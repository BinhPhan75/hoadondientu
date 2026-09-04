/**
 * CyberBillDriver: Driver hỗ trợ nhận diện và tra cứu HĐĐT CyberBill (CyberLotus)
 * Cổng tra cứu: https://cyberbill.vn/tra-cuu
 */

import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { GenericFallbackDriver } from './GenericFallbackDriver';

export class CyberBillDriver extends BaseInvoiceProviderDriver {
  readonly name = 'CyberLotus CyberBill Driver';
  readonly providerCode = 'CYBERBILL';
  readonly metadata: DriverMetadata = {
    name: 'CyberLotus CyberBill Driver',
    providerCode: 'CYBERBILL',
    description: 'Tra cứu & xử lý hóa đơn điện tử CyberBill (cyberbill.vn) qua Mã tra cứu / MST bên bán',
    sampleUrl: 'https://cyberbill.vn/tra-cuu',
    supportsCaptcha: false,
    requiredFields: ['lookupCode', 'sellerTaxCode']
  };

  private fallback = new GenericFallbackDriver();

  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'CYBERBILL';
    }
    return detectProvider(xmlData) === 'CYBERBILL';
  }

  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst');
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C24TCB';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    let lookupCode = this.extractCustomField(xmlData, ['Mã tra cứu', 'MaTraCuu', 'MTCuu', 'Mã nhận hóa đơn', 'CyberBill']) || 
                     this.extractXmlTag(xmlData, 'MTCuu') || 
                     this.extractXmlTag(xmlData, 'MaTraCuu');

    return {
      provider: this.providerCode,
      providerName: 'CyberLotus CyberBill',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      cqtCode,
      lookupCode,
      lookupUrl: 'https://cyberbill.vn/tra-cuu',
      rawXml: xmlData,
      additionalData: {
        msttcgp: '0107871301'
      }
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi động xử lý HĐĐT CyberBill: Số ${info.invoiceNo}, Ký hiệu ${info.invoiceSeries}`, logs);
    if (info.lookupCode) {
      this.createLog(`Mã tra cứu CyberBill: "${info.lookupCode}"`, logs);
    }
    this.createLog(`Chuyển sang bộ tạo bản thể hiện PDF vector độ phân giải cao chuẩn NĐ 123/2020/NĐ-CP`, logs);
    
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
}
