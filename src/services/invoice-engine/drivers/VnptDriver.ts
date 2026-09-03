/**
 * VnptDriver: Driver tra cứu & tải PDF Hóa đơn điện tử VNPT (VNPT Invoice)
 * Cổng tra cứu: https://tracuu.vnpt-invoice.com.vn
 */

import axios from 'axios';
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';

export class VnptDriver extends BaseInvoiceProviderDriver {
  readonly name = 'VNPT Invoice Driver';
  readonly providerCode = 'VNPT';
  readonly metadata: DriverMetadata = {
    name: 'VNPT Invoice Driver',
    providerCode: 'VNPT',
    description: 'Tra cứu và tải PDF HĐĐT gốc từ cổng VNPT Invoice qua Fkey / Mã tra cứu và MST bên bán',
    sampleUrl: 'https://tracuu.vnpt-invoice.com.vn',
    supportsCaptcha: false,
    requiredFields: ['sellerTaxCode', 'lookupCode']
  };

  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'VNPT' || 
             Boolean(xmlData.lookupUrl?.includes('vnpt-invoice.com.vn')) ||
             Boolean(xmlData.additionalData?.msttcgp === '0100686209');
    }

    const xml = xmlData;
    const msttcgp = this.extractXmlTag(xml, 'MSTTCGP');
    const website = this.extractXmlTag(xml, 'Website').toLowerCase();
    const signature = this.extractXmlTag(xml, 'X509IssuerName').toUpperCase() + 
                      this.extractXmlTag(xml, 'X509SubjectName').toUpperCase();

    if (msttcgp === '0100686209') return true;
    if (website.includes('vnpt-invoice') || website.includes('vnpt.vn')) return true;
    if (signature.includes('VNPT')) return true;
    if (xml.includes('vnpt-invoice.com.vn')) return true;

    const fkey = this.extractCustomField(xml, ['Fkey', 'Mã tra cứu', 'MaTraCuu', 'Mã Fkey']);
    if (fkey && xml.includes('VNPT')) return true;

    return false;
  }

  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst');
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C24TGT';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    // Trích xuất Fkey hoặc Mã tra cứu của VNPT
    let lookupCode = this.extractCustomField(xmlData, ['Fkey', 'Mã Fkey', 'Mã tra cứu', 'MaTraCuu']);
    if (!lookupCode) {
      lookupCode = this.extractXmlTag(xmlData, 'Fkey') || this.extractXmlTag(xmlData, 'MTCuu');
    }

    const totalAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTTTBSo') || '0') || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTThue') || '0') || 0;

    return {
      provider: this.providerCode,
      providerName: 'VNPT Invoice',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      lookupCode: lookupCode || undefined,
      lookupUrl: 'https://tracuu.vnpt-invoice.com.vn',
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

    const fkey = (info.lookupCode || '').trim();
    const cleanMst = (info.sellerTaxCode || '').trim();
    this.createLog(`Fkey VNPT: "${fkey}", MST: "${cleanMst}"`, logs);

    const timeoutMs = options?.timeoutMs || 12000;

    const endpoints = [
      `https://tracuu.vnpt-invoice.com.vn/api/invoices/download-pdf?fkey=${encodeURIComponent(fkey)}&taxCode=${encodeURIComponent(cleanMst)}`,
      `https://portal.vnpt-invoice.com.vn/api/download-pdf?fkey=${encodeURIComponent(fkey)}`
    ];

    for (const url of endpoints) {
      try {
        this.createLog(`Đang gửi yêu cầu đến VNPT: ${url.substring(0, 60)}...`, logs);
        const resp = await axios.get(url, {
          timeout: timeoutMs,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': 'application/pdf, application/json, */*',
            ...(options?.customHeaders || {})
          },
          validateStatus: (s) => s === 200
        });

        if (resp.data && resp.data.byteLength > 50) {
          const buf = Buffer.from(resp.data);
          if (buf.toString('utf-8', 0, 5).startsWith('%PDF')) {
            this.createLog(`Tải thành công file PDF gốc từ VNPT (${(buf.length / 1024).toFixed(1)} KB)`, logs);
            return {
              success: true,
              provider: this.providerCode,
              driverName: this.name,
              pdfBuffer: buf,
              pdfBase64: buf.toString('base64'),
              contentType: 'application/pdf',
              filename: this.buildPdfFilename(info),
              isFallback: false,
              sourceUrl: url,
              executionLogs: logs
            };
          }
        }
      } catch (err: any) {
        this.createLog(`Cổng VNPT phản hồi cảnh báo: ${err.message}`, logs);
      }
    }

    throw new Error(`[VnptDriver] Không thể tải PDF gốc từ VNPT Invoice. Sẽ kích hoạt Fallback.`);
  }
}
