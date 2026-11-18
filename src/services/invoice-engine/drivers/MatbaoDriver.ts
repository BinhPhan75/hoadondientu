/**
 * Matbao / Mifi (MSTTCGP 0302712571) issuer original-PDF lookup.
 * Mirror the public portal's XML flow: resolve the FKey from invoice identity,
 * then query the PDF endpoint. Pass through only a user-provided CAPTCHA token.
 */
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import type { ExtractedInvoiceInfo, DownloadOptions, DownloadResult, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { OriginalInvoiceError } from '../OriginalInvoiceError';
import { verifyIssuerInvoiceBytes } from '../../invoiceIdentityVerifier';

const PORTAL = 'https://matbao.in/tra-cuu-hoa-don';
const FKEY_ENDPOINT = 'https://matbao.in/api/tra-cuu-hoa-don/fkey';
const LOOKUP_ENDPOINT = 'https://matbao.in/api/tra-cuu-hoa-don';
const MAX_XML = 5_000_000;
const MAX_PDF = 18_000_000;

function verifiedProviderUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['matbao.in', 'mifi.vn'].some(root => host === root || host.endsWith('.' + root))) return null;
    return url;
  } catch { return null; }
}

function findPdfTarget(value: unknown, depth = 0): string | undefined {
  if (depth > 5 || value == null) return undefined;
  if (typeof value === 'string') {
    const url = verifiedProviderUrl(value);
    return url && /(?:downloadpdfca\.aspx|\.pdf(?:$|\?))/i.test(url.pathname) ? url.href : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 25)) {
      const target = findPdfTarget(item, depth + 1);
      if (target) return target;
    }
  } else if (typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      if (/url|pdf|download|link|data|result|viewer/i.test(key)) {
        const target = findPdfTarget(val, depth + 1);
        if (target) return target;
      }
    }
  }
  return undefined;
}

/**
 * Matbao's own PDF proxy accepts a validated issuer viewer URL.
 * Do not forward arbitrary URLs to its src parameter.
 */
export function matbaoPdfProxyFromViewer(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const viewer = verifiedProviderUrl(value);
  if (!viewer || viewer.hostname === 'matbao.in' ||
      !/\/api\/ViewInvTemplate\.aspx$/i.test(viewer.pathname)) return undefined;
  const p = viewer.searchParams;
  if (!p.get('idinv') || !p.get('fkey') || !p.get('comid') ||
      !/^\d{1,3}$/.test(p.get('pattern') || '') ||
      !/^[01]$/.test(p.get('convert') || '')) return undefined;
  const proxy = new URL('https://matbao.in/api/tra-cuu-hoa-don/pdf');
  proxy.searchParams.set('src', viewer.href);
  return proxy.href;
}

export function matbaoPdfUrlFromLookupResult(
  payload: unknown, info: Pick<ExtractedInvoiceInfo, 'invoiceNo' | 'invoiceSeries' | 'templateCode'>
): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const result = payload as Record<string, unknown>;
  const normalizeNo = (value: unknown) => String(value ?? '').replace(/^0+(?=\d)/, '');
  const symbol = String(result.symbol ?? '').toUpperCase();
  const series = String(info.invoiceSeries || '').toUpperCase();
  if (result.found !== true ||
      normalizeNo(result.number) !== normalizeNo(info.invoiceNo) ||
      (symbol !== series && symbol !== String(info.templateCode) + series)) return undefined;
  // Prefer Matbao's same-origin PDF proxy, observed returning application/pdf.
  return matbaoPdfProxyFromViewer(result.viewerUrl) || findPdfTarget(result.pdfUrl);
}

export class MatbaoDriver extends BaseInvoiceProviderDriver {
  readonly name = 'Matbao Mifi XML Lookup Driver';
  readonly providerCode = 'MATBAO';
  readonly metadata: DriverMetadata = {
    name: 'Matbao Mifi XML Lookup Driver',
    providerCode: 'MATBAO',
    description: 'Tra cứu theo XML gốc qua FKey của cổng Mắt Bão',
    sampleUrl: PORTAL,
    supportsCaptcha: true,
    requiredFields: ['rawXml'],
  };

  canHandle(xml: string | ExtractedInvoiceInfo): boolean {
    if (typeof xml !== 'string') return xml.provider === this.providerCode ||
      /matbao|mifi/i.test(xml.lookupUrl || '');
    return detectProvider(xml) === this.providerCode ||
      /<MSTTCGP>\s*0302712571\s*<\/MSTTCGP>/i.test(xml) ||
      /(?:matbao\.in|mifi\.vn)/i.test(xml);
  }

  extractInfo(xml: string): ExtractedInvoiceInfo {
    const seller = this.extractXmlTag(this.extractXmlTag(xml, 'NBan'), 'MST');
    const name = this.extractXmlTag(this.extractXmlTag(xml, 'NBan'), 'Ten');
    const no = this.extractXmlTag(xml, 'SHDon');
    const series = this.extractXmlTag(xml, 'KHHDon');
    return {
      provider: this.providerCode,
      providerName: 'Mắt Bão / Mifi',
      sellerTaxCode: seller,
      sellerName: name,
      invoiceNo: no,
      invoiceSeries: series,
      templateCode: this.extractXmlTag(xml, 'KHMSHDon'),
      invoiceDate: this.extractXmlTag(xml, 'NLap'),
      cqtCode: this.extractXmlTag(xml, 'MCCQT'),
      // Matbao's XML does not contain a conventional lookup code.
      lookupCode: '',
      lookupUrl: PORTAL,
      rawXml: xml,
      additionalData: { msttcgp: '0302712571', lookupMethod: 'xml-fkey' },
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const fallback = (detail: string, code = 'MATBAO_XML_UPLOAD_REQUIRED', status = 428): never => {
      throw new OriginalInvoiceError(
        detail + ' Mở https://matbao.in/tra-cuu-hoa-don, chọn "Tra cứu dùng file XML", tải XML hóa đơn lên để lấy bản PDF gốc.',
        this.providerCode, code, status, PORTAL
      );
    };

    const xml = String(info.rawXml || '');
    if (!xml.includes('<HDon') || !/0302712571/.test(this.extractXmlTag(xml, 'MSTTCGP')) ||
        Buffer.byteLength(xml, 'utf8') > MAX_XML) {
      return fallback('Thiếu XML Mắt Bão hợp lệ.', 'MATBAO_XML_REQUIRED', 400);
    }

    const timeout = Math.min(options?.timeoutMs || 20000, 30000);
    const sellerTaxCode = info.sellerTaxCode || this.extractXmlTag(xml, 'MST');
    const templateCode = info.templateCode || this.extractXmlTag(xml, 'KHMSHDon');
    const invoiceSeries = info.invoiceSeries || this.extractXmlTag(xml, 'KHHDon');
    const invoiceNo = String(info.invoiceNo || this.extractXmlTag(xml, 'SHDon') || '')
      .trim().replace(/^0+(?=\d)/, '');
    if (!sellerTaxCode || !templateCode || !invoiceSeries || !/^\d+$/.test(invoiceNo)) {
      return fallback('XML thiếu MST người bán, mẫu số, ký hiệu hoặc số hóa đơn.',
        'MATBAO_XML_REQUIRED', 400);
    }

    let fkey = this.extractXmlTag(xml, 'Fkey') || '';
    if (!fkey) {
      const fkeyUrl = new URL(FKEY_ENDPOINT);
      fkeyUrl.searchParams.set('taxcode', sellerTaxCode);
      fkeyUrl.searchParams.set('pattern', templateCode);
      fkeyUrl.searchParams.set('serial', invoiceSeries);
      fkeyUrl.searchParams.set('no', invoiceNo);
      let response: Response;
      try {
        response = await fetch(fkeyUrl, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(timeout),
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return fallback('Không kết nối được API lấy FKey của Mắt Bão: ' + detail,
          'MATBAO_FKEY_UNAVAILABLE', 502);
      }
      if (!response.ok) {
        return fallback('API lấy FKey của Mắt Bão trả về HTTP ' + response.status + '.',
          'MATBAO_FKEY_UNAVAILABLE', 502);
      }
      const text = await response.text();
      if (text.length > 300_000) return fallback('Phản hồi FKey của Mắt Bão vượt giới hạn.');
      let payload: unknown;
      try { payload = JSON.parse(text); } catch {
        return fallback('API lấy FKey của Mắt Bão trả về dữ liệu không hợp lệ.',
          'MATBAO_FKEY_UNAVAILABLE', 502);
      }
      const value = payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>).fkey
        : undefined;
      fkey = typeof value === 'string' ? value.trim() : '';
    }
    if (!/^[A-Za-z0-9]{5,64}$/.test(fkey)) {
      return fallback('Mắt Bão không tìm thấy FKey phù hợp với hóa đơn XML này.',
        'MATBAO_FKEY_NOT_FOUND', 404);
    }

    const lookupUrl = new URL(LOOKUP_ENDPOINT);
    lookupUrl.searchParams.set('code', fkey);
    lookupUrl.searchParams.set('keyword', '');
    const recaptchaToken = String(options?.recaptchaToken || '').trim();
    if (recaptchaToken) lookupUrl.searchParams.set('token', recaptchaToken);
    let lookupResponse: Response;
    try {
      lookupResponse = await fetch(lookupUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeout),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return fallback('Không kết nối được API tra cứu hóa đơn Mắt Bão: ' + detail,
        'MATBAO_LOOKUP_UNAVAILABLE', 502);
    }
    if (lookupResponse.status === 403) {
      return fallback('Mắt Bão yêu cầu xác minh reCAPTCHA trên trang tra cứu.',
        'MATBAO_CAPTCHA_REQUIRED', 428);
    }
    if (!lookupResponse.ok) {
      return fallback('API tra cứu Mắt Bão trả về HTTP ' + lookupResponse.status + '.',
        'MATBAO_LOOKUP_UNAVAILABLE', 502);
    }
    const lookupText = await lookupResponse.text();
    if (lookupText.length > 300_000) return fallback('Phản hồi tra cứu Mắt Bão vượt giới hạn.');
    let lookupResult: unknown;
    try { lookupResult = JSON.parse(lookupText); } catch {
      return fallback('API tra cứu Mắt Bão trả về dữ liệu không hợp lệ.',
        'MATBAO_LOOKUP_UNAVAILABLE', 502);
    }
    if (!lookupResult || typeof lookupResult !== 'object' ||
        (lookupResult as Record<string, unknown>).found !== true) {
      if (!recaptchaToken) {
        return fallback('Mắt Bão chưa trả kết quả khi chưa có CAPTCHA; hãy xác minh trên trang tra cứu.',
          'MATBAO_CAPTCHA_REQUIRED', 428);
      }
      return fallback('Mắt Bão không tìm thấy hóa đơn theo FKey lấy từ XML.',
        'MATBAO_INVOICE_NOT_FOUND', 404);
    }
    const target = matbaoPdfUrlFromLookupResult(lookupResult, {
      invoiceNo,
      invoiceSeries,
      templateCode,
    });
    if (!target) {
      return fallback('Kết quả FKey không khớp hóa đơn XML hoặc không có liên kết PDF đáng tin cậy.',
        'MATBAO_PDF_LINK_UNVERIFIED', 422);
    }

    try {
      const response = await fetch(target, {
        redirect: 'manual', signal: AbortSignal.timeout(timeout),
        headers: { Accept: 'application/pdf' },
      });
      if (!response.ok || response.headers.get('location')) {
        return fallback('Máy chủ PDF Mắt Bão yêu cầu xác minh trong trình duyệt.',
          'MATBAO_PDF_REQUIRES_BROWSER', 428);
      }
      const claimedSize = Number(response.headers.get('content-length') || 0);
      if (claimedSize > MAX_PDF) return fallback('PDF vượt giới hạn 18MB.');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_PDF || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
        return fallback('Máy chủ không trả về PDF gốc hợp lệ.');
      }
      const check = await verifyIssuerInvoiceBytes(bytes, 'application/pdf', {
        sellerTaxCode: info.sellerTaxCode,
        invoiceNo: info.invoiceNo,
        invoiceSeries: info.invoiceSeries,
      });
      if (!check.ok) return fallback('Chưa xác minh được đúng hóa đơn từ PDF: ' + check.reason,
        'MATBAO_PDF_IDENTITY_MISMATCH', 422);
      return {
        success: true, provider: this.providerCode, driverName: this.name,
        pdfBuffer: bytes, pdfBase64: bytes.toString('base64'), contentType: 'application/pdf',
        filename: this.buildPdfFilename(info), isFallback: false, sourceUrl: target,
        executionLogs: ['Đã nhận liên kết PDF từ cổng Mắt Bão', 'Đã xác minh danh tính PDF gốc'],
      };
    } catch (error) {
      if (error instanceof OriginalInvoiceError) throw error;
      return fallback('Không tải được PDF gốc từ máy chủ Mắt Bão.', 'MATBAO_PDF_UNAVAILABLE', 502);
    }
  }
}
