import { createWorker, type Worker } from 'tesseract.js';
import zlib from 'zlib';

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.NETLIFY
);

export const POS_CAPTCHA_WHITELIST = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const DIGITS_CAPTCHA_WHITELIST = '0123456789';

let tesseractWorker: Worker | null = null;
let workerInitializing: Promise<Worker> | null = null;

async function getWorker(whitelist?: string): Promise<Worker> {
  const targetWhitelist = whitelist || POS_CAPTCHA_WHITELIST;

  if (tesseractWorker) {
    await tesseractWorker.setParameters({
      tessedit_char_whitelist: targetWhitelist,
      tessedit_pageseg_mode: '7' as any, // PSM 7: Treat the image as a single text line
      user_defined_dpi: '300',
      tessjs_create_pdf: '0',
      tessjs_create_hocr: '0',
      tessjs_create_tsv: '0',
      tessjs_create_box: '0',
      tessjs_create_unlv: '0',
      tessjs_create_osd: '0',
    });
    return tesseractWorker;
  }

  if (workerInitializing) {
    const w = await workerInitializing;
    await w.setParameters({
      tessedit_char_whitelist: targetWhitelist,
      tessedit_pageseg_mode: '7' as any,
      user_defined_dpi: '300',
      tessjs_create_pdf: '0',
      tessjs_create_hocr: '0',
      tessjs_create_tsv: '0',
      tessjs_create_box: '0',
      tessjs_create_unlv: '0',
      tessjs_create_osd: '0',
    });
    return w;
  }

  workerInitializing = (async () => {
    try {
      const cachePath = process.env.TEMP || '/tmp';
      const w = await createWorker('eng', 1, {
        cachePath,
      });
      await w.setParameters({
        tessedit_char_whitelist: targetWhitelist,
        tessedit_pageseg_mode: '7' as any, // PSM 7: Single text line
        user_defined_dpi: '300',
        tessjs_create_pdf: '0',
        tessjs_create_hocr: '0',
        tessjs_create_tsv: '0',
        tessjs_create_box: '0',
        tessjs_create_unlv: '0',
        tessjs_create_osd: '0',
      });
      tesseractWorker = w;
      return w;
    } finally {
      workerInitializing = null;
    }
  })();

  const w = await workerInitializing;
  return w;
}

/**
 * Giải mã ảnh PNG RGBA chuẩn từ ASP.NET Captcha (EasyInvoice / VNPT)
 */
export function decodePngRgba(buf: Buffer): { width: number; height: number; data: Buffer } | null {
  try {
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

    if (!width || !height || idatChunks.length === 0) return null;

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
        if (filter === 1) val = (raw + a) & 0xff;
        else if (filter === 2) val = (raw + b) & 0xff;
        else if (filter === 3) val = (raw + Math.floor((a + b) / 2)) & 0xff;
        else if (filter === 4) {
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
  } catch {
    return null;
  }
}

/**
 * Tạo ảnh BMP binarized (trắng/đen) phóng to để Tesseract OCR dễ nhận diện các số Captcha
 */
export function createBinarizedBmp(
  decoded: { width: number; height: number; data: Buffer },
  scale = 3,
  cropLeft = 30,
  cropRight = 142
): Buffer {
  const { width, height, data } = decoded;
  const cropX1 = Math.max(0, Math.min(cropLeft, width - 10));
  const cropX2 = Math.min(cropRight, width);
  const cropW = Math.max(1, cropX2 - cropX1);
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
      const r = data[srcIdx] || 0;
      const g = data[srcIdx + 1] || 0;
      const b = data[srcIdx + 2] || 0;
      const lum = r * 0.299 + g * 0.587 + b * 0.114;

      const isText = lum > 140;
      const val = isText ? 0 : 255; // 0 = Đen (Chữ số), 255 = Trắng (Nền)

      const pxOffset = rowStart + destX * 3;
      bmp[pxOffset] = val;
      bmp[pxOffset + 1] = val;
      bmp[pxOffset + 2] = val;
    }
  }

  return bmp;
}

/**
 * Tạo ảnh BMP binarized chuyên sâu cho CAPTCHA máy tính tiền (POS Captcha) trên Node.js
 * Tăng tương phản tối đa, loại bỏ nền xám mờ và bổ sung viền trắng an toàn cho Tesseract
 */
export function createPosBinarizedBmp(
  decoded: { width: number; height: number; data: Buffer },
  scale = 2.5,
  threshold = 145,
  padding = 10
): Buffer {
  const { width, height, data } = decoded;

  // Nếu ảnh đã được phóng to sẵn từ phía client (width >= 300), giữ nguyên scale 1.0
  const effectiveScale = width >= 300 ? 1.0 : Math.max(1.0, Math.min(scale, Math.round(500 / width)));
  const effectivePadding = width >= 300 ? Math.round(padding / 2) : padding;

  const paddedW = width + effectivePadding * 2;
  const paddedH = height + effectivePadding * 2;
  const newW = Math.round(paddedW * effectiveScale);
  const newH = Math.round(paddedH * effectiveScale);

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

  // Khởi tạo nền trắng
  bmp.fill(255, 54);

  for (let destY = 0; destY < newH; destY++) {
    const srcY = Math.floor((newH - 1 - destY) / effectiveScale) - effectivePadding;
    const rowStart = 54 + destY * rowSize;

    if (srcY < 0 || srcY >= height) continue;

    for (let destX = 0; destX < newW; destX++) {
      const srcX = Math.floor(destX / effectiveScale) - effectivePadding;
      if (srcX < 0 || srcX >= width) continue;

      const srcIdx = (srcY * width + srcX) * 4;
      const r = data[srcIdx] || 0;
      const g = data[srcIdx + 1] || 0;
      const b = data[srcIdx + 2] || 0;
      const lum = r * 0.299 + g * 0.587 + b * 0.114;

      // Chữ đậm -> Đen (0), Nền và vạch mờ -> Trắng (255)
      const val = lum < threshold ? 0 : 255;

      const pxOffset = rowStart + destX * 3;
      bmp[pxOffset] = val;
      bmp[pxOffset + 1] = val;
      bmp[pxOffset + 2] = val;
    }
  }

  return bmp;
}

/**
 * Bộ lọc hậu xử lý regex chuẩn hóa mã OCR, loại bỏ ký tự rác và sửa lỗi nhầm lẫn phổ biến.
 */
export function postProcessOcrText(
  rawText: string,
  options?: { digitsOnly?: boolean; expectedLength?: number }
): string {
  if (!rawText) return '';

  const digitsOnly = options?.digitsOnly === true;

  if (digitsOnly) {
    // 1. Chuyển đổi các ký tự chữ dễ bị Tesseract nhận diện nhầm thành số
    let mapped = rawText
      .replace(/[OoD]/g, '0')
      .replace(/[Il|!]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss]/g, '5')
      .replace(/[b]/g, '6')
      .replace(/[T]/g, '7')
      .replace(/[B]/g, '8')
      .replace(/[gq]/g, '9');

    // 2. Chỉ giữ lại số
    let digits = mapped.replace(/[^0-9]/g, '');

    // 3. Khớp độ dài nếu có yêu cầu (VD: EasyInvoice / VNPT thường là 4 số)
    if (options?.expectedLength && digits.length > options.expectedLength) {
      const match = digits.match(new RegExp(`\\d{${options.expectedLength}}`));
      if (match) return match[0];
      return digits.substring(0, options.expectedLength);
    }
    return digits;
  }

  // Luồng Alphanumeric (Mã POS Captcha Cổng Thuế: 4-6 ký tự in hoa và số, VD: 6V7BEF, 46JBRS)
  // 1. Loại bỏ các ký tự rác, nét gạch, ký hiệu phân cách phi chữ số do vạch nhiễu
  let cleaned = rawText
    .replace(/[|\\/_~—–\-.,:;'"“”`*#^!?()[\]{}<>+=$@%&]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();

  // 2. Loại bỏ các ký tự phi alphanumeric
  cleaned = cleaned.replace(/[^A-Z0-9]/g, '');

  // 3. Xử lý độ dài: Captcha máy tính tiền của Tổng cục Thuế thường là 6 ký tự
  const targetLen = options?.expectedLength || 6;
  if (cleaned.length > targetLen) {
    // Nếu bị nhận diện thừa ký tự do rác ở viền mép (VD: "I6V7BEF" hoặc "6V7BEF_")
    // Kiểm tra xem có cụm 4-6 ký tự hợp lệ không
    const match = cleaned.match(/[A-Z0-9]{4,6}/);
    if (match && match[0].length >= 4 && match[0].length <= targetLen) {
      return match[0];
    }
    return cleaned.substring(0, targetLen);
  }

  return cleaned;
}

export interface TesseractSolveOptions {
  digitsOnly?: boolean;
  expectedLength?: number;
  preprocessEasyInvoice?: boolean;
  preprocessPosCaptcha?: boolean;
  whitelist?: string;
  timeoutMs?: number;
}

/**
 * Giải Captcha cục bộ bằng Tesseract.js (không cần gọi API ngoài, không bị giới hạn quota hay HTTP 429)
 * Có cơ chế giới hạn thời gian (timeoutMs) để ngăn chặn rủi ro treo tiến trình trên môi trường Serverless/Vercel.
 */
export async function solveCaptchaWithTesseract(
  imageInput: Buffer | string | Uint8Array,
  options?: TesseractSolveOptions
): Promise<{ code: string; confidence: number }> {
  const timeoutMs = options?.timeoutMs || 12000;

  const recognitionPromise = (async () => {
    let buf: Buffer;
    if (typeof imageInput === 'string') {
      const trimmed = imageInput.trim();
      if (trimmed.startsWith('<svg') || trimmed.includes('<svg')) {
        throw new Error('Tesseract không hỗ trợ định dạng SVG trực tiếp.');
      }
      const cleanB64 = trimmed.replace(/^data:image\/[a-z+]+;base64,/, '');
      buf = Buffer.from(cleanB64, 'base64');
    } else {
      buf = Buffer.from(imageInput);
    }

    if (buf.length >= 4 && buf.slice(0, 10).toString('utf-8').includes('<svg')) {
      throw new Error('Tesseract không hỗ trợ định dạng SVG trực tiếp.');
    }

    // Đặt mặc định digitsOnly = false để nhận diện cả chữ và số (VD: K8H6WK)
    const digitsOnly = options?.digitsOnly === true;
    const whitelist = options?.whitelist || (digitsOnly ? DIGITS_CAPTCHA_WHITELIST : POS_CAPTCHA_WHITELIST);

    let processBuf = buf;

    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    if (options?.preprocessEasyInvoice === true && isPng) {
      const decoded = decodePngRgba(buf);
      if (decoded) {
        const binarized = createBinarizedBmp(decoded, 3, 25, 145);
        processBuf = binarized;
      }
    } else if (options?.preprocessPosCaptcha === true && isPng) {
      const decoded = decodePngRgba(buf);
      // Chỉ re-binarize nếu ảnh nhỏ (< 300px), ảnh đã scale lớn từ client canvas được giữ nguyên để Tesseract đọc nét căng
      if (decoded && decoded.width < 300) {
        const binarized = createPosBinarizedBmp(decoded, 2.5, 145, 12);
        processBuf = binarized;
      }
    }

    const worker = await getWorker(whitelist);
    const result = await worker.recognize(processBuf);
    const rawText = result.data.text || '';

    const cleaned = postProcessOcrText(rawText, {
      digitsOnly,
      expectedLength: options?.expectedLength,
    });

    return {
      code: cleaned,
      confidence: result.data.confidence || 0,
    };
  })();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Tesseract timeout vượt quá ${timeoutMs}ms`)), timeoutMs)
  );

  return Promise.race([recognitionPromise, timeoutPromise]);
}

export async function terminateTesseract(): Promise<void> {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
}
