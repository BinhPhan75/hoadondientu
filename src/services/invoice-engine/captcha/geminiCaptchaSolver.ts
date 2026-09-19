import { GoogleGenerativeAI } from '@google/generative-ai';

export const VNPT_CAPTCHA_PROMPT =
  'This is a 4-digit captcha image with a noisy gray background. Please ignore the background noise and strike-through lines, and focus only on identifying the 4 main numbers. Output ONLY the 4 digits, nothing else.';

export const CAPTCHA_PROMPT = VNPT_CAPTCHA_PROMPT;

const CANDIDATE_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'];

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình.');
  }
  return new GoogleGenerativeAI(apiKey);
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
  base64Image: string | Buffer | Uint8Array,
  customPrompt?: string
): Promise<string> {
  const promptToUse = customPrompt || VNPT_CAPTCHA_PROMPT;
  const image = toImagePart(base64Image);
  const genAI = getGenAI();

  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 20,
        },
      });

      const result = await model.generateContent([
        { inlineData: image },
        promptToUse,
      ]);
      const rawText = result.response.text();
      const digits = rawText.replace(/\D/g, '');

      if (digits.length === 4) {
        return digits;
      }

      // If the model returned full text containing 4 digits, extract the 4-digit group
      const match = rawText.match(/\b\d{4}\b/);
      if (match) {
        return match[0];
      }

      if (digits.length > 4) {
        return digits.slice(0, 4);
      }

      throw new Error(`Gemini (${modelName}) trả về mã Captcha không hợp lệ: "${rawText.trim()}"`);
    } catch (error: any) {
      lastError = error;
      console.warn(`[Gemini CAPTCHA] Model ${modelName} thất bại:`, error?.message || error);
    }
  }

  console.error('[Gemini CAPTCHA] Tất cả các model giải Captcha thất bại:', lastError?.message || lastError);
  throw lastError || new Error('Không thể giải Captcha bằng Gemini.');
}
