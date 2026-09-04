/**
 * EasyInvoiceDriver: Driver hỗ trợ nhận diện và xử lý Hóa đơn điện tử EasyInvoice (Softdreams)
 * Cổng tra cứu: https://easyinvoice.vn
 */

import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { GenericFallbackDriver } from './GenericFallbackDriver';

export class EasyInvoiceDriver extends BaseInvoiceProviderDriver {
  readonly name = 'Softdreams EasyInvoice Driver';
  readonly providerCode = 'EASYINVOICE';
  readonly metadata: DriverMetadata = {
    name: 'Softdreams EasyInvoice Driver',
    providerCode: 'EASYINVOICE',
    description: 'Tra cứu & xử lý hóa đơn điện tử EasyInvoice (Softdreams) qua Mã tra cứu / Chữ ký số EasyCA',
    sampleUrl: 'https://easyinvoice.vn/tra-cuu',
    supportsCaptcha: false,
    requiredFields: ['lookupCode', 'sellerTaxCode']
  };

  private fallback = new GenericFallbackDriver();

  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'EASYINVOICE';
    }
    return detectProvider(xmlData) === 'EASYINVOICE';
  }

  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst');
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C25TEI';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    const lookupCode = this.extractCustomField(xmlData, ['Mã tra cứu', 'MaTraCuu', 'MTCuu', 'Fkey', 'EasyInvoice']) || 
                       this.extractXmlTag(xmlData, 'MTCuu') || 
                       this.extractXmlTag(xmlData, 'MaTraCuu');

    return {
      provider: this.providerCode,
      providerName: 'Softdreams EasyInvoice',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      cqtCode,
      lookupCode,
      lookupUrl: 'https://easyinvoice.vn/tra-cuu',
      rawXml: xmlData
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi động xử lý HĐĐT EasyInvoice: Số ${info.invoiceNo}, Mẫu ${info.templateCode}/${info.invoiceSeries}`, logs);
    this.createLog(`Chuyển sang bộ tạo bản thể hiện PDF & HTML/CSS chuẩn Nghị định 123 / Thông tư 78`, logs);
    
    // Tự động kết hợp render dự phòng chuẩn hóa cao cấp
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
}
