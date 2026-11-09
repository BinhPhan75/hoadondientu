import { CaptchaSolveOptions, CaptchaSolveResult } from '../types';
import { solveCaptchaWithGemini } from './geminiCaptchaSolver';
import { solveCaptchaWithTesseract, terminateTesseract } from './tesseractCaptchaSolver';

export class CaptchaSolver {
  /**
   * Ưu tiên giải mã cục bộ bằng Tesseract (Miễn phí 100%, chạy offline),
   * nếu thất bại mới tự động chuyển sang Gemini API làm phương án dự phòng.
   * Nếu có cờ forceGemini (ví dụ khi GDT từ chối mã từ OCR local ở lần trước),
   * sẽ bỏ qua Tesseract và dùng ngay Gemini API trên CAPTCHA mới.
   */
  public static async solveWithAI(
    imageInput: Buffer | string | Uint8Array,
    options?: CaptchaSolveOptions
  ): Promise<CaptchaSolveResult | null> {
    const startTime = Date.now();
    
    // 1. ƯU TIÊN SỐ 1: Chạy Tesseract local OCR
    if (!options?.forceGemini || options?.alphanumeric) {
      try {
        const tesseractRes = await solveCaptchaWithTesseract(imageInput, {
          digitsOnly: options?.alphanumeric !== true,
          whitelist: options?.whitelist || (options?.alphanumeric ? '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '0123456789'),
          timeoutMs: options?.timeoutMs || 4000,
          preprocessEasyInvoice: options?.preprocessEasyInvoice === true,
          preprocessPosCaptcha: options?.alphanumeric === true,
        });

        const localCode = (tesseractRes?.code || '').trim().toUpperCase();
        const validLocalCode = options?.alphanumeric
          ? /^[A-Z0-9]{4,6}$/.test(localCode)
          : /^[0-9]{3,6}$/.test(localCode);
        if (validLocalCode) {
          console.log(`[CaptchaSolver] Tesseract local giải thành công: "${localCode}" (độ tin cậy: ${Math.round(tesseractRes.confidence)}%)`);
          return {
            code: localCode,
            confidence: tesseractRes.confidence,
            engine: 'tesseract-local',
            processingTimeMs: Date.now() - startTime,
          };
        }
      } catch (error: any) {
        console.warn('[CaptchaSolver] Tesseract local OCR không nhận diện được:', error?.message || error);
      }
    }

    // 2. Đối với Hóa đơn máy tính tiền (alphanumeric): TUYỆT ĐỐI BỎ GỌI GEMINI API
    // Hoàn toàn dựa vào công nghệ Local OCR (Template Matching Client + Tesseract Local),
    // nếu không tự đọc được thì chuyển thẳng sang luồng người dùng nhập tay.
    if (options?.alphanumeric || options?.localOnly) {
      console.info('[CaptchaSolver] Không gọi Gemini API cho CAPTCHA máy tính tiền; kết thúc luồng OCR cục bộ để chuyển nhập tay.');
      return null;
    }

    // 3. Fallback Gemini API CHỈ dành cho các loại hóa đơn khác ngoài máy tính tiền (như EasyInvoice số hoặc VNPT nếu có key)
    try {
      const code = await solveCaptchaWithGemini(imageInput, options?.prompt, {
        timeoutMs: Math.max(options?.timeoutMs || 25000, 15000),
        customApiKey: options?.customApiKey,
        alphanumeric: false,
      });
      if (code) {
        console.log(`[CaptchaSolver] Gemini API giải thành công: "${code}"`);
        return {
          code,
          confidence: 99,
          engine: 'gemini',
          processingTimeMs: Date.now() - startTime,
        };
      }
    } catch (error: any) {
      console.warn('[CaptchaSolver] Gemini CAPTCHA fallback không thành công:', error?.message || error);
      return null;
    }

    return null;
  }

  public static isValidImageBuffer(buf: Buffer | Uint8Array): boolean {
    if (!buf || buf.length < 8) return false;
    const image = Buffer.from(buf);
    return (
      (image[0] === 0x89 && image[1] === 0x50 && image[2] === 0x4e && image[3] === 0x47) ||
      (image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) ||
      (image[0] === 0x47 && image[1] === 0x49 && image[2] === 0x46) ||
      (image[0] === 0x42 && image[1] === 0x4d) ||
      (image[0] === 0x52 && image[1] === 0x49 && image[2] === 0x46 && image[3] === 0x46)
    );
  }

  public static async solve(
    imageInput: Buffer | string | Uint8Array,
    options?: CaptchaSolveOptions
  ): Promise<string> {
    const result = await this.solveWithDetails(imageInput, options);
    return result.code;
  }

  public static async solveWithDetails(
    imageInput: Buffer | string | Uint8Array,
    options?: CaptchaSolveOptions
  ): Promise<CaptchaSolveResult> {
    const res = await this.solveWithAI(imageInput, options);
    if (!res || !res.code) {
      throw new Error('[CaptchaSolver] Không thể nhận diện mã Captcha bằng bộ xử lý OCR cục bộ.');
    }
    return res;
  }

  public static async resetWorker(): Promise<void> {
    await terminateTesseract();
  }

  public static async terminate(): Promise<void> {
    await terminateTesseract();
  }
}
