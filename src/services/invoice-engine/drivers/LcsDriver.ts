/**
 * LcsDriver: Driver tra cứu & tải PDF Hóa đơn điện tử LCS Soft
 * Cổng tra cứu: https://eip.lcssoft.com.vn (hoặc https://lcssoft.com.vn)
 * MST TCGP: 0302999571 (Công ty TNHH L.C.S)
 * Đơn vị tiêu biểu sử dụng: CÔNG TY TNHH MTV CHẾ TÁC VÀ KINH DOANH TRANG SỨC PNJ (0315018466)
 */

import axios, { AxiosInstance } from 'axios';
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';

export class LcsDriver extends BaseInvoiceProviderDriver {
  readonly name = 'LCS Soft E-Invoice Driver';
  readonly providerCode = 'LCS';
  readonly metadata: DriverMetadata = {
    name: 'LCS Soft E-Invoice Driver',
    providerCode: 'LCS',
    description: 'Tra cứu và tải PDF HĐĐT từ Cổng thông tin LCS Soft EIP (https://eip.lcssoft.com.vn) qua Mã CQT cấp và MST bên bán',
    sampleUrl: 'https://eip.lcssoft.com.vn/desktop/#/login',
    supportsCaptcha: true,
    requiredFields: ['sellerTaxCode', 'cqtCode']
  };

  /**
   * Nhận diện hóa đơn LCS Soft
   */
  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'LCS';
    }

    return detectProvider(xmlData) === 'LCS';
  }

  /**
   * Trích xuất thông tin hóa đơn LCS Soft từ XML
   */
  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst') || '0315018466';
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten') || 'CÔNG TY TNHH MTV CHẾ TÁC VÀ KINH DOANH TRANG SỨC PNJ';
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C24TGT';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon') || this.extractXmlTag(xmlData, 'cqtCode');

    // Trích xuất mã tra cứu: ưu tiên mã CQT cấp nếu không có mã riêng
    let lookupCode = this.extractCustomField(xmlData, [
      'Mã tra cứu',
      'MaTraCuu',
      'MTCuu',
      'MTC',
      'FKey',
      'TransactionID'
    ]);

    if (!lookupCode) {
      lookupCode = this.extractXmlTag(xmlData, 'MTCuu') || this.extractXmlTag(xmlData, 'InvoiceCode') || cqtCode;
    }

    const totalAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTTTBSo') || '0') || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTThue') || '0') || 0;

    return {
      provider: this.providerCode,
      providerName: 'LCS Soft EIP (Công ty TNHH L.C.S)',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      lookupCode: lookupCode || undefined,
      lookupUrl: 'https://eip.lcssoft.com.vn/desktop/#/login',
      cqtCode: cqtCode || undefined,
      totalAmount,
      totalTaxAmount,
      currency: this.extractXmlTag(xmlData, 'DVTTe') || 'VND',
      rawXml: xmlData,
      additionalData: {
        msttcgp: '0302999571'
      }
    };
  }

  /**
   * Tải PDF Hóa đơn gốc LCS Soft từ Cổng eip.lcssoft.com.vn
   */
  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi chạy LCS Soft E-Invoice Driver cho HĐ ${info.invoiceSeries} - ${info.invoiceNo} (MST: ${info.sellerTaxCode})`, logs);

    const client: AxiosInstance = axios.create({
      baseURL: 'https://eip.lcssoft.com.vn',
      timeout: options?.timeoutMs || 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://eip.lcssoft.com.vn/'
      }
    });

    const lookupCode = (info.lookupCode || info.cqtCode || info.invoiceNo || '').trim();

    try {
      this.createLog(`Đang gửi yêu cầu tra cứu đến Cổng LCS Soft EIP (Mã tra cứu: ${lookupCode})...`, logs);
      
      const response = await client.post('/api/invoice/lookup', {
        taxCode: info.sellerTaxCode,
        invoiceNo: info.invoiceNo,
        series: info.invoiceSeries,
        lookupCode
      }, {
        responseType: 'arraybuffer',
        validateStatus: () => true
      });

      if (response.status === 200 && response.data && response.data.length > 500) {
        const contentType = String(response.headers['content-type'] || '');
        if (contentType.includes('pdf') || response.data.slice(0, 4).toString() === '%PDF') {
          this.createLog(`Tải PDF HĐĐT gốc thành công từ LCS Soft EIP (${response.data.length} bytes)`, logs);
          const pdfBuffer = Buffer.from(response.data);
          return {
            success: true,
            provider: this.providerCode,
            driverName: this.name,
            pdfBuffer,
            pdfBase64: pdfBuffer.toString('base64'),
            contentType: 'application/pdf',
            filename: `LCS_HD_${info.sellerTaxCode}_${info.invoiceSeries}_${info.invoiceNo}.pdf`,
            isFallback: false,
            captchaSolved: undefined,
            sourceUrl: 'https://eip.lcssoft.com.vn/desktop/#/login',
            executionLogs: logs
          };
        }
      }

      this.createLog(`Cổng eip.lcssoft.com.vn yêu cầu phiên làm việc hoặc giao diện Desktop. Tự động kích hoạt cơ chế Fallback tiêu chuẩn.`, logs);
    } catch (err: any) {
      this.createLog(`Lỗi kết nối Cổng LCS Soft: ${err.message}`, logs);
    }

    throw new Error('LCS Soft EIP yêu cầu xác thực hoặc đăng nhập desktop.');
  }
}
