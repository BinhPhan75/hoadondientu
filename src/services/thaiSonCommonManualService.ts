// Manual CAPTCHA workflow for shared Thai Son portal. No Gemini request.
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { OriginalInvoiceError } from './invoice-engine/OriginalInvoiceError';
import { verifyIssuerInvoiceBytes } from './invoiceIdentityVerifier';
import {
  extractThaiSonDownloadTargets,
  isThaiSonHelpDocumentLink,
  isThaiSonHelpPdf,
  parseThaiSonForm,
  verifiedThaiSonInvoiceHtmlWithSeries,
  isThaiSonMarketingPage,
} from './thaiSonInvoiceService';

const PORTAL_ORIGIN = 'https://einvoice.vn';
const PORTAL_URL = PORTAL_ORIGIN + '/tra-cuu';
const MAX_STATE_AGE_MS = 5 * 60 * 1000;

interface ManualCaptchaState {
  issuedAt: number;
  cookies: string[];
  hiddenFields: Record<string, string>;
  action: string;
  method: 'GET' | 'POST';
  submitName?: string;
  submitValue?: string;
  lookupCodeHash: string;
  lookupField: string;
  captchaField: string;
}

export type ThaiSonCommonLookupResult =
  | { kind: 'html'; html: string }
  | { kind: 'pdf'; filename: string; pdfBuffer: Buffer };

const MAX_RESULT_BYTES = 18_000_000;

function providerError(message: string, code: string, status = 422): OriginalInvoiceError {
  return new OriginalInvoiceError(message, 'THAISON', code, status, PORTAL_URL);
}

function pdfFilename(sellerTaxCode: string, invoiceNo: string): string {
  const number = String(invoiceNo).replace(/\D/g, '').padStart(7, '0');
  return 'HoaDon_ThaiSonCommon_' + sellerTaxCode.replace(/\D/g, '') + '_' + number + '.pdf';
}

function normalizeLookupCode(value: unknown): string {
  const code = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]{5,128}$/.test(code)) {
    throw providerError('Mã nhận hóa đơn Thái Sơn cổng chung không hợp lệ.', 'LOOKUP_DATA_MISSING');
  }
  return code;
}

function cookiesFromHeaders(headers: Headers, jar: Map<string, string>): void {
  for (const header of headers.getSetCookie()) {
    const pair = header.split(';', 1)[0].trim();
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (/^[A-Za-z0-9_.-]{1,100}$/.test(name) && !/[\r\n;]/.test(value) && value.length <= 1024) {
      jar.set(name, value);
    }
  }
}

async function requestPortal(
  target: URL,
  method: 'GET' | 'POST',
  body: string | undefined,
  jar: Map<string, string>,
  timeoutMs: number,
): Promise<Response> {
  let url = target;
  let requestMethod = method;
  let requestBody = body;
  const signal = AbortSignal.timeout(timeoutMs);

  for (let hop = 0; hop < 5; hop++) {
    if (url.origin !== PORTAL_ORIGIN) {
      throw providerError('Cổng Thái Sơn cổng chung chuyển hướng sang miền khác.', 'PORTAL_REDIRECT_REJECTED', 502);
    }
    const cookie = Array.from(jar, ([name, value]) => name + '=' + value).join('; ');
    const response = await fetch(url, {
      method: requestMethod,
      body: requestBody,
      redirect: 'manual',
      signal,
      headers: {
        Accept: 'text/html,application/pdf,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0',
        Referer: PORTAL_URL,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(requestMethod === 'POST' ? {
          Origin: PORTAL_ORIGIN,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        } : {}),
      },
    });
    cookiesFromHeaders(response.headers, jar);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        await response.body?.cancel();
        throw providerError('Cổng Thái Sơn cổng chung trả về chuyển hướng thiếu địa chỉ.', 'PORTAL_REDIRECT_REJECTED', 502);
      }
      const next = new URL(location, url);
      await response.body?.cancel();
      if (response.status === 303 ||
          ([301, 302].includes(response.status) && requestMethod === 'POST')) {
        requestMethod = 'GET';
        requestBody = undefined;
      }
      url = next;
      continue;
    }
    return response;
  }
  throw providerError('Cổng Thái Sơn cổng chung chuyển hướng quá nhiều lần.', 'PORTAL_REDIRECT_REJECTED', 502);
}

function encodeState(state: ManualCaptchaState): string {
  const encoded = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
  if (encoded.length > 16000) {
    throw providerError('Dữ liệu CAPTCHA Thái Sơn cổng chung vượt giới hạn.', 'CAPTCHA_UNAVAILABLE', 502);
  }
  return encoded;
}

function decodeState(value: unknown, lookupCode: string): ManualCaptchaState {
  const encoded = String(value || '');
  if (!encoded || encoded.length > 16000) {
    throw providerError('Phiên CAPTCHA không hợp lệ. Tải CAPTCHA mới.', 'CAPTCHA_EXPIRED');
  }
  let state: ManualCaptchaState;
  try {
    state = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw providerError('Phiên CAPTCHA không hợp lệ. Tải CAPTCHA mới.', 'CAPTCHA_EXPIRED');
  }

  const now = Date.now();
  const hidden = state?.hiddenFields;
  const validCookies = Array.isArray(state?.cookies) && state.cookies.length <= 20 &&
    state.cookies.every(cookie => typeof cookie === 'string' &&
      /^[A-Za-z0-9_.-]{1,100}=[^;\r\n]{0,1024}$/.test(cookie));
  const validHiddenFields = hidden && typeof hidden === 'object' && !Array.isArray(hidden) &&
    Object.keys(hidden).length <= 24 &&
    Object.entries(hidden).every(([name, field]) =>
      /^[A-Za-z0-9_.\[\]-]{1,100}$/.test(name) &&
      typeof field === 'string' && field.length <= 4096 && !/[\r\n]/.test(field));

  if (!Number.isSafeInteger(state?.issuedAt) || state.issuedAt > now + 10000 ||
      now - state.issuedAt > MAX_STATE_AGE_MS || !validCookies || !validHiddenFields ||
      !/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(state.lookupField || '') ||
      !/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(state.captchaField || '') ||
      state.lookupField === state.captchaField ||
      !['GET','POST'].includes(state.method) ||
      !/^\/[A-Za-z0-9/_-]{0,200}(?:\?[A-Za-z0-9_.~%=&-]{0,500})?$/.test(state.action || '') ||
      (state.submitName && !/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(state.submitName)) ||
      (state.submitValue && (state.submitValue.length > 256 || /[\r\n]/.test(state.submitValue))) ||
      !/^[a-f0-9]{64}$/.test(state.lookupCodeHash || '') ||
      state.lookupCodeHash !== createHash('sha256').update(lookupCode).digest('hex')) {
    throw providerError('Phiên CAPTCHA đã hết hạn hoặc không khớp mã nhận hóa đơn. Tải CAPTCHA mới.', 'CAPTCHA_EXPIRED');
  }
  return state;
}

export async function createThaiSonCommonManualCaptcha(lookupCodeInput: unknown): Promise<{
  image: string;
  state: string;
}> {
  const lookupCode = normalizeLookupCode(lookupCodeInput);
  const jar = new Map<string, string>();
  try {
    const page = await requestPortal(new URL(PORTAL_URL), 'GET', undefined, jar, 15000);
    if (!page.ok) {
      throw providerError('Không tải được biểu mẫu tra cứu Thái Sơn cổng chung (HTTP ' + page.status + ').', 'CAPTCHA_UNAVAILABLE', 502);
    }
    const html = await page.text();
    if (html.length > 2_000_000) {
      throw providerError('Biểu mẫu tra cứu Thái Sơn cổng chung vượt giới hạn.', 'CAPTCHA_UNAVAILABLE', 502);
    }
    if (isThaiSonMarketingPage(html)) {
      throw providerError(
        'einvoice.vn/tra-cuu hiện là trang giới thiệu. Cần cổng tra cứu thực tế của người bán để lấy CAPTCHA và PDF gốc.',
        'ISSUER_LOOKUP_PORTAL_REQUIRED'
      );
    }
    const form = parseThaiSonForm(html);
    if (!form.formFound || !form.field || !form.captchaField || !form.imagePath) {
      throw providerError('Không nhận diện được biểu mẫu CAPTCHA của cổng Thái Sơn cổng chung.', 'CAPTCHA_FORM_CHANGED', 502);
    }
    const action = new URL(form.formAction || PORTAL_URL, PORTAL_URL);
    const imageUrl = new URL(form.imagePath, PORTAL_URL);
    if (action.origin !== PORTAL_ORIGIN ||
        imageUrl.origin !== PORTAL_ORIGIN) {
      throw providerError('Biểu mẫu Thái Sơn cổng chung có địa chỉ không hợp lệ.', 'CAPTCHA_FORM_CHANGED', 502);
    }
    const imageResponse = await requestPortal(imageUrl, 'GET', undefined, jar, 10000);
    if (!imageResponse.ok) {
      throw providerError('Không tải được ảnh CAPTCHA Thái Sơn cổng chung.', 'CAPTCHA_UNAVAILABLE', 502);
    }
    const mime = (imageResponse.headers.get('content-type') || '').split(';')[0].toLowerCase();
    const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
    if (!/^image\/(?:png|jpeg|gif|webp)$/.test(mime) ||
        imageBytes.length < 50 || imageBytes.length > 400_000) {
      throw providerError('Cổng Thái Sơn cổng chung trả ảnh CAPTCHA không hợp lệ.', 'CAPTCHA_UNAVAILABLE', 502);
    }
    const state: ManualCaptchaState = {
      issuedAt: Date.now(),
      cookies: Array.from(jar, ([name, value]) => name + '=' + value),
      hiddenFields: form.hiddenFields,
      action: action.pathname + action.search,
      method: form.method,
      submitName: form.submitName,
      submitValue: form.submitValue,
      lookupCodeHash: createHash('sha256').update(lookupCode).digest('hex'),
      lookupField: form.field,
      captchaField: form.captchaField,
    };
    return {
      image: 'data:' + mime + ';base64,' + imageBytes.toString('base64'),
      state: encodeState(state),
    };
  } catch (error: any) {
    if (error instanceof OriginalInvoiceError) throw error;
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw providerError(
      timedOut ? 'Kết nối cổng Thái Sơn cổng chung hết thời gian chờ.' : 'Không thể tải CAPTCHA Thái Sơn cổng chung.',
      timedOut ? 'PROVIDER_TIMEOUT' : 'CAPTCHA_UNAVAILABLE',
      timedOut ? 504 : 502
    );
  }
}

export async function submitThaiSonCommonManualLookup(params: {
  state: unknown;
  lookupCode: unknown;
  captcha: unknown;
  sellerTaxCode: string;
  invoiceNo: string;
  invoiceSeries: string;
}): Promise<ThaiSonCommonLookupResult> {
  const lookupCode = normalizeLookupCode(params.lookupCode);
  const captcha = String(params.captcha || '').trim();
  if (!captcha || captcha.length > 32 || /[\r\n]/.test(captcha)) {
    throw providerError('Nhập mã kiểm tra CAPTCHA.', 'CAPTCHA_REQUIRED');
  }
  const state = decodeState(params.state, lookupCode);
  const jar = new Map(state.cookies.map(pair => {
    const index = pair.indexOf('=');
    return [pair.slice(0, index), pair.slice(index + 1)] as const;
  }));
  const payload = new URLSearchParams();
  Object.entries(state.hiddenFields).forEach(([name, value]) => payload.set(name, value));
  payload.set(state.lookupField, lookupCode);
  payload.set(state.captchaField, captcha);
  if (state.submitName && ![state.lookupField, state.captchaField].includes(state.submitName)) {
    payload.set(state.submitName, state.submitValue || '');
  }

  let response: Response;
  try {
    const actionUrl = new URL(state.action, PORTAL_URL);
    if (state.method === 'GET') payload.forEach((value, name) => actionUrl.searchParams.set(name, value));
    response = await requestPortal(
      actionUrl, state.method, state.method === 'POST' ? payload.toString() : undefined, jar, 30000
    );
  } catch (error: any) {
    if (error instanceof OriginalInvoiceError) throw error;
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw providerError(
      timedOut ? 'Tra cứu Thái Sơn cổng chung hết thời gian chờ.' : 'Không kết nối được cổng Thái Sơn cổng chung.',
      timedOut ? 'PROVIDER_TIMEOUT' : 'LOOKUP_FAILED',
      timedOut ? 504 : 502
    );
  }
  const contentLength = Number(response.headers.get('content-length') || '0');
  if (contentLength > MAX_RESULT_BYTES) {
    throw providerError('Kết quả tra cứu Thái Sơn cổng chung vượt giới hạn 18 MB.', 'RESULT_TOO_LARGE', 502);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_RESULT_BYTES) {
    throw providerError('Kết quả tra cứu Thái Sơn cổng chung vượt giới hạn 18 MB.', 'RESULT_TOO_LARGE', 502);
  }
  const contentType = response.headers.get('content-type') || '';
  const verifyPdf = async (
    pdf: Buffer, pdfContentType: string
  ): Promise<ThaiSonCommonLookupResult | undefined> => {
    if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') return;
    const verification = await verifyIssuerInvoiceBytes(pdf, pdfContentType, {
      sellerTaxCode: params.sellerTaxCode,
      invoiceNo: params.invoiceNo,
      invoiceSeries: params.invoiceSeries,
    });
    if (!verification.ok) return;
    return {
      kind: 'pdf',
      filename: pdfFilename(params.sellerTaxCode, params.invoiceNo),
      pdfBuffer: pdf,
    };
  };
  if (bytes.subarray(0, 5).toString('latin1') === '%PDF-') {
    const result = await verifyPdf(bytes, contentType);
    if (result) return result;
    throw providerError('PDF Thái Sơn cổng chung chưa khớp MST và số hóa đơn đang mở; không hiển thị kết quả.', 'INVOICE_IDENTITY_MISMATCH');
  }
  if (!response.ok || !/html/i.test(contentType)) {
    throw providerError('Thái Sơn cổng chung trả kết quả tra cứu không hợp lệ (HTTP ' + response.status + ').', 'LOOKUP_FAILED', 502);
  }

  const html = bytes.toString('utf8');
  if (isThaiSonMarketingPage(html)) {
    throw providerError(
      'Kết quả trả về website giới thiệu Thái Sơn, không phải hóa đơn MARU. Cần đúng cổng phát hành của người bán.',
      'ISSUER_LOOKUP_PORTAL_REQUIRED'
    );
  }
  let verifiedHtml = verifiedThaiSonInvoiceHtmlWithSeries(html, params.sellerTaxCode, params.invoiceNo, params.invoiceSeries);

  const $ = cheerio.load(html);
  const returnedForm = parseThaiSonForm(html);
  const providerMessage = (returnedForm.error || $('#listresult').text())
    .replace(/\s+/g, ' ').trim().slice(0, 240);
  const isCaptchaError = /captcha|mã kiểm tra|mã xác thực/i.test(providerMessage);
  // The shared portal may keep the lookup form on the page while rendering
  // a result modal or advertising a PDF endpoint. Inspect verified downloads
  // before declaring lookup failure; never treat the form alone as success.
  const returnedToForm = returnedForm.formFound && returnedForm.field === state.lookupField;

  const queue = extractThaiSonDownloadTargets(html).map(target => ({
    ...target,
    base: response.url || PORTAL_URL,
    depth: 0,
  }));
  const seenTargets = new Set<string>();
  while (queue.length && seenTargets.size < 18) {
    const target = queue.shift()!;
    let targetUrl: URL;
    try {
      targetUrl = new URL(target.path, target.base);
    } catch {
      continue;
    }
    if (targetUrl.origin !== PORTAL_ORIGIN || isThaiSonHelpDocumentLink(targetUrl.href)) continue;
    if (target.method === 'GET' && target.data) {
      new URLSearchParams(target.data).forEach((value, name) => targetUrl.searchParams.set(name, value));
    }
    const unique = target.method + '|' + targetUrl.href + '|' + (target.data || '');
    if (seenTargets.has(unique)) continue;
    seenTargets.add(unique);

    try {
      const targetResponse = await requestPortal(
        targetUrl, target.method, target.method === 'POST' ? target.data : undefined, jar, 15000
      );
      const targetLength = Number(targetResponse.headers.get('content-length') || '0');
      if (targetLength > MAX_RESULT_BYTES) {
        await targetResponse.body?.cancel();
        continue;
      }
      const targetBytes = Buffer.from(await targetResponse.arrayBuffer());
      if (targetBytes.length > MAX_RESULT_BYTES) continue;

      const targetType = targetResponse.headers.get('content-type') || '';
      const targetPdf = await verifyPdf(targetBytes, targetType);
      if (targetPdf && !isThaiSonHelpPdf(targetBytes)) return targetPdf;

      if (target.depth >= 2 || targetBytes.length > 1_500_000 ||
          (!/html/i.test(targetType) &&
           !/<!doctype html|<html/i.test(targetBytes.subarray(0, 250).toString('utf8')))) {
        continue;
      }

      const targetHtml = targetBytes.toString('utf8');
      verifiedHtml = verifiedHtml ||
        verifiedThaiSonInvoiceHtmlWithSeries(targetHtml, params.sellerTaxCode, params.invoiceNo, params.invoiceSeries);
      extractThaiSonDownloadTargets(targetHtml).forEach(nested => {
        queue.push({ ...nested, base: targetResponse.url || targetUrl.href, depth: target.depth + 1 });
      });
    } catch {
      // Other advertised links may still lead to the verified invoice.
    }
  }
  if (verifiedHtml) return { kind: 'html', html: verifiedHtml };

  // Distinguish an explicit captcha rejection from a returned form with no
  // verified invoice. This avoids blaming the user's captcha when the
  // provider's JavaScript/XHR search has not run in the server-side flow.
  const providerDetail = providerMessage.replace(/[\r\n]/g, ' ').slice(0, 160);
  if (isCaptchaError) {
    throw providerError('Cổng Thái Sơn báo lỗi CAPTCHA: ' + providerDetail +
      '. Lấy CAPTCHA mới và nhập lại.', 'CAPTCHA_REJECTED');
  }
  if (returnedToForm) {
    throw providerError(
      providerDetail
        ? 'Cổng Thái Sơn chưa trả hóa đơn: ' + providerDetail
        : 'Cổng Thái Sơn nhận yêu cầu nhưng chỉ trả lại biểu mẫu; chưa nhận được kết quả PDF/XML. Có thể website xử lý tra cứu bằng yêu cầu JavaScript riêng.',
      'LOOKUP_NOT_COMPLETED'
    );
  }
  throw providerError(
    providerDetail || 'Cổng Thái Sơn chưa trả PDF/XML khớp MST, ký hiệu và số hóa đơn.',
    'INVOICE_NOT_VERIFIED'
  );
}
