/**
 * ThaiSonDriver: Driver hỗ trợ nhận diện và tra cứu HĐĐT Thái Sơn (einvoice.vn)
 * Cổng tra cứu: https://einvoice.vn/tra-cuu
 */

import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { GenericFallbackDriver } from './GenericFallbackDriver';
import { downloadOriginalThaiSonPdf } from '../../thaiSonInvoiceService';

export class ThaiSonDriver extends BaseInvoiceProviderDriver {
  readonly name = 'Thái Sơn E-Invoice Driver';
  readonly providerCode = 'THAISON';
  readonly metadata: DriverMetadata = {
    name: 'Thái Sơn E-Invoice Driver',
    providerCode: 'THAISON',
    description: 'Tra cứu & xử lý hóa đơn điện tử Thái Sơn (einvoice.vn) qua Mã tra cứu / MST bên bán',
    sampleUrl: 'https://einvoice.vn/tra-cuu',
    supportsCaptcha: true,
    requiredFields: ['lookupCode', 'sellerTaxCode']
  };

  private fallback = new GenericFallbackDriver();

  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'THAISON';
    }
    return detectProvider(xmlData) === 'THAISON';
  }

  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst');
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C24TTS';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    let lookupCode = this.extractCustomField(xmlData, ['Mã tra cứu', 'MaTraCuu', 'MTCuu', 'Mã nhận hóa đơn']) || 
                     this.extractXmlTag(xmlData, 'MTCuu') || 
                     this.extractXmlTag(xmlData, 'MaTraCuu');

    return {
      provider: this.providerCode,
      providerName: 'Thái Sơn E-Invoice',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      cqtCode,
      lookupCode,
      lookupUrl: 'https://einvoice.vn/tra-cuu',
      rawXml: xmlData,
      additionalData: {
        msttcgp: '0101300842'
      }
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi động xử lý HĐĐT Thái Sơn E-Invoice: Số ${info.invoiceNo}, Ký hiệu ${info.invoiceSeries}`, logs);

    if (info.lookupCode && !options?.forceFallback) {
      try {
        this.createLog(`Tìm thấy mã nhận hóa đơn Thái Sơn: "${info.lookupCode}"`, logs);
        this.createLog(`Đang gửi yêu cầu giải Captcha & tải PDF gốc từ cổng Thái Sơn (einvoice.vn)...`, logs);

        const result = await downloadOriginalThaiSonPdf({
          lookupCode: info.lookupCode,
          sellerTaxCode: info.sellerTaxCode,
          invoiceNo: info.invoiceNo,
          invoiceSeries: info.invoiceSeries
        });

        this.createLog(`Đã tải thành công tệp PDF gốc từ cổng Thái Sơn: ${result.filename} (${result.pdfBuffer.length} bytes)`, logs);

        return {
          success: true,
          pdfBuffer: result.pdfBuffer,
          pdfBase64: result.pdfBase64,
          filename: result.filename,
          contentType: 'application/pdf',
          provider: this.providerCode,
          driverName: this.name,
          isFallback: false,
          captchaSolved: 'auto',
          sourceUrl: result.sourceUrl,
          executionLogs: logs
        };
      } catch (err: any) {
        this.createLog(`Tải PDF gốc Thái Sơn chưa thành công: ${err.message}. Tự động chuyển sang bộ tạo bản thể hiện vector chuẩn QĐ 1450.`, logs);
      }
    } else if (!info.lookupCode) {
      this.createLog(`Hóa đơn XML không chứa mã nhận hóa đơn Thái Sơn. Chuyển sang bộ tạo bản thể hiện vector QĐ 1450.`, logs);
    }

    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
}
