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
    if (!/^\d{10}(?:-\d{3})?$/.test(taxCode) || !/^[A-Za-z0-9_-]{6,128}$/.test(lookupCode) ||
        lookupCode === info.cqtCode) {
      throw new OriginalInvoiceError(
        'M-invoice cần đúng MST bên bán và mã tra cứu (Số bảo mật) từ XML, không dùng mã CQT.',
        this.providerCode, 'LOOKUP_DATA_MISSING', 422, portal
      );
    }

    // The official public SPA requires a valid Google reCAPTCHA v3 token
    // for PDF requests. Never synthesize or bypass one.
    if (options?.recaptchaToken) {
      const url = new URL('/api/Search/SearchInvoiceCaptcha', portal);
      url.search = new URLSearchParams({
        masothue: taxCode, sobaomat: lookupCode, type: 'PDF', inchuyendoi: 'false'
      }).toString();
      try {
        const response = await fetch(url.toString(), {
          headers: {
            Accept: 'application/pdf,application/octet-stream,*/*',
            Referer: portal,
            'X-Recaptcha-Token': options.recaptchaToken,
          },
          signal: AbortSignal.timeout(Math.min(options.timeoutMs || 20000, 30000)),
        });
        const content = Buffer.from(await response.arrayBuffer());
        if (response.ok && content.subarray(0, 5).toString('latin1') === '%PDF-') {
          return {
            success: true, provider: this.providerCode, driverName: this.name,
            pdfBuffer: content, pdfBase64: content.toString('base64'),
            contentType: 'application/pdf', filename: this.buildPdfFilename(info),
            isFallback: false, sourceUrl: portal, executionLogs: ['M-invoice: nhận bản PDF từ cổng phát hành'],
          };
        }
      } catch (error: any) {
        console.warn('[MinvoiceDriver] Official PDF lookup failed:', error?.message);
      }
    }

    // Unlike the PDF operation, the official site's XML download method
    // does not request a reCAPTCHA token. Download the supplier's XML file
    // and verify seller MST, series and number in the manager before caching.
    const source = await this.downloadXml(taxCode, lookupCode, Math.min(options?.timeoutMs || 20000, 30000));
    if (source) {
      const prefix = source.subarray(0, 128).toString('utf8').replace(/^\uFEFF/, '').trimStart();
      let contentType = '';
      let extension = '';
      if (/^<\?xml\b|^<HDon(?:\s|>)/i.test(prefix)) {
        contentType = 'application/xml';
        extension = '.xml';
      } else if (source.subarray(0, 4).toString('latin1') === 'PK\x03\x04') {
        contentType = 'application/zip';
        extension = '.zip';
      } else if (source.subarray(0, 5).toString('latin1') === '%PDF-') {
        contentType = 'application/pdf';
        extension = '.pdf';
      }
      if (contentType) {
        const safeNo = (info.invoiceNo || '').replace(/[^0-9]/g, '').padStart(7, '0');
        const safeSeries = (info.invoiceSeries || '').replace(/[^A-Za-z0-9]/g, '');
        const safeTax = taxCode.replace(/[^0-9-]/g, '');
        return {
          success: true, provider: this.providerCode, driverName: this.name,
          pdfBuffer: source, pdfBase64: source.toString('base64'),
          contentType,
          filename: ['HoaDon_MInvoice', safeTax, safeSeries, safeNo].filter(Boolean).join('_') + extension,
          isFallback: false, sourceUrl: portal,
          executionLogs: ['M-invoice: tải tệp ' + extension + ' từ cổng phát hành, chờ đối chiếu danh tính hóa đơn'],
        };
      }
    }
    throw new OriginalInvoiceError(
      'Cổng M-invoice chưa trả về XML gốc theo MST và mã tra cứu. PDF của cổng yêu cầu xác thực reCAPTCHA v3 trong trình duyệt.',
      this.providerCode, 'MINVOICE_ORIGINAL_UNAVAILABLE', 502, portal
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
