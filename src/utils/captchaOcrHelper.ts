/**
 * Helper to convert SVG captcha from GDT Portal to high-resolution crisp PNG
 * using HTML5 Offscreen Canvas. This enables Gemini Vision / Local Tesseract to see
 * the rendered glyphs instead of parsing raw SVG markup, increasing OCR accuracy.
 */

export function cleanGdtSvgString(svg: string): string {
  if (!svg || typeof svg !== 'string') return svg;
  let cleaned = svg
    .replace(/<path\b[^>]*\bfill\s*=\s*["']none["'][^>]*\/?>/gi, '')
    .replace(/<path\b[^>]*\bfill\s*=\s*["']none["'][^>]*><\/path>/gi, '')
    .replace(/<path\b[^>]*\bfill\s*=\s*["']transparent["'][^>]*\/?>/gi, '')
    .replace(/<path\b[^>]*\bfill\s*=\s*["']transparent["'][^>]*><\/path>/gi, '')
    .replace(/<line\b[^>]*\/?>/gi, '')
    .replace(/<polyline\b[^>]*\/?>/gi, '');

  if (cleaned.includes('<svg') && !cleaned.includes('fill="#ffffff"') && !cleaned.includes('fill="white"')) {
    cleaned = cleaned.replace(/<svg\b([^>]*)>/i, '<svg$1><rect width="100%" height="100%" fill="#ffffff"/>');
  }

  return cleaned;
}

export async function convertSvgToSharpPng(svgOrDataUri: string): Promise<string> {
  if (typeof window === 'undefined' || !svgOrDataUri) return svgOrDataUri;

  // Already a bitmap PNG or JPEG
  if (svgOrDataUri.startsWith('data:image/png') || svgOrDataUri.startsWith('data:image/jpeg')) {
    return svgOrDataUri;
  }

  let src = svgOrDataUri;
  if (src.startsWith('data:image/svg+xml;base64,')) {
    try {
      const decoded = atob(src.replace('data:image/svg+xml;base64,', ''));
      const cleaned = cleanGdtSvgString(decoded);
      src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleaned)}`;
    } catch {
      // keep original
    }
  } else if (!src.startsWith('data:image/svg+xml')) {
    if (src.includes('<svg')) {
      const cleaned = cleanGdtSvgString(src);
      src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleaned)}`;
    } else {
      return svgOrDataUri;
    }
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      resolve(svgOrDataUri);
    }, 2500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const scale = 2.5; // 2.5x upscaling for razor-sharp character rendering
        const baseWidth = img.naturalWidth || img.width || 130;
        const baseHeight = img.naturalHeight || img.height || 48;
        const w = Math.round(baseWidth * scale);
        const h = Math.round(baseHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // Solid white background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);

          // High quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);

          // Contrast optimization for OCR
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

            // Background whitening & noise reduction
            if (luminance > 205) {
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
            } else if (luminance < 160) {
              // Deepen dark text glyphs
              data[i] = Math.max(0, r - 35);
              data[i + 1] = Math.max(0, g - 35);
              data[i + 2] = Math.max(0, b - 35);
            }
          }
          ctx.putImageData(imgData, 0, 0);

          const pngData = canvas.toDataURL('image/png');
          resolve(pngData);
          return;
        }
      } catch (err) {
        console.warn('Canvas rasterization exception:', err);
      }
      resolve(svgOrDataUri);
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(svgOrDataUri);
    };

    img.src = src;
  });
}

/**
 * Tiền xử lý chuyên sâu cho CAPTCHA Hóa đơn máy tính tiền (POS Captcha).
 * Khử sạch các đường gạch ngang, vạch cắt ngang và nhiễu hoa văn mờ bằng HTML5 Canvas binarization,
 * đồng thời bổ sung viền trắng an toàn để Tesseract PSM 7 không bị mất nét chữ ở mép viền.
 */
export async function preprocessPosCaptchaImage(imageSrc: string): Promise<string> {
  if (typeof window === 'undefined' || !imageSrc) return imageSrc;

  // 1. Nếu là định dạng SVG, làm sạch các đường gạch nhiễu fill="none" và chèn nền trắng
  let baseSource = imageSrc;
  if (imageSrc.includes('<svg') || imageSrc.startsWith('data:image/svg+xml')) {
    if (imageSrc.startsWith('data:image/svg+xml;base64,')) {
      try {
        const decoded = atob(imageSrc.replace('data:image/svg+xml;base64,', ''));
        const cleaned = cleanGdtSvgString(decoded);
        baseSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleaned)}`;
      } catch {
        baseSource = imageSrc;
      }
    } else if (imageSrc.includes('<svg')) {
      const cleaned = cleanGdtSvgString(imageSrc);
      baseSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleaned)}`;
    }
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      resolve(baseSource);
    }, 2500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(baseSource);
          return;
        }

        const scale = 2.5;
        const padding = 12; // Viền trắng an toàn giúp Tesseract PSM 7 phân đoạn dòng chữ chính xác
        const rawW = img.naturalWidth || img.width || 200;
        const rawH = img.naturalHeight || img.height || 40;

        const scaledW = Math.round(rawW * scale);
        const scaledH = Math.round(rawH * scale);
        const totalW = scaledW + padding * 2;
        const totalH = scaledH + padding * 2;

        canvas.width = totalW;
        canvas.height = totalH;

        // Vẽ nền trắng
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, totalW, totalH);

        // Bật khử răng cưa chất lượng cao khi phóng to
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, padding, padding, scaledW, scaledH);

        const imgData = ctx.getImageData(0, 0, totalW, totalH);
        const data = imgData.data;

        // Binarization: Tách chữ và vạch mờ/nhiễu
        const threshold = 145;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Độ xám cảm nhận mắt người (ITU-R BT.601)
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

          if (luminance < threshold) {
            // Nét chữ: Đen tuyền 100%
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
          } else {
            // Nền & vạch mờ: Trắng tinh 100%
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          }
        }

        // Khử đốm nhỏ cô lập (Despeckle)
        for (let y = 1; y < totalH - 1; y++) {
          for (let x = 1; x < totalW - 1; x++) {
            const idx = (y * totalW + x) * 4;
            if (data[idx] === 0) {
              let blackNeighbors = 0;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  const nIdx = ((y + dy) * totalW + (x + dx)) * 4;
                  if (data[nIdx] === 0) blackNeighbors++;
                }
              }
              if (blackNeighbors < 2) {
                data[idx] = 255;
                data[idx + 1] = 255;
                data[idx + 2] = 255;
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
        return;
      } catch (err) {
        console.warn('POS Preprocessing error:', err);
      }
      resolve(baseSource);
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(baseSource);
    };

    img.src = baseSource;
  });
}

/**
 * Bộ lọc regex hậu xử lý cho mã Captcha POS ở phía client
 * Loại bỏ ký tự đặc biệt, dấu câu, rác phân đoạn, đưa về 4-6 ký tự in hoa/chữ số
 */
export function cleanPosCaptchaOcrResult(rawText: string, expectedLength = 6): string {
  if (!rawText) return '';
  let cleaned = rawText
    .replace(/[|\\/_~—–\-.,:;'"“”`*#^!?()[\]{}<>+=$@%&]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (cleaned.length > expectedLength) {
    const match = cleaned.match(/[A-Z0-9]{4,6}/);
    if (match && match[0].length >= 4 && match[0].length <= expectedLength) {
      return match[0];
    }
    return cleaned.substring(0, expectedLength);
  }
  return cleaned;
}

export { solveCaptchaWithClientTemplateMatching } from './clientTemplateCaptchaSolver';

