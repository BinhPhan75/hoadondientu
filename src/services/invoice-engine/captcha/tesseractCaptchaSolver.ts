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
 * Giải mã ảnh PNG RGBA chuẩn từ ASP.NET Captcha (EasyInvoice / VNPT / Visnam)
 */
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
 * Tiền xử lý chuyên sâu cho CAPTCHA VIN-HOADON (Visnam - tracuu.vin-hoadon.com):
 * - Kích thước gốc rất lớn (1500x350) -> thu nhỏ về kích thước chuẩn (380px)
 * - Nền trong suốt hoặc trắng -> composite nền trắng chuẩn
 * - Khử sạch vạch kẻ chéo màu đỏ/xanh lá cắt ngang qua các chữ số
 * - Giữ lại các nét chữ số lớn, binarize sang đen trắng sắc nét theo ngưỡng lumThreshold
 * - Bổ sung viền trắng an toàn 15px xung quanh giúp Tesseract nhận diện 4 chữ số nhanh và chuẩn
 */
export function createVisnamBinarizedBmp(
  decoded: { width: number; height: number; data: Buffer },
  targetWidth = 380,
  padding = 15,
  lumThreshold = 165
): Buffer {
  const { width, height, data } = decoded;
  const targetW = Math.max(200, Math.min(targetWidth, width));
  const targetH = Math.max(50, Math.round((height * targetW) / width));
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
  bmp.fill(255, 54); // Fill white

  const scaleX = width / targetW;
  const scaleY = height / targetH;

  for (let dy = 0; dy < targetH; dy++) {
    // In BMP format, row 0 is bottom scanline
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

      // Composite onto white background
      const cR = Math.round(r * a + 255 * (1 - a));
      const cG = Math.round(g * a + 255 * (1 - a));
      const cB = Math.round(b * a + 255 * (1 - a));

      // Remove red & green noise lines
      const isRedLine = cR > cG + 35 && cR > cB + 35;
      const isGreenLine = cG > cR + 25 && cG > cB + 25;
      const lum = 0.299 * cR + 0.587 * cG + 0.114 * cB;

      // Digits are dark (lum < lumThreshold) or blue (cB > cR + 25 && cB > cG + 25 && lum < 220)
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

    // 3. Khớp độ dài nếu có yêu cầu (VD: EasyInvoice / VNPT / Visnam
