import { CaptchaSolveOptions, CaptchaSolveResult } from '../types';
import { solveCaptchaWithGemini } from './geminiCaptchaSolver';
import { solveCaptchaWithTesseract, terminateTesseract } from './tesseractCaptchaSolver';

export class CaptchaSolver {
  /**
   * Cố gắng giải bằng Tesseract cục bộ trước (Miễn phí, không tốn quota),
   * nếu lỗi hoặc không ra kết quả thì có thể fallback sang Gemini.
   */
  public static async solveWithAI(
    imageInput: Buffer | string | Uint8Array,
    options?: CaptchaSolveOptions
  ): Promise<CaptchaSolveResult | null> {
    const startTime = Date.now();
    try {
      // 1. Thử dùng Tesseract cục bộ trước
      const tesseractRes = await solveCaptchaWithTesseract(imageInput, {
        digitsOnly: options?.alphanumeric !== true,
        timeoutMs: options?.timeoutMs || 3000,
        preprocessEasyInvoice: true,
      });

      if (tesseractRes && tesseractRes.code && tesseractRes.code.length >= 3) {
        return {
          code: tesseractRes.code,
          confidence: tesseractRes.confidence,
          engine: 'tesseract-local',
          processingTimeMs: Date.now() - startTime,
        };
      }
    } catch (e) {
      // Bỏ qua lỗi Tesseract để chuyển sang fallback Gemini nếu cần
    }

    // 2. Fallback sang Gemini nếu Tesseract không đọc được
    try {
      const code = await solveCaptchaWithGemini(imageInput, options?.prompt, { timeoutMs: options?.timeoutMs });
      return {
        code,
        confidence: 99,
        engine: 'gemini',
        processingTimeMs: Date.now() - startTime,
      };
    } catch {
      return null;
    }
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
      throw new Error('[CaptchaSolver] Không thể giải Captcha bằng cả Tesseract lẫn Gemini.');
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
