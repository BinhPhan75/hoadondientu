/**
 * MinvoiceDriver: Driver xử lý tra cứu và tải hóa đơn điện tử gốc M-Invoice (minvoice.vn / minvoice.com.vn)
 * Đơn vị cung cấp giải pháp: Công ty TNHH Hóa đơn điện tử M-Invoice (MST: 0106026495)
 * Cổng tra cứu: https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don
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
    description: 'Tra cứu & tải hóa đơn điện tử PDF trực tiếp từ M-Invoice (minvoice.vn)',
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

    const details = extractLookupDetailsFromXml(xmlData);
    let lookupCode = details.lookupCode || '';

    // Bổ sung quét thẻ "Số bảo mật" (có dấu tiếng Việt) và các biến thể khác
    if (!lookupCode) {
      lookupCode = this.extractCustomField(xmlData, [
        'Số bảo mật',
        'Mã tra cứu',
        'MaTraCuu',
        'MTCuu',
        'SoBaoMat',
        'so_baomat',
        'CheckCode',
        'checkCode',
        'Mã bảo mật',
        'MaBaoMat'
      ]);
    }

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

    this.createLog(`Khởi chạy M-Invoice Driver cho HĐ Ký hiệu: ${info.invoiceSeries || ''} - Số: ${info.invoiceNo || ''}`, logs);
    this.createLog(`MST bên bán: ${taxCode}, Mã tra cứu: ${lookupCode}`, logs);

    try {
      this.createLog('Đang kết nối cổng M-Invoice tải trực tiếp tệp PDF bản thể hiện...', logs);
      const targetUrl = new URL('https://tracuuhoadon.minvoice.com.vn/api/Search/SearchInvoiceCaptcha');
      targetUrl.search = new URLSearchParams({
        masothue: taxCode,
        sobaomat: lookupCode,
        type: 'PDF',
        inchuyendoi: 'false'
      }).toString();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options?.timeoutMs || 25000);

      const headers: Record<string, string> = {
        'Accept': 'application/pdf, application/json, text/plain, */*',
        'Referer': portal,
        'Origin': 'https://tracuuhoadon.minvoice.com.vn',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      if (options?.recaptchaToken) {
        headers['X-Recaptcha-Token'] = options.recaptchaToken;
      }

      const response = await fetch(targetUrl.href, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timer);

      const buffer = Buffer.from(await response.arrayBuffer());
      if (response.ok && buffer.length > 100) {
        if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
          this.createLog(`Đã tải thành công tệp PDF gốc từ M-Invoice (${(buffer.length / 1024).toFixed(1)} KB)`, logs);
          return {
            success: true,
            provider: this.providerCode,
            driverName: this.name,
            pdfBuffer: buffer,
            pdfBase64: buffer.toString('base64'),
            contentType: 'application/pdf',
            filename: this.buildPdfFilename(info),
            isFallback: false,
            sourceUrl: targetUrl.href,
            executionLogs: logs
          };
        }
      }
    } catch (e: any) {
      this.createLog(`Lỗi gọi API tải PDF trực tiếp: ${e.message}`, logs);
    }

    throw new OriginalInvoiceError(
      'Không thể tải trực tiếp tệp PDF từ cổng M-Invoice. Vui lòng kiểm tra lại MST bên bán và Mã tra cứu.',
      this.providerCode, 'ORIGINAL_DOWNLOAD_FAILED', 422, portal
    );
  }
}
