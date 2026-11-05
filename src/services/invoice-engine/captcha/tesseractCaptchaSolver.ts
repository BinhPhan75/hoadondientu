import { createWorker, type Worker } from 'tesseract.js';
import zlib from 'zlib';

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.NETLIFY
);

let tesseractWorker: Worker | null = null;
let workerInitializing: Promise<Worker> | null = null;

async function getWorker(whitelist?: string): Promise<Worker> {
  if (tesseractWorker) {
    if (whitelist) {
      await tesseractWorker.setParameters({
        tessedit_char_whitelist: whitelist,
        tessedit_pageseg_mode: '7' as any, // Single text line
      });
    }
    return tesseractWorker;
  }

  if (workerInitializing) {
    const w = await workerInitializing;
    if (whitelist) {
      await w.setParameters({
        tessedit_char_whitelist: whitelist,
        tessedit_pageseg_mode: '7' as any,
      });
    }
    return w;
  }

  workerInitializing = (async () => {
    try {
      const cachePath = isServerless ? '/tmp' : '.';
      const w = await createWorker('eng', 1, {
        cachePath,
      });
      await w.setParameters({
        tessedit_char_whitelist: whitelist || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
        tessedit_pageseg_mode: '7' as any,
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

export interface TesseractSolveOptions {
  digitsOnly?: boolean;
  expectedLength?: number;
  preprocessEasyInvoice?: boolean;
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
  const timeoutMs = options?.timeoutMs || 4500;

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

    const digitsOnly = options?.digitsOnly !== false;
    const whitelist = options?.whitelist || (digitsOnly ? '0123456789' : '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');

    let processBuf = buf;

    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    if (options?.preprocessEasyInvoice === true && isPng) {
      const decoded = decodePngRgba(buf);
      if (decoded) {
        const binarized = createBinarizedBmp(decoded, 3, 25, 145);
        processBuf = binarized;
      }
    }

    const worker = await getWorker(whitelist);
    const result = await worker.recognize(processBuf);
    let text = result.data.text || '';

    if (digitsOnly) {
      text = text.replace(/[^0-9]/g, '');
    } else {
      text = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    }

    return {
      code: text,
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
