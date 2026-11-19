import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { OriginalInvoiceError } from './invoice-engine/OriginalInvoiceError';
import { verifyIssuerInvoiceBytes } from './invoiceIdentityVerifier';
import { parseThaiSonForm, verifiedThaiSonInvoiceHtml } from './thaiSonInvoiceService';

const PORTAL_ORIGIN = 'https://saigoncoop.einvoice.com.vn';
const PORTAL_URL = PORTAL_ORIGIN + '/';
const MAX_STATE_AGE_MS = 5 * 60 * 1000;

interface ManualCaptchaState {
  issuedAt: number;
  cookies: string[];
  hiddenFields: Record<string, string>;
  action: string;
  lookupCodeHash: string;
  lookupField: 'MA_NHAN_HOA_DON';
  captchaField: 'CaptchaInputText';
}

export type SaigonCoopLookupResult =
  | { kind: 'html'; html: string }
  | { kind: 'pdf'; filename: string; pdfBuffer: Buffer };

function providerError(message: string, code: string, status = 422): OriginalInvoiceError {
  return new OriginalInvoiceError(message, 'THAISON', code, status, PORTAL_URL);
}

function normalizeLookupCode(value: unknown): string {
  const code = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]{5,128}$/.test(code)) {
    throw providerError('Mã nhận hóa đơn Saigon Co.op không hợp lệ.', 'LOOKUP_DATA_MISSING');
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
      throw providerError('Cổng Saigon Co.op chuyển hướng sang miền khác.', 'PORTAL_REDIRECT_REJECTED', 502);
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
        throw providerError('Cổng Saigon Co.op trả về chuyển hướng thiếu địa chỉ.', 'PORTAL_REDIRECT_REJECTED', 502);
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
  throw providerError('Cổng Saigon Co.op chuyển hướng quá nhiều lần.', 'PORTAL_REDIRECT_REJECTED', 502);
}

function encodeState(state: ManualCaptchaState): string {
  const encoded = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
  if (encoded.length > 12000) {
    throw providerError('Dữ liệu CAPTCHA Saigon Co.op vượt giới hạn.', 'CAPTCHA_UNAVAILABLE', 502);
  }
  return encoded;
}

function decodeState(value: unknown, lookupCode: string): ManualCaptchaState {
  const encoded = String(value || '');
  if (!encoded || encoded.length > 12000) {
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
    Object.keys(hidden).length <= 12 &&
    Object.entries(hidden).every(([name, field]) =>
      ['__RequestVerificationToken', 'CaptchaDeText', 'CaptchaToken'].includes(name) &&
      typeof field === 'string' && field.length <= 4096 && !/[\r\n]/.test(field));

  if (!Number.isSafeInteger(state?.issuedAt) || state.issuedAt > now + 10000 ||
      now - state.issuedAt > MAX_STATE_AGE_MS || !validCookies || !validHiddenFields ||
      state.lookupField !== 'MA_NHAN_HOA_DON' || state.captchaField !== 'CaptchaInputText' ||
      state.action !== '/xem-hoa-don' ||
      !state.hiddenFields.__RequestVerificationToken ||
      !(state.hiddenFields.CaptchaDeText || state.hiddenFields.CaptchaToken) ||
      !/^[a-f0-9]{64}$/.test(state.lookupCodeHash || '') ||
      state.lookupCodeHash !== createHash('sha256').update(lookupCode).digest('hex')) {
    throw providerError('Phiên CAPTCHA đã hết hạn hoặc không khớp mã nhận hóa đơn. Tải CAPTCHA mới.', 'CAPTCHA_EXPIRED');
  }
  return state;
}

export async function createSaigonCoopManualCaptcha(lookupCodeInput: unknown): Promise<{
  image: string;
  state: string;
}> {
  const lookupCode = normalizeLookupCode(lookupCodeInput);
  const jar = new Map<string, string>();
  try {
    const page = await requestPortal(new URL(PORTAL_URL), 'GET', undefined, jar, 15000);
    if (!page.ok) {
      throw providerError('Không tải được biểu mẫu tra cứu Saigon Co.op (HTTP ' + page.status + ').', 'CAPTCHA_UNAVAILABLE', 502);
    }
    const html = await page.text();
    if (html.length > 2_000_000) {
      throw providerError('Biểu mẫu tra cứu Saigon Co.op vượt giới hạn.', 'CAPTCHA_UNAVAILABLE', 502);
    }
    const form = parseThaiSonForm(html);
    if (!form.formFound || form.field !== 'MA_NHAN_HOA_DON' ||
        form.captchaField !== 'CaptchaInputText' || !form.imagePath ||
        !form.hiddenFields.__RequestVerificationToken ||
        !(form.hiddenFields.CaptchaDeText || form.hiddenFields.CaptchaToken)) {
      throw providerError('Không nhận diện được biểu mẫu CAPTCHA của cổng Saigon Co.op.', 'CAPTCHA_FORM_CHANGED', 502);
    }
    const action = new URL(form.formAction || '/xem-hoa-don', PORTAL_URL);
    const imageUrl = new URL(form.imagePath, PORTAL_URL);
    if (action.origin !== PORTAL_ORIGIN || action.pathname !== '/xem-hoa-don' ||
        imageUrl.origin !== PORTAL_ORIGIN) {
      throw providerError('Biểu mẫu Saigon Co.op có địa chỉ không hợp lệ.', 'CAPTCHA_FORM_CHANGED', 502);
    }
    const imageResponse = await requestPortal(imageUrl, 'GET', undefined, jar, 10000);
    if (!imageResponse.ok) {
      throw providerError('Không tải được ảnh CAPTCHA Saigon Co.op.', 'CAPTCHA_UNAVAILABLE', 502);
    }
    const mime = (imageResponse.headers.get('content-type') || '').split(';')[0].toLowerCase();
    const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
    if (!/^image\/(?:png|jpeg|gif|webp)$/.test(mime) ||
        imageBytes.length < 50 || imageBytes.length > 400_000) {
      throw providerError('Cổng Saigon Co.op trả ảnh CAPTCHA không hợp lệ.', 'CAPTCHA_UNAVAILABLE', 502);
    }
    const state: ManualCaptchaState = {
      issuedAt: Date.now(),
      cookies: Array.from(jar, ([name, value]) => name + '=' + value),
      hiddenFields: form.hiddenFields,
      action: action.pathname,
      lookupCodeHash: createHash('sha256').update(lookupCode).digest('hex'),
      lookupField: 'MA_NHAN_HOA_DON',
      captchaField: 'CaptchaInputText',
    };
    return {
      image: 'data:' + mime + ';base64,' + imageBytes.toString('base64'),
      state: encodeState(state),
    };
  } catch (error: any) {
    if (error instanceof OriginalInvoiceError) throw error;
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw providerError(
      timedOut ? 'Kết nối cổng Saigon Co.op hết thời gian chờ.' : 'Không thể tải CAPTCHA Saigon Co.op.',
      timedOut ? 'PROVIDER_TIMEOUT' : 'CAPTCHA_UNAVAILABLE',
      timedOut ? 504 : 502
    );
  }
}

export async function submitSaigonCoopManualLookup(params: {
  state: unknown;
  lookupCode: unknown;
  captcha: unknown;
  sellerTaxCode: string;
  invoiceNo: string;
  invoiceSeries: string;
}): Promise<SaigonCoopLookupResult> {
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

  let response: Response;
  try {
    response = await requestPortal(
      new URL(state.action, PORTAL_URL), 'POST', payload.toString(), jar, 30000
    );
  } catch (error: any) {
    if (error instanceof OriginalInvoiceError) throw error;
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw providerError(
      timedOut ? 'Tra cứu Saigon Co.op hết thời gian chờ.' : 'Không kết nối được cổng Saigon Co.op.',
      timedOut ? 'PROVIDER_TIMEOUT' : 'LOOKUP_FAILED',
      timedOut ? 504 : 502
    );
  }
  const contentLength = Number(response.headers.get('content-length') || '0');
  if (contentLength > 18_000_000) {
    throw providerError('Kết quả tra cứu Saigon Co.op vượt giới hạn 18 MB.', 'RESULT_TOO_LARGE', 502);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 18_000_000) {
    throw providerError('Kết quả tra cứu Saigon Co.op vượt giới hạn 18 MB.', 'RESULT_TOO_LARGE', 502);
  }
  const contentType = response.headers.get('content-type') || '';
  if (bytes.subarray(0, 5).toString('latin1') === '%PDF-') {
    const verification = await verifyIssuerInvoiceBytes(bytes, contentType, {
      sellerTaxCode: params.sellerTaxCode,
      invoiceNo: params.invoiceNo,
      invoiceSeries: params.invoiceSeries,
    });
    if (!verification.ok) {
      throw providerError('PDF Saigon Co.op chưa khớp hóa đơn đang mở: ' + verification.reason, 'INVOICE_IDENTITY_MISMATCH');
    }
    const number = String(params.invoiceNo).replace(/\D/g, '').padStart(7, '0');
    return {
      kind: 'pdf',
      filename: 'HoaDon_SaigonCoop_' + params.sellerTaxCode.replace(/\D/g, '') + '_' + number + '.pdf',
      pdfBuffer: bytes,
    };
  }
  if (!response.ok || !/html/i.test(contentType)) {
    throw providerError('Saigon Co.op trả kết quả tra cứu không hợp lệ (HTTP ' + response.status + ').', 'LOOKUP_FAILED', 502);
  }

  const html = bytes.toString('utf8');
  const verifiedHtml = verifiedThaiSonInvoiceHtml(html, params.sellerTaxCode, params.invoiceNo);
  if (verifiedHtml) return { kind: 'html', html: verifiedHtml };

  const $ = cheerio.load(html);
  const returnedForm = parseThaiSonForm(html);
  const providerMessage = (returnedForm.error || $('#listresult').text())
    .replace(/\s+/g, ' ').trim().slice(0, 240);
  const isCaptchaError = /captcha|mã kiểm tra|mã xác thực/i.test(providerMessage);
  if (returnedForm.formFound && returnedForm.field === 'MA_NHAN_HOA_DON' && !providerMessage) {
    throw providerError(
      'Cổng chưa mở hóa đơn và đã trả lại biểu mẫu tra cứu. Kiểm tra mã nhận HĐ, nhập lại CAPTCHA hoặc tải CAPTCHA mới.',
      'LOOKUP_NOT_COMPLETED'
    );
  }
  throw providerError(
    isCaptchaError
      ? 'CAPTCHA không đúng hoặc đã hết hạn. Tải CAPTCHA mới rồi thử lại.'
      : providerMessage || 'Kết quả từ cổng Saigon Co.op không khớp MST và số hóa đơn đang mở; không hiển thị kết quả.',
    isCaptchaError ? 'CAPTCHA_REJECTED' : 'INVOICE_NOT_VERIFIED'
  );
}
