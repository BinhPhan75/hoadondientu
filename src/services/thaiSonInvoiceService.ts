import * as cheerio from 'cheerio';
import { solveCaptchaWithGemini, ALPHANUMERIC_CAPTCHA_PROMPT } from './invoice-engine/captcha/geminiCaptchaSolver';
import { OriginalInvoiceError } from './invoice-engine/OriginalInvoiceError';

export const THAISON_PORTAL_URL = 'https://einvoice.vn/tra-cuu';

export interface ThaiSonDownloadParams {
  lookupCode: string;
  portalUrl?: string;
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
  const lookupNames = ['MaNhanHoaDon', 'MaTraCuu', 'MaNhanHDon', 'MTCuu'];
  const form = $('form').filter((_, el) =>
    lookupNames.some(name => $(el).find('input[name="' + name + '"]').length > 0)
  ).first();
  const field = lookupNames.find(name => form.find('input[name="' + name + '"]').length) || 'MaNhanHoaDon';
  const tokenInput = form.find('input[name="CaptchaDeText"],input[name="CaptchaToken"]').first();
  const token = tokenInput.val();
  const imagePath = form.find('img#CaptchaImage, img[src*="Captcha"], img[src*="captcha"]').first().attr('src')
    || $('img#CaptchaImage, img[src*="Captcha"], img[src*="captcha"]').first().attr('src');
  const error = $('.text-danger, .validation-summary-errors, .field-validation-error').text().trim();
  const hiddenFields: Record<string,string> = {};
  form.find('input[type="hidden"][name]').each((_, el) => {
    const name = $(el).attr('name') || '';
    if (name) hiddenFields[name] = String($(el).val() || '');
  });
  return {
    token: String(token || ''),
    imagePath,
    error,
    field,
    formAction: form.attr('action') || '',
    hiddenFields
  };
}

export async function downloadOriginalThaiSonPdf(params: ThaiSonDownloadParams): Promise<ThaiSonDownloadResult> {
  if (!params.lookupCode?.trim()) throw new OriginalInvoiceError('Thái Sơn thiếu Mã nhận hóa đơn.', 'THAISON', 'LOOKUP_DATA_MISSING', 422);
  const portal = new URL(params.portalUrl || THAISON_PORTAL_URL);
  const host = portal.hostname.toLowerCase();
  const supportedHost = host === 'einvoice.vn' || host === 'www.einvoice.vn' ||
    host.endsWith('.einvoice.com.vn') || host === 'vat.ggg.com.vn';
  if (!supportedHost || portal.protocol !== 'https:' || portal.username || portal.password) {
    throw new OriginalInvoiceError('Cổng Thái Sơn chưa được xác minh để tải bản gốc: ' + host, 'THAISON', 'PORTAL_NOT_SUPPORTED', 422);
  }
  const portalBase = portal.origin + (host.endsWith('.einvoice.com.vn') || host === 'vat.ggg.com.vn' ? '/' : '/tra-cuu');
  const signal = AbortSignal.timeout(Math.min(params.timeoutMs || 45000, 45000));
  const cookies = new Map<string, string>();
  const request = async (path: string, init: RequestInit = {}) => {
    let url = new URL(path, portalBase);
    let method = init.method || 'GET';
    let body = init.body;
    for (let hop = 0; hop < 5; hop++) {
      if (url.origin !== portal.origin) throw new Error('Cổng Thái Sơn chuyển hướng sang miền khác; không chuyển tiếp cookie.');
      const response = await fetch(url, {
        ...init, method, body, signal, redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Referer: portalBase,
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
      const page = await request(portalBase);
      const form = parseThaiSonForm(await page.text());
      if (!form.imagePath) throw new Error('Cổng Thái Sơn không trả về CAPTCHA của biểu mẫu tra cứu; không thể tải PDF tự động trên cổng này.');
      const image = await request(form.imagePath);
      const mime = (image.headers.get('content-type') || 'image/gif').split(';')[0];
      const bytes = Buffer.from(await image.arrayBuffer());
      const code = await solveCaptchaWithGemini('data:' + mime + ';base64,' + bytes.toString('base64'), ALPHANUMERIC_CAPTCHA_PROMPT, { customApiKey: params.customApiKey, alphanumeric: true });
      signal.throwIfAborted();
      const payload = new URLSearchParams(form.hiddenFields);
      payload.set(form.field, params.lookupCode.trim());
      payload.set('CaptchaInputText', code);
      if (form.token) payload.set('CaptchaDeText', form.token);
      const result = await request(form.formAction ? new URL(form.formAction, portalBase).toString() : portalBase, {
        method: 'POST',
        body: payload.toString(),
      });
      const html = await result.text();
      const error = parseThaiSonForm(html).error;
      if (error) {
        if (attempt === 0 && /captcha|mã kiểm tra|mã xác thực/i.test(error)) continue;
        throw new Error(error);
      }
      const $ = cheerio.load(html);
      const advertisedDownload = $('a[href]').map((_, el) => $(el).attr('href') || '').get()
        .find(href => /(?:tai[-/]hoa[-/]don|download.*pdf|\.pdf(?:\?|$))/i.test(href));
      const downloadPath = advertisedDownload ||
        (host === 'einvoice.vn' || host === 'www.einvoice.vn'
          ? '/tra-cuu/tai-hoa-don-dien-tu?format=pdf'
          : '');
      if (!downloadPath) {
        throw new OriginalInvoiceError(
          'Đã truy vấn cổng ' + host + ' nhưng chưa xác định được đường tải PDF gốc. Không tự suy đoán endpoint của cổng riêng.',
          'THAISON', 'TENANT_DOWNLOAD_UNAVAILABLE', 422, portalBase
        );
      }
      const pdfResponse = await request(downloadPath);
      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      if (pdfBuffer.subarray(0, 5).toString() !== '%PDF-') {
        throw new OriginalInvoiceError('Cổng ' + host + ' không trả về PDF hợp lệ.', 'THAISON', 'INVALID_ORIGINAL_PDF', 502, portalBase);
      }
      return {
        success: true, contentType: 'application/pdf', pdfBuffer, pdfBase64: pdfBuffer.toString('base64'),
        filename: ['HoaDon_ThaiSon', params.sellerTaxCode || '', params.invoiceSeries || '', params.invoiceNo || ''].join('_') + '.pdf',
        sourceUrl: portalBase,
      };
    }
    throw new Error('Thái Sơn từ chối CAPTCHA sau 2 lần thử.');
  } catch (error: any) {
    const timeout = signal.aborted;
    if (error instanceof OriginalInvoiceError) throw error;
    throw new OriginalInvoiceError(
      timeout ? 'Tra cứu Thái Sơn hết thời gian chờ. Vui lòng thử lại sau.' : 'Thái Sơn (' + host + '): ' + error.message,
      'THAISON', timeout ? 'PROVIDER_TIMEOUT' : 'ORIGINAL_DOWNLOAD_FAILED', timeout ? 504 : 502, portalBase,
    );
  }
}

export async function downloadOriginalThaiSonXml(_params: ThaiSonDownloadParams): Promise<{ success: boolean; filename: string; xmlContent: string }> {
  // A new PDF lookup does not yield XML and needlessly consumes another CAPTCHA.
  throw new OriginalInvoiceError('Chưa hỗ trợ tải XML Thái Sơn tự động. Hãy tải XML tại cổng tra cứu.', 'THAISON', 'XML_NOT_SUPPORTED', 422, THAISON_PORTAL_URL);
}
