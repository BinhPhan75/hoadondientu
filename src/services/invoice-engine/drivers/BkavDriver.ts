/**
 * BkavDriver: Driver hỗ trợ nhận diện và xử lý Hóa đơn điện tử Bkav eHoadon
 * Cổng tra cứu: https://ehoadon.bkav.com
 */

import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { GenericFallbackDriver } from './GenericFallbackDriver';

export class BkavDriver extends BaseInvoiceProviderDriver {
  readonly name = 'Bkav eHoadon Driver';
  readonly providerCode = 'BKAV';
  readonly metadata: DriverMetadata = {
    name: 'Bkav eHoadon Driver',
    providerCode: 'BKAV',
    description: 'Tra cứu & xử lý hóa đơn điện tử Bkav eHoadon qua Mã tra cứu / Chữ ký số BKAV-CA',
    sampleUrl: 'https://ehoadon.bkav.com/tra-cuu',
    supportsCaptcha: false,
    requiredFields: ['lookupCode', 'sellerTaxCode']
  };

  private fallback = new GenericFallbackDriver();

  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'BKAV';
    }
    return detectProvider(xmlData) === 'BKAV';
  }

  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst');
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C25TBK';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    const lookupCode = this.extractCustomField(xmlData, ['Mã tra cứu', 'MaTraCuu', 'MTCuu', 'Mã nhận hóa đơn', 'Bkav']) || 
                       this.extractXmlTag(xmlData, 'MTCuu') || 
                       this.extractXmlTag(xmlData, 'MaTraCuu');

    return {
      provider: this.providerCode,
      providerName: 'Bkav eHoadon',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      cqtCode,
      lookupCode,
      lookupUrl: 'https://ehoadon.bkav.com/tra-cuu',
      rawXml: xmlData
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi động xử lý HĐĐT Bkav eHoadon: Số ${info.invoiceNo}, Ký hiệu ${info.invoiceSeries}`, logs);
    this.createLog(`Chuyển sang bộ tạo bản thể hiện PDF & HTML/CSS chuẩn Nghị định 123 / Thông tư 78`, logs);
    
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
}
