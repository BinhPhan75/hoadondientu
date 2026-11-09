import { GoogleGenAI } from '@google/genai';
import { createHash } from 'node:crypto';

export const VNPT_CAPTCHA_PROMPT =
  'Read the 4 digits in this captcha image. Ignore background noise. Output ONLY the 4 digits.';
export const EASYINVOICE_CAPTCHA_PROMPT = VNPT_CAPTCHA_PROMPT;
export const CAPTCHA_PROMPT = VNPT_CAPTCHA_PROMPT;
export const ALPHANUMERIC_CAPTCHA_PROMPT =
  'Read the 4 to 6 alphanumeric characters in this captcha image. Output ONLY those characters, no explanation.';

export interface CaptchaRequestOptions {
  customApiKey?: string;
  alphanumeric?: boolean;
  timeoutMs?: number;
}

type CacheEntry = { expires: number; promise: Promise<string> };
const attempts = new Map<string, CacheEntry>();
const blockedKeys = new Map<string, number>();
const usage = { requests: 0, cacheHits: 0, failures: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0 };

export function getCaptchaUsage() { return { ...usage }; }

function imagePart(input: Buffer | Uint8Array | string) {
  if (typeof input === 'string') {
    const dataUri = input.trim().match(/^data:(image\/[^;]+);base64,([\s\S]+)$/);
    if (dataUri) return { mimeType: dataUri[1], data: dataUri[2] };
    if (input.trim().startsWith('<svg')) return { mimeType: 'image/svg+xml', data: Buffer.from(input).toString('base64') };
  }
  const bytes = typeof input === 'string' ? Buffer.from(input, 'base64') : Buffer.from(input);
  const signature = bytes.subarray(0, 12).toString('latin1');
  const mimeType = signature.startsWith('GIF') ? 'image/gif'
    : bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
    : signature.startsWith('RIFF') ? 'image/webp'
    : signature.startsWith('BM') ? 'image/bmp' : 'image/png';
  return { mimeType, data: bytes.toString('base64') };
}

export async function solveCaptchaWithGemini(
  input: string | Buffer | Uint8Array,
  customPrompt?: string,
  options: CaptchaRequestOptions = {},
): Promise<string> {
  const apiKey = options.customApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY chưa được cấu hình.');
  if (process.env.CAPTCHA_AI_ENABLED === 'false') throw new Error('OCR AI đã tắt. Vui lòng nhập CAPTCHA thủ công.');
  let configuredModel = process.env.CAPTCHA_AI_MODEL || 'gemini-3.1-flash-lite';
  if (configuredModel === 'gemini-flash-latest' || configuredModel.includes('1.5') || configuredModel.includes('2.0') || configuredModel.includes('2.5')) {
    configuredModel = 'gemini-3.1-flash-lite';
  }
  const model = configuredModel;
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  if ((blockedKeys.get(keyHash) || 0) > Date.now()) {
    throw new Error('Hạn mức AI nhận diện Captcha tạm hết lượt hôm nay. Vui lòng nhập thủ công.');
  }
  const image = imagePart(input);
  const prompt = customPrompt || VNPT_CAPTCHA_PROMPT;
  const alphanumeric = options.alphanumeric ?? /alphanumeric/i.test(prompt);
  const fingerprint = createHash('sha256').update(JSON.stringify([keyHash, model, image, prompt, alphanumeric])).digest('hex');
  for (const [key, entry] of attempts) {
    if (entry.expires <= Date.now()) attempts.delete(key);
  }
  const existing = attempts.get(fingerprint);
  if (existing) { usage.cacheHits++; return existing.promise; }
  // Bound memory; refuse additional work instead of evicting an in-flight call.
  if (attempts.size >= 512) throw new Error('OCR đang bận. Vui lòng thử lại sau.');
  // Gemini rejects explicitly configured deadlines below 10 seconds.
  const timeoutMs = Math.min(Math.max(options.timeoutMs || 12000, 10000), 12000);
  const work = (async () => {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
          timeout: timeoutMs,
        },
      });
      usage.requests++;
      
      const candidateModels = [model, 'gemini-3.1-flash-lite'].filter((v, i, a) => a.indexOf(v) === i);
      let response: any = null;
      let lastModelError: any = null;

      for (const candidate of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: candidate,
            contents: [{ inlineData: image }, { text: prompt }],
            config: {
              maxOutputTokens: 32,
              abortSignal: AbortSignal.timeout(timeoutMs),
            },
          });
          if (response && response.text) break;
        } catch (candErr: any) {
          lastModelError = candErr;
          console.warn(`[OCR AI model ${candidate} failed]:`, candErr.message?.substring(0, 80));
        }
      }

      if (!response || !response.text) {
        throw lastModelError || new Error('Không nhận diện được nội dung từ các mô hình AI.');
      }

      usage.inputTokens += response.usageMetadata?.promptTokenCount || 0;
      usage.outputTokens += response.usageMetadata?.candidatesTokenCount || 0;
      usage.thinkingTokens += response.usageMetadata?.thoughtsTokenCount || 0;
      console.info('[CAPTCHA usage]', JSON.stringify({ model, ...usage }));
      const rawText = (response.text || '').trim();
      const cleanChars = rawText.replace(/[^a-zA-Z0-9]/g, '');
      if (alphanumeric) {
        if (/^[a-zA-Z0-9]{4,6}$/.test(cleanChars)) {
          return cleanChars.toUpperCase();
        }
        const match = rawText.match(/[a-zA-Z0-9]{4,6}/);
        if (match) return match[0].toUpperCase();
      } else {
        const digits = rawText.replace(/[^0-9]/g, '');
        if (/^\d{4}$/.test(digits)) return digits;
      }
      throw new Error(`OCR trả về mã không hợp lệ: "${rawText}".`);
    } catch (error: any) {
      usage.failures++;
      const message = String(error?.message || error);
      if (/429|RESOURCE_EXHAUSTED|spending cap|quota/i.test(message)) {
        if (blockedKeys.size >= 128) blockedKeys.delete(blockedKeys.keys().next().value!);
        blockedKeys.set(keyHash, Date.now() + 20000); // 20s temporary backoff
      }
      throw error;
    }
  })();
  attempts.set(fingerprint, { expires: Date.now() + 120000, promise: work });
  return work;
}
