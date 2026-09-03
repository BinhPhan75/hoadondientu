/**
 * CaptchaSolver: Module giải Captcha tự động bằng OCR cho Hóa đơn điện tử
 * Sử dụng thư viện Tesseract.js chuyên dụng cho Node.js / TypeScript
 * Hỗ trợ nhận diện ảnh Captcha dạng Buffer, Stream, Base64 URI, hoặc SVG
 * Tích hợp kiểm tra Magic Bytes để tránh lỗi định dạng không hợp lệ từ máy chủ
 */

import { createWorker, Worker } from 'tesseract.js';
import { CaptchaSolveOptions, CaptchaSolveResult } from '../types';

export class CaptchaSolver {
  private static workerInstance: Worker | null = null;
  private static isInitializing = false;
  private static initPromise: Promise<Worker> | null = null;

  /**
   * Khởi tạo hoặc lấy worker Tesseract.js dạng Singleton để tối ưu hiệu năng
   */
  public static async getWorker(lang = 'eng'): Promise<Worker> {
    if (this.workerInstance) {
      return this.workerInstance;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        console.log('[CaptchaSolver] Đang khởi tạo Tesseract.js OCR Worker...');
        const worker = await createWorker(lang, 1, {
          errorHandler: (err) => {
            // Ngăn worker thread crash tiến trình Node.js khi ảnh lỗi
            if (process.env.DEBUG_OCR) {
              console.warn('[CaptchaSolver] Worker error handled safely:', err);
            }
          },
          logger: (m) => {
            if (process.env.DEBUG_OCR) {
              console.log(`[Tesseract Log] ${m.status}: ${(m.progress * 100).toFixed(0)}%`);
            }
          }
        });

        // Cấu hình tối ưu cho nhận diện Captcha:
        // - Chỉ cho phép chữ và số (Alphanumeric)
        // - Page Segmentation Mode (PSM) = 7: Single text line
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
          tessedit_pageseg_mode: '7' as any,
        });

        this.workerInstance = worker;
        this.isInitializing = false;
        console.log('[CaptchaSolver] Khởi tạo Tesseract.js Worker thành công.');
        return worker;
      } catch (error) {
        this.isInitializing = false;
        this.initPromise = null;
        console.error('[CaptchaSolver] Lỗi khởi tạo Tesseract Worker:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Kiểm tra xem Buffer có phải là ảnh Raster (PNG, JPG, GIF, BMP, TIFF, WebP) hợp lệ không
   */
  public static isValidImageBuffer(buf: Buffer | Uint8Array): boolean {
    if (!buf || buf.length < 8) return false;
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);

    // PNG: 89 50 4E 47
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return true;
    // JPEG: FF D8 FF
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return true;
    // GIF: GIF87a or GIF89a (47 49 46)
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true;
    // BMP: BM (42 4D)
    if (b[0] === 0x42 && b[1] === 0x4D) return true;
    // WebP: RIFF...WEBP
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return true;
    // TIFF: II (49 49) or MM (4D 4D)
    if ((b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4D && b[1] === 0x4D)) return true;

    return false;
  }

  /**
   * Giải mã Captcha từ ảnh (Buffer, Base64 String, hoặc SVG)
   * @param imageInput Buffer hoặc chuỗi Base64 / SVG
   * @param options Cấu hình whitelist, timeout, v.v.
   * @returns Chuỗi text kết quả đã được làm sạch
   */
  public static async solve(
    imageInput: Buffer | string | Uint8Array,
    options?: CaptchaSolveOptions
  ): Promise<string> {
    const result = await this.solveWithDetails(imageInput, options);
    return result.code;
  }

  /**
   * Giải mã Captcha kèm chi tiết (độ tin cậy, thời gian xử lý, engine)
   */
  public static async solveWithDetails(
    imageInput: Buffer | string | Uint8Array,
    options?: CaptchaSolveOptions
  ): Promise<CaptchaSolveResult> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || 10000;

    if (!imageInput) {
      throw new Error('[CaptchaSolver] Dữ liệu ảnh Captcha rỗng.');
    }

    // 1. Kiểm tra nếu là dạng SVG text (ví dụ Captcha SVG từ một số cổng Thuế)
    const asString = typeof imageInput === 'string' ? imageInput : (Buffer.isBuffer(imageInput) ? imageInput.toString('utf-8', 0, 100) : '');
    if (asString.includes('<svg') || asString.startsWith('data:image/svg+xml')) {
      const fullSvgStr = typeof imageInput === 'string' ? imageInput : (imageInput as Buffer).toString('utf-8');
      const svgText = this.tryExtractTextFromSvg(fullSvgStr);
      if (svgText) {
        return {
          code: svgText,
          confidence: 100,
          engine: 'regex',
          processingTimeMs: Date.now() - startTime
        };
      }
    }

    // 2. Chuyển đổi input về Buffer hoặc URL tương thích với Tesseract
    const imagePayload = this.normalizeImagePayload(imageInput);

    // Kiểm tra tính hợp lệ của Buffer ảnh
    if (Buffer.isBuffer(imagePayload)) {
      const isRaster = this.isValidImageBuffer(imagePayload);
      if (!isRaster) {
        // Kiểm tra xem có phải chuỗi HTML phản hồi lỗi từ server
        const textPreview = imagePayload.toString('utf-8', 0, 80).toLowerCase();
        if (textPreview.includes('<html') || textPreview.includes('<!doctype')) {
          throw new Error('[CaptchaSolver] Server trả về trang HTML thay vì ảnh Captcha (404/Login required).');
        }
        throw new Error('[CaptchaSolver] Định dạng ảnh không được hỗ trợ hoặc không phải ảnh hợp lệ.');
      }
    }

    // 3. Thực hiện OCR qua Tesseract với cơ chế Timeout
    try {
      const worker = await this.getWorker(options?.lang || 'eng');

      // Tùy chỉnh whitelist nếu được chỉ định
      if (options?.whitelist) {
        await worker.setParameters({
          tessedit_char_whitelist: options.whitelist,
        });
      }

      const ocrPromise = worker.recognize(imagePayload);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`[CaptchaSolver] Quá thời gian OCR (${timeoutMs}ms)`)), timeoutMs);
      });

      const { data } = await Promise.race([ocrPromise, timeoutPromise]);
      const rawText = data.text || '';
      
      // Làm sạch chuỗi: loại bỏ khoảng trắng, ký tự đặc biệt, giữ lại A-Z, 0-9
      const cleanCode = rawText.replace(/[^a-zA-Z0-9]/g, '').trim();

      console.log(`[CaptchaSolver] Đã giải Captcha: "${cleanCode}" (Confidence: ${data.confidence?.toFixed(1)}%, Time: ${Date.now() - startTime}ms)`);

      return {
        code: cleanCode,
        confidence: data.confidence,
        engine: 'tesseract',
        processingTimeMs: Date.now() - startTime
      };
    } catch (error: any) {
      console.warn('[CaptchaSolver] Tesseract OCR thất bại hoặc timeout:', error.message);
      
      // Tự hủy worker nếu bị treo để giải phóng tài nguyên
      await this.resetWorker();

      throw new Error(`Không thể giải Captcha tự động bằng OCR: ${error.message}`);
    }
  }

  /**
   * Trích xuất văn bản trực tiếp từ thẻ SVG nếu có
   */
  private static tryExtractTextFromSvg(svgString: string): string | null {
    try {
      let rawSvg = svgString;
      if (rawSvg.startsWith('data:image/svg+xml;base64,')) {
        rawSvg = Buffer.from(rawSvg.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf-8');
      } else if (rawSvg.startsWith('data:image/svg+xml;utf8,')) {
        rawSvg = decodeURIComponent(rawSvg.replace('data:image/svg+xml;utf8,', ''));
      }

      const textTagMatches = rawSvg.match(/<text[^>]*>([\s\S]*?)<\/text>/gi);
      if (textTagMatches && textTagMatches.length > 0) {
        const textContent = textTagMatches.map(m => m.replace(/<[^>]+>/g, '').trim()).join('');
        const clean = textContent.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (clean.length >= 2 && clean.length <= 10) {
          return clean;
        }
      }
    } catch {
      // Ignore and fallback to raster OCR
    }
    return null;
  }

  /**
   * Chuẩn hóa đầu vào ảnh về dạng Buffer hoặc String Data URI
   */
  private static normalizeImagePayload(input: Buffer | string | Uint8Array): Buffer | string {
    if (Buffer.isBuffer(input)) {
      return input;
    }

    if (input instanceof Uint8Array) {
      return Buffer.from(input);
    }

    if (typeof input === 'string') {
      const trimmed = input.trim();
      // Nếu là Data URI dạng base64
      if (trimmed.startsWith('data:image/')) {
        const base64Index = trimmed.indexOf(';base64,');
        if (base64Index !== -1) {
          const rawBase64 = trimmed.substring(base64Index + 8);
          return Buffer.from(rawBase64, 'base64');
        }
      }
      // Nếu là chuỗi base64 thuần
      if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 50) {
        try {
          return Buffer.from(trimmed, 'base64');
        } catch {
          // Fallback return string
        }
      }
      return trimmed;
    }

    throw new Error('[CaptchaSolver] Định dạng đầu vào không hợp lệ');
  }

  /**
   * Đặt lại worker khi xảy ra lỗi nghiêm trọng
   */
  public static async resetWorker(): Promise<void> {
    if (this.workerInstance) {
      try {
        await this.workerInstance.terminate();
      } catch {
        // ignore
      }
      this.workerInstance = null;
    }
    this.initPromise = null;
    this.isInitializing = false;
  }

  /**
   * Giải phóng worker khi ứng dụng tắt
   */
  public static async terminate(): Promise<void> {
    await this.resetWorker();
    console.log('[CaptchaSolver] Đã giải phóng OCR Worker.');
  }
}
