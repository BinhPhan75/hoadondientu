/**
 * WINinvoice: verified public lookup workflow.
 * GET /bill for fresh CSRF & session -> POST form private_code/cmpn_key
 * -> 303 /bill/inv -> GET matching /bill/view?...&download=1.
 * Never reuse a copied user's CSRF token, cookie, or invoice-specific f key.
 */
import * as cheerio from 'cheerio';
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import type { ExtractedInvoiceInfo, DownloadOptions, DownloadResult, DriverMetadata } from '../types';
import { OriginalInvoiceError } from '../OriginalInvoiceError';
import { verifyIssuerInvoiceBytes } from '../../invoiceIdentityVerifier';

const HOST = 'https://tracuu.wininvoice.vn';
const PORTAL = HOST + '/bill';
const MAX_HTML = 2_000_000;
const MAX_PDF = 18_000_000;
const TOKEN_FIELD = 'phtcsrf_tkndf-tc';
const TOKEN_COOKIE = 'df-tcphtcsrf_coki_tkndf-tc';

export function winInvoiceFields(xml: string): { lookupCode: string; companyCode: string } {
  const field = (id: string) => {
    const match = [...xml.matchAll(/<TTin\b[^>]*\bId=["']([^"']+)["'][^>]*>([\s\S]*?)<\/TTin>/gi)]
      .find(item => item[1].toLowerCase() === id.toLowerCase());
    if (!match) return '';
    return match[2].match(/<DLieu(?:\s[^>]*)?>([\s\S]*?)<\/DLieu>/i)?.[1]?.trim() || '';
  };
  return { lookupCode: field('privateCode'), companyCode: field('cmpnKey') };
}

function sameOrigin(url: URL): boolean {
  return url.origin === HOST && !url.username && !url.password;
}

/** No arbitrary redirects or external URL fetches. */
function providerUrl(value: string, base: string): URL | undefined {
  try {
    const url = new URL(value, base);
    return sameOrigin(url) ? url : undefined;
  } catch { return undefined; }
}

function setCookies(headers: Headers, jar: Map<string, string>): void {
  // getSetCookie is available on Node/undici Headers. Do not log cookies.
  const values = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  for (const item of values) {
    const pair = item.split(';', 1)[0];
    const pos = pair.indexOf('=');
    if (pos > 0) {
      const name = pair.slice(0, pos).trim();
      const value = pair.slice(pos + 1).trim();
      if (/^[a-zA-Z0-9_-]{1,100}$/.test(name) && value.length < 4096) jar.set(name, value);
    }
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([key, value]) => key + '=' + value).join('; ');
}

function csrfFromHtml(html: string): string {
  const $ = cheerio.load(html);
  const field = $('input').filter((_, el) => $(el).attr('name') === TOKEN_FIELD).first();
  return String(field.attr('value') || '').trim();
}

export function findWinInvoiceDownloadLink(html: string, info: ExtractedInvoiceInfo): string | undefined {
  const $ = cheerio.load(html);
  const series = String(info.invoiceSeries || '').trim().toUpperCase();
  const number = String(info.invoiceNo || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!series || !number) return undefined;
  // Website may render download links in href, data-href or JS onclick.
  const candidates: string[] = [];
  $('[href],[data-href],[onclick]').each((_, el) => {
    for (const attr of ['href', 'data-href', 'onclick']) {
      const value = $(el).attr(attr) || '';
      if (attr !== 'onclick') {
        if (value) candidates.push(value);
      } else {
        const match = value.match(/(?:https?:\/\/tracuu\.wininvoice\.vn)?\/bill\/view\?[^"'\s<>]+/i);
        if (match) candidates.push(match[0]);
      }
    }
  });
  for (const candidate of candidates) {
    const url = providerUrl(candidate.replace(/&amp;/gi, '&'), HOST + '/bill/inv');
    if (!url || url.pathname !== '/bill/view') continue;
    const name = url.searchParams.get('name') || '';
    const pivot = name.lastIndexOf('_');
    if (pivot < 0) continue;
    const linkSeries = name.slice(0, pivot).trim().toUpperCase();
    const linkNo = name.slice(pivot + 1).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (series !== linkSeries || number !== linkNo || !url.searchParams.get('f')) continue;
    url.searchParams.set('download', '1');
    return url.href;
  }
  return undefined;
}

async function responseText(response: Response): Promise<string> {
  const size = Number(response.headers.get('content-length') || 0);
  if (size > MAX_HTML) throw new Error('HTML từ WINinvoice vượt giới hạn.');
  const text = await response.text();
  if (text.length > MAX_HTML) throw new Error('HTML từ WINinvoice vượt giới hạn.');
  return text;
}

export class WinInvoiceDriver extends BaseInvoiceProviderDriver {
  readonly name = 'WINinvoice Original PDF Driver';
  readonly providerCode = 'WININVOICE';
  readonly metadata: DriverMetadata = {
    name: 'WINinvoice Original PDF Driver', providerCode: 'WININVOICE',
    description: 'Tra cứu PDF WINinvoice bằng privateCode + cmpnKey qua biểu mẫu chính thức',
    sampleUrl: PORTAL, supportsCaptcha: false, requiredFields: ['rawXml'],
  };

  canHandle(input: string | ExtractedInvoiceInfo): boolean {
    if (typeof input !== 'string') return input.provider === this.providerCode;
    return /<MSTTCGP>\s*0312303803\s*<\/MSTTCGP>/i.test(input) ||
      /(?:tracuu\.)?wininvoice\.vn/i.test(input);
  }

  extractInfo(xml: string): ExtractedInvoiceInfo {
    const fields = winInvoiceFields(xml);
    const seller = this.extractXmlTag(this.extractXmlTag(xml, 'NBan'), 'MST');
    return {
      provider: this.providerCode, providerName: 'WINinvoice - Win Tech Solution',
      sellerTaxCode: seller, sellerName: this.extractXmlTag(this.extractXmlTag(xml, 'NBan'), 'Ten'),
      invoiceNo: this.extractXmlTag(xml, 'SHDon'), invoiceSeries: this.extractXmlTag(xml, 'KHHDon'),
      templateCode: this.extractXmlTag(xml, 'KHMSHDon'), invoiceDate: this.extractXmlTag(xml, 'NLap'),
      cqtCode: this.extractXmlTag(xml, 'MCCQT'),
      lookupCode: fields.lookupCode, lookupUrl: PORTAL, rawXml: xml,
      additionalData: { companyCode: fields.companyCode, lookupMethod: 'privateCode+cmpnKey' },
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const fail = (reason: string, code = 'WININVOICE_PORTAL_REQUIRED'): never => {
      throw new OriginalInvoiceError(
        reason + ' Có thể tra cứu tại https://tracuu.wininvoice.vn/bill bằng hai mã trong XML.',
        this.providerCode, code, 428, PORTAL
      );
    };
    if (!/<MSTTCGP>\s*0312303803\s*<\/MSTTCGP>/i.test(info.rawXml || '')) {
      return fail('Không có XML WINinvoice hợp lệ.', 'WININVOICE_XML_REQUIRED');
    }
    const {lookupCode, companyCode} = winInvoiceFields(info.rawXml || '');
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(lookupCode) ||
        !/^\d{10}(?:-\d{3})?$/.test(companyCode)) {
      return fail('Thiếu privateCode hoặc cmpnKey hợp lệ.', 'WININVOICE_MISSING_CODES');
    }
    const timeout = Math.min(options?.timeoutMs || 25000, 45000);
    const jar = new Map<string, string>();
    const logs: string[] = [];
    const request = async (url: string, method: 'GET'|'POST', body?: string) => {
      const response = await fetch(url, {
        method, redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/pdf,*/*',
          ...(jar.size ? { Cookie: cookieHeader(jar) } : {}),
          ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', Origin: HOST } : {}),
          Referer: PORTAL,
        },
        ...(body ? { body } : {}),
        signal: AbortSignal.timeout(timeout),
      });
      setCookies(response.headers, jar);
      return response;
    };
    try {
      // Establish same-session cookies and request a FRESH anti-CSRF value.
      const landing = await request(PORTAL, 'GET');
      if (!landing.ok || !String(landing.headers.get('content-type') || '').includes('text/html')) {
        return fail('Không mở được biểu mẫu WINinvoice.');
      }
      const html = await responseText(landing);
      const formToken = csrfFromHtml(html);
      const cookieToken = jar.get(TOKEN_COOKIE) || '';
      const csrf = formToken || cookieToken;
      if (!csrf || !/^[A-Za-z0-9_-]{12,150}$/.test(csrf) || !jar.size) {
        return fail('Không lấy được phiên hoặc mã CSRF hợp lệ từ WINinvoice.');
      }
      const data = new URLSearchParams({
        private_code: lookupCode, cmpn_key: companyCode, action: 'submit',
        [TOKEN_FIELD]: csrf, test: '1',
      });
      // The observed contract is POST /bill with 303 See Other /bill/inv.
      const posted = await request(PORTAL, 'POST', data.toString());
      if (posted.status !== 303) {
        return fail('WINinvoice không chấp nhận biểu mẫu tra cứu (HTTP ' + posted.status + ').');
      }
      const redirect = providerUrl(posted.headers.get('location') || '', PORTAL);
      if (!redirect || redirect.pathname !== '/bill/inv') {
        return fail('Phản hồi chuyển hướng tra cứu WINinvoice không hợp lệ.');
      }
      logs.push('Đã xác thực biểu mẫu WINinvoice và được chuyển đến danh sách hóa đơn');
      const listing = await request(redirect.href, 'GET');
      if (!listing.ok || !String(listing.headers.get('content-type') || '').includes('text/html')) {
        return fail('Không lấy được danh sách hóa đơn WINinvoice.');
      }
      const listHtml = await responseText(listing);
      const downloadUrl = findWinInvoiceDownloadLink(listHtml, info);
      if (!downloadUrl) return fail('Không tìm thấy liên kết tải đúng ký hiệu và số hóa đơn trong phiên tra cứu.');
      const file = await request(downloadUrl, 'GET');
      if (!file.ok || Number(file.headers.get('content-length') || 0) > MAX_PDF ||
          file.headers.get('location')) {
        return fail('WINinvoice không cho tải hóa đơn (HTTP ' + file.status + ').');
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.length < 100 || bytes.length > MAX_PDF ||
          bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
        return fail('Đường dẫn tải WINinvoice không trả PDF; có thể yêu cầu phiên trình duyệt hoặc tải loại file khác.');
      }
      const verified = await verifyIssuerInvoiceBytes(bytes, 'application/pdf', {
        sellerTaxCode: info.sellerTaxCode, invoiceSeries: info.invoiceSeries, invoiceNo: info.invoiceNo,
      });
      if (!verified.ok) return fail('Không xác minh được danh tính PDF gốc: ' + verified.reason);
      logs.push('PDF được đối chiếu thông tin hóa đơn thành công');
      return {
        success: true, provider: this.providerCode, driverName: this.name,
        pdfBuffer: bytes, pdfBase64: bytes.toString('base64'),
        filename: this.buildPdfFilename(info), contentType: 'application/pdf',
        sourceUrl: downloadUrl, isFallback: false, executionLogs: logs,
      };
    } catch (error: any) {
      if (error instanceof OriginalInvoiceError) throw error;
      return fail('Không kết nối được cổng WINinvoice hoặc phiên tra cứu đã hết hạn.');
    }
  }
}
