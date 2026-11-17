import * as cheerio from 'cheerio';
import JSZip from 'jszip';
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
  const named = $('form').filter((_, node) => lookupNames.some(name =>
    $(node).find('input[name="' + name + '"]').length > 0)).first();

  // Tenant portals are white-labelled: names such as MaNhanHoaDon are not
  // universal. Match by the labelled field, then the first non-captcha text
  // input belonging to the same form.
  let form = named;
  if (!form.length) {
    form = $('form').filter((_, node) => {
      const el = $(node);
      const descriptors = [el.text(), ...el.find('input').map((_, input) => {
        const field = $(input);
        return [field.attr('name'),field.attr('id'),field.attr('placeholder'),
          field.attr('aria-label')].filter(Boolean).join(' ');
      }).get()].join(' ');
      return /m[aã]\s*(?:nh[aậ]n\s*h[oó]a\s*[dđ][oơ]n|tra\s*c[uứ]u)|nh[aậ]n\s*h[oó]a\s*[dđ][oơ]n|lookup|fkey/i.test(descriptors);
    }).first();
  }

  const findLookupInput = () => {
    const namedField = lookupNames.find(name => form.find('input[name="' + name + '"]').length > 0);
    if (namedField) return form.find('input[name="' + namedField + '"]').first();
    const candidates = form.find('input').filter((_, node) => {
      const el = $(node);
      const type = String(el.attr('type') || 'text').toLowerCase();
      if (!['text','search',''].includes(type)) return false;
      const label = [el.attr('name'),el.attr('id'),el.attr('placeholder'),el.attr('aria-label')]
        .filter(Boolean).join(' ');
      return !/captcha|ki[eể]m\s*tra|x[aá]c\s*th[uự]c|verification|token/i.test(label);
    });
    return candidates.first();
  };
  const lookupInput = findLookupInput();
  const field = lookupInput.attr('name') || '';
  const captchaInput = form.find('input').filter((_, node) => {
    const el = $(node);
    const type = String(el.attr('type') || 'text').toLowerCase();
    return ['text','search',''].includes(type) &&
      /captcha|ki[eể]m\s*tra|x[aá]c\s*th[uự]c|verification/i.test(
        [el.attr('name'),el.attr('id'),el.attr('placeholder'),el.attr('aria-label')]
          .filter(Boolean).join(' '));
  }).first();
  const captchaField = captchaInput.attr('name') || 'CaptchaInputText';
  const tokenInput = form.find('input[name="CaptchaDeText"],input[name="CaptchaToken"]').first();
  const imagePath = form.find('img#CaptchaImage, img[src*="Captcha"], img[src*="captcha"]').first().attr('src')
    || $('img#CaptchaImage, img[src*="Captcha"], img[src*="captcha"]').first().attr('src');
  const error = form.find('.validation-summary-errors, .field-validation-error').text().trim()
    || $('.validation-summary-errors').text().trim();
  const hiddenFields: Record<string, string> = {};
  form.find('input[type="hidden"][name]').each((_, node) => {
    const el = $(node), name = el.attr('name') || '';
    if (name) hiddenFields[name] = String(el.val() || '');
  });

  return {
    token: String(tokenInput.val() || ''),
    imagePath,
    error,
    field,
    captchaField,
    method: (form.attr('method') || 'POST').toUpperCase() === 'GET' ? 'GET' as const : 'POST' as const,
    formAction: form.attr('action') || '',
    hiddenFields,
    formFound: Boolean(form.length)
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
  $('script, iframe, object, embed, form, input, button, meta[http-equiv=refresh]').remove();
  // The provider HTML is untrusted content. Strip executable attributes
  // before putting it into a browser srcDoc frame.
  $('*').each((_, node) => {
    if (node.type !== 'tag') return;
    const el = $(node);
    const attrs = (node as any).attribs || {};
    for (const attr of Object.keys(attrs)) {
      const value = String(attrs[attr] || '');
      if (/^on/i.test(attr) ||
          (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(attr.toLowerCase()) &&
           /^\s*(?:javascript|vbscript|file|data:text\/html):/i.test(value))) {
        el.removeAttr(attr);
      }
    }
  });
  return $.html();
}

/**
 * Accept a provider PDF directly, or a provider ZIP. If the ZIP contains
 * a PDF use it for preview; otherwise retain the signed XML archive.
 */
export async function extractThaiSonOriginalContent(
  bytes: Buffer
): Promise<{ bytes: Buffer; type: string; extension: '.pdf' | '.zip' } | undefined> {
  if (bytes.length > 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { bytes, type: 'application/pdf', extension: '.pdf' };
  }
  if (bytes.length < 4 || bytes.subarray(0, 4).toString('latin1') !== 'PK\u0003\u0004' ||
      bytes.length > 30_000_000) return;
  try {
    const archive = await JSZip.loadAsync(bytes, { checkCRC32: false });
    const entries = Object.values(archive.files);
    const pdfs = entries.filter(file => !file.dir && /\.pdf$/i.test(file.name));
    for (const pdf of pdfs.slice(0, 5)) {
      
      const content = await pdf.async('nodebuffer');
      if (content.subarray(0, 5).toString('latin1') === '%PDF-') {
        return { bytes: content, type: 'application/pdf', extension: '.pdf' };
      }
    }
    if (entries.some(file => !file.dir && /\.xml$/i.test(file.name))) {
      return { bytes, type: 'application/zip', extension: '.zip' };
    }
  } catch {
    // Invalid or unsupported archive; do not treat it as a signed invoice.
  }
}
/** Safe structural diagnostics; never include values, cookies, CAPTCHA, or invoice codes. */
export function diagnoseThaiSonSearchPage(html: string) {
  const $ = cheerio.load(html);
  const inputs = $('input[name]').map((_, node) => {
    const el = $(node);
    return { name: (el.attr('name') || '').slice(0, 80), type: el.attr('type') || 'text' };
  }).get().slice(0, 16);
  const forms = $('form').map((_, node) => {
    const el = $(node);
    return { method: el.attr('method') || 'GET', action: (el.attr('action') || '').slice(0, 120) };
  }).get().slice(0, 8);
  return {
    forms, inputs,
    scripts: $('script[src]').length,
    clientRendered: !forms.length && (inputs.length === 0 || $('script[src]').length > 0)
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
      const searchPageHtml = await page.text();
      const form = parseThaiSonForm(searchPageHtml);
      if (!form.formFound || !form.field) {
        const diagnostics = diagnoseThaiSonSearchPage(searchPageHtml);
        console.warn('[ThaiSon] Cannot detect native search form', {
          host, forms: diagnostics.forms, inputs: diagnostics.inputs,
          scriptCount: diagnostics.scripts, clientRendered: diagnostics.clientRendered
        });
        throw new OriginalInvoiceError(
          diagnostics.clientRendered
            ? 'Cổng ' + host + ' cần chạy JavaScript để tạo hoặc gửi biểu mẫu tra cứu. Bộ tải HTTP hiện chưa hỗ trợ quy trình JavaScript này.'
            : 'Không nhận diện được trường mã tra cứu trên ' + host + '. Cần đối chiếu cấu trúc request tra cứu thành công của cổng phát hành.',
          'THAISON', 'LOOKUP_FORM_NOT_FOUND', 422, portalBase
        );
      }
      if (!form.imagePath) throw new Error('Cổng Thái Sơn không trả về CAPTCHA của biểu mẫu tra cứu; không thể tải PDF tự động trên cổng này.');
      const image = await request(form.imagePath);
      const mime = (image.headers.get('content-type') || 'image/gif').split(';')[0];
      const bytes = Buffer.from(await image.arrayBuffer());
      const code = await solveCaptchaWithGemini('data:' + mime + ';base64,' + bytes.toString('base64'), ALPHANUMERIC_CAPTCHA_PROMPT, { customApiKey: params.customApiKey, alphanumeric: true });
      signal.throwIfAborted();
      const payload = new URLSearchParams(form.hiddenFields);
      payload.set(form.field, params.lookupCode.trim());
      payload.set(form.captchaField, code);
      if (form.token) payload.set('CaptchaDeText', form.token);
      const actionUrl = new URL(form.formAction || portalBase, portalBase);
      if (form.method === 'GET') payload.forEach((value, name) => actionUrl.searchParams.set(name, value));
      const result = await request(actionUrl.toString(), {
        method: form.method,
        body: form.method === 'POST' ? payload.toString() : undefined,
      });
      const resultBody = Buffer.from(await result.arrayBuffer());
      const directOriginal = await extractThaiSonOriginalContent(resultBody);
      if (directOriginal) {
        return {
          success: true, contentType: directOriginal.type, pdfBuffer: directOriginal.bytes,
          pdfBase64: directOriginal.bytes.toString('base64'),
          filename: ['HoaDon_ThaiSon', params.sellerTaxCode || '', params.invoiceSeries || '', params.invoiceNo || ''].join('_') + directOriginal.extension,
          sourceUrl: result.url
        };
      }
      const html = resultBody.toString('utf8');
      const postForm = parseThaiSonForm(html);
      const error = postForm.error;
      if (error) {
        if (attempt === 0 && /captcha|mã kiểm tra|mã xác thực/i.test(error)) continue;
        throw new Error(error);
      }
      let displayHtml = verifiedThaiSonInvoiceHtml(html, params.sellerTaxCode, params.invoiceNo);
      const advertisedTargets = extractThaiSonDownloadTargets(html);
      if (!displayHtml && postForm.formFound && advertisedTargets.length === 0) {
        console.warn('[ThaiSon] Lookup returned the search form instead of invoice details', {
          host, action: postForm.formAction, lookupField: postForm.field,
          captchaField: postForm.captchaField, responseBytes: resultBody.length
        });
        if (attempt === 0) continue;
        throw new OriginalInvoiceError(
          'Cổng ' + host + ' vẫn trả về form tra cứu, chưa xác nhận được hóa đơn. Có thể CAPTCHA không được chấp nhận hoặc biểu mẫu dùng yêu cầu AJAX khác.',
          'THAISON', 'LOOKUP_NOT_COMPLETED', 422, portalBase
        );
      }
      const queue = advertisedTargets.map(target => ({ ...target, base: result.url, depth: 0 }));
      const seenTargets = new Set<string>();
      let originalContent: Awaited<ReturnType<typeof extractThaiSonOriginalContent>>;
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
          const candidate = await extractThaiSonOriginalContent(bytes);
          if (candidate) {
            originalContent = candidate;
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
      if (!originalContent) {
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
        success: true, contentType: originalContent.type,
        pdfBuffer: originalContent.bytes, pdfBase64: originalContent.bytes.toString('base64'),
        filename: ['HoaDon_ThaiSon', params.sellerTaxCode || '', params.invoiceSeries || '', params.invoiceNo || ''].join('_') + originalContent.extension,
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
