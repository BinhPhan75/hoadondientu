import { createWorker, type Worker } from 'tesseract.js';
import zlib from 'zlib';

export const POS_CAPTCHA_WHITELIST = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const DIGITS_CAPTCHA_WHITELIST = '0123456789';

let tesseractWorker: Worker | null = null;
let workerInitializing: Promise<Worker> | null = null;
let tesseractBrokenOnHost = false;

function isMissingWasmOrCoreError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '');
  return (
    /tesseract-core|tesseract\.js-core|failed to asynchronously prepare wasm|ENOENT|RuntimeError:\s*Aborted/i.test(msg)
  );
}

async function applyWorkerParams(worker: Worker, whitelist: string): Promise<void> {
  await worker.setParameters({
    tessedit_char_whitelist: whitelist,
    tessedit_pageseg_mode: '7' as any,
    user_defined_dpi: '300',
    tessjs_create_pdf: '0',
    tessjs_create_hocr: '0',
    tessjs_create_tsv: '0',
    tessjs_create_box: '0',
    tessjs_create_unlv: '0',
    tessjs_create_osd: '0',
  });
}

async function getWorker(whitelist?: string): Promise<Worker | null> {
  if (tesseractBrokenOnHost) return null;
  const targetWhitelist = whitelist || POS_CAPTCHA_WHITELIST;

  try {
    if (tesseractWorker) {
      await applyWorkerParams(tesseractWorker, targetWhitelist);
      return tesseractWorker;
    }

    if (workerInitializing) {
      const w = await workerInitializing;
      await applyWorkerParams(w, targetWhitelist);
      return w;
    }

    workerInitializing = (async () => {
      try {
        const cachePath = process.env.TEMP || '/tmp';
        const w = await createWorker('eng', 1, { cachePath });
        await applyWorkerParams(w, targetWhitelist);
        tesseractWorker = w;
        return w;
      } catch (initErr) {
        if (isMissingWasmOrCoreError(initErr)) {
          tesseractBrokenOnHost = true;
          console.warn('[Tesseract] Bỏ qua OCR do môi trường thiếu file WASM/core:', (initErr as any)?.message || initErr);
          return null as unknown as Worker;
        }
        throw initErr;
      } finally {
        workerInitializing = null;
      }
    })();

    const w = await workerInitializing;
    return w || null;
  } catch (err) {
    if (isMissingWasmOrCoreError(err)) {
      tesseractBrokenOnHost = true;
      return null;
    }
    throw err;
  }
}

export function decodePngRgba(buf: Buffer): { width: number; height: number; data: Buffer } | null {
  try {
    let offset = 8;
    const idatChunks: Buffer[] = [];
    let width = 0;
    let height = 0;
    let colorType = 6;

    while (offset < buf.length) {
      const len = buf.readUInt32BE(offset);
      const type = buf.slice(offset + 4, offset + 8).toString('ascii');
      if (type === 'IHDR') {
        width = buf.readUInt32BE(offset + 8);
        height = buf.readUInt32BE(offset + 12);
        colorType = buf.readUInt8(offset + 17);
      } else if (type === 'IDAT') {
        idatChunks.push(buf.slice(offset + 8, offset + 8 + len));
      }
      offset += 12 + len;
    }

    if (!width || !height || idatChunks.length === 0) return null;

    const bpp = colorType === 2 ? 3 : 4;
    const stride = width * bpp + 1;
    const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
    const rawRgba = Buffer.alloc(width * height * 4);
    const prevRow = Buffer.alloc(width * bpp);
    const curRow = Buffer.alloc(width * bpp);

    for (let y = 0; y < height; y++) {
      const filter = decompressed[y * stride];
      const rowOffset = y * stride + 1;

      for (let x = 0; x < width * bpp; x++) {
        const raw = decompressed[rowOffset + x];
        const a = x >= bpp ? curRow[x - bpp] : 0;
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
        curRow[x] = val;
      }
      curRow.copy(prevRow);

      const destOffset = y * width * 4;
      for (let x = 0; x < width; x++) {
        if (bpp === 3) {
          rawRgba[destOffset + x * 4] = curRow[x * 3];
          rawRgba[destOffset + x * 4 + 1] = curRow[x * 3 + 1];
          rawRgba[destOffset + x * 4 + 2] = curRow[x * 3 + 2];
          rawRgba[destOffset + x * 4 + 3] = 255;
        } else {
          rawRgba[destOffset + x * 4] = curRow[x * 4];
          rawRgba[destOffset + x * 4 + 1] = curRow[x * 4 + 1];
          rawRgba[destOffset + x * 4 + 2] = curRow[x * 4 + 2];
          rawRgba[destOffset + x * 4 + 3] = curRow[x * 4 + 3];
        }
      }
    }

    return { width, height, data: rawRgba };
  } catch {
    return null;
  }
}

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
      const val = isText ? 0 : 255;

      const pxOffset = rowStart + destX * 3;
      bmp[pxOffset] = val;
      bmp[pxOffset + 1] = val;
      bmp[pxOffset + 2] = val;
    }
  }

  return bmp;
}

export function createPosBinarizedBmp(
  decoded: { width: number; height: number; data: Buffer },
  scale = 2.5,
  threshold = 145,
  padding = 10
): Buffer {
  const { width, height, data } = decoded;

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

      const val = lum < threshold ? 0 : 255;

      const pxOffset = rowStart + destX * 3;
      bmp[pxOffset] = val;
      bmp[pxOffset + 1] = val;
      bmp[pxOffset + 2] = val;
    }
  }

  return bmp;
}

export function createVisnamBinarizedBmp(
  decoded: { width: number; height: number; data: Buffer },
  targetWidth = 240,
  padding = 12,
  lumThreshold = 175,
  targetHeight?: number
): Buffer {
  const { width, height, data } = decoded;
  const targetW = Math.max(160, Math.min(targetWidth, width));
  const targetH = targetHeight ? Math.max(40, targetHeight) : Math.max(50, Math.round((height * targetW) / width));
  const totalW = targetW + padding * 2;
  const totalH = targetH + padding * 2;

  const rowSize = Math.floor((24 * totalW + 31) / 32) * 4;
  const imageSize = rowSize * totalH;
  const fileSize = 54 + imageSize;

  const bmp = Buffer.alloc(fileSize);
  bmp.write('BM', 0);
  bmp.writeUInt32LE(fileSize, 2);
  bmp.writeUInt32LE(54, 10);
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(totalW, 18);
  bmp.writeInt32LE(totalH, 22);
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  bmp.writeUInt32LE(0, 30);
  bmp.writeUInt32LE(imageSize, 34);
  bmp.fill(255, 54);

  const scaleX = width / targetW;
  const scaleY = height / targetH;

  for (let dy = 0; dy < targetH; dy++) {
    const srcY = height - 1 - Math.floor(dy * scaleY);
    const destY = dy + padding;
    const rowStart = 54 + destY * rowSize;

    for (let dx = 0; dx < targetW; dx++) {
      const srcX = Math.floor(dx * scaleX);
      const idx = (srcY * width + srcX) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3] / 255;

      const cR = Math.round(r * a + 255 * (1 - a));
      const cG = Math.round(g * a + 255 * (1 - a));
      const cB = Math.round(b * a + 255 * (1 - a));

      const isRedLine = cR > cG + 30 && cR > cB + 30;
      const isGreenLine = cG > cR + 25 && cG > cB + 25;
      const lum = 0.299 * cR + 0.587 * cG + 0.114 * cB;

      const isDigit =
        !isRedLine &&
        !isGreenLine &&
        (lum < lumThreshold || (cB > cR + 25 && cB > cG + 25 && lum < 220));

      const destXWithPad = dx + padding;
      const pxOffset = rowStart + destXWithPad * 3;
      const val = isDigit ? 0 : 255;
      bmp[pxOffset] = val;
      bmp[pxOffset + 1] = val;
      bmp[pxOffset + 2] = val;
    }
  }

  return bmp;
}

export function postProcessOcrText(
  rawText: string,
  options?: { digitsOnly?: boolean; expectedLength?: number }
): string {
  if (!rawText) return '';

  const digitsOnly = options?.digitsOnly === true;

  if (digitsOnly) {
    const mapped = rawText
      .replace(/[OoD]/g, '0')
      .replace(/[Il|!]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss]/g, '5')
      .replace(/[b]/g, '6')
      .replace(/[T]/g, '7')
      .replace(/[B]/g, '8')
      .replace(/[gq]/g, '9');

    const digits = mapped.replace(/[^0-9]/g, '');

    if (options?.expectedLength && digits.length > options.expectedLength) {
      const match = digits.match(new RegExp(`\\d{${options.expectedLength}}`));
      if (match) return match[0];
      return digits.substring(0, options.expectedLength);
    }
    return digits;
  }

  let cleaned = rawText
    .replace(/[|\\/_~—–\-.,:;'"“”`*#^!?()[\]{}<>+=$@%&]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const targetLen = options?.expectedLength || 6;
  if (cleaned.length > targetLen) {
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
  preprocessVisnam?: boolean;
  whitelist?: string;
  timeoutMs?: number;
}

export async function solveVisnamCaptcha(
  imageInput: Buffer | string | Uint8Array,
  timeoutMs = 3000
): Promise<{ code: string; confidence: number } | null> {
  if (tesseractBrokenOnHost) return null;

  const recognitionPromise = (async () => {
    try {
      let buf: Buffer;
      if (typeof imageInput === 'string') {
        const cleanB64 = imageInput.trim().replace(/^data:image\/[a-z+]+;base64,/, '');
        buf = Buffer.from(cleanB64, 'base64');
      } else {
        buf = Buffer.from(imageInput);
      }

      const isPng = buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      if (!isPng) return null;

      const decoded = decodePngRgba(buf);
      if (!decoded) return null;

      const worker = await getWorker(DIGITS_CAPTCHA_WHITELIST);
      if (!worker) return null;

      const passes = [
        { w: 240, h: 90, psm: '8', lum: 175 },
        { w: 220, h: 80, psm: '8', lum: 175 },
        { w: 260, h: 90, psm: '8', lum: 185 },
        { w: 240, h: 90, psm: '7', lum: 175 },
        { w: 320, h: 80, psm: '8', lum: 175 },
      ];

      for (const pass of passes) {
        const bmp = createVisnamBinarizedBmp(decoded, pass.w, 12, pass.lum, pass.h);
        await worker.setParameters({
          tessedit_char_whitelist: DIGITS_CAPTCHA_WHITELIST,
          tessedit_pageseg_mode: pass.psm as any,
        });
        const res = await worker.recognize(bmp);
        const cleaned = postProcessOcrText(res.data.text || '', { digitsOnly: true, expectedLength: 4 });
        if (/^\d{4}$/.test(cleaned)) {
          return { code: cleaned, confidence: res.data.confidence || 85 };
        }
      }

      return null;
    } catch (err) {
      if (isMissingWasmOrCoreError(err)) {
        tesseractBrokenOnHost = true;
      }
      return null;
    }
  })();

  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs)
  );

  return Promise.race([recognitionPromise, timeoutPromise]);
}

export async function solveCaptchaWithTesseract(
  imageInput: Buffer | string | Uint8Array,
  options?: TesseractSolveOptions
): Promise<{ code: string; confidence: number }> {
  if (tesseractBrokenOnHost) {
    return { code: '', confidence: 0 };
  }

  const timeoutMs = options?.timeoutMs || 6000;

  const recognitionPromise = (async () => {
    try {
      let buf: Buffer;
      if (typeof imageInput === 'string') {
        const trimmed = imageInput.trim();
        if (trimmed.startsWith('<svg') || trimmed.includes('<svg')) {
          return { code: '', confidence: 0 };
        }
        const cleanB64 = trimmed.replace(/^data:image\/[a-z+]+;base64,/, '');
        buf = Buffer.from(cleanB64, 'base64');
      } else {
        buf = Buffer.from(imageInput);
      }

      if (buf.length >= 4 && buf.slice(0, 10).toString('utf-8').includes('<svg')) {
        return { code: '', confidence: 0 };
      }

      const isPng = buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      if (options?.preprocessVisnam === true && isPng) {
        const visnamRes = await solveVisnamCaptcha(buf, Math.min(timeoutMs, 2500));
        if (visnamRes) {
          return visnamRes;
        }
        return { code: '', confidence: 0 };
      }

      const digitsOnly = options?.digitsOnly === true;
      const whitelist = options?.whitelist || (digitsOnly ? DIGITS_CAPTCHA_WHITELIST : POS_CAPTCHA_WHITELIST);

      let processBuf = buf;

      if (options?.preprocessEasyInvoice === true && isPng) {
        const decoded = decodePngRgba(buf);
        if (decoded) {
          processBuf = createBinarizedBmp(decoded, 3, 25, 145);
        }
      } else if (options?.preprocessPosCaptcha === true && isPng) {
        const decoded = decodePngRgba(buf);
        if (decoded && decoded.width < 300) {
          processBuf = createPosBinarizedBmp(decoded, 2.5, 145, 12);
        }
      }

      const worker = await getWorker(whitelist);
      if (!worker) {
        return { code: '', confidence: 0 };
      }

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
    } catch (err) {
      if (isMissingWasmOrCoreError(err)) {
        tesseractBrokenOnHost = true;
        return { code: '', confidence: 0 };
      }
      throw err;
    }
  })();

  const timeoutPromise = new Promise<{ code: string; confidence: number }>((resolve) =>
    setTimeout(() => resolve({ code: '', confidence: 0 }), timeoutMs)
  );

  return Promise.race([recognitionPromise, timeoutPromise]);
}

export async function terminateTesseract(): Promise<void> {
  if (tesseractWorker) {
    try {
      await tesseractWorker.terminate();
    } catch {}
    tesseractWorker = null;
  }
}
