/**
 * Helper to convert SVG captcha from GDT Portal to high-resolution crisp PNG
 * using HTML5 Offscreen Canvas. This enables Gemini Vision / Local Tesseract to see
 * the rendered glyphs instead of parsing raw SVG markup, increasing OCR accuracy.
 */

export function cleanGdtSvgString(svg: string): string {
  if (!svg || typeof svg !== 'string') return svg;
  return svg.replace(/<path[^>]*stroke=[^>]*fill="none"[^>]*\/>/gi, '');
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
 * Khử sạch các đường gạch ngang, vạch cắt ngang và nhiễu hoa văn mờ bằng HTML5 Canvas binarization.
 */
export async function preprocessPosCaptchaImage(imageSrc: string): Promise<string> {
  if (typeof window === 'undefined' || !imageSrc) return imageSrc;

  // Nếu là SVG, chuyển đổi sang PNG sắc nét trước
  let basePng = imageSrc;
  if (imageSrc.includes('<svg') || imageSrc.startsWith('data:image/svg+xml')) {
    basePng = await convertSvgToSharpPng(imageSrc);
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      resolve(basePng);
    }, 2500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(basePng);
          return;
        }

        const width = img.naturalWidth || img.width || 200;
        const height = img.naturalHeight || img.height || 60;
        canvas.width = width;
        canvas.height = height;

        // Vẽ nền trắng
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Ngưỡng binarization linh hoạt để tẩy vạch gạch mờ và giữ nét chữ
        const threshold = 145;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Độ xám theo chuẩn cảm nhận mắt người
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

          // Chuyển nét chữ đậm về ĐEN TUYỀN (0), còn vạch kẻ mờ & nền thành TRẮNG TINH (255)
          if (luminance < threshold) {
            data[i] = 0;       // Red
            data[i + 1] = 0;   // Green
            data[i + 2] = 0;   // Blue
          } else {
            data[i] = 255;     // Red
            data[i + 1] = 255; // Green
            data[i + 2] = 255; // Blue
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
        return;
      } catch (err) {
        console.warn('POS Preprocessing error:', err);
      }
      resolve(basePng);
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(basePng);
    };

    img.src = basePng;
  });
}
