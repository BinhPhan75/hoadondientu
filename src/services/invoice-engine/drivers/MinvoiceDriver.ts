/**
 * MinvoiceDriver: Driver xử lý tra cứu và tải hóa đơn điện tử gốc M-Invoice (minvoice.vn / minvoice.com.vn)
 * Đơn vị cung cấp giải pháp: Công ty TNHH Hóa đơn điện tử M-Invoice (MST: 0106026495)
 * Cổng tra cứu: https://tracuuhoadon.minvoice.com.vn
 *
 * Cơ chế tra cứu:
 * - Tham số 1: Mã số thuế bên bán (masothue / sellerTaxCode)
 * - Tham số 2: Số bảo mật (sobaomat / lookupCode / checkCode)
 * - Endpoint tải PDF: GET /api/Search/SearchInvoice?masothue=...&sobaomat=...&type=PDF&inchuyendoi=false
 * - Endpoint tải XML: GET /api/Search/DownloadXml?masothue=...&sobaomat=...
 */

import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { GenericFallbackDriver } from './GenericFallbackDriver';
import { extractLookupDetailsFromXml } from '../../../utils/xmlParser';

export class MinvoiceDriver extends BaseInvoiceProviderDriver {
  readonly name = 'M-Invoice Driver';
  readonly providerCode = 'MINVOICE';
  readonly metadata: DriverMetadata = {
    name: 'M-Invoice Driver',
    providerCode: 'MINVOICE',
    description: 'Tra cứu & tải hóa đơn điện tử gốc M-Invoice (minvoice.vn) qua Mã số thuế bên bán và Số bảo mật',
    sampleUrl: 'https://tracuuhoadon.minvoice.com.vn',
    supportsCaptcha: false,
    requiredFields: ['sellerTaxCode', 'lookupCode']
  };

  private fallback = new GenericFallbackDriver();

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
    const logs: string[] = [];
    const timeoutMs = options?.timeoutMs || 25000;

    this.createLog(`[M-Invoice] Bắt đầu tra cứu hóa đơn: Ký hiệu ${info.invoiceSeries}, Số ${info.invoiceNo}`, logs);

    const sellerTaxCode = (options?.customInfo?.sellerTaxCode || info.sellerTaxCode || '').trim();
    const lookupCode = (options?.customInfo?.lookupCode || info.lookupCode || '').trim();

    if (!sellerTaxCode) {
      this.createLog(`[M-Invoice] Thiếu Mã số thuế bên bán (sellerTaxCode). Chuyển sang Render PDF chuẩn GDT.`, logs);
      const fallbackRes = await this.fallback.fetchPdf(info, options);
      return {
        ...fallbackRes,
        provider: this.providerCode,
        driverName: this.name,
        executionLogs: [...logs, ...fallbackRes.executionLogs]
      };
    }

    if (!lookupCode) {
      this.createLog(`[M-Invoice] Hóa đơn không có Số bảo mật (lookupCode / checkCode). Chuyển sang Render PDF chuẩn GDT.`, logs);
      const fallbackRes = await this.fallback.fetchPdf(info, options);
      return {
        ...fallbackRes,
        provider: this.providerCode,
        driverName: this.name,
        executionLogs: [...logs, ...fallbackRes.executionLogs]
      };
    }

    this.createLog(`[M-Invoice] Gửi yêu cầu tải PDF gốc: MST ${sellerTaxCode}, Số bảo mật: ${lookupCode}`, logs);

    try {
      // Endpoint chính thức của Cổng M-Invoice (tracuuhoadon.minvoice.com.vn)
      const targetUrl = `https://tracuuhoadon.minvoice.com.vn/api/Search/SearchInvoice?masothue=${encodeURIComponent(
        sellerTaxCode
      )}&sobaomat=${encodeURIComponent(lookupCode)}&type=PDF&inchuyendoi=false`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf, application/octet-stream, */*',
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

        // Kiểm tra chữ ký file PDF (%PDF)
        if (buffer.length >= 500 && buffer.subarray(0, 10).toString('latin1').includes('%PDF')) {
          this.createLog(`[M-Invoice] Đã tải thành công file PDF gốc từ server M-Invoice (${(buffer.length / 1024).toFixed(1)} KB)`, logs);
          const filename = this.buildPdfFilename(info);
          return {
            success: true,
            provider: this.providerCode,
            driverName: this.name,
            pdfBuffer: buffer,
            pdfBase64: buffer.toString('base64'),
            contentType: 'application/pdf',
            filename,
            isFallback: false,
            sourceUrl: targetUrl,
            executionLogs: logs
          };
        } else {
          this.createLog(`[M-Invoice] Phản hồi từ server không phải định dạng PDF hợp lệ (Size: ${buffer.length} bytes)`, logs);
        }
      } else {
        this.createLog(`[M-Invoice] Server phản hồi mã trạng thái HTTP ${resp.status} ${resp.statusText}`, logs);
      }
    } catch (err: any) {
      this.createLog(`[M-Invoice] Lỗi kết nối tới server M-Invoice: ${err.message}`, logs);
    }

    // Nếu không tải được trực tiếp từ API server M-Invoice (hoặc server yêu cầu xác thực thêm)
    this.createLog(`[M-Invoice] Chuyển đổi sang bộ tạo PDF vector chất lượng cao chuẩn NĐ 123/2020/NĐ-CP`, logs);
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
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
