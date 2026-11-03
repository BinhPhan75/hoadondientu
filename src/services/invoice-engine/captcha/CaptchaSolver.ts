import { CaptchaSolveOptions, CaptchaSolveResult } from '../types';
import { solveCaptchaWithGemini } from './geminiCaptchaSolver';

export class CaptchaSolver {
  public static async solveWithAI(
    imageInput: Buffer | string | Uint8Array,
    options?: CaptchaSolveOptions
  ): Promise<CaptchaSolveResult | null> {
    try {
      const startTime = Date.now();
      const code = await solveCaptchaWithGemini(imageInput, options?.prompt);
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
    const startTime = Date.now();
    if (!imageInput) {
      throw new Error('[CaptchaSolver] Dữ liệu ảnh Captcha rỗng.');
    }

    try {
      const code = await solveCaptchaWithGemini(imageInput, options?.prompt);
      return {
        code,
        confidence: 99,
        engine: 'gemini',
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      throw new Error(`Không thể giải Captcha bằng Gemini: ${error?.message || error}`);
    }
  }

  public static async resetWorker(): Promise<void> {
    // Kept for API compatibility. Gemini is request-based and has no local worker.
  }

  public static async terminate(): Promise<void> {
    // Kept for API compatibility. Gemini is request-based and has no local worker.
  }
}
