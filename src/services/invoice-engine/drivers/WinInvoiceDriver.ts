/**
 * WINinvoice (Win Tech Solution, solution MST 0312303803).
 * The XML contains privateCode (lookup code) and cmpnKey (company code);
 * neither is equivalent to the CQT code.
 * The public portal's actual download API is not yet verified. Optional
 * WININVOICE_LOOKUP_API_URL must be configured only after observing a
 * successful authorized request in the provider Network panel.
 */
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import type { ExtractedInvoiceInfo, DownloadOptions, DownloadResult, DriverMetadata } from '../types';
import { OriginalInvoiceError } from '../OriginalInvoiceError';
import { verifyIssuerInvoiceBytes } from '../../invoiceIdentityVerifier';

const PORTAL = 'https://tracuu.wininvoice.vn/';
const MAX_PDF = 18_000_000;

export function winInvoiceFields(xml: string): { lookupCode: string; companyCode: string } {
  const field = (id: string) => {
    const match = [...xml.matchAll(/<TTin\b[^>]*\bId=["']([^"']+)["'][^>]*>([\s\S]*?)<\/TTin>/gi)]
      .find(item => item[1].toLowerCase() === id.toLowerCase());
    if (!match) return '';
    return match[2].match(/<DLieu(?:\s[^>]*)?>([\s\S]*?)<\/DLieu>/i)?.[1]?.trim() || '';
  };
  return { lookupCode: field('privateCode'), companyCode: field('cmpnKey') };
}

function authorizedWinInvoiceUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !(url.hostname === 'tracuu.wininvoice.vn' || url.hostname.endsWith('.wininvoice.vn')) ||
        url.hostname === 'wininvoice.vn') return null;
    return url;
  } catch { return null; }
}

export class WinInvoiceDriver extends BaseInvoiceProviderDriver {
  readonly name = 'WINinvoice Original PDF Driver';
  readonly providerCode = 'WININVOICE';
  readonly metadata: DriverMetadata = {
    name: 'WINinvoice Original PDF Driver', providerCode: 'WININVOICE',
    description: 'Tra cứu bằng mã privateCode và cmpnKey trong XML',
    sampleUrl: PORTAL, supportsCaptcha: false,
    requiredFields: ['rawXml'],
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
      sellerTaxCode: seller,
      sellerName: this.extractXmlTag(this.extractXmlTag(xml, 'NBan'), 'Ten'),
      invoiceNo: this.extractXmlTag(xml, 'SHDon'),
      invoiceSeries: this.extractXmlTag(xml, 'KHHDon'),
      templateCode: this.extractXmlTag(xml, 'KHMSHDon'),
      invoiceDate: this.extractXmlTag(xml, 'NLap'),
      cqtCode: this.extractXmlTag(xml, 'MCCQT'),
      lookupCode: fields.lookupCode, lookupUrl: PORTAL, rawXml: xml,
      additionalData: { companyCode: fields.companyCode, lookupMethod: 'privateCode+cmpnKey' },
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const fail = (reason: string, code = 'WININVOICE_PORTAL_REQUIRED'): never => {
      throw new OriginalInvoiceError(
        reason + ' Mở https://tracuu.wininvoice.vn/ rồi nhập Mã tra cứu và Mã công ty lấy từ XML để tải PDF gốc.',
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
    const endpoint = authorizedWinInvoiceUrl(process.env.WININVOICE_LOOKUP_API_URL || '');
    if (!endpoint) return fail('Chưa có endpoint tải PDF được xác minh từ cổng WINinvoice.');
    if (endpoint.pathname === '/' || endpoint.pathname === '/bill/') {
      return fail('Endpoint phải là API được xác minh, không phải trang nhập liệu.');
    }

    // Configurable adapter: use only the observed upstream contract.
    const codeField = process.env.WININVOICE_CODE_FIELD || 'lookupCode';
    const companyField = process.env.WININVOICE_COMPANY_FIELD || 'companyCode';
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(codeField) ||
        !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(companyField)) {
      return fail('Cấu hình tên trường WINinvoice không hợp lệ.');
    }
    const values = { [codeField]: lookupCode, [companyField]: companyCode };
    const timeout = Math.min(options?.timeoutMs || 20000, 30000);
    let bytes: Buffer | undefined;
    try {
      const response = await fetch(endpoint.href, {
        method: 'POST', redirect: 'manual',
        headers: { Accept: 'application/pdf, application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(values), signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok || response.status >= 300 || response.headers.get('location')) {
        return fail('WINinvoice không trả về PDF (HTTP ' + response.status + ').');
      }
      const length = Number(response.headers.get('content-length') || 0);
      if (length > MAX_PDF) return fail('PDF vượt giới hạn dung lượng.');
      const type = (response.headers.get('content-type') || '').toLowerCase();
      if (type.includes('application/pdf')) {
        bytes = Buffer.from(await response.arrayBuffer());
      } else if (type.includes('application/json')) {
        const body: any = await response.json();
        const b64 = body?.pdfBase64 || body?.result?.pdfBase64 || body?.filePdf?.fileData;
        const link = body?.pdfUrl || body?.result?.pdfUrl;
        if (typeof b64 === 'string' && b64.length < MAX_PDF * 1.5 &&
            /^[A-Za-z0-9+/]*={0,2}$/.test(b64)) {
          bytes = Buffer.from(b64, 'base64');
        } else if (typeof link === 'string') {
          const target = authorizedWinInvoiceUrl(link);
          if (!target) return fail('Liên kết PDF không thuộc hệ thống WINinvoice.');
          const download = await fetch(target.href, {
            redirect: 'manual', signal: AbortSignal.timeout(timeout),
            headers: { Accept: 'application/pdf' },
          });
          if (!download.ok || download.headers.get('location') ||
              Number(download.headers.get('content-length') || 0) > MAX_PDF) {
            return fail('Không tải được PDF từ URL của WINinvoice.');
          }
          bytes = Buffer.from(await download.arrayBuffer());
        }
      }
    } catch {
      return fail('Không kết nối được API tải PDF WINinvoice.');
    }
    if (!bytes || bytes.length < 100 || bytes.length > MAX_PDF ||
        bytes.subarray(0,5).toString('latin1') !== '%PDF-') {
      return fail('Cổng WINinvoice không trả về PDF gốc hợp lệ.');
    }
    const check = await verifyIssuerInvoiceBytes(bytes, 'application/pdf', {
      sellerTaxCode: info.sellerTaxCode,
      invoiceSeries: info.invoiceSeries,
      invoiceNo: info.invoiceNo,
    });
    if (!check.ok) return fail('PDF chưa xác minh đúng hóa đơn: ' + check.reason);
    return {
      success: true, provider: this.providerCode, driverName: this.name,
      pdfBuffer: bytes, pdfBase64: bytes.toString('base64'),
      contentType: 'application/pdf', filename: this.buildPdfFilename(info),
      sourceUrl: endpoint.href, isFallback: false,
      executionLogs: ['WINinvoice: đã tải PDF và xác minh danh tính hóa đơn'],
    };
  }
}
