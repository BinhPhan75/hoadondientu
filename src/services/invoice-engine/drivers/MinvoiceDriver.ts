/**
 * MinvoiceDriver: Driver xử lý tra cứu và tải hóa đơn điện tử gốc M-Invoice (minvoice.vn / minvoice.com.vn)
 * Đơn vị cung cấp giải pháp: Công ty TNHH Hóa đơn điện tử M-Invoice (MST: 0106026495)
 * Cổng tra cứu: https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don
 *
 * Cơ chế tra cứu:
 * - Tham số 1: Mã số thuế bên bán (masothue / sellerTaxCode)
 * - Tham số 2: Số bảo mật / Mã tra cứu (sobaomat / lookupCode / checkCode)
 * - Tải tệp hóa đơn gốc chính thức: GET /api/Search/DownloadXml?masothue=...&sobaomat=... (trả về gói ZIP chứa XML gốc ký số)
 * - PDF tra cứu: GET /api/Search/SearchInvoiceCaptcha (khi có reCAPTCHA token)
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
    sampleUrl: 'https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don',
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

    // 2. Tìm trong cấu trúc trường mở rộng <TTin><TTruong>Số bảo mật / Mã tra cứu</TTruong><DLieu>...</DLieu></TTin>
    if (!lookupCode) {
      lookupCode = this.extractCustomField(xmlData, [
        'Mã tra cứu',
        'MaTraCuu',
        'MTCuu',
        'Số bảo mật',
        'SoBaoMat',
        'so_baomat',
        'CheckCode',
        'checkCode',
        'Mã bảo mật',
        'MaBaoMat'
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
      const match = xmlData.match(/(?:Số\s*bảo\s*mật|So\s*bao\s*mat|Mã\s*bảo\s*mật|Mã\s*tra\s*cứu|CheckCode)\s*[:：=]\s*([A-Za-z0-9._-]+)/i);
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
      lookupUrl: details.lookupUrl || 'https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don',
      rawXml: xmlData,
      additionalData: {
        msttcgp: '0106026495',
        soBaoMat: lookupCode.trim()
      }
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    const portal = 'https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don';
    const taxCode = (options?.customInfo?.sellerTaxCode || info.sellerTaxCode || '').trim();
    const lookupCode = (options?.customInfo?.lookupCode || info.lookupCode || '').trim();
    if (!taxCode || !lookupCode || lookupCode === info.cqtCode) {
      throw new OriginalInvoiceError('MINVOICE thiếu MST bên bán hoặc Mã tra cứu (Số bảo mật).', this.providerCode, 'LOOKUP_DATA_MISSING', 422, portal);
    }

    this.createLog(`Khởi chạy M-Invoice Driver cho HĐ ${info.invoiceSeries || ''} - ${info.invoiceNo || ''}`, logs);
    this.createLog(`MST bên bán: ${taxCode}, Mã tra cứu: ${lookupCode}`, logs);

    // 1. Nếu có recaptchaToken, thử tải PDF từ SearchInvoiceCaptcha
    if (options?.recaptchaToken) {
      try {
        this.createLog('Đang thử lấy PDF từ cổng M-Invoice với token reCAPTCHA...', logs);
        const url = new URL('/api/Search/SearchInvoiceCaptcha', portal);
        url.search = new URLSearchParams({ masothue: taxCode, sobaomat: lookupCode, type: 'PDF', inchuyendoi: 'false' }).toString();
        const response = await fetch(url, {
          headers: { Accept: 'application/pdf', Referer: portal, 'X-Recaptcha-Token': options.recaptchaToken },
          signal: AbortSignal.timeout(Math.min(options.timeoutMs || 20000, 30000)),
        });
        const buffer = Buffer.from(await response.arrayBuffer());
        if (response.ok && buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
          this.createLog(`Đã tải thành công tệp PDF gốc từ M-Invoice (${(buffer.length / 1024).toFixed(1)} KB)`, logs);
          return {
            success: true, provider: this.providerCode, driverName: this.name,
            pdfBuffer: buffer, pdfBase64: buffer.toString('base64'), contentType: 'application/pdf',
            filename: this.buildPdfFilename(info), isFallback: false, sourceUrl: url.href, executionLogs: logs,
          };
        }
      } catch (e: any) {
        this.createLog(`SearchInvoiceCaptcha: ${e.message}`, logs);
      }
    }

    // 2. Tải tệp XML/ZIP hóa đơn gốc chính thức từ DownloadXml
    this.createLog('Đang kết nối cổng M-Invoice tải gói hóa đơn gốc chính thức (DownloadXml)...', logs);
    const xmlZipBuffer = await this.downloadXml(taxCode, lookupCode, options?.timeoutMs || 25000);
    if (xmlZipBuffer && xmlZipBuffer.length > 50) {
      if (xmlZipBuffer.subarray(0, 4).toString('latin1') === 'PK\x03\x04') {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(xmlZipBuffer);

        const pdfFiles = Object.values(zip.files).filter(f => !f.dir && /\.pdf$/i.test(f.name));
        for (const pdfFile of pdfFiles) {
          const pdfData = await pdfFile.async('nodebuffer');
          if (pdfData.subarray(0, 5).toString('latin1') === '%PDF-') {
            this.createLog(`Trích xuất thành công PDF gốc từ gói ZIP M-Invoice (${(pdfData.length / 1024).toFixed(1)} KB)`, logs);
            return {
              success: true, provider: this.providerCode, driverName: this.name,
              pdfBuffer: pdfData, pdfBase64: pdfData.toString('base64'), contentType: 'application/pdf',
              filename: this.buildPdfFilename(info), isFallback: false, sourceUrl: portal, executionLogs: logs
            };
          }
        }

        const xmlFiles = Object.values(zip.files).filter(f => !f.dir && /\.xml$/i.test(f.name));
        if (xmlFiles.length > 0) {
          this.createLog(`Đã tải thành công tệp ZIP gốc từ cổng M-Invoice (${(xmlZipBuffer.length / 1024).toFixed(1)} KB), chứa hóa đơn XML có chữ ký số.`, logs);
          const filename = ['HoaDon_MInvoice', taxCode, info.invoiceSeries || '', info.invoiceNo || ''].filter(Boolean).join('_') + '.zip';
          return {
            success: true, provider: this.providerCode, driverName: this.name,
            pdfBuffer: xmlZipBuffer, pdfBase64: xmlZipBuffer.toString('base64'), contentType: 'application/zip',
            filename, isFallback: false, sourceUrl: portal, executionLogs: logs
          };
        }
      }
    }

    throw new OriginalInvoiceError(
      'Không tìm thấy hóa đơn trên cổng M-Invoice. Vui lòng kiểm tra lại MST bên bán và Mã tra cứu.',
      this.providerCode, 'ORIGINAL_DOWNLOAD_FAILED', 422, portal
    );
  }

  /**
   * Tải tệp XML hóa đơn gốc từ cổng M-Invoice
   */
  async downloadXml(sellerTaxCode: string, lookupCode: string, timeoutMs = 25000): Promise<Buffer | null> {
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Referer': 'https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don',
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
