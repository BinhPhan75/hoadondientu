/**
 * VnpayDriver: Driver tra cứu & tải PDF Hóa đơn điện tử VNPAY Invoice
 * Cổng tra cứu: https://portal.vnpayinvoice.vn
 * MST TCGP: 0102182292 (Công ty Cổ phần Giải pháp Thanh toán Việt Nam - VNPAY)
 * Các đơn vị tiêu biểu sử dụng: Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank - 0100112437)
 */

import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { downloadOriginalVnpayPdf, buildVnpayPortalUrl } from '../../vnpayInvoiceService';

export class VnpayDriver extends BaseInvoiceProviderDriver {
  readonly name = 'VNPAY Invoice Driver';
  readonly providerCode = 'VNPAY';
  readonly metadata: DriverMetadata = {
    name: 'VNPAY Invoice Driver',
    providerCode: 'VNPAY',
    description: 'Tra cứu và tải PDF HĐĐT gốc từ cổng VNPAY Invoice (portal.vnpayinvoice.vn) qua Mã tra cứu và Mã số thuế bên bán',
    sampleUrl: 'https://portal.vnpayinvoice.vn/',
    supportsCaptcha: true,
    requiredFields: ['sellerTaxCode', 'lookupCode']
  };

  /**
   * Nhận diện hóa đơn VNPAY Invoice
   */
  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'VNPAY';
    }

    return detectProvider(xmlData) === 'VNPAY';
  }

  /**
   * Trích xuất thông tin hóa đơn VNPAY từ XML
   */
  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst') || '0102182292';
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten') || 'CÔNG TY CỔ PHẦN GIẢI PHÁP THANH TOÁN VIỆT NAM';
    const buyerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nm_mst') || this.extractXmlTag(xmlData, 'nmmst');
    const buyerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nm_ten') || this.extractXmlTag(xmlData, 'nmten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C24TGT';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    // Trích xuất mã tra cứu: kiểm tra các thẻ thông dụng
    let lookupCode = this.extractCustomField(xmlData, [
      'Mã tra cứu',
      'MaTraCuu',
      'MTCuu',
      'MTC',
      'FKey',
      'LookupCode',
      'TransactionID'
    ]);

    if (!lookupCode) {
      lookupCode = this.extractXmlTag(xmlData, 'MTCuu') || 
        this.extractXmlTag(xmlData, 'MaTraCuu') ||
        this.extractXmlTag(xmlData, 'LookupCode') ||
        this.extractXmlTag(xmlData, 'FKey') ||
        this.extractXmlTag(xmlData, 'TransactionID');
    }

    // Quét thêm trong các khối TTin / TTKhac
    if (!lookupCode) {
      const ttinBlocks = this.extractXmlBlocks(xmlData, 'TTin');
      for (const block of ttinBlocks) {
        const truong = (this.extractXmlTag(block, 'TTruong') || this.extractXmlTag(block, 'TenTruong')).toLowerCase();
        if (truong.includes('tra cứu') || truong.includes('tra cuu') || truong.includes('lookup') || truong.includes('fkey')) {
          const val = this.extractXmlTag(block, 'DLieu') || this.extractXmlTag(block, 'Data');
          if (val) {
            lookupCode = val.trim();
            break;
          }
        }
      }
    }

    const totalAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTTTBSo') || '0') || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTThue') || '0') || 0;
    const directUrl = buildVnpayPortalUrl(lookupCode, sellerTaxCode);

    return {
      provider: this.providerCode,
      providerName: 'VNPAY Invoice (Công ty Cổ phần Giải pháp Thanh toán Việt Nam)',
      sellerTaxCode,
      sellerName,
      buyerTaxCode: buyerTaxCode || undefined,
      buyerName: buyerName || undefined,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      lookupCode: lookupCode || undefined,
      lookupUrl: directUrl,
      cqtCode: cqtCode || undefined,
      totalAmount,
      totalTaxAmount,
      currency: this.extractXmlTag(xmlData, 'DVTTe') || 'VND',
      rawXml: xmlData,
      additionalData: {
        msttcgp: '0102182292',
        portalUrl: 'https://portal.vnpayinvoice.vn/'
      }
    };
  }

  /**
   * Tải PDF Hóa đơn gốc VNPAY từ cổng portal.vnpayinvoice.vn
   */
  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi chạy VNPAY Invoice Driver cho HĐ ${info.invoiceSeries || ''} - ${info.invoiceNo || ''} (MST: ${info.sellerTaxCode})`, logs);

    const sellerTaxCode = (info.sellerTaxCode || '').trim();
    const lookupCode = (info.lookupCode || '').trim();

    if (!sellerTaxCode) {
      this.createLog('LỖI: Thiếu Mã số thuế bên bán (sellerTaxCode).', logs);
      throw new Error('[VnpayDriver] Thiếu Mã số thuế bên bán (sellerTaxCode) để tra cứu hóa đơn VNPAY.');
    }

    if (!lookupCode) {
      this.createLog('LỖI: Không tìm thấy Mã tra cứu trong XML hóa đơn.', logs);
      throw new Error('[VnpayDriver] Không tìm thấy Mã tra cứu trong XML hóa đơn VNPAY.');
    }

    this.createLog(`Thông tin tra cứu: MST bên bán=${sellerTaxCode}, Mã tra cứu=${lookupCode}`, logs);
    this.createLog('Đang kết nối đến Cổng VNPAY Invoice (portal.vnpayinvoice.vn)...', logs);

    try {
      const result = await downloadOriginalVnpayPdf({
        sellerTaxCode,
        lookupCode,
        invoiceNo: info.invoiceNo,
        invoiceSeries: info.invoiceSeries
      });

      if (result.success && result.pdfBuffer) {
        this.createLog(`Tải PDF HĐĐT gốc thành công từ VNPAY Invoice (${(result.pdfBuffer.length / 1024).toFixed(1)} KB)`, logs);
        return {
          success: true,
          provider: this.providerCode,
          driverName: this.name,
          pdfBuffer: result.pdfBuffer,
          pdfBase64: result.pdfBase64 || result.pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
          filename: result.filename || this.buildPdfFilename(info),
          isFallback: false,
          sourceUrl: result.sourceUrl,
          executionLogs: logs
        };
      }

      if (result.requiresCaptcha) {
        this.createLog(`[LƯU Ý] Cổng VNPAY Invoice yêu cầu xác thực reCAPTCHA v3. Cung cấp đường dẫn tra cứu trực tiếp: ${buildVnpayPortalUrl(lookupCode, sellerTaxCode)}`, logs);
        throw new Error(result.error || 'Cổng VNPAY Invoice yêu cầu xác thực reCAPTCHA.');
      }
    } catch (err: any) {
      this.createLog(`Lỗi khi gọi cổng VNPAY: ${err.message}`, logs);
      throw new Error(`[VnpayDriver] Không thể tải PDF trực tiếp từ Cổng VNPAY: ${err.message}`);
    }

    throw new Error('[VnpayDriver] Không thể tải PDF gốc từ Cổng VNPAY Invoice.');
  }
}
