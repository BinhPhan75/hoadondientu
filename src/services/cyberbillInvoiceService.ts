/**
 * CyberBill Invoice Service (CyberLotus - bill1app.xcyber.vn / cyberbill.vn)
 * Tự động giải Captcha bằng Gemini AI & Tải file PDF hóa đơn gốc từ cổng CyberBill.
 */

import { GoogleGenAI } from '@google/genai';
import { solveCaptchaWithGemini } from './invoice-engine/captcha/geminiCaptchaSolver';
import { solveCaptchaWithTesseract } from './invoice-engine/captcha/tesseractCaptchaSolver';

export const CYBERBILL_PORTAL_URL = 'https://cyberbill.vn/tra-cuu';
const CYBERBILL_API_BASE = 'https://bill1app.xcyber.vn/api/services/hddt/TraCuuHoaDon';

export interface CyberBillDownloadParams {
  sellerTaxCode: string;
  lookupCode: string;
  invoiceNo?: string;
  invoiceSeries?: string;
  customApiKey?: string;
}

export interface CyberBillDownloadResult {
  success: boolean;
  filename: string;
  contentType: string;
  pdfBuffer: Buffer;
  pdfBase64: string;
  sourceUrl: string;
  htmlContent?: string;
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
 * Giải captcha CyberBill bằng Gemini AI hoặc Tesseract OCR
 */
async function solveCyberBillCaptcha(imageDataUri: string, customApiKey?: string): Promise<string> {
  const ai = getGenAI(customApiKey);
  if (ai) {
    try {
      const match = imageDataUri.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      const mimeType = match ? match[1] : 'image/jpeg';
      const base64Data = match ? match[2] : imageDataUri;

      const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'];
      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data
                }
              },
              {
                text: 'This is a captcha image from CyberBill e-invoice portal. Extract and return ONLY the 4 to 6 uppercase alphanumeric characters shown in the image. Return only the exact characters without spaces, markdown, or punctuation.'
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
      imageDataUri,
      'This is a captcha image. Extract and return ONLY the 4 to 6 alphanumeric characters without spaces.'
    );
    const cleaned = code.replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
    if (cleaned.length >= 4) return cleaned;
  } catch {
    // try tesseract
  }

  try {
    const tResult = await solveCaptchaWithTesseract(imageDataUri);
    const cleaned = tResult.code.replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
    if (cleaned.length >= 4) return cleaned;
  } catch {
    // ignore
  }

  return '';
}

/**
 * Tra cứu và tải hóa đơn gốc từ cổng CyberBill (CyberLotus)
 */
export async function downloadOriginalCyberbillPdf(
  params: CyberBillDownloadParams
): Promise<CyberBillDownloadResult> {
  const sellerTaxCode = params.sellerTaxCode.trim();
  const lookupCode = params.lookupCode.trim();
  const invoiceNo = (params.invoiceNo || '1').padStart(7, '0');
  const invoiceSeries = params.invoiceSeries || 'CYBERBILL';

  let lastError = 'Không thể kết nối đến cổng tra cứu CyberBill';
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[CyberBill] Lần thử ${attempt}/${maxAttempts}: Khởi tạo phiên tra cứu và lấy Captcha...`);

      // 1. Refresh Captcha
      const capResp = await fetch(`${CYBERBILL_API_BASE}/RefreshCaptcha`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({})
      });

      if (!capResp.ok) {
        throw new Error(`Cổng CyberBill trả về HTTP ${capResp.status}`);
      }

      const capData = await capResp.json();
      const captchaKey = capData?.result?.key;
      const captchaImage = capData?.result?.image;

      if (!captchaKey || !captchaImage) {
        throw new Error('Không nhận được mã phiên Captcha từ CyberBill');
      }

      // 2. Giải Captcha
      const captchaCode = await solveCyberBillCaptcha(captchaImage, params.customApiKey);
      if (!captchaCode) {
        console.warn(`[CyberBill] Lần ${attempt}: Không giải được Captcha, thử lại với ảnh mới...`);
        continue;
      }

      console.log(`[CyberBill] Lần ${attempt}: Đã giải Captcha thành công -> "${captchaCode}". Thực hiện tra cứu...`);

      // 3. Tra cứu hóa đơn
      const traCuuResp = await fetch(`${CYBERBILL_API_BASE}/TraCuu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://cyberbill.vn/'
        },
        body: JSON.stringify({
          key: captchaKey,
          captcha: captchaCode,
          doanhNghiep_MST: sellerTaxCode,
          maSoBiMat: lookupCode
        })
      });

      if (!traCuuResp.ok) {
        throw new Error(`TraCuu trả về lỗi HTTP ${traCuuResp.status}`);
      }

      const traCuuData = await traCuuResp.json();
      const result = traCuuData?.result;

      if (!result) {
        throw new Error('Không nhận được dữ liệu phản hồi từ CyberBill');
      }

      // Kiểm tra lỗi Captcha sai để retry
      if (result.status === 2 && result.message && result.message.includes('xác thực không hợp lệ')) {
        console.warn(`[CyberBill] Lần ${attempt}: Mã xác thực sai, làm mới Captcha...`);
        lastError = 'Mã Captcha nhận diện chưa khớp';
        continue;
      }

      if (result.message && (result.message.includes('không tìm thấy') || result.message.includes('không tồn tại'))) {
        throw new Error(`Cổng CyberBill phản hồi: ${result.message}`);
      }

      let pdfBase64 = '';
      let htmlContent = result.html || '';

      // 4. Tải file PDF chính thức
      console.log(`[CyberBill] Đang tải file PDF gốc qua DownloadPdf...`);
      const downloadResp = await fetch(`${CYBERBILL_API_BASE}/DownloadPdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://cyberbill.vn/'
        },
        body: JSON.stringify({
          key: captchaKey,
          doanhNghiep_MST: sellerTaxCode,
          maSoBiMat: lookupCode
        })
      });

      if (downloadResp.ok) {
        const downloadData = await downloadResp.json();
        if (downloadData?.result?.fileData) {
          pdfBase64 = downloadData.result.fileData;
        }
      }

      // Nếu DownloadPdf chưa có fileData, kiểm tra base64 trong kết quả TraCuu
      if (!pdfBase64 && result.base64) {
        pdfBase64 = result.base64;
      }

      if (!pdfBase64 && !htmlContent) {
        throw new Error(result.message || 'Không nhận được dữ liệu tệp PDF hoặc HTML từ CyberBill.');
      }

      let pdfBuffer: Buffer;
      if (pdfBase64) {
        pdfBuffer = Buffer.from(pdfBase64, 'base64');
      } else {
        // Nếu chỉ có HTML, tạo buffer từ HTML
        pdfBuffer = Buffer.from(htmlContent, 'utf-8');
      }

      const cleanFilename = `HoaDon_CyberBill_${sellerTaxCode}_${invoiceSeries}_${invoiceNo}.pdf`;

      return {
        success: true,
        filename: cleanFilename,
        contentType: 'application/pdf',
        pdfBuffer,
        pdfBase64: pdfBuffer.toString('base64'),
        sourceUrl: CYBERBILL_PORTAL_URL,
        htmlContent
      };
    } catch (err: any) {
      console.error(`[CyberBill] Lỗi lần ${attempt}:`, err.message);
      lastError = err.message;
    }
  }

  throw new Error(`Tải hóa đơn CyberBill thất bại sau ${maxAttempts} lần thử: ${lastError}`);
}
