/**
 * CyberBillDriver: Driver hỗ trợ nhận diện và tra cứu HĐĐT CyberBill (CyberLotus)
 * Cổng tra cứu: https://cyberbill.vn/tra-cuu
 */

import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { GenericFallbackDriver } from './GenericFallbackDriver';
import { downloadOriginalCyberbillPdf } from '../../cyberbillInvoiceService';

export class CyberBillDriver extends BaseInvoiceProviderDriver {
  readonly name = 'CyberLotus CyberBill Driver';
  readonly providerCode = 'CYBERBILL';
  readonly metadata: DriverMetadata = {
    name: 'CyberLotus CyberBill Driver',
    providerCode: 'CYBERBILL',
    description: 'Tra cứu & xử lý hóa đơn điện tử CyberBill (cyberbill.vn) qua Mã tra cứu / MST bên bán',
    sampleUrl: 'https://cyberbill.vn/tra-cuu',
    supportsCaptcha: true,
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

    if (info.lookupCode && info.sellerTaxCode && !options?.forceFallback) {
      try {
        this.createLog(`Tìm thấy mã tra cứu CyberBill: "${info.lookupCode}", MST bên bán: "${info.sellerTaxCode}"`, logs);
        this.createLog(`Đang gửi yêu cầu giải Captcha & tải PDF gốc từ máy chủ CyberBill (bill1app.xcyber.vn)...`, logs);

        const result = await downloadOriginalCyberbillPdf({
          sellerTaxCode: info.sellerTaxCode,
          lookupCode: info.lookupCode,
          invoiceNo: info.invoiceNo,
          invoiceSeries: info.invoiceSeries
        });

        this.createLog(`Đã tải thành công tệp PDF gốc từ cổng CyberBill: ${result.filename} (${result.pdfBuffer.length} bytes)`, logs);

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
        this.createLog(`Tải PDF gốc CyberBill chưa thành công: ${err.message}. Tự động chuyển sang bộ tạo bản thể hiện vector chuẩn QĐ 1450.`, logs);
      }
    } else if (!info.lookupCode) {
      this.createLog(`Hóa đơn XML không chứa mã tra cứu CyberBill. Chuyển sang bộ tạo bản thể hiện vector QĐ 1450.`, logs);
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
