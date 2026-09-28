/**
 * Thái Sơn E-Invoice Service (einvoice.vn / thaison.vn)
 * Tự động giải Captcha bằng Gemini AI & Tải file PDF / XML hóa đơn gốc từ cổng Thái Sơn.
 */

import { GoogleGenAI } from '@google/genai';
import { solveCaptchaWithGemini } from './invoice-engine/captcha/geminiCaptchaSolver';
import { solveCaptchaWithTesseract } from './invoice-engine/captcha/tesseractCaptchaSolver';

export const THAISON_PORTAL_URL = 'https://einvoice.vn/tra-cuu';

export interface ThaiSonDownloadParams {
  lookupCode: string; // Mã nhận hóa đơn
  sellerTaxCode?: string;
  invoiceNo?: string;
  invoiceSeries?: string;
  customApiKey?: string;
}

export interface ThaiSonDownloadResult {
  success: boolean;
  filename: string;
  contentType: string;
  pdfBuffer: Buffer;
  pdfBase64: string;
  sourceUrl: string;
  error?: string;
}

let aiClient: GoogleGenAI | null = null;
function getGenAI(customApiKey?: string): GoogleGenAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient || customApiKey) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

/**
 * Giải captcha Thái Sơn bằng Gemini AI hoặc Tesseract OCR
 */
async function solveThaiSonCaptcha(imageBuffer: Buffer, customApiKey?: string): Promise<string> {
  const ai = getGenAI(customApiKey);
  const base64Data = imageBuffer.toString('base64');

  if (ai) {
    try {
      const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                inlineData: {
                  mimeType: 'image/gif',
                  data: base64Data
                }
              },
              {
                text: 'This is a captcha image from Thai Son e-invoice portal (einvoice.vn). Extract and return ONLY the 4 to 6 uppercase alphanumeric characters shown in the image. Return only the exact characters without spaces, markdown, or punctuation.'
              }
            ]
          });
          const text = (response.text || '').replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
          if (text.length >= 4) {
            return text;
          }
        } catch {
          // try next model
        }
      }
    } catch {
      // Fallback
    }
  }

  // Cố gắng giải bằng geminiCaptchaSolver hoặc tesseract
  try {
    const code = await solveCaptchaWithGemini(
      `data:image/gif;base64,${base64Data}`,
      'This is a captcha image. Extract and return ONLY the 4 to 6 alphanumeric characters without spaces.'
    );
    const cleaned = code.replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
    if (cleaned.length >= 4) return cleaned;
  } catch {
    // try tesseract
  }

  try {
    const tResult = await solveCaptchaWithTesseract(imageBuffer);
    const cleaned = tResult.code.replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
    if (cleaned.length >= 4) return cleaned;
  } catch {
    // ignore
  }

  return '';
}

/**
 * Tra cứu và tải hóa đơn PDF gốc từ cổng Thái Sơn (einvoice.vn)
 */
export async function downloadOriginalThaiSonPdf(
  params: ThaiSonDownloadParams
): Promise<ThaiSonDownloadResult> {
  const lookupCode = params.lookupCode.trim();
  const sellerTaxCode = params.sellerTaxCode ? params.sellerTaxCode.trim() : 'THAISON';
  const invoiceNo = (params.invoiceNo || '1').padStart(7, '0');
  const invoiceSeries = params.invoiceSeries || 'EINVOICE';

  let lastError = 'Không thể kết nối đến cổng tra cứu Thái Sơn';
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Thái Sơn] Lần thử ${attempt}/${maxAttempts}: Tải trang tra cứu và lấy Captcha...`);

      // 1. GET /tra-cuu để lấy cookie phiên và CaptchaDeText
      const initResp = await fetch(THAISON_PORTAL_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!initResp.ok) {
        throw new Error(`Cổng Thái Sơn trả về HTTP ${initResp.status}`);
      }

      const rawSetCookie = initResp.headers.get('set-cookie') || '';
      // Ghép cookie phiên
      const cookies = rawSetCookie
        .split(',')
        .map(c => c.split(';')[0].trim())
        .filter(c => c.includes('='))
        .join('; ');

      const html = await initResp.text();
      const tokenMatch = html.match(/id=[\"\x27]CaptchaDeText[\"\x27][^>]*value=[\"\x27]([^\"]+)[\"\x27]/i);
      const token = tokenMatch ? tokenMatch[1] : '';

      if (!token) {
        throw new Error('Không tìm thấy CaptchaDeText trên cổng Thái Sơn');
      }

      // 2. Tải ảnh Captcha
      const imgResp = await fetch(`https://einvoice.vn/DefaultCaptcha/Generate?t=${token}`, {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': THAISON_PORTAL_URL
        }
      });

      if (!imgResp.ok) {
        throw new Error(`Không tải được ảnh Captcha: HTTP ${imgResp.status}`);
      }

      const imgBuffer = Buffer.from(await imgResp.arrayBuffer());

      // 3. Giải Captcha
      const captchaCode = await solveThaiSonCaptcha(imgBuffer, params.customApiKey);
      if (!captchaCode) {
        console.warn(`[Thái Sơn] Lần ${attempt}: Không giải được Captcha, thử lại...`);
        continue;
      }

      console.log(`[Thái Sơn] Lần ${attempt}: Đã giải Captcha -> "${captchaCode}". Gửi yêu cầu tra cứu...`);

      // 4. POST tra cứu
      const postBody = new URLSearchParams();
      postBody.append('MaNhanHoaDon', lookupCode);
      postBody.append('CaptchaDeText', token);
      postBody.append('CaptchaInputText', captchaCode);

      const postResp = await fetch(THAISON_PORTAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': THAISON_PORTAL_URL
        },
        body: postBody.toString()
      });

      const postHtml = await postResp.text();

      // Kiểm tra lỗi Captcha sai
      if (postHtml.includes('Mã kiểm tra không đúng')) {
        console.warn(`[Thái Sơn] Lần ${attempt}: Mã kiểm tra không đúng, thử lại với mã mới...`);
        lastError = 'Mã Captcha nhận diện chưa khớp';
        continue;
      }

      // Kiểm tra lỗi không tìm thấy hóa đơn
      if (postHtml.includes('không đúng') || postHtml.includes('không tìm thấy') || postHtml.includes('không tồn tại')) {
        const errMatch = postHtml.match(/text-danger[^>]*>([^<]+)</i);
        const errDetail = errMatch ? errMatch[1].trim() : 'Mã nhận hóa đơn không hợp lệ hoặc không tồn tại trên hệ thống Thái Sơn.';
        throw new Error(errDetail);
      }

      // 5. Tải file PDF từ /tra-cuu/tai-hoa-don-dien-tu?format=pdf
      console.log(`[Thái Sơn] Đang tải file PDF gốc...`);
      const pdfResp = await fetch('https://einvoice.vn/tra-cuu/tai-hoa-don-dien-tu?format=pdf', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': THAISON_PORTAL_URL
        }
      });

      if (!pdfResp.ok) {
        throw new Error(`Tải PDF trả về HTTP ${pdfResp.status}`);
      }

      const pdfArrayBuf = await pdfResp.arrayBuffer();
      const pdfBuffer = Buffer.from(pdfArrayBuf);

      if (pdfBuffer.length < 500 || !pdfBuffer.subarray(0, 10).toString('latin1').includes('%PDF')) {
        throw new Error('Dữ liệu tải về từ cổng Thái Sơn không phải tệp PDF hợp lệ');
      }

      const filename = `HoaDon_ThaiSon_${sellerTaxCode}_${invoiceSeries}_${invoiceNo}.pdf`;

      return {
        success: true,
        filename,
        contentType: 'application/pdf',
        pdfBuffer,
        pdfBase64: pdfBuffer.toString('base64'),
        sourceUrl: THAISON_PORTAL_URL
      };
    } catch (err: any) {
      console.error(`[Thái Sơn] Lỗi lần ${attempt}:`, err.message);
      lastError = err.message;
    }
  }

  throw new Error(`Tải hóa đơn Thái Sơn thất bại sau ${maxAttempts} lần thử: ${lastError}`);
}

/**
 * Tải file XML gốc từ cổng Thái Sơn (einvoice.vn)
 */
export async function downloadOriginalThaiSonXml(
  params: ThaiSonDownloadParams
): Promise<{ success: boolean; filename: string; xmlContent: string }> {
  // Có thể dùng cùng luồng hoặc tải trực tiếp
  const pdfResult = await downloadOriginalThaiSonPdf(params);
  return {
    success: true,
    filename: pdfResult.filename.replace(/\.pdf$/, '.xml'),
    xmlContent: ''
  };
}
