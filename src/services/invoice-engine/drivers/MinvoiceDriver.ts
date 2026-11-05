/**
 * MinvoiceDriver: Driver xử lý tra cứu và tải hóa đơn điện tử gốc M-Invoice (minvoice.vn / minvoice.com.vn)
 * Đơn vị cung cấp giải pháp: Công ty TNHH Hóa đơn điện tử M-Invoice (MST: 0106026495)
 * Cổng tra cứu: https://tracuuhoadon.minvoice.com.vn
 *
 * Cơ chế tra cứu:
 * - Tham số 1: Mã số thuế bên bán (masothue / sellerTaxCode)
 * - Tham số 2: Số bảo mật (sobaomat / lookupCode / checkCode)
 * - PDF: GET /api/Search/SearchInvoiceCaptcha + X-Recaptcha-Token from the official portal
 * - Endpoint tải XML: GET /api/Search/DownloadXml?masothue=...&sobaomat=...
 */

import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { OriginalInvoiceError } from '../OriginalInvoiceError';
import { extractLookupDetailsFromXml } from '../../../utils/xmlParser';

export class MinvoiceDriver extends BaseInvoiceProviderDriver {
  readonly name = 'M-Invoice Driver';
  readonly providerCode = 'MINVOICE';
  readonly metadata: DriverMetadata = {
    name: 'M-Invoice Driver',
    providerCode: 'MINVOICE',
    description: 'Tra cứu & tải hóa đơn điện tử gốc M-Invoice (minvoice.vn) qua Mã số thuế bên bán và Số bảo mật',
    sampleUrl: 'https://tracuuhoadon.minvoice.com.vn',
    supportsCaptcha: true,
    requiredFields: ['sellerTaxCode', 'lookupCode']
  };

  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'MINVOICE';
    }
    return (
      detectProvider(xmlData) === 'MINVOICE' ||
      /minvoice\.vn|minvoice\.com\.vn|tracuuhoadon\.minvoice|0106026495/i.test(xmlData)
    );
  }

  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst');
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C24TMI';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    // 1. Thử qua hàm trích xuất đa lớp tổng quát
    const details = extractLookupDetailsFromXml(xmlData);
    let lookupCode = details.lookupCode || '';

    // 2. Tìm trong cấu trúc trường mở rộng <TTin><TTruong>Số bảo mật</TTruong><DLieu>...</DLieu></TTin>
    if (!lookupCode) {
      lookupCode = this.extractCustomField(xmlData, [
        'Số bảo mật',
        'SoBaoMat',
        'so_baomat',
        'CheckCode',
        'checkCode',
        'Mã bảo mật',
        'MaBaoMat',
        'Mã tra cứu',
        'MaTraCuu',
        'MTCuu'
      ]);
    }

    // 3. Tìm theo các thẻ XML trực tiếp của M-Invoice
    if (!lookupCode) {
      lookupCode =
        this.extractXmlTag(xmlData, 'SoBaoMat') ||
        this.extractXmlTag(xmlData, 'sobaomat') ||
        this.extractXmlTag(xmlData, 'CheckCode') ||
        this.extractXmlTag(xmlData, 'checkCode') ||
        this.extractXmlTag(xmlData, 'MaBaoMat') ||
        this.extractXmlTag(xmlData, 'MTCuu') ||
        this.extractXmlTag(xmlData, 'MaTraCuu');
    }

    // 4. Quét regex mẫu "Số bảo mật: ABCXYZ" trong text
    if (!lookupCode) {
      const match = xmlData.match(/(?:Số\s*bảo\s*mật|So\s*bao\s*mat|Mã\s*bảo\s*mật|CheckCode)\s*[:：=]\s*([A-Za-z0-9._-]+)/i);
      if (match && match[1]) {
        lookupCode = match[1].trim();
      }
    }

    return {
      provider: this.providerCode,
      providerName: 'M-Invoice (minvoice.vn)',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      cqtCode,
      lookupCode: lookupCode.trim(),
      lookupUrl: details.lookupUrl || 'https://tracuuhoadon.minvoice.com.vn',
      rawXml: xmlData,
      additionalData: {
        msttcgp: '0106026495',
        soBaoMat: lookupCode.trim()
      }
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const portal = 'https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don';
    const taxCode = (options?.customInfo?.sellerTaxCode || info.sellerTaxCode || '').trim();
    const lookupCode = (options?.customInfo?.lookupCode || info.lookupCode || '').trim();
    if (!taxCode || !lookupCode || lookupCode === info.cqtCode) {
      throw new OriginalInvoiceError('MINVOICE thiếu MST bên bán hoặc Số bảo mật. Mã cơ quan thuế không thay thế Số bảo mật.', this.providerCode, 'LOOKUP_DATA_MISSING', 422, portal);
    }
    // The public portal now uses reCAPTCHA v3, not an OCR image challenge.
    if (!options?.recaptchaToken) {
      throw new OriginalInvoiceError('MINVOICE yêu cầu xác thực Google reCAPTCHA trên cổng tra cứu. Hãy mở cổng MINVOICE để tải PDF gốc.', this.providerCode, 'RECAPTCHA_REQUIRED', 428, portal);
    }
    const url = new URL('/api/Search/SearchInvoiceCaptcha', portal);
    url.search = new URLSearchParams({ masothue: taxCode, sobaomat: lookupCode, type: 'PDF', inchuyendoi: 'false' }).toString();
    const response = await fetch(url, {
      headers: { Accept: 'application/pdf', Referer: portal, 'X-Recaptcha-Token': options.recaptchaToken },
      signal: AbortSignal.timeout(Math.min(options.timeoutMs || 20000, 30000)),
    }).catch((error: Error) => {
      throw new OriginalInvoiceError('MINVOICE: ' + error.message, this.providerCode, 'PROVIDER_CONNECTION_FAILED', 502, portal);
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (response.ok && buffer.subarray(0, 5).toString() === '%PDF-') {
      return {
        success: true, provider: this.providerCode, driverName: this.name,
        pdfBuffer: buffer, pdfBase64: buffer.toString('base64'), contentType: 'application/pdf',
        filename: this.buildPdfFilename(info), isFallback: false, sourceUrl: url.href, executionLogs: [],
      };
    }
    let message = '';
    try {
      const body = JSON.parse(buffer.toString('utf8'));
      message = String(body.message || body.Message || body.error || '').slice(0, 300);
    } catch { /* HTML error pages are not PDF documents. */ }
    const captchaRequired = /captcha/i.test(message) || [401, 403, 428].includes(response.status);
    throw new OriginalInvoiceError(
      captchaRequired ? 'MINVOICE yêu cầu xác thực lại Google reCAPTCHA trên cổng tra cứu.' : ('MINVOICE: ' + (message || 'Không nhận được PDF hợp lệ (HTTP ' + response.status + ').')),
      this.providerCode, captchaRequired ? 'RECAPTCHA_REQUIRED' : 'ORIGINAL_DOWNLOAD_FAILED',
      captchaRequired ? 428 : 502, portal,
    );
  }

  /**
   * Tải tệp XML hóa đơn gốc từ cổng M-Invoice
   */
  async downloadXml(sellerTaxCode: string, lookupCode: string, timeoutMs = 20000): Promise<Buffer | null> {
    try {
      const targetUrl = `https://tracuuhoadon.minvoice.com.vn/api/Search/DownloadXml?masothue=${encodeURIComponent(
        sellerTaxCode.trim()
      )}&sobaomat=${encodeURIComponent(lookupCode.trim())}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/xml, text/xml, application/zip, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://tracuuhoadon.minvoice.com.vn/',
          'Origin': 'https://tracuuhoadon.minvoice.com.vn'
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (buffer.length > 50) {
          return buffer;
        }
      }
    } catch (err) {
      console.error('[MinvoiceDriver] Lỗi downloadXml:', err);
    }
    return null;
  }
}
