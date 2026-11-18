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

    const timeout = Math.min(options?.timeoutMs || 20000, 30000);
    const makeUrl = (path: string) => {
      // Legacy public M-invoice PDF links use *only* type, masothue, sobaomat.
      // Extra inchuyendoi was never part of this endpoint and may cause 400.
      const params = new URLSearchParams([
        ['type', 'PDF'],
        ['masothue', taxCode],
        ['sobaomat', lookupCode],
      ]);
      return 'https://tracuuhoadon.minvoice.com.vn/api/Search/' + path +
        '?' + params.toString();
    };

    // A legacy PDF operation is already implemented elsewhere in this
    // application. Try it once, without inventing captcha tokens.
    const attempts = [
      { path: 'SearchInvoice', token: '' },
      ...(options?.recaptchaToken
        ? [{ path: 'SearchInvoiceCaptcha', token: options.recaptchaToken }]
        : []),
    ];
    const statuses: string[] = [];
    for (const attempt of attempts) {
      const url = makeUrl(attempt.path);
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/pdf,application/octet-stream,*/*',
            Referer: portal,
            ...(attempt.token ? { 'X-Recaptcha-Token': attempt.token } : {}),
          },
          signal: AbortSignal.timeout(timeout),
        });
        const contentLength = Number(response.headers.get('content-length') || '0');
        if (contentLength > 18_000_000) {
          statuses.push(attempt.path + ': PDF vượt 18 MB');
          continue;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length >= 100 && buffer.length <= 18_000_000 &&
            response.ok && buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
          // InvoiceDownloaderManager verifies the seller, series and number
          // from actual PDF contents before returning or caching the file.
          return {
            success: true, provider: this.providerCode, driverName: this.name,
            pdfBuffer: buffer, pdfBase64: buffer.toString('base64'),
            contentType: 'application/pdf', filename: this.buildPdfFilename(info),
            isFallback: false, sourceUrl: portal,
            executionLogs: ['M-invoice: đã nhận PDF từ ' + attempt.path],
          };
        }
        const type = response.headers.get('content-type') || '';
        statuses.push(attempt.path + ': HTTP ' + response.status +
          (response.ok ? ' nhưng không trả về PDF' : '') +
          (type && !/^application\/pdf/i.test(type) ? ' (' + type.split(';')[0].slice(0, 60) + ')' : ''));
        if (response.status === 429) break;
      } catch (error: any) {
        statuses.push(attempt.path + ': ' + String(error?.message || 'lỗi kết nối').slice(0, 120));
      }
    }

    throw new OriginalInvoiceError(
      'Chưa tải được PDF gốc M-invoice bằng MST và mã tra cứu. ' +
      statuses.join('; ') +
      (options?.recaptchaToken
        ? '. Kiểm tra mã tra cứu hoặc thử lại sau.'
        : '. Cổng PDF có thể yêu cầu reCAPTCHA v3 trong trình duyệt.'),
      this.providerCode, 'MINVOICE_PDF_UNAVAILABLE', 502, portal,
    );
  }

}
