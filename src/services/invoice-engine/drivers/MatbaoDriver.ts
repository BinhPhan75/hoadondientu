/**
 * Matbao / Mifi (MSTTCGP 0302712571) issuer original-PDF lookup.
 *
 * These invoices use their raw XML as the lookup input, not an fkey.
 * The XML-upload endpoint/field varies with portal deployment and is not
 * publicly documented. Only enable automated upload after inspecting a
 * working provider request; never guess an endpoint in production.
 *
 * Optional server configuration:
 * MATBAO_XML_UPLOAD_URL=https://<verified-matbao-or-mifi-host>/<verified-path>
 * MATBAO_XML_UPLOAD_FIELD=<verified-multipart-file-field> (default: file)
 * MATBAO_XML_UPLOAD_MODE=multipart | raw (default: multipart)
 */
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import type { ExtractedInvoiceInfo, DownloadOptions, DownloadResult, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { OriginalInvoiceError } from '../OriginalInvoiceError';
import { verifyIssuerInvoiceBytes } from '../../invoiceIdentityVerifier';

const PORTAL = 'https://matbao.in/tra-cuu-hoa-don';
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

export class MatbaoDriver extends BaseInvoiceProviderDriver {
  readonly name = 'Matbao Mifi XML Upload Driver';
  readonly providerCode = 'MATBAO';
  readonly metadata: DriverMetadata = {
    name: 'Matbao Mifi XML Upload Driver',
    providerCode: 'MATBAO',
    description: 'Tra cứu theo XML gốc, không cần mã tra cứu dạng văn bản',
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
      additionalData: { msttcgp: '0302712571', lookupMethod: 'xml-upload' },
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

    const upload = verifiedProviderUrl(process.env.MATBAO_XML_UPLOAD_URL || '');
    if (!upload) {
      return fallback('Chưa cấu hình endpoint nhận XML được xác minh của Mắt Bão.');
    }

    const timeout = Math.min(options?.timeoutMs || 20000, 30000);
    const mode = process.env.MATBAO_XML_UPLOAD_MODE === 'raw' ? 'raw' : 'multipart';
    const headers: Record<string, string> = { Accept: 'application/json, text/html, */*' };
    let body: BodyInit;
    if (mode === 'raw') {
      headers['Content-Type'] = 'application/xml; charset=utf-8';
      body = xml;
    } else {
      const field = process.env.MATBAO_XML_UPLOAD_FIELD || 'file';
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(field)) {
        return fallback('Tên trường upload XML không hợp lệ.', 'MATBAO_UPLOAD_CONFIG_ERROR', 500);
      }
      const form = new FormData();
      form.append(field, new Blob([xml], { type: 'application/xml' }), 'invoice.xml');
      body = form;
    }

    let target: string | undefined;
    try {
      const response = await fetch(upload.href, {
        method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) {
        return fallback('Cổng Mắt Bão từ chối upload XML (HTTP ' + response.status + ').',
          'MATBAO_UPLOAD_UNAVAILABLE', 502);
      }
      const ct = response.headers.get('content-type') || '';
      const text = await response.text();
      if (text.length > 2_000_000) return fallback('Phản hồi upload quá lớn.');
      if (/json/i.test(ct)) {
        try { target = findPdfTarget(JSON.parse(text)); } catch { /* invalid response */ }
      }
      // Some portals return a server-rendered HTML link to their viewer.
      if (!target && /html/i.test(ct)) {
        const match = text.match(/https:\/\/[^"'\s<>]+(?:downloadpdfca\.aspx|\.pdf)[^"'\s<>]*/i);
        if (match) target = findPdfTarget(match[0].replace(/&amp;/g, '&'));
      }
    } catch {
      return fallback('Không kết nối được dịch vụ upload XML của Mắt Bão.',
        'MATBAO_UPLOAD_UNAVAILABLE', 502);
    }
    if (!target) return fallback('Chưa nhận được liên kết tải PDF từ kết quả upload XML.');

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
        executionLogs: ['Upload XML Mắt Bão thành công', 'Đã xác minh danh tính PDF gốc'],
      };
    } catch (error) {
      if (error instanceof OriginalInvoiceError) throw error;
      return fallback('Không tải được PDF gốc từ máy chủ Mắt Bão.', 'MATBAO_PDF_UNAVAILABLE', 502);
    }
  }
}
