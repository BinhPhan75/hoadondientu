/**
 * Client-Side CAPTCHA Solver using HTML5 Canvas & Comismsh.ttf Template Matching
 * Chạy 100% trong trình duyệt người dùng (Zero-Latency, không phụ thuộc server/Gemini API).
 * 
 * Đặc điểm CAPTCHA Cổng Tổng Cục Thuế (hoadondientu.gdt.gov.vn):
 * - Thư viện sinh mã: svg-captcha (Node.js) sử dụng độc quyền phông chữ Comismsh.ttf qua opentype.js
 * - 36 ký tự in hoa và chữ số (0-9, A-Z)
 * - Mỗi ký tự trong SVG là một thẻ <path> vector độc lập từ trái sang phải
 * - Đường nhiễu là các thẻ <path stroke="..." fill="none"/>
 */

import * as opentype from 'opentype.js';
import { cleanGdtSvgString } from './captchaOcrHelper';

export const ALPHANUMERIC_CHARS = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z'
];

export const CANONICAL_WIDTH = 20;
export const CANONICAL_HEIGHT = 28;

export interface SegmentedChar {
  charIndex: number;
  canvas: HTMLCanvasElement;
  binaryGrid: Uint8Array; // 1: nét chữ (đen), 0: nền (trắng)
  width: number;
  height: number;
  aspectRatio: number;
  holesCount: number;
  x: number;
  y: number;
}

export interface TemplateGlyph {
  char: string;
  fontFamily: string;
  binaryGrid: Uint8Array;
  holesCount: number;
  aspectRatio: number;
  pixelCount: number;
}

export interface CharacterMatchResult {
  char: string;
  confidence: number; // 0 - 100
  secondaryMatch?: { char: string; confidence: number };
}

export interface ClientCaptchaSolveResult {
  success: boolean;
  code: string;
  confidence: number; // 0 - 100
  needsFallback: boolean;
  segmentedCount: number;
  characters: CharacterMatchResult[];
  executionTimeMs: number;
  engine: 'client-template-matching';
}

export interface TemplateMatchingOptions {
  minConfidenceThreshold?: number; // Mặc định: 35%
  expectedLength?: number; // Mặc định: 6 ký tự
  binarizeThreshold?: number; // Mặc định: 145 (0-255)
  debugCanvas?: boolean;
}

// Bảng số liệu kích thước chuẩn của từng ký tự trong Comismsh.ttf ở fontSize=50
export const COMISMSH_METRICS: Record<string, { w: number; h: number; ratio: number; holes: number }> = {
  '0': { w: 15.1, h: 23.8, ratio: 0.63, holes: 1 },
  '1': { w: 11.8, h: 26.8, ratio: 0.44, holes: 0 },
  '2': { w: 19.5, h: 25.8, ratio: 0.76, holes: 0 },
  '3': { w: 16.1, h: 23.8, ratio: 0.68, holes: 0 },
  '4': { w: 16.8, h: 25.0, ratio: 0.67, holes: 1 },
  '5': { w: 17.0, h: 24.4, ratio: 0.70, holes: 0 },
  '6': { w: 16.4, h: 25.2, ratio: 0.65, holes: 1 },
  '7': { w: 20.5, h: 26.9, ratio: 0.76, holes: 0 },
  '8': { w: 15.7, h: 23.6, ratio: 0.67, holes: 2 },
  '9': { w: 15.7, h: 24.1, ratio: 0.65, holes: 1 },
  'A': { w: 29.0, h: 26.2, ratio: 1.11, holes: 1 },
  'B': { w: 20.1, h: 27.4, ratio: 0.73, holes: 2 },
  'C': { w: 21.5, h: 24.9, ratio: 0.86, holes: 0 },
  'D': { w: 22.9, h: 27.6, ratio: 0.83, holes: 1 },
  'E': { w: 18.8, h: 28.4, ratio: 0.66, holes: 0 },
  'F': { w: 17.7, h: 27.3, ratio: 0.65, holes: 0 },
  'G': { w: 22.0, h: 23.9, ratio: 0.92, holes: 0 },
  'H': { w: 25.8, h: 28.4, ratio: 0.91, holes: 0 },
  'I': { w: 6.6, h: 28.4, ratio: 0.23, holes: 0 },
  'J': { w: 13.6, h: 24.9, ratio: 0.55, holes: 0 },
  'K': { w: 24.5, h: 28.4, ratio: 0.86, holes: 0 },
  'L': { w: 17.3, h: 28.4, ratio: 0.61, holes: 0 },
  'M': { w: 34.1, h: 29.1, ratio: 1.17, holes: 0 },
  'N': { w: 32.9, h: 32.8, ratio: 1.00, holes: 0 },
  'O': { w: 23.4, h: 24.2, ratio: 0.97, holes: 1 },
  'P': { w: 17.1, h: 27.3, ratio: 0.62, holes: 1 },
  'Q': { w: 26.4, h: 26.9, ratio: 0.98, holes: 1 },
  'R': { w: 23.0, h: 28.4, ratio: 0.81, holes: 1 },
  'S': { w: 16.1, h: 23.7, ratio: 0.68, holes: 0 },
  'T': { w: 22.2, h: 25.9, ratio: 0.86, holes: 0 },
  'U': { w: 24.9, h: 26.4, ratio: 0.94, holes: 0 },
  'V': { w: 27.2, h: 26.0, ratio: 1.05, holes: 0 },
  'W': { w: 39.4, h: 26.6, ratio: 1.48, holes: 0 },
  'X': { w: 26.2, h: 28.2, ratio: 0.93, holes: 0 },
  'Y': { w: 25.7, h: 25.9, ratio: 0.99, holes: 0 },
  'Z': { w: 21.8, h: 27.9, ratio: 0.78, holes: 0 }
};

// Bộ nhớ đệm templates tĩnh được khởi tạo 1 lần trong RAM trình duyệt
let cachedTemplateBank: Map<string, TemplateGlyph[]> | null = null;
let parsedOpentypeFont: opentype.Font | null = null;
let fontLoadPromise: Promise<boolean> | null = null;

/**
 * Đảm bảo phông chữ Comismsh.ttf được tải đầy đủ vào CSS FontFace và opentype
 */
export async function ensureFontLoaded(): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  if (document.fonts && document.fonts.check('16px ComismshCaptcha') && parsedOpentypeFont) {
    return true;
  }

  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = (async () => {
    try {
      // 1. Tải FontFace vào document.fonts
      if ('fonts' in document) {
        try {
          const fontFace = new FontFace('ComismshCaptcha', 'url(/fonts/Comismsh.ttf)');
          const loaded = await fontFace.load();
          document.fonts.add(loaded);
          await document.fonts.ready;
        } catch (cssFontErr) {
          console.warn('[FontFace load notice]:', cssFontErr);
        }
      }

      // 2. Tải và phân tích vector font qua opentype.js
      try {
        const res = await fetch('/fonts/Comismsh.ttf');
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const ot: any = opentype;
          const parseFn = ot.parse || (ot['default'] && ot['default'].parse) || ot['default'];
          if (typeof parseFn === 'function') {
            parsedOpentypeFont = parseFn(buf);
          }
        }
      } catch (otErr) {
        console.warn('[Opentype parse notice]:', otErr);
      }

      // Đặt lại cache template để tạo mẫu từ phông Comismsh chuẩn
      cachedTemplateBank = null;
      return true;
    } catch (e) {
      console.warn('[ensureFontLoaded error]:', e);
      return false;
    }
  })();

  return fontLoadPromise;
}

/**
 * Đếm số vòng kín (Holes / Topological Euler loops) của ký tự.
 * Ví dụ: '8', 'B' có 2 vòng kín; '0', '4', '6', '9', 'A', 'D', 'O', 'P', 'Q', 'R' có 1 vòng; các chữ khác có 0.
 */
export function countEnclosedHoles(grid: Uint8Array, width: number, height: number): number {
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  // 1. Flood-fill từ tất cả các điểm biên ngoài cùng (nền bên ngoài)
  for (let x = 0; x < width; x++) {
    const topIdx = 0 * width + x;
    const btmIdx = (height - 1) * width + x;
    if (grid[topIdx] === 0 && visited[topIdx] === 0) { visited[topIdx] = 1; queue.push(topIdx); }
    if (grid[btmIdx] === 0 && visited[btmIdx] === 0) { visited[btmIdx] = 1; queue.push(btmIdx); }
  }

  for (let y = 0; y < height; y++) {
    const leftIdx = y * width + 0;
    const rightIdx = y * width + (width - 1);
    if (grid[leftIdx] === 0 && visited[leftIdx] === 0) { visited[leftIdx] = 1; queue.push(leftIdx); }
    if (grid[rightIdx] === 0 && visited[rightIdx] === 0) { visited[rightIdx] = 1; queue.push(rightIdx); }
  }

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    const neighbors = [
      cy > 0 ? (cy - 1) * width + cx : -1,
      cy < height - 1 ? (cy + 1) * width + cx : -1,
      cx > 0 ? cy * width + (cx - 1) : -1,
      cx < width - 1 ? cy * width + (cx + 1) : -1
    ];

    for (const n of neighbors) {
      if (n >= 0 && visited[n] === 0 && grid[n] === 0) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }

  // 2. Tìm các vùng điểm trắng (0) chưa được duyệt -> chính là các lỗ hổng kín bên trong ký tự
  let holeCount = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0 && visited[i] === 0) {
      holeCount++;
      const holeQueue = [i];
      visited[i] = 2;
      let hHead = 0;
      let holePixelSize = 0;

      while (hHead < holeQueue.length) {
        const curr = holeQueue[hHead++];
        holePixelSize++;
        const cx = curr % width;
        const cy = Math.floor(curr / width);

        const neighbors = [
          cy > 0 ? (cy - 1) * width + cx : -1,
          cy < height - 1 ? (cy + 1) * width + cx : -1,
          cx > 0 ? cy * width + (cx - 1) : -1,
          cx < width - 1 ? cy * width + (cx + 1) : -1
        ];

        for (const n of neighbors) {
          if (n >= 0 && visited[n] === 0 && grid[n] === 0) {
            visited[n] = 2;
            holeQueue.push(n);
          }
        }
      }

      // Bỏ qua nếu lỗ quá bé (nhiễu 1-2 pixel)
      if (holePixelSize < 3) {
        holeCount--;
      }
    }
  }

  return Math.min(holeCount, 2);
}

/**
 * Khởi tạo kho mẫu (Template Bank) cho 36 ký tự bằng phông chữ Comismsh chuẩn CAPTCHA Cổng Thuế.
 */
export function initializeTemplateBank(forceRefresh = false): Map<string, TemplateGlyph[]> {
  if (cachedTemplateBank && !forceRefresh) return cachedTemplateBank;
  if (typeof document === 'undefined') return new Map();

  const bank = new Map<string, TemplateGlyph[]>();
  const fontFamilies = [
    'ComismshCaptcha, "Comic Sans MS", cursive, sans-serif',
    'sans-serif'
  ];

  const offscreen = document.createElement('canvas');
  offscreen.width = 70;
  offscreen.height = 70;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) return bank;

  // Hỗ trợ cả chữ thẳng đứng và chữ nghiêng (slanted)
  const skews = [0, -0.15, 0.15];
  const fontSizes = [28, 30];

  for (const char of ALPHANUMERIC_CHARS) {
    const list: TemplateGlyph[] = [];

    // Cách 1: Render vector trực tiếp từ opentype glyph nếu có
    if (parsedOpentypeFont) {
      try {
        const glyph = parsedOpentypeFont.charToGlyph(char);
        const fontScale = 50 / parsedOpentypeFont.unitsPerEm;
        const glyphW = glyph.advanceWidth ? glyph.advanceWidth * fontScale : 0;
        const glyphH = (parsedOpentypeFont.ascender + parsedOpentypeFont.descender) * fontScale;
        const left = 0 - (glyphW / 2);
        const top = 0 + (glyphH / 2);
        const path = glyph.getPath(left, top, 50);
        const pathData = path.toPathData(2);

        // Đo bounding box của path
        const nums = pathData.match(/[-+]?[0-9]*\.?[0-9]+/g);
        if (nums && nums.length >= 4) {
          let minX = 9999, maxX = -9999, minY = 9999, maxY = -9999;
          for (let i = 0; i < nums.length; i += 2) {
            const x = parseFloat(nums[i]);
            const y = parseFloat(nums[i + 1]);
            if (!isNaN(x)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
            if (!isNaN(y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
          }
          const w = maxX - minX;
          const h = maxY - minY;

          if (w > 2 && h > 4 && typeof Path2D !== 'undefined') {
            const charCanvas = document.createElement('canvas');
            charCanvas.width = CANONICAL_WIDTH;
            charCanvas.height = CANONICAL_HEIGHT;
            const charCtx = charCanvas.getContext('2d', { willReadFrequently: true });

            if (charCtx) {
              charCtx.fillStyle = '#FFFFFF';
              charCtx.fillRect(0, 0, CANONICAL_WIDTH, CANONICAL_HEIGHT);

              const targetW = CANONICAL_WIDTH - 2;
              const targetH = CANONICAL_HEIGHT - 2;
              const scale = Math.min(targetW / (w || 1), targetH / (h || 1));
              const destW = Math.max(1, Math.round(w * scale));
              const destH = Math.max(1, Math.round(h * scale));
              const offsetX = 1 + Math.round((targetW - destW) / 2);
              const offsetY = 1 + Math.round((targetH - destH) / 2);

              charCtx.save();
              charCtx.translate(offsetX, offsetY);
              charCtx.scale(scale, scale);
              charCtx.translate(-minX, -minY);
              charCtx.fillStyle = '#000000';
              charCtx.fill(new Path2D(pathData));
              charCtx.restore();

              const charImgData = charCtx.getImageData(0, 0, CANONICAL_WIDTH, CANONICAL_HEIGHT);
              const cData = charImgData.data;
              const grid = new Uint8Array(CANONICAL_WIDTH * CANONICAL_HEIGHT);
              let pxCount = 0;

              for (let i = 0; i < grid.length; i++) {
                const pIdx = i * 4;
                const lum = 0.299 * cData[pIdx] + 0.587 * cData[pIdx + 1] + 0.114 * cData[pIdx + 2];
                if (lum < 160) {
                  grid[i] = 1;
                  pxCount++;
                } else {
                  grid[i] = 0;
                }
              }

              const holes = countEnclosedHoles(grid, CANONICAL_WIDTH, CANONICAL_HEIGHT);
              list.push({
                char,
                fontFamily: 'Comismsh-opentype-vector',
                binaryGrid: grid,
                holesCount: holes,
                aspectRatio: w / (h || 1),
                pixelCount: pxCount
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Opentype vector template notice]:', err);
      }
    }

    // Cách 2: Render qua HTML5 Canvas text rendering CHỈ KHI chưa có vector template từ opentype
    if (list.length === 0) {
      for (const font of fontFamilies) {
        for (const size of fontSizes) {
          for (const skew of skews) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, 70, 70);

            if (skew !== 0) {
              ctx.setTransform(1, 0, skew, 1, 0, 0);
            }

            ctx.fillStyle = '#000000';
            ctx.font = `bold ${size}px ${font}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(char, 35, 35);

            ctx.setTransform(1, 0, 0, 1, 0, 0);

            const imgData = ctx.getImageData(0, 0, 70, 70);
            const data = imgData.data;

            let minX = 70, maxX = 0, minY = 70, maxY = 0;
            let count = 0;
            for (let y = 0; y < 70; y++) {
              for (let x = 0; x < 70; x++) {
                const idx = (y * 70 + x) * 4;
                const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                if (lum < 160) {
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                  count++;
                }
              }
            }

            if (count < 10 || minX >= maxX || minY >= maxY) continue;

            const w = maxX - minX + 1;
            const h = maxY - minY + 1;

            const charCanvas = document.createElement('canvas');
            charCanvas.width = CANONICAL_WIDTH;
            charCanvas.height = CANONICAL_HEIGHT;
            const charCtx = charCanvas.getContext('2d', { willReadFrequently: true });
            if (!charCtx) continue;

            charCtx.fillStyle = '#FFFFFF';
            charCtx.fillRect(0, 0, CANONICAL_WIDTH, CANONICAL_HEIGHT);
            charCtx.imageSmoothingEnabled = true;

            const targetW = CANONICAL_WIDTH - 2;
            const targetH = CANONICAL_HEIGHT - 2;
            const scale = Math.min(targetW / (w || 1), targetH / (h || 1));
            const destW = Math.max(1, Math.round(w * scale));
            const destH = Math.max(1, Math.round(h * scale));
            const offsetX = 1 + Math.round((targetW - destW) / 2);
            const offsetY = 1 + Math.round((targetH - destH) / 2);

            charCtx.drawImage(offscreen, minX, minY, w, h, offsetX, offsetY, destW, destH);

            const charImgData = charCtx.getImageData(0, 0, CANONICAL_WIDTH, CANONICAL_HEIGHT);
            const cData = charImgData.data;
            const grid = new Uint8Array(CANONICAL_WIDTH * CANONICAL_HEIGHT);
            let pxCount = 0;

            for (let i = 0; i < grid.length; i++) {
              const pIdx = i * 4;
              const lum = 0.299 * cData[pIdx] + 0.587 * cData[pIdx + 1] + 0.114 * cData[pIdx + 2];
              if (lum < 160) {
                grid[i] = 1;
                pxCount++;
              } else {
                grid[i] = 0;
              }
            }

            const holes = countEnclosedHoles(grid, CANONICAL_WIDTH, CANONICAL_HEIGHT);

            list.push({
              char,
              fontFamily: `${font} ${size}px ${skew !== 0 ? 'skew' : ''}`,
              binaryGrid: grid,
              holesCount: holes,
              aspectRatio: w / (h || 1),
              pixelCount: pxCount
            });
          }
        }
      }
    }

    bank.set(char, list);
  }

  cachedTemplateBank = bank;
  return bank;
}

/**
 * Phân đoạn trực tiếp từ các thẻ vector <path> trong mã SVG của Tổng cục Thuế.
 * Mỗi ký tự trong SVG Cổng Thuế là một thẻ <path> độc lập; sắp xếp theo trọng tâm trục X (avgX)
 * giúp triệt tiêu hoàn toàn hiện tượng dính chữ (kerning) và đường gạch nhiễu chéo.
 */
export function segmentSvgDirectly(svg: string): SegmentedChar[] | null {
  if (typeof document === 'undefined') return null;

  const pathRegex = /<path\b([^>]*)>/gi;
  let match;
  const glyphs: Array<{ minX: number; maxX: number; minY: number; maxY: number; avgX: number; d: string }> = [];

  while ((match = pathRegex.exec(svg)) !== null) {
    const attrs = match[1];
    const isNoise =
      attrs.includes('fill="none"') ||
      attrs.includes("fill='none'") ||
      attrs.includes('fill="transparent"') ||
      attrs.includes("fill='transparent'") ||
      (attrs.includes('stroke=') && (!attrs.includes('fill=') || attrs.includes('fill="none"') || attrs.includes("fill='none'")));
    if (isNoise) {
      continue;
    }

    const dMatch = attrs.match(/\bd\s*=\s*["']([^"']+)["']/);
    if (!dMatch) continue;
    const d = dMatch[1];
    const nums = d.match(/[-+]?[0-9]*\.?[0-9]+/g);
    if (!nums || nums.length < 4) continue;

    let minX = 9999, maxX = -9999, minY = 9999, maxY = -9999;
    let sumX = 0, countX = 0;
    for (let i = 0; i < nums.length; i += 2) {
      const x = parseFloat(nums[i]);
      const y = parseFloat(nums[i + 1]);
      if (!isNaN(x)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        sumX += x;
        countX++;
      }
      if (!isNaN(y)) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    const avgX = sumX / (countX || 1);
    const w = maxX - minX;
    const h = maxY - minY;
    // Bỏ qua các vệt nhiễu có kích thước bất thường
    if (w < 4 || h < 8 || countX < 6) continue;

    glyphs.push({ minX, maxX, minY, maxY, avgX, d });
  }

  if (glyphs.length < 4 || glyphs.length > 7) return null;

  // Sắp xếp các ký tự theo tọa độ trọng tâm X từ trái sang phải
  glyphs.sort((a, b) => a.avgX - b.avgX);

  const segments: SegmentedChar[] = [];

  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    const w = g.maxX - g.minX;
    const h = g.maxY - g.minY;

    const charCanvas = document.createElement('canvas');
    charCanvas.width = CANONICAL_WIDTH;
    charCanvas.height = CANONICAL_HEIGHT;
    const charCtx = charCanvas.getContext('2d', { willReadFrequently: true });
    if (!charCtx) continue;

    charCtx.fillStyle = '#FFFFFF';
    charCtx.fillRect(0, 0, CANONICAL_WIDTH, CANONICAL_HEIGHT);

    const targetW = CANONICAL_WIDTH - 2;
    const targetH = CANONICAL_HEIGHT - 2;
    const scale = Math.min(targetW / (w || 1), targetH / (h || 1));
    const destW = Math.max(1, Math.round(w * scale));
    const destH = Math.max(1, Math.round(h * scale));
    const offsetX = 1 + Math.round((targetW - destW) / 2);
    const offsetY = 1 + Math.round((targetH - destH) / 2);

    charCtx.save();
    charCtx.translate(offsetX, offsetY);
    charCtx.scale(scale, scale);
    charCtx.translate(-g.minX, -g.minY);

    charCtx.fillStyle = '#000000';
    if (typeof Path2D !== 'undefined') {
      try {
        charCtx.fill(new Path2D(g.d));
      } catch {
        charCtx.restore();
        continue;
      }
    }
    charCtx.restore();

    const charImgData = charCtx.getImageData(0, 0, CANONICAL_WIDTH, CANONICAL_HEIGHT);
    const cData = charImgData.data;
    const grid = new Uint8Array(CANONICAL_WIDTH * CANONICAL_HEIGHT);

    for (let p = 0; p < grid.length; p++) {
      const pIdx = p * 4;
      const lum = 0.299 * cData[pIdx] + 0.587 * cData[pIdx + 1] + 0.114 * cData[pIdx + 2];
      grid[p] = lum < 150 ? 1 : 0;
    }

    const holes = countEnclosedHoles(grid, CANONICAL_WIDTH, CANONICAL_HEIGHT);

    segments.push({
      charIndex: segments.length,
      canvas: charCanvas,
      binaryGrid: grid,
      width: w,
      height: h,
      aspectRatio: w / (h || 1),
      holesCount: holes,
      x: g.minX,
      y: g.minY
    });
  }

  return segments.length >= 4 ? segments : null;
}

/**
 * Chuẩn hóa ảnh và phân đoạn (Character Segmentation) thành từng ký tự độc lập từ trái sang phải.
 */
export async function segmentCaptchaImage(
  imageSource: string,
  binarizeThreshold = 145
): Promise<{ segments: SegmentedChar[]; debugCanvas?: HTMLCanvasElement }> {
  if (typeof window === 'undefined' || !imageSource) {
    return { segments: [] };
  }

  // 1. Thử phân đoạn trực tiếp từ vector SVG nếu là ảnh SVG (tốc độ < 1ms, độ chính xác tuyệt đối)
  let rawSvg = '';
  if (imageSource.includes('<svg')) {
    rawSvg = imageSource;
  } else if (imageSource.startsWith('data:image/svg+xml;base64,')) {
    try {
      rawSvg = atob(imageSource.replace('data:image/svg+xml;base64,', ''));
    } catch {}
  } else if (imageSource.startsWith('data:image/svg+xml')) {
    try {
      rawSvg = decodeURIComponent(imageSource.replace(/^data:image\/svg\+xml;[^,]+,/, ''));
    } catch {}
  }

  if (rawSvg && typeof Path2D !== 'undefined') {
    const directSegments = segmentSvgDirectly(rawSvg);
    if (directSegments && directSegments.length >= 4 && directSegments.length <= 7) {
      return { segments: directSegments };
    }
  }

  // 2. Khử đường gạch nhiễu SVG fill="none" và chèn nền trắng cho luồng Canvas Raster
  let preparedSrc = imageSource;
  if (imageSource.includes('<svg') || imageSource.startsWith('data:image/svg+xml')) {
    if (imageSource.startsWith('data:image/svg+xml;base64,')) {
      try {
        const decoded = atob(imageSource.replace('data:image/svg+xml;base64,', ''));
        const cleaned = cleanGdtSvgString(decoded);
        preparedSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleaned)}`;
      } catch {
        preparedSrc = imageSource;
      }
    } else if (imageSource.includes('<svg')) {
      const cleaned = cleanGdtSvgString(imageSource);
      preparedSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleaned)}`;
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => resolve({ segments: [] }), 2500);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const rawW = img.naturalWidth || img.width || 200;
        const rawH = img.naturalHeight || img.height || 40;

        const scale = 2.0;
        const width = Math.round(rawW * scale);
        const height = Math.round(rawH * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve({ segments: [] });
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        const binaryMatrix = new Uint8Array(width * height);
        const colDensity = new Int32Array(width);

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            if (lum < binarizeThreshold) {
              binaryMatrix[y * width + x] = 1;
              colDensity[x]++;
              data[idx] = 0;
              data[idx + 1] = 0;
              data[idx + 2] = 0;
            } else {
              binaryMatrix[y * width + x] = 0;
              data[idx] = 255;
              data[idx + 1] = 255;
              data[idx + 2] = 255;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // Quét biểu đồ hình chiếu dọc theo trục X để tìm các vùng chứa ký tự
        const rawRegions: Array<{ startX: number; endX: number }> = [];
        let inChar = false;
        let startX = 0;
        const noiseColThreshold = 2;

        for (let x = 0; x < width; x++) {
          if (colDensity[x] >= noiseColThreshold) {
            if (!inChar) {
              inChar = true;
              startX = x;
            }
          } else {
            if (inChar) {
              inChar = false;
              if (x - startX >= 6) {
                rawRegions.push({ startX, endX: x - 1 });
              }
            }
          }
        }
        if (inChar && width - startX >= 6) {
          rawRegions.push({ startX, endX: width - 1 });
        }

        // Tách các ký tự bị dính nhau nếu một khối quá rộng
        const refinedRegions: Array<{ startX: number; endX: number }> = [];
        const avgCharWidth = width / 7;

        for (const reg of rawRegions) {
          const w = reg.endX - reg.startX + 1;
          if (w > avgCharWidth * 1.65) {
            const mid = Math.round((reg.startX + reg.endX) / 2);
            const searchWindow = Math.round(w * 0.25);
            let minDensity = 9999;
            let splitX = mid;

            for (let x = mid - searchWindow; x <= mid + searchWindow; x++) {
              if (colDensity[x] < minDensity) {
                minDensity = colDensity[x];
                splitX = x;
              }
            }

            refinedRegions.push({ startX: reg.startX, endX: splitX });
            refinedRegions.push({ startX: splitX + 1, endX: reg.endX });
          } else {
            refinedRegions.push(reg);
          }
        }

        const segments: SegmentedChar[] = [];

        for (let i = 0; i < refinedRegions.length; i++) {
          const reg = refinedRegions[i];
          const segW = reg.endX - reg.startX + 1;

          let minY = height, maxY = 0;
          for (let y = 0; y < height; y++) {
            for (let x = reg.startX; x <= reg.endX; x++) {
              if (binaryMatrix[y * width + x] === 1) {
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          if (minY >= maxY || maxY - minY < 8) continue;
          const segH = maxY - minY + 1;

          const charCanvas = document.createElement('canvas');
          charCanvas.width = CANONICAL_WIDTH;
          charCanvas.height = CANONICAL_HEIGHT;
          const charCtx = charCanvas.getContext('2d', { willReadFrequently: true });
          if (!charCtx) continue;

          charCtx.fillStyle = '#FFFFFF';
          charCtx.fillRect(0, 0, CANONICAL_WIDTH, CANONICAL_HEIGHT);
          charCtx.imageSmoothingEnabled = true;

          const targetW = CANONICAL_WIDTH - 2;
          const targetH = CANONICAL_HEIGHT - 2;
          const segScale = Math.min(targetW / (segW || 1), targetH / (segH || 1));
          const destW = Math.max(1, Math.round(segW * segScale));
          const destH = Math.max(1, Math.round(segH * segScale));
          const offsetX = 1 + Math.round((targetW - destW) / 2);
          const offsetY = 1 + Math.round((targetH - destH) / 2);

          charCtx.drawImage(
            canvas,
            reg.startX, minY, segW, segH,
            offsetX, offsetY, destW, destH
          );

          const charImgData = charCtx.getImageData(0, 0, CANONICAL_WIDTH, CANONICAL_HEIGHT);
          const cData = charImgData.data;
          const grid = new Uint8Array(CANONICAL_WIDTH * CANONICAL_HEIGHT);

          for (let p = 0; p < grid.length; p++) {
            const pIdx = p * 4;
            const lum = 0.299 * cData[pIdx] + 0.587 * cData[pIdx + 1] + 0.114 * cData[pIdx + 2];
            grid[p] = lum < 150 ? 1 : 0;
          }

          const holes = countEnclosedHoles(grid, CANONICAL_WIDTH, CANONICAL_HEIGHT);

          segments.push({
            charIndex: segments.length,
            canvas: charCanvas,
            binaryGrid: grid,
            width: segW,
            height: segH,
            aspectRatio: segW / segH,
            holesCount: holes,
            x: reg.startX,
            y: minY
          });
        }

        resolve({ segments, debugCanvas: canvas });
      } catch (err) {
        console.warn('[Segment Captcha Error]:', err);
        resolve({ segments: [] });
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve({ segments: [] });
    };

    img.src = preparedSrc;
  });
}

/**
 * Đo độ tương đồng giữa ký tự đã tách với một mẫu bằng thuật toán Dice Coefficient kết hợp Euler loop.
 */
export function calculateTemplateSimilarity(
  char: SegmentedChar,
  template: TemplateGlyph
): number {
  const g1 = char.binaryGrid;
  const g2 = template.binaryGrid;
  const len = g1.length;

  let strokeOverlap = 0;
  let strokeC1 = 0;
  let strokeC2 = 0;
  let bgOverlap = 0;

  for (let i = 0; i < len; i++) {
    const v1 = g1[i];
    const v2 = g2[i];

    if (v1 === 1) strokeC1++;
    if (v2 === 1) strokeC2++;

    if (v1 === 1 && v2 === 1) {
      strokeOverlap++;
    } else if (v1 === 0 && v2 === 0) {
      bgOverlap++;
    }
  }

  if (strokeC1 === 0 || strokeC2 === 0) return 0;

  // Dice Similarity Coefficient: 2 * |A ∩ B| / (|A| + |B|)
  const diceScore = (2 * strokeOverlap) / (strokeC1 + strokeC2);

  // Background Overlap ratio
  const bgScore = bgOverlap / len;

  // Topological Loop (vòng kín) matching penalty / bonus
  let loopScore = 0;
  if (char.holesCount === template.holesCount) {
    loopScore = 0.10;
  } else {
    loopScore = -0.25 * Math.abs(char.holesCount - template.holesCount);
  }

  // Tỉ lệ khung hình (Aspect Ratio Similarity)
  const ratioDiff = Math.abs(char.aspectRatio - template.aspectRatio);
  const ratioScore = Math.max(0, 1 - ratioDiff * 2.0) * 0.15;

  // Ràng buộc hình học topology đặc thù của Comismsh:
  let topologyPenalty = 0;

  // Nếu ký tự có 2 vòng kín (holes = 2) -> bắt buộc là 'B' hoặc '8'
  if (char.holesCount === 2 && template.char !== '8' && template.char !== 'B') {
    topologyPenalty -= 0.40;
  } else if (char.holesCount === 0 && (template.char === '8' || template.char === 'B')) {
    topologyPenalty -= 0.40;
  }

  // Nếu ký tự có 0 vòng kín nhưng mẫu là chữ có vòng kín kín đáo ('O', 'D', '0')
  if (char.holesCount === 0 && ['O', 'D', '0', 'Q', 'P'].includes(template.char)) {
    topologyPenalty -= 0.15;
  }

  // Ký tự cực rộng (W, M) vs ký tự hẹp (1, I, J, L)
  if (char.aspectRatio > 1.25 && !['W', 'M', 'A'].includes(template.char)) {
    topologyPenalty -= 0.30;
  }
  if (char.aspectRatio < 0.45 && !['1', 'I', 'J', 'L'].includes(template.char)) {
    topologyPenalty -= 0.30;
  }

  // Ký tự '1' vs 'I': 'I' trong Comismsh là nét đơn cực hẹp (ratio ~0.23), '1' có mỏ nghiêng (ratio ~0.44)
  if (char.aspectRatio < 0.32 && template.char === '1') {
    topologyPenalty -= 0.20;
  }

  const finalScore = (diceScore * 0.65) + (bgScore * 0.10) + loopScore + ratioScore + topologyPenalty;

  return Math.max(0, Math.min(1, finalScore));
}

/**
 * So khớp một ký tự đơn lẻ với toàn bộ 36 ký tự trong Template Bank
 */
export function matchSingleCharacter(
  segment: SegmentedChar,
  bank: Map<string, TemplateGlyph[]>
): CharacterMatchResult {
  let bestChar = '?';
  let bestScore = 0;
  let secondChar = '?';
  let secondScore = 0;

  for (const [candidateChar, templates] of bank.entries()) {
    let maxCandidateScore = 0;

    for (const tmpl of templates) {
      const score = calculateTemplateSimilarity(segment, tmpl);
      if (score > maxCandidateScore) {
        maxCandidateScore = score;
      }
    }

    if (maxCandidateScore > bestScore) {
      secondScore = bestScore;
      secondChar = bestChar;
      bestScore = maxCandidateScore;
      bestChar = candidateChar;
    } else if (maxCandidateScore > secondScore) {
      secondScore = maxCandidateScore;
      secondChar = candidateChar;
    }
  }

  return {
    char: bestChar,
    confidence: Math.round(bestScore * 100),
    secondaryMatch: secondChar !== '?' ? { char: secondChar, confidence: Math.round(secondScore * 100) } : undefined
  };
}

/**
 * Module chính: Giải mã CAPTCHA bằng Template Matching hoàn toàn phía Client.
 * Tự động phân đoạn ảnh, so khớp mẫu điểm ảnh Comismsh, trả về mã và cờ cần fallback.
 */
export async function solveCaptchaWithClientTemplateMatching(
  imageSource: string,
  options: TemplateMatchingOptions = {}
): Promise<ClientCaptchaSolveResult> {
  const startTime = Date.now();
  const expectedLength = options.expectedLength ?? 6;

  // 1. Đảm bảo phông chữ Comismsh.ttf đã được nạp
  await ensureFontLoaded();

  // 2. Khởi tạo kho mẫu Template Bank trong RAM (sử dụng phông Comismsh chuẩn)
  const bank = initializeTemplateBank();

  // 3. Phân đoạn ký tự từ ảnh đầu vào
  const { segments } = await segmentCaptchaImage(imageSource, options.binarizeThreshold);

  if (segments.length === 0) {
    return {
      success: false,
      code: '',
      confidence: 0,
      needsFallback: true,
      segmentedCount: 0,
      characters: [],
      executionTimeMs: Date.now() - startTime,
      engine: 'client-template-matching'
    };
  }

  // 4. So khớp từng ký tự đơn lẻ
  const matches: CharacterMatchResult[] = [];
  let totalConfidence = 0;

  for (const seg of segments) {
    const match = matchSingleCharacter(seg, bank);
    matches.push(match);
    totalConfidence += match.confidence;
  }

  const avgConfidence = Math.round(totalConfidence / (matches.length || 1));
  const detectedCode = matches.map(m => m.char).join('').toUpperCase();

  // 5. Đánh giá tính hợp lệ
  const validLength = matches.length >= 4 && matches.length <= (expectedLength + 1);
  const minConfidence = options.minConfidenceThreshold ?? 30;
  const acceptableConfidence = avgConfidence >= minConfidence;
  const needsFallback = !validLength || !acceptableConfidence || detectedCode.includes('?');

  return {
    success: !needsFallback,
    code: detectedCode,
    confidence: avgConfidence,
    needsFallback,
    segmentedCount: segments.length,
    characters: matches,
    executionTimeMs: Date.now() - startTime,
    engine: 'client-template-matching'
  };
}
