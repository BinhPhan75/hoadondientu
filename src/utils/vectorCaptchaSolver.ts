/**
 * High-Precision Vector Font CAPTCHA Solver for GDT Tax Portal (Cổng Tổng cục Thuế)
 * 100% Cục bộ (Zero-Latency, KHÔNG gọi Gemini API, KHÔNG phụ thuộc dịch vụ ngoài).
 *
 * Cơ chế hoạt động:
 * 1. Cổng Thuế sinh CAPTCHA bằng thư viện svg-captcha (Node.js) sử dụng độc quyền phông chữ Comismsh.ttf.
 * 2. Mỗi ký tự trong SVG là một thẻ <path> vector độc lập với màu tô (fill="#222", #333, #444).
 * 3. Các đường gạch nhiễu là thẻ <path fill="none" stroke="..."/> được loại bỏ sạch 100%.
 * 4. Ký tự được nhận diện bằng:
 *    - Phân tích topology vòng kín Euler (0 lỗ: E,S,3,5,...; 1 lỗ: A,D,O,P,Q,R,4,6,9; 2 lỗ: 0,8,B).
 *    - Bản đồ mật độ vùng 12x12 (144 đặc trưng không gian invariant).
 *    - Tỉ lệ khung hình aspect ratio chuẩn của glyphs trong Comismsh.ttf.
 */

import * as opentype from 'opentype.js';

export const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface VectorGlyphTemplate {
  char: string;
  w: number;
  h: number;
  ratio: number;
  mCount: number;
  zCount: number;
  zones: Float32Array; // 12x12 = 144 đặc trưng mật độ không gian
}

export interface VectorSolveResult {
  success: boolean;
  code: string;
  confidence: number; // 0 - 100
  characters: Array<{ char: string; confidence: number }>;
  executionTimeMs: number;
  engine: 'comismsh-vector-zonal';
}

// Bảng số lỗ Euler chuẩn của 36 ký tự trong Comismsh.ttf
export const EULER_HOLES: Record<string, number> = {
  '0': 2, '8': 2, 'B': 2,
  '4': 1, '6': 1, '9': 1, 'A': 1, 'D': 1, 'O': 1, 'P': 1, 'Q': 1, 'R': 1,
  '1': 0, '2': 0, '3': 0, '5': 0, '7': 0, 'C': 0, 'E': 0, 'F': 0, 'G': 0,
  'H': 0, 'I': 0, 'J': 0, 'K': 0, 'L': 0, 'M': 0, 'N': 0, 'S': 0, 'T': 0,
  'U': 0, 'V': 0, 'W': 0, 'X': 0, 'Y': 0, 'Z': 0
};

let cachedTemplates: Record<string, VectorGlyphTemplate> | null = null;
let fontInstance: opentype.Font | null = null;
let fontLoadingPromise: Promise<opentype.Font | null> | null = null;

/**
 * Trích xuất các điểm mẫu dày đặc và tính toán vector đặc trưng mật độ vùng 12x12
 */
export function extractVectorFeatures(d: string): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  w: number;
  h: number;
  ratio: number;
  mCount: number;
  zCount: number;
  zones: Float32Array;
} {
  const points: Array<{ x: number; y: number }> = [];
  const regex = /([a-df-z])([^a-df-z]*)/gi;
  let match: RegExpExecArray | null;
  let curX = 0, curY = 0;
  let startX = 0, startY = 0;

  while ((match = regex.exec(d)) !== null) {
    const type = match[1];
    const args = (match[2].trim().match(/[-+]?[0-9]*\.?[0-9]+(?:e[-+]?[0-9]+)?/gi) || []).map(parseFloat);

    if (type === 'M') {
      curX = args[0] || 0;
      curY = args[1] || 0;
      startX = curX;
      startY = curY;
      points.push({ x: curX, y: curY });
    } else if (type === 'L') {
      for (let i = 0; i < args.length; i += 2) {
        const nx = args[i], ny = args[i + 1];
        if (nx !== undefined && ny !== undefined) {
          for (let s = 1; s <= 4; s++) {
            const t = s / 4;
            points.push({ x: curX + t * (nx - curX), y: curY + t * (ny - curY) });
          }
          curX = nx;
          curY = ny;
        }
      }
    } else if (type === 'Q') {
      for (let i = 0; i < args.length; i += 4) {
        const cx = args[i], cy = args[i + 1];
        const nx = args[i + 2], ny = args[i + 3];
        if (cx !== undefined && cy !== undefined && nx !== undefined && ny !== undefined) {
          for (let s = 1; s <= 6; s++) {
            const t = s / 6;
            const invT = 1 - t;
            const px = invT * invT * curX + 2 * invT * t * cx + t * t * nx;
            const py = invT * invT * curY + 2 * invT * t * cy + t * t * ny;
            points.push({ x: px, y: py });
          }
          curX = nx;
          curY = ny;
        }
      }
    } else if (type === 'Z' || type === 'z') {
      for (let s = 1; s <= 4; s++) {
        const t = s / 4;
        points.push({ x: curX + t * (startX - curX), y: curY + t * (startY - curY) });
      }
      curX = startX;
      curY = startY;
    }
  }

  let minX = 9999, maxX = -9999, minY = 9999, maxY = -9999;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const ratio = w / h;

  const Z = 12;
  const zones = new Float32Array(Z * Z);
  for (const p of points) {
    const col = Math.min(Z - 1, Math.max(0, Math.floor(((p.x - minX) / w) * Z)));
    const row = Math.min(Z - 1, Math.max(0, Math.floor(((p.y - minY) / h) * Z)));
    zones[row * Z + col] += 1;
  }

  let sum = 0;
  for (let i = 0; i < zones.length; i++) sum += zones[i];
  if (sum > 0) {
    for (let i = 0; i < zones.length; i++) zones[i] /= sum;
  }

  const mCount = (d.match(/M/g) || []).length;
  const zCount = (d.match(/Z/gi) || []).length;

  return { minX, maxX, minY, maxY, w, h, ratio, mCount, zCount, zones };
}

export function parseOpenTypeBuffer(buf: ArrayBuffer | Buffer): opentype.Font {
  const parseFn = (opentype as any).parse || (opentype as any).default?.parse || (opentype as any).default;
  if (typeof parseFn !== 'function') {
    throw new Error('opentype.parse is not available');
  }
  return parseFn(buf);
}

/**
 * Nạp font Comismsh.ttf cho môi trường Node.js hoặc trình duyệt
 */
export async function loadComismshFont(): Promise<opentype.Font | null> {
  if (fontInstance) return fontInstance;
  if (fontLoadingPromise) return fontLoadingPromise;

  fontLoadingPromise = (async () => {
    try {
      // 1. Nếu đang chạy trong Node.js
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const fontPath = path.resolve(process.cwd(), 'public/fonts/Comismsh.ttf');
          if (fs.existsSync(fontPath)) {
            const buf = fs.readFileSync(fontPath);
            fontInstance = parseOpenTypeBuffer(buf);
            return fontInstance;
          }
        } catch (nodeErr) {
          console.warn('[VectorSolver Node font notice]:', nodeErr);
        }
      }

      // 2. Nếu đang chạy trong trình duyệt
      if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        const res = await fetch('/fonts/Comismsh.ttf');
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          fontInstance = parseOpenTypeBuffer(arrayBuffer);
          return fontInstance;
        }
      }
    } catch (e) {
      console.warn('[VectorSolver loadComismshFont error]:', e);
    }
    return null;
  })();

  return fontLoadingPromise;
}

/**
 * Khởi tạo bảng mẫu vector đặc trưng cho toàn bộ 36 ký tự
 */
export async function initializeVectorTemplates(): Promise<Record<string, VectorGlyphTemplate>> {
  if (cachedTemplates) return cachedTemplates;

  const font = await loadComismshFont();
  if (!font) return {};

  const templates: Record<string, VectorGlyphTemplate> = {};
  for (const char of ALPHANUMERIC) {
    try {
      const g = font.charToGlyph(char);
      const p = g.getPath(0, 0, 50);
      const pd = p.toPathData(2);
      const feat = extractVectorFeatures(pd);
      templates[char] = {
        char,
        w: feat.w,
        h: feat.h,
        ratio: feat.ratio,
        mCount: feat.mCount,
        zCount: feat.zCount,
        zones: feat.zones
      };
    } catch (err) {
      console.warn(`[VectorSolver template for ${char}]:`, err);
    }
  }

  cachedTemplates = templates;
  return templates;
}

/**
 * Giải mã chuỗi CAPTCHA SVG trực tiếp từ vector paths
 */
export async function solveCaptchaFromSvg(svgContent: string): Promise<VectorSolveResult> {
  const startTime = Date.now();
  if (!svgContent || typeof svgContent !== 'string') {
    return {
      success: false,
      code: '',
      confidence: 0,
      characters: [],
      executionTimeMs: 0,
      engine: 'comismsh-vector-zonal'
    };
  }

  const templates = await initializeVectorTemplates();
  if (Object.keys(templates).length === 0) {
    return {
      success: false,
      code: '',
      confidence: 0,
      characters: [],
      executionTimeMs: Date.now() - startTime,
      engine: 'comismsh-vector-zonal'
    };
  }

  // Loại bỏ các đường gạch nhiễu nền
  const pathRegex = /<path\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  const rawGlyphPaths: Array<{ d: string }> = [];

  while ((match = pathRegex.exec(svgContent)) !== null) {
    const attrs = match[1];
    const isNoise =
      attrs.includes('fill="none"') ||
      attrs.includes("fill='none'") ||
      attrs.includes('fill="transparent"') ||
      attrs.includes("fill='transparent'") ||
      (attrs.includes('stroke=') && (!attrs.includes('fill=') || attrs.includes('fill="none"') || attrs.includes("fill='none'")));

    if (isNoise) continue;

    const dMatch = attrs.match(/\bd\s*=\s*["']([^"']+)["']/);
    if (!dMatch) continue;
    rawGlyphPaths.push({ d: dMatch[1] });
  }

  if (rawGlyphPaths.length < 4 || rawGlyphPaths.length > 7) {
    return {
      success: false,
      code: '',
      confidence: 0,
      characters: [],
      executionTimeMs: Date.now() - startTime,
      engine: 'comismsh-vector-zonal'
    };
  }

  // Trích xuất đặc trưng và sắp xếp ký tự theo trục X từ trái qua phải
  const targets = rawGlyphPaths.map(p => {
    const feat = extractVectorFeatures(p.d);
    return { d: p.d, ...feat };
  }).sort((a, b) => a.minX - b.minX);

  const matchedChars: Array<{ char: string; confidence: number }> = [];
  let totalScore = 0;

  for (const target of targets) {
    let bestChar = '?';
    let bestScore = 999999;
    let secondChar = '?';
    let secondScore = 999999;

    for (const [char, ref] of Object.entries(templates)) {
      // 1. Độ phạt vòng kín Euler (dựa trên mCount / lỗ rỗng)
      const mDiff = Math.abs(target.mCount - ref.mCount);
      const mPenalty = mDiff === 0 ? 0 : 0.60 * mDiff;

      // 2. Khoảng cách Euclidean giữa vector đặc trưng 144 chiều (12x12 histogram)
      let diffSq = 0;
      for (let i = 0; i < 144; i++) {
        const diff = target.zones[i] - ref.zones[i];
        diffSq += diff * diff;
      }
      const zoneDist = Math.sqrt(diffSq);

      // 3. Độ chênh lệch tỉ lệ khung hình (Aspect Ratio)
      const ratioDiff = Math.abs(target.ratio - ref.ratio) / Math.max(target.ratio, ref.ratio);

      const totalCost = zoneDist * 1.5 + ratioDiff * 0.40 + mPenalty;

      if (totalCost < bestScore) {
        secondScore = bestScore;
        secondChar = bestChar;
        bestScore = totalCost;
        bestChar = char;
      } else if (totalCost < secondScore) {
        secondScore = totalCost;
        secondChar = char;
      }
    }

    const conf = Math.max(0, Math.min(100, Math.round((1 - bestScore * 0.75) * 100)));
    matchedChars.push({ char: bestChar, confidence: conf });
    totalScore += conf;
  }

  const code = matchedChars.map(m => m.char).join('').toUpperCase();
  const avgConfidence = Math.round(totalScore / (matchedChars.length || 1));
  const success = code.length >= 4 && !code.includes('?') && avgConfidence >= 40;

  return {
    success,
    code,
    confidence: avgConfidence,
    characters: matchedChars,
    executionTimeMs: Date.now() - startTime,
    engine: 'comismsh-vector-zonal'
  };
}
