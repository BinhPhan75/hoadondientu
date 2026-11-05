import * as cheerio from 'cheerio';
import { solveCaptchaWithGemini, ALPHANUMERIC_CAPTCHA_PROMPT } from './invoice-engine/captcha/geminiCaptchaSolver';
import { OriginalInvoiceError } from './invoice-engine/OriginalInvoiceError';

export const THAISON_PORTAL_URL = 'https://einvoice.vn/tra-cuu';

export interface ThaiSonDownloadParams {
  lookupCode: string;
  sellerTaxCode?: string;
  invoiceNo?: string;
  invoiceSeries?: string;
  customApiKey?: string;
  timeoutMs?: number;
}
export interface ThaiSonDownloadResult {
  success: boolean;
  filename: string;
  contentType: string;
  pdfBuffer: Buffer;
  pdfBase64: string;
  sourceUrl: string;
  error?: string;
}

export function parseThaiSonForm(html: string) {
  const $ = cheerio.load(html);
  const form = $('form').filter((_, el) => $(el).find('input[name="MaNhanHoaDon"]').length > 0).first();
  const token = form.find('input[name="CaptchaDeText"]').val();
  const imagePath = form.find('img#CaptchaImage').attr('src');
  const error = form.find('.text-danger, .validation-summary-errors, .field-validation-error').text().trim();
  return { token: String(token || ''), imagePath, error };
}

export async function downloadOriginalThaiSonPdf(params: ThaiSonDownloadParams): Promise<ThaiSonDownloadResult> {
  if (!params.lookupCode?.trim()) throw new OriginalInvoiceError('Thái Sơn thiếu Mã nhận hóa đơn.', 'THAISON', 'LOOKUP_DATA_MISSING', 422);
  const signal = AbortSignal.timeout(Math.min(params.timeoutMs || 45000, 45000));
  const cookies = new Map<string, string>();
  const request = async (path: string, init: RequestInit = {}) => {
    let url = new URL(path, THAISON_PORTAL_URL);
    let method = init.method || 'GET';
    let body = init.body;
    for (let hop = 0; hop < 5; hop++) {
      if (url.origin !== new URL(THAISON_PORTAL_URL).origin) throw new Error('Cổng Thái Sơn chuyển hướng sang miền không được hỗ trợ.');
      const response = await fetch(url, {
        ...init, method, body, signal, redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Referer: THAISON_PORTAL_URL,
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: Array.from(cookies, ([key, value]) => key + '=' + value).join('; '),
        },
      });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0];
        const pos = pair.indexOf('=');
        if (pos > 0) cookies.set(pair.slice(0, pos).trim(), pair.slice(pos + 1));
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Thái Sơn trả về chuyển hướng thiếu địa chỉ.');
        url = new URL(location, url);
        if (response.status === 303 || ([301, 302].includes(response.status) && method === 'POST')) { method = 'GET'; body = undefined; }
        await response.body?.cancel();
        continue;
      }
      if (!response.ok) throw new Error('Cổng Thái Sơn trả về HTTP ' + response.status);
      return response;
    }
    throw new Error('Cổng Thái Sơn chuyển hướng quá nhiều lần.');
  };

  try {
    // Only a rejected CAPTCHA warrants a new challenge. Other errors stop here.
    for (let attempt = 0; attempt < 2; attempt++) {
      const page = await request(THAISON_PORTAL_URL);
      const form = parseThaiSonForm(await page.text());
      if (!form.token || !form.imagePath) throw new Error('Cổng Thái Sơn không trả về biểu mẫu tra cứu hợp lệ.');
      const image = await request(form.imagePath);
      const mime = (image.headers.get('content-type') || 'image/gif').split(';')[0];
      const bytes = Buffer.from(await image.arrayBuffer());
      const code = await solveCaptchaWithGemini('data:' + mime + ';base64,' + bytes.toString('base64'), ALPHANUMERIC_CAPTCHA_PROMPT, { customApiKey: params.customApiKey, alphanumeric: true });
      signal.throwIfAborted();
      const result = await request(THAISON_PORTAL_URL, {
        method: 'POST',
        body: new URLSearchParams({ MaNhanHoaDon: params.lookupCode.trim(), CaptchaDeText: form.token, CaptchaInputText: code }).toString(),
      });
      const html = await result.text();
      const error = parseThaiSonForm(html).error;
      if (error) {
        if (attempt === 0 && /captcha|mã kiểm tra|mã xác thực/i.test(error)) continue;
        throw new Error(error);
      }
      const pdfResponse = await request('/tra-cuu/tai-hoa-don-dien-tu?format=pdf');
      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      if (pdfBuffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('Cổng Thái Sơn chưa trả về PDF. Kiểm tra Mã nhận hóa đơn và phiên tra cứu.');
      return {
        success: true, contentType: 'application/pdf', pdfBuffer, pdfBase64: pdfBuffer.toString('base64'),
        filename: ['HoaDon_ThaiSon', params.sellerTaxCode || '', params.invoiceSeries || '', params.invoiceNo || ''].join('_') + '.pdf',
        sourceUrl: THAISON_PORTAL_URL,
      };
    }
    throw new Error('Thái Sơn từ chối CAPTCHA sau 2 lần thử.');
  } catch (error: any) {
    const timeout = signal.aborted;
    throw new OriginalInvoiceError(
      timeout ? 'Tra cứu Thái Sơn hết thời gian chờ. Vui lòng thử lại sau.' : 'Thái Sơn: ' + error.message,
      'THAISON', timeout ? 'PROVIDER_TIMEOUT' : 'ORIGINAL_DOWNLOAD_FAILED', timeout ? 504 : 502, THAISON_PORTAL_URL,
    );
  }
}

export async function downloadOriginalThaiSonXml(_params: ThaiSonDownloadParams): Promise<{ success: boolean; filename: string; xmlContent: string }> {
  // A new PDF lookup does not yield XML and needlessly consumes another CAPTCHA.
  throw new OriginalInvoiceError('Chưa hỗ trợ tải XML Thái Sơn tự động. Hãy tải XML tại cổng tra cứu.', 'THAISON', 'XML_NOT_SUPPORTED', 422, THAISON_PORTAL_URL);
}
