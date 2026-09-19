/**
 * ViettelDriver: Driver tra cứu & tải PDF Hóa đơn điện tử Viettel (vInvoice / S-Invoice)
 * Cổng tra cứu chính thức: https://vinvoice.viettel.vn/utilities/invoice-search
 * Cơ chế: Sử dụng API utility downloadPDF và generatePDF của Viettel với Mã số thuế và Mã số bí mật (ReservationCode)
 */

import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { downloadOriginalViettelPdf } from '../../viettelInvoiceService';

export class ViettelDriver extends BaseInvoiceProviderDriver {
  readonly name = 'Viettel vInvoice / S-Invoice Driver';
  readonly providerCode = 'VIETTEL';
  readonly metadata: DriverMetadata = {
    name: 'Viettel vInvoice / S-Invoice Driver',
    providerCode: 'VIETTEL',
    description: 'Tra cứu và tải PDF HĐĐT gốc từ cổng Viettel vInvoice / S-Invoice qua Mã số thuế và Mã số bí mật (ReservationCode)',
    sampleUrl: 'https://vinvoice.viettel.vn/utilities/invoice-search',
    supportsCaptcha: false,
    requiredFields: ['sellerTaxCode', 'secretCode']
  };

  /**
   * Nhận diện hóa đơn Viettel S-Invoice / vInvoice
   */
  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'VIETTEL';
    }

    return detectProvider(xmlData) === 'VIETTEL';
  }

  /**
   * Trích xuất thông tin hóa đơn Viettel từ XML
   */
  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst');
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C26TGT';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    // Trích xuất Mã bí mật (SecretCode / ReservationCode) của Viettel
    let secretCode = this.extractCustomField(xmlData, [
      'Mã số bí mật',
      'MaBiMat',
      'Mã bí mật',
      'ReservationCode',
      'SecretCode',
      'MaSoBiMat',
      'Mã bảo mật',
      'MaBaoMat'
    ]);

    if (!secretCode) {
      secretCode = this.extractXmlTag(xmlData, 'ReservationCode') || 
        this.extractXmlTag(xmlData, 'SecretCode') ||
        this.extractXmlTag(xmlData, 'MaBiMat') ||
        this.extractXmlTag(xmlData, 'MaSoBiMat');
    }

    // Nếu vẫn chưa thấy, quét khối TTin / TTKhac tìm DLieu có độ dài 10-25 ký tự chữ và số
    if (!secretCode) {
      const ttinBlocks = this.extractXmlBlocks(xmlData, 'TTin');
      for (const block of ttinBlocks) {
        const truong = (this.extractXmlTag(block, 'TTruong') || this.extractXmlTag(block, 'TenTruong')).toLowerCase();
        if (truong.includes('bí mật') || truong.includes('bi mat') || truong.includes('secret') || truong.includes('reservation')) {
          const val = this.extractXmlTag(block, 'DLieu') || this.extractXmlTag(block, 'Data');
          if (val) {
            secretCode = val.trim();
            break;
          }
        }
      }
    }

    // Dự phòng tìm kiếm bằng biểu thức chính quy chuỗi mã bí mật điển hình của Viettel (ví dụ S109R1TNGHTH3MN)
    if (!secretCode) {
      const match = xmlData.match(/\b([A-Z0-9]{12,20})\b/);
      if (match && match[1] && !match[1].startsWith('0') && /[A-Z]/.test(match[1]) && /\d/.test(match[1])) {
        // Chỉ nhận nếu gần từ khóa bí mật
        const index = xmlData.indexOf(match[1]);
        const snippet = xmlData.substring(Math.max(0, index - 80), Math.min(xmlData.length, index + 80)).toLowerCase();
        if (snippet.includes('bí mật') || snippet.includes('bi mat') || snippet.includes('secret') || snippet.includes('reservation')) {
          secretCode = match[1];
        }
      }
    }

    const totalAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTTTBSo') || '0') || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTThue') || '0') || 0;

    return {
      provider: this.providerCode,
      providerName: 'Viettel vInvoice / S-Invoice',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      secretCode: secretCode || undefined,
      lookupUrl: 'https://vinvoice.viettel.vn/utilities/invoice-search',
      cqtCode: cqtCode || undefined,
      totalAmount,
      totalTaxAmount,
      currency: this.extractXmlTag(xmlData, 'DVTTe') || 'VND',
      rawXml: xmlData,
      additionalData: {
        msttcgp: '0100109106'
      }
    };
  }

  /**
   * Tải PDF Hóa đơn gốc Viettel trực tiếp từ máy chủ vinvoice.viettel.vn
   */
  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi chạy Viettel vInvoice Driver cho HĐ ${info.invoiceSeries || ''} - ${info.invoiceNo || ''}`, logs);

    const supplierTaxCode = (info.sellerTaxCode || '').trim();
    const reservationCode = (info.secretCode || '').trim();

    if (!supplierTaxCode) {
      this.createLog('LỖI: Thiếu Mã số thuế bên bán (sellerTaxCode).', logs);
      throw new Error('[ViettelDriver] Thiếu Mã số thuế bên bán (sellerTaxCode) để tra cứu hóa đơn Viettel.');
    }

    if (!reservationCode) {
      this.createLog('LỖI: Không tìm thấy Mã số bí mật (reservationCode) trong XML.', logs);
      throw new Error('[ViettelDriver] Không tìm thấy Mã số bí mật (Mã bí mật / ReservationCode) trong XML hóa đơn.');
    }

    this.createLog(`Thông tin tra cứu: MST bên bán=${supplierTaxCode}, Mã bí mật=${reservationCode}`, logs);
    this.createLog('Đang kết nối đến cổng dịch vụ Viettel vInvoice (vinvoice.viettel.vn)...', logs);

    try {
      const result = await downloadOriginalViettelPdf({
        supplierTaxCode,
        reservationCode,
        invoiceNo: info.invoiceNo,
        invoiceSeries: info.invoiceSeries
      });

      if (result.success && result.pdfBuffer) {
        this.createLog(`Tải thành công file PDF gốc từ Viettel (${(result.pdfBuffer.length / 1024).toFixed(1)} KB)`, logs);
        return {
          success: true,
          provider: this.providerCode,
          driverName: this.name,
          pdfBuffer: result.pdfBuffer,
          pdfBase64: result.pdfBase64 || result.pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
          filename: this.buildPdfFilename(info),
          isFallback: false,
          sourceUrl: result.sourceUrl,
          executionLogs: logs
        };
      }
    } catch (err: any) {
      this.createLog(`Lỗi khi tải PDF từ Viettel: ${err.message}`, logs);
      throw new Error(`[ViettelDriver] Không thể tải PDF gốc từ Viettel vInvoice: ${err.message}`);
    }

    throw new Error(`[ViettelDriver] Không thể tải PDF gốc từ Viettel vInvoice.`);
  }
}
