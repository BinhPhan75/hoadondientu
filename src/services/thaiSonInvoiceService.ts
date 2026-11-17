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


type ThaiSonDownloadTarget = {
  path: string;
  method: 'GET' | 'POST';
  data?: string;
};

/** Discover only download URLs or forms advertised by a successful lookup page. */
export function extractThaiSonDownloadTargets(html: string): ThaiSonDownloadTarget[] {
  const $ = cheerio.load(html);
  const found: ThaiSonDownloadTarget[] = [];
  const seen = new Set<string>();
  const add = (path: string, method: 'GET' | 'POST' = 'GET', data?: string) => {
    const value = path.trim().replace(/&amp;/g, '&');
    if (!value || value.startsWith('#') || /^(?:javascript|data|file):/i.test(value)) return;
    const id = [method, value, data || ''].join('|');
    if (seen.has(id)) return;
    seen.add(id);
    found.push({ path: value, method, data });
  };

  const isDownloadText = (s: string) =>
    /tải\s*(?:về|xuống|hóa\s*đơn|pdf)|download|save\s*(?:file|invoice|pdf)|xuất\s*pdf|in\s*hóa\s*đơn/i.test(s);
  const isDownloadPath = (s: string) =>
    /\.pdf(?:[?#]|$)|(?:tai|download|export|print|pdf|file)/i.test(s);

  $('a[href], iframe[src], embed[src], object[data], source[src]').each((_, node) => {
    const $el = $(node);
    const path = $el.attr('href') || $el.attr('src') || $el.attr('data') || '';
    const label = [$el.text(), $el.attr('title') || '', $el.attr('download') || ''].join(' ');
    const tag = String((node as { tagName?: string }).tagName || '').toLowerCase();
    if (['iframe', 'embed', 'object', 'source'].includes(tag) ||
        isDownloadText(label) || isDownloadPath(path)) add(path);
  });

  $('button, input[type=submit], input[type=button], a[onclick]').each((_, node) => {
    const $el = $(node);
    const label = [$el.text(), $el.attr('value') || '', $el.attr('title') || ''].join(' ');
    if (!isDownloadText(label)) return;
    const ownAction = $el.attr('formaction') || $el.attr('data-url') || $el.attr('data-href') || '';
    if (ownAction) add(ownAction);
    const onclick = $el.attr('onclick') || '';
    // Read literal URLs from handlers without executing provider JavaScript.
    for (const match of onclick.matchAll(/(?:open|href\s*=|assign\s*\(|replace\s*\()\s*\(?\s*['"]([^'"]+)['"]/gi)) {
      if (match[1]) add(match[1]);
    }
    const form = $el.closest('form');
    if (form.length) {
      const action = ownAction || form.attr('action') || '';
      if (action && (isDownloadPath(action) || isDownloadText(label))) {
        const payload = new URLSearchParams();
        form.find('input[name], select[name]').each((_, input) => {
          const el = $(input);
          const name = el.attr('name') || '';
          if (name && !['file', 'password'].includes((el.attr('type') || '').toLowerCase())) {
            payload.set(name, String(el.val() || ''));
          }
        });
        const buttonName = $el.attr('name');
        if (buttonName) payload.set(buttonName, $el.attr('value') || '');
        const method = (form.attr('method') || 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET';
        add(action, method, payload.toString());
      }
    }
  });
  return found.slice(0, 12);
}

/**
 * The provider sometimes returns a fully rendered invoice page without
 * exposing a downloadable PDF. Verify invoice metadata before showing its
 * HTML as a provider presentation (never call it an original PDF).
 */
export function verifiedThaiSonInvoiceHtml(
  html: string,
  sellerTaxCode: string | undefined,
  invoiceNo: string | undefined
): string | undefined {
  if (!sellerTaxCode || !invoiceNo || html.length > 2_000_000) return;
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ');
  const compact = text.replace(/\s+/g, '').toLowerCase();
  const seller = sellerTaxCode.replace(/\s+/g, '').toLowerCase();
  const number = String(invoiceNo).replace(/^0+/, '') || '0';
  if (!compact.includes(seller) || !compact.includes(number) ||
      !/hóa\s*đơn|hoá\s*đơn|hoa\s*don|vat\s*invoice|tax\s*invoice/i.test(text)) {
    return;
  }
  $('script, iframe, object, embed, form, input, button').remove();
  $('[onload],[onclick],[onerror],[onmouseover],[onfocus]').each((_, node) => {
    const el = $(node);
    for (const attr of ['onload', 'onclick', 'onerror', 'onmouseover', 'onfocus']) el.removeAttr(attr);
  });
  $('a[href], img[src]').each((_, node) => {
    const el = $(node);
    const field = node.tagName === 'a' ? 'href' : 'src';
    const value = el.attr(field) || '';
    if (/^\s*(?:javascript|data:text\/html|file):/i.test(value)) el.removeAttr(field);
  });
  return $.html();
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
      const resultBody = Buffer.from(await result.arrayBuffer());
      if (resultBody.subarray(0, 5).toString() === '%PDF-') {
        return {
          success: true, contentType: 'application/pdf', pdfBuffer: resultBody,
          pdfBase64: resultBody.toString('base64'),
          filename: ['HoaDon_ThaiSon', params.sellerTaxCode || '', params.invoiceSeries || '', params.invoiceNo || ''].join('_') + '.pdf',
          sourceUrl: result.url
        };
      }
      const html = resultBody.toString('utf8');
      const error = parseThaiSonForm(html).error;
      if (error) {
        if (attempt === 0 && /captcha|mã kiểm tra|mã xác thực/i.test(error)) continue;
        throw new Error(error);
      }
      let displayHtml = verifiedThaiSonInvoiceHtml(html, params.sellerTaxCode, params.invoiceNo);
      const queue = extractThaiSonDownloadTargets(html)
        .map(target => ({ ...target, base: result.url, depth: 0 }));
      const seenTargets = new Set<string>();
      let pdfBuffer: Buffer | null = null;
      // Follow only links and forms advertised by the issuer's page.
      // Nested iframe pages can themselves contain the printable PDF URL.
      while (queue.length && seenTargets.size < 18) {
        const target = queue.shift()!;
        try {
          const targetUrl = new URL(target.path, target.base);
          if (target.method === 'GET' && target.data) {
            const query = new URLSearchParams(target.data);
            query.forEach((value, name) => targetUrl.searchParams.set(name, value));
          }
          if (targetUrl.origin !== portal.origin) continue;
          const unique = target.method + '|' + targetUrl.href + '|' + (target.data || '');
          if (seenTargets.has(unique)) continue;
          seenTargets.add(unique);
          const targetResponse = await request(targetUrl.toString(), {
            method: target.method,
            body: target.method === 'POST' ? target.data : undefined
          });
          const bytes = Buffer.from(await targetResponse.arrayBuffer());
          if (bytes.length > 5 && bytes.subarray(0, 5).toString() === '%PDF-') {
            pdfBuffer = bytes;
            break;
          }
          const mime = targetResponse.headers.get('content-type') || '';
          if (target.depth < 2 && bytes.length < 1500000 &&
              (/html/i.test(mime) || /<!doctype html|<html/i.test(bytes.subarray(0, 250).toString('utf8')))) {
            const innerHtml = bytes.toString('utf8');
            displayHtml = displayHtml || verifiedThaiSonInvoiceHtml(innerHtml, params.sellerTaxCode, params.invoiceNo);
            const nested = extractThaiSonDownloadTargets(innerHtml);
            nested.forEach(item => queue.push({ ...item, base: targetResponse.url, depth: target.depth + 1 }));
          }
        } catch (error: any) {
          if (signal.aborted) throw error;
          console.warn('[ThaiSon] Provider link did not return PDF:', target.path.slice(0, 140), error?.message);
        }
      }
      if (!pdfBuffer) {
        if (displayHtml) {
          const htmlBuffer = Buffer.from(displayHtml, 'utf8');
          return {
            success: true, contentType: 'text/html; charset=utf-8',
            pdfBuffer: htmlBuffer, pdfBase64: htmlBuffer.toString('base64'),
            filename: ['HoaDon_ThaiSon', params.sellerTaxCode || '', params.invoiceSeries || '', params.invoiceNo || ''].join('_') + '.html',
            sourceUrl: result.url
          };
        }
        throw new OriginalInvoiceError(
          'Đã tra cứu trên cổng ' + host + ' nhưng không tìm thấy PDF hoặc bản HTML hóa đơn có dữ liệu khớp.',
          'THAISON', 'TENANT_DOWNLOAD_UNAVAILABLE', 422, portalBase
        );
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
