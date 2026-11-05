/**
 * VnptDriver: Driver tra cứu & tải PDF Hóa đơn điện tử VNPT (VNPT Invoice)
 * Cổng tra cứu: https://tracuu.vnpt-invoice.com.vn
 */

import axios from 'axios';
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { GenericFallbackDriver } from './GenericFallbackDriver';
import { downloadOriginalVnptPdf } from '../../vnptInvoiceService';

export class VnptDriver extends BaseInvoiceProviderDriver {
  readonly name = 'VNPT Invoice Driver';
  readonly providerCode = 'VNPT';
  readonly metadata: DriverMetadata = {
    name: 'VNPT Invoice Driver',
    providerCode: 'VNPT',
    description: 'Tra cứu và tải PDF HĐĐT gốc từ cổng VNPT Invoice qua Fkey / Mã tra cứu, MST bên bán và vượt Captcha tự động',
    sampleUrl: 'https://tracuu.vnpt-invoice.com.vn',
    supportsCaptcha: true,
    requiredFields: ['sellerTaxCode', 'lookupCode']
  };

  private fallback = new GenericFallbackDriver();

  /**
   * Nhận diện hóa đơn VNPT theo đúng thứ tự ưu tiên nghiêm ngặt
   */
  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'VNPT';
    }

    return detectProvider(xmlData) === 'VNPT';
  }

  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst');
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C24TGT';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    // Trích xuất mã tra cứu của VNPT (Ưu tiên Fkey / Mã tra cứu)
    let lookupCode = this.extractCustomField(xmlData, ['Fkey', 'Mã Fkey', 'Mã tra cứu', 'MaTraCuu', 'MTCuu', 'MTC']) ||
      this.extractXmlTag(xmlData, 'Fkey') ||
      this.extractXmlTag(xmlData, 'MTCuu');
    if (!lookupCode) {
      lookupCode = cqtCode;
    }

    const totalAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTTTBSo') || '0') || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTThue') || '0') || 0;
    const nmuaBlock = this.extractXmlTag(xmlData, 'NMua') || this.extractXmlTag(xmlData, 'Buyer') || '';
    const buyerTaxCode = this.extractXmlTag(nmuaBlock, 'MST') || this.extractXmlTag(xmlData, 'MSTNMua') || this.extractXmlTag(xmlData, 'nmmst') || '';
    const buyerName = this.extractXmlTag(nmuaBlock, 'Ten') || this.extractXmlTag(xmlData, 'TenNMua') || this.extractXmlTag(xmlData, 'nmten') || '';

    return {
      provider: this.providerCode,
      providerName: 'VNPT Invoice',
      sellerTaxCode,
      sellerName,
      buyerTaxCode: buyerTaxCode || undefined,
      buyerName: buyerName || undefined,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      lookupCode: lookupCode || undefined,
      lookupUrl: sellerTaxCode ? `https://${sellerTaxCode}-tt78.vnpt-invoice.com.vn` : 'https://4000344946-tt78.vnpt-invoice.com.vn',
      cqtCode: cqtCode || undefined,
      totalAmount,
      totalTaxAmount,
      currency: this.extractXmlTag(xmlData, 'DVTTe') || 'VND',
      rawXml: xmlData,
      additionalData: {
        msttcgp: '0100686209'
      }
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi chạy VNPT Invoice Driver cho HĐ ${info.invoiceSeries} - ${info.invoiceNo}`, logs);

    const fkey = (options?.customInfo?.lookupCode || info.lookupCode || '').trim();
    const cleanMst = (options?.customInfo?.sellerTaxCode || info.sellerTaxCode || '').trim();
    this.createLog(`Fkey VNPT: "${fkey}", MST: "${cleanMst}"`, logs);

    // 1. Thử tải trực tiếp hóa đơn gốc qua Cổng VNPT với Gemini AI Captcha Solver
    if (fkey) {
      try {
        this.createLog(`Đang kết nối cổng VNPT và tự động giải Captcha bằng AI...`, logs);
        const vnptRes = await downloadOriginalVnptPdf({
          lookupCode: fkey,
          sellerTaxCode: cleanMst,
          portalUrl: options?.customInfo?.lookupUrl || info.lookupUrl,
          invoiceNumber: options?.customInfo?.invoiceNo || info.invoiceNo
        });

        if (vnptRes.data && vnptRes.data.length > 500) {
          const buf = vnptRes.data;
          const captchaMsg = vnptRes.captchaSolved ? ` (Đã vượt Captcha: ${vnptRes.captchaSolved})` : '';
          this.createLog(`Vượt Captcha và tải thành công file PDF gốc từ VNPT (${(buf.length / 1024).toFixed(1)} KB)${captchaMsg}`, logs);
          return {
            success: true,
            provider: this.providerCode,
            driverName: this.name,
            pdfBuffer: buf,
            pdfBase64: buf.toString('base64'),
            contentType: 'application/pdf',
            filename: vnptRes.filename || this.buildPdfFilename(info),
            isFallback: false,
            captchaSolved: vnptRes.captchaSolved,
            sourceUrl: info.lookupUrl || `https://${cleanMst}-tt78.vnpt-invoice.com.vn`,
            executionLogs: logs
          };
        }
      } catch (err: any) {
        this.createLog(`Cổng VNPT chưa trả về PDF: ${err.message}`, logs);
      }
    }

    // 2. Nếu không tải được từ cổng hoặc không có fkey, lấy mẫu chuẩn Tổng cục Thuế (GDT)
    this.createLog(`Kích hoạt Fallback mẫu chuẩn Tổng cục Thuế (GDT) cho HĐ VNPT`, logs);
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
}
