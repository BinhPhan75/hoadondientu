import { GoogleGenerativeAI } from '@google/generative-ai';

const CAPTCHA_PROMPT = 'Extract the 4-digit captcha code from this image. Output ONLY the 4 digits, nothing else.';
let model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình.');
  }

  if (!model) {
    const client = new GoogleGenerativeAI(apiKey);
    model = client.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 10,
      },
    });
  }
  return model;
}

function toImagePart(image: Buffer | Uint8Array | string): { data: string; mimeType: string } {
  if (Buffer.isBuffer(image) || image instanceof Uint8Array) {
    return { data: Buffer.from(image).toString('base64'), mimeType: 'image/png' };
  }

  const source = image.trim();
  const dataUri = source.match(/^data:(image\/[^;]+);base64,(.+)$/s);
  if (dataUri) {
    return { data: dataUri[2], mimeType: dataUri[1] };
  }

  return { data: source, mimeType: 'image/png' };
}

export async function solveCaptchaWithGemini(
  base64Image: string | Buffer | Uint8Array
): Promise<string> {
  try {
    const image = toImagePart(base64Image);
    const result = await getModel().generateContent([
      { inlineData: image },
      CAPTCHA_PROMPT,
    ]);
    const rawText = result.response.text();
    const digits = rawText.replace(/\D/g, '');

    if (digits.length !== 4) {
      throw new Error(`Gemini trả về mã Captcha không hợp lệ: "${rawText.trim()}"`);
    }

    return digits;
  } catch (error: any) {
    console.error('[Gemini CAPTCHA] Giải Captcha thất bại:', error?.message || error);
    throw error;
  }
}
