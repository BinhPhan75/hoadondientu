import axios from 'axios';
import * as cheerio from 'cheerio';
import zlib from 'zlib';
import JSZip from 'jszip';
import Tesseract from 'tesseract.js';
import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

/**
 * Giải mã ảnh PNG RGBA chuẩn từ ASP.NET Captcha
 */
function decodePngRgba(buf: Buffer): { width: number; height: number; data: Buffer } {
  let offset = 8;
  const idatChunks: Buffer[] = [];
  let width = 0;
  let height = 0;

  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString('ascii');
    if (type === 'IHDR') {
      width = buf.readUInt32BE(offset + 8);
      height = buf.readUInt32BE(offset + 12);
    } else if (type === 'IDAT') {
      idatChunks.push(buf.slice(offset + 8, offset + 8 + len));
    }
    offset += 12 + len;
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  const rawRgba = Buffer.alloc(width * height * 4);
  const stride = width * 4 + 1;
  const prevRow = Buffer.alloc(width * 4);

  for (let y = 0; y < height; y++) {
    const filter = decompressed[y * stride];
    const rowOffset = y * stride + 1;
    const destOffset = y * width * 4;

    for (let x = 0; x < width * 4; x++) {
      const bpp = 4;
      const raw = decompressed[rowOffset + x];
      const a = x >= bpp ? rawRgba[destOffset + x - bpp] : 0;
      const b = prevRow[x];
      const c = x >= bpp ? prevRow[x - bpp] : 0;

      let val = raw;
      if (filter === 1) {
        val = (raw + a) & 0xff;
      } else if (filter === 2) {
        val = (raw + b) & 0xff;
      } else if (filter === 3) {
        val = (raw + Math.floor((a + b) / 2)) & 0xff;
      } else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        val = (raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
      rawRgba[destOffset + x] = val;
      prevRow[x] = val;
    }
  }

  return { width, height, data: rawRgba };
}

/**
 * Tiền xử lý ảnh Captcha EasyInvoice:
 * - Cắt bớt dải đen/gradient mép trái (x: 30 -> 140)
 * - Phóng to 3x để Tesseract OCR nhận diện nét chữ tốt nhất
 * - Binarize & Đảo ngược màu: Chữ sáng -> đen, Nền tối -> trắng
 * - Xuất ra file BMP 24-bit không nén
 */
function createBinarizedBmp(decoded: { width: number; height: number; data: Buffer }, scale = 3): Buffer {
  const { width, height, data } = decoded;
  const cropX1 = 30;
  const cropX2 = Math.min(142, width);
  const cropW = cropX2 - cropX1;
  const cropH = height;

  const newW = cropW * scale;
  const newH = cropH * scale;
  const rowSize = Math.floor((24 * newW + 31) / 32) * 4;
  const imageSize = rowSize * newH;
  const fileSize = 54 + imageSize;

  const bmp = Buffer.alloc(fileSize);
  bmp.write('BM', 0);
  bmp.writeUInt32LE(fileSize, 2);
  bmp.writeUInt32LE(54, 10);
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(newW, 18);
  bmp.writeInt32LE(newH, 22);
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  bmp.writeUInt32LE(0, 30);
  bmp.writeUInt32LE(imageSize, 34);

  for (let destY = 0; destY < newH; destY++) {
    const srcY = Math.floor((newH - 1 - destY) / scale);
    const rowStart = 54 + destY * rowSize;

    for (let destX = 0; destX < newW; destX++) {
      const srcX = cropX1 + Math.floor(destX / scale);
      const srcIdx = (srcY * width + srcX) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const lum = r * 0.299 + g * 0.587 + b * 0.114;

      const isText = lum > 140;
      const val = isText ? 0 : 255; // 0 = Black (Text), 255 = White (Background)

      const pxOffset = rowStart + destX * 3;
      bmp[pxOffset] = val;
      bmp[pxOffset + 1] = val;
      bmp[pxOffset + 2] = val;
    }
  }

  return bmp;
}

/**
 * Giải Captcha EasyInvoice bằng Tesseract.js (kết hợp AI fallback nếu cần)
 */
export async function solveEasyInvoiceCaptcha(captchaBuf: Buffer): Promise<{ code: string; confidence: number; engine: string }> {
  try {
    const decoded = decodePngRgba(captchaBuf);
    const bmp = createBinarizedBmp(decoded, 3);

    const worker = await Tesseract.createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
    });

    const res = await worker.recognize(bmp);
    await worker.terminate();

    const digits = (res.data.text || '').replace(/[^0-9]/g, '');
    const confidence = res.data.confidence || 0;

    if (digits.length === 4 && confidence >= 60) {
      console.log(`[EasyInvoice] Tesseract OCR giải Captcha thành công: "${digits}" (${confidence}%)`);
      return { code: digits, confidence, engine: 'tesseract' };
    }
    console.log(`[EasyInvoice] Tesseract OCR kết quả chưa chắc chắn: "${digits}" (${confidence}%), thử giải bằng Gemini Vision...`);
  } catch (tessErr: any) {
    console.warn('[EasyInvoice] Tesseract lỗi tiền xử lý:', tessErr.message);
  }

  // AI Fallback (Gemini Vision) nếu có API key
  const ai = getGenAI();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: captchaBuf.toString('base64'),
                },
              },
              {
                text: 'Hãy đọc 4 chữ số xuất hiện trong ảnh captcha này. Chỉ trả về đúng 4 chữ số, không thêm bất kỳ chữ nào khác.',
              },
            ],
          },
        ],
      });
      const aiDigits = (response.text || '').replace(/[^0-9]/g, '').trim();
      if (aiDigits.length === 4) {
        console.log(`[EasyInvoice] Gemini Vision giải Captcha thành công: "${aiDigits}"`);
        return { code: aiDigits, confidence: 99, engine: 'gemini' };
      }
    } catch (aiErr: any) {
      console.warn('[EasyInvoice] Gemini Vision giải captcha lỗi:', aiErr.message);
    }
  }

  return { code: '', confidence: 0, engine: 'none' };
}

export interface EasyInvoiceDownloadParams {
  lookupCode: string;
  sellerTaxCode?: string;
  lookupUrl?: string;
  khhdon?: string;
  shdon?: string;
  viewOnly?: boolean;
}

export interface EasyInvoiceDownloadResult {
  success: boolean;
  filename: string;
  contentType: string;
  buffer: Buffer;
  pdfBase64?: string;
  htmlContent?: string;
  message?: string;
}

/**
 * Tải hóa đơn gốc từ Cổng EasyInvoice với cơ chế tự động giải Captcha
 */
export async function downloadOriginalEasyInvoice(
  params: EasyInvoiceDownloadParams
): Promise<EasyInvoiceDownloadResult> {
  const { lookupCode, sellerTaxCode, lookupUrl, khhdon, shdon } = params;

  if (!lookupCode) {
    throw new Error('Mã tra cứu hóa đơn EasyInvoice (FKey) không được để trống.');
  }

  // Xác định domain Cổng EasyInvoice
  let domain = '';
  if (lookupUrl && /easyinvoice\.com\.vn|easyinvoice\.vn/i.test(lookupUrl)) {
    try {
      const parsedUrl = new URL(lookupUrl);
      domain = `${parsedUrl.protocol}//${parsedUrl.host}`;
    } catch {
      // Bỏ qua nếu url không chuẩn
    }
  }

  if (!domain && sellerTaxCode) {
    domain = `http://${sellerTaxCode.trim()}hd.easyinvoice.com.vn`;
  }

  if (!domain) {
    domain = 'https://tracuu.easyinvoice.vn';
  }

  console.log(`[EasyInvoice] Khởi động tải HĐ gốc: FKey="${lookupCode}", MST="${sellerTaxCode || ''}", Cổng="${domain}"`);

  const maxRetries = 3;
  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[EasyInvoice] Lần thử ${attempt}/${maxRetries}: Lấy Captcha từ ${domain}/Captcha/Show...`);

      const cRes = await axios.get(`${domain}/Captcha/Show`, {
        responseType: 'arraybuffer',
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Referer': `${domain}/Search/Index`,
        },
      });

      const cookie = cRes.headers['set-cookie']
        ? (Array.isArray(cRes.headers['set-cookie']) ? cRes.headers['set-cookie'].join('; ') : cRes.headers['set-cookie'])
        : '';

      const captchaBuf = Buffer.from(cRes.data);
      const { code, confidence, engine } = await solveEasyInvoiceCaptcha(captchaBuf);

      if (!code || code.length !== 4) {
        console.warn(`[EasyInvoice] Chưa đọc được mã 4 số ở lần thử ${attempt}. Tiếp tục thử lại...`);
        continue;
      }

      console.log(`[EasyInvoice] Đã giải Captcha: "${code}" (Engine: ${engine}, Độ tin cậy: ${confidence}%). Gửi yêu cầu tìm kiếm...`);

      const postRes = await axios.post(
        `${domain}/Search/Search`,
        `typeSearch=&FKey=${encodeURIComponent(lookupCode.trim())}&Capcha=${encodeURIComponent(code)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookie,
            'Referer': `${domain}/Search/Index?fkey=${encodeURIComponent(lookupCode.trim())}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          },
          timeout: 12000,
        }
      );

      const $ = cheerio.load(postRes.data);
      const msg = $('#msg').val() as string;

      if (msg) {
        console.warn(`[EasyInvoice] Thông báo từ cổng: "${msg}"`);
        if (msg.includes('Mã xác thực không chính xác') || msg.includes('sai mã xác thực') || msg.includes('captcha')) {
          console.log('[EasyInvoice] Sai Captcha, thử lại...');
          continue;
        }
        if (msg.includes('Không tìm thấy') || msg.includes('không tồn tại')) {
          throw new Error(`Cổng EasyInvoice thông báo: ${msg}`);
        }
      }

      const invDataStr = $('#InvData').val() as string;
      if (!invDataStr) {
        // Có thể mã captcha sai nhưng không báo rõ
        console.warn(`[EasyInvoice] Không nhận được InvData ở lần thử ${attempt}.`);
        continue;
      }

      let invData: any = {};
      try {
        invData = JSON.parse(invDataStr);
      } catch (e: any) {
        console.error('[EasyInvoice] Không thể parse InvData JSON:', e.message);
      }

      // Trích xuất token từ script showInv(..., 'token')
      const scriptMatch = postRes.data.match(/showInv\([^;]+,\s*'([^']+)'\);/);
      const token = scriptMatch ? scriptMatch[1] : '';

      const invoiceHtml = invData.str || '';
      const b64Html = Buffer.from(invoiceHtml, 'utf-8').toString('base64');

      let downloadFileName = `HOADON_${sellerTaxCode || 'EASYINVOICE'}_${khhdon || 'HD'}_${shdon || lookupCode}`;

      // The provider's HTML is the authoritative invoice presentation. Return
      // it before PDF generation when the UI requests an original view.
      if (params.viewOnly && invoiceHtml) {
        return {
          success: true,
          filename: `${downloadFileName}.html`,
          contentType: 'text/html',
          buffer: Buffer.from(invoiceHtml, 'utf-8'),
          htmlContent: invoiceHtml,
          message: 'Đã tra cứu và nhận bản thể hiện gốc EasyInvoice.'
        };
      }

      // Thử gọi endpoint tải PDF chính thức từ server EasyInvoice
      if (token && b64Html) {
        try {
          console.log('[EasyInvoice] Gọi API tạo gói PDF chính thức...');
          const pdfGenRes = await axios.post(
            `${domain}/Invoice/DownloadPdfAndFileAttachFromAvailableHtml`,
            new URLSearchParams({ token, html: b64Html }).toString(),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookie,
                'Referer': `${domain}/Search/Index`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
              },
              timeout: 15000,
            }
          );

          if (pdfGenRes.data && pdfGenRes.data.fileGuid) {
            const dlFileName = pdfGenRes.data.fileName || `${downloadFileName}.zip`;
            const dlUrl = `${domain}/Invoice/Download?fileGuid=${encodeURIComponent(pdfGenRes.data.fileGuid)}&fileName=${encodeURIComponent(dlFileName)}`;
            console.log(`[EasyInvoice] Tải file từ: ${dlUrl}`);

            const dlRes = await axios.get(dlUrl, {
              headers: { 'Cookie': cookie },
              responseType: 'arraybuffer',
              timeout: 15000,
            });

            const downloadedBuf = Buffer.from(dlRes.data);

            // Kiểm tra xem file tải về có phải là ZIP không
            if (downloadedBuf.length > 4 && downloadedBuf[0] === 0x50 && downloadedBuf[1] === 0x4B) {
              // Giải nén ZIP bằng JSZip để lấy trực tiếp file PDF bên trong
              try {
                const zip = new JSZip();
                const unzipped = await zip.loadAsync(downloadedBuf);
                const pdfFile = Object.values(unzipped.files).find(f => !f.dir && f.name.toLowerCase().endsWith('.pdf'));

                if (pdfFile) {
                  const pdfBuf = await pdfFile.async('nodebuffer');
                  console.log(`[EasyInvoice] Đã trích xuất thành công PDF "${pdfFile.name}" (${(pdfBuf.length / 1024).toFixed(1)} KB)`);
                  return {
                    success: true,
                    filename: pdfFile.name,
                    contentType: 'application/pdf',
                    buffer: pdfBuf,
                    pdfBase64: pdfBuf.toString('base64'),
                    htmlContent: invoiceHtml,
                  };
                }
              } catch (zipErr: any) {
                console.warn('[EasyInvoice] Không thể giải nén ZIP, gửi nguyên file ZIP:', zipErr.message);
              }

              // Trả về file ZIP nếu không giải nén được hoặc có nhiều file đính kèm
              return {
                success: true,
                filename: dlFileName,
                contentType: 'application/x-zip-compressed',
                buffer: downloadedBuf,
                pdfBase64: downloadedBuf.toString('base64'),
                htmlContent: invoiceHtml,
              };
            } else if (downloadedBuf.toString('utf-8', 0, 5).startsWith('%PDF')) {
              // Là file PDF trực tiếp
              return {
                success: true,
                filename: `${downloadFileName}.pdf`,
                contentType: 'application/pdf',
                buffer: downloadedBuf,
                pdfBase64: downloadedBuf.toString('base64'),
                htmlContent: invoiceHtml,
              };
            }
          }
        } catch (pdfErr: any) {
          console.warn('[EasyInvoice] Không thể tải PDF qua DownloadPdfAndFileAttachFromAvailableHtml:', pdfErr.message);
        }
      }

      // Nếu có invoiceHtml từ InvData, trả về bản thể hiện HTML gốc
      if (invoiceHtml) {
        console.log(`[EasyInvoice] Trả về bản thể hiện HTML gốc EasyInvoice (${(invoiceHtml.length / 1024).toFixed(1)} KB)`);
        return {
          success: true,
          filename: `${downloadFileName}.html`,
          contentType: 'text/html',
          buffer: Buffer.from(invoiceHtml, 'utf-8'),
          htmlContent: invoiceHtml,
        };
      }
    } catch (err: any) {
      lastError = err.message;
      console.warn(`[EasyInvoice] Lỗi ở lần thử ${attempt}:`, err.message);
    }
  }

  throw new Error(lastError || 'Không thể tự động vượt Captcha và tải hóa đơn gốc từ Cổng EasyInvoice sau 3 lần thử.');
}
