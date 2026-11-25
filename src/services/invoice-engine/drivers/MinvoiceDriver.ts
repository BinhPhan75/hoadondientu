/**
 * MinvoiceDriver: Driver xử lý tra cứu và tải hóa đơn điện tử gốc M-Invoice (minvoice.vn / minvoice.com.vn)
 * Đơn vị cung cấp giải pháp: Công ty TNHH Hóa đơn điện tử M-Invoice (MST: 0106026495)
 * Cổng tra cứu: https://tracuuhoadon.minvoice.com.vn
 *
 * Cơ chế tra cứu:
 * - Tham số 1: Mã số thuế bên bán (masothue / sellerTaxCode)
 * - Tham số 2: Số bảo mật (sobaomat / lookupCode / checkCode)
 * - PDF: legacy SearchInvoice by seller MST + lookup code; current SPA
 *   uses SearchInvoiceCaptcha with a legitimate browser reCAPTCHA v3 token.
 * - This driver never downloads XML or ZIP as a fallback.
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

  /**
   * Original issuer PDF only. The legacy public PDF operation accepts seller
   * tax ID + invoice lookup code; newer official SPA versions can require a
   * Google reCAPTCHA v3 token for their PDF operation. Never fall back to XML,
   * ZIP or a reconstructed tax-authority PDF.
   */
  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const portal = 'https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don';
    const taxCode = (options?.customInfo?.sellerTaxCode || info.sellerTaxCode || '').trim();
    const lookupCode = (options?.customInfo?.lookupCode || info.lookupCode || '').trim();

    if (!/^\d{10}(?:-\d{3})?$/.test(taxCode) ||
        !/^[A-Za-z0-9_-]{6,128}$/.test(lookupCode) ||
        lookupCode === info.cqtCode) {
      throw new OriginalInvoiceError(
        'M-invoice cần MST người bán và mã tra cứu (Số bảo mật) hợp lệ từ XML.',
        this.providerCode, 'LOOKUP_DATA_MISSING', 422, portal
      );
    }

    const token = (options?.recaptchaToken || (options?.customInfo as any)?.recaptchaToken || '').trim();

    // M-invoice's live portal uses SearchInvoiceCaptcha, requiring browser reCAPTCHA v3.
    // If not available, fall back to official GDT PDF renderer.
    if (!token) {
      throw new Error(
        'M-invoice yêu cầu mã reCAPTCHA xác thực từ trình duyệt. Tự động kết xuất bản thể hiện chuẩn Tổng cục Thuế.'
      );
    }

    const params = new URLSearchParams([
      ['masothue', taxCode],
      ['sobaomat', lookupCode],
      ['type', 'PDF'],
      ['inchuyendoi', 'false'],
    ]);
    const url = 'https://tracuuhoadon.minvoice.com.vn/api/Search/SearchInvoiceCaptcha?' +
      params.toString();
    const timeout = Math.min(options?.timeoutMs || 20000, 30000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          Referer: portal,
          'X-Recaptcha-Token': token,
        },
        signal: AbortSignal.timeout(timeout),
      });
    } catch (error: any) {
      throw new Error('Không thể kết nối cổng PDF M-invoice: ' + String(error?.message || 'lỗi kết nối').slice(0, 120));
    }

    const contentLength = Number(response.headers.get('content-length') || '0');
    if (contentLength > 18_000_000) {
      throw new Error('PDF gốc M-invoice vượt giới hạn 18 MB.');
    }
    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());
    if (response.ok && buffer.length >= 100 && buffer.length <= 18_000_000 &&
        buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
      // InvoiceDownloaderManager verifies invoice identity before caching.
      return {
        success: true, provider: this.providerCode, driverName: this.name,
        pdfBuffer: buffer, pdfBase64: buffer.toString('base64'),
        contentType: 'application/pdf', filename: this.buildPdfFilename(info),
        isFallback: false, sourceUrl: portal,
        executionLogs: ['M-invoice: đã nhận PDF gốc từ SearchInvoiceCaptcha'],
      };
    }
    throw new Error(
      'M-invoice SearchInvoiceCaptcha: HTTP ' + response.status +
      ' (' + contentType.split(';')[0].slice(0, 60) + ')' +
      (response.ok ? ', phản hồi không phải PDF hợp lệ.' : '. Tự động chuyển sang bản thể hiện chuẩn.')
    );
  }

}
