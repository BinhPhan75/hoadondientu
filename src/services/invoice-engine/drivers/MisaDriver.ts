/**
 * MisaDriver: Driver tra cứu & tải PDF Hóa đơn điện tử MISA (meInvoice)
 * Cổng tra cứu: https://www.meinvoice.vn/tra-cuu
 */

import axios from 'axios';
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';

export class MisaDriver extends BaseInvoiceProviderDriver {
  readonly name = 'MISA meInvoice Driver';
  readonly providerCode = 'MISA';
  readonly metadata: DriverMetadata = {
    name: 'MISA meInvoice Driver',
    providerCode: 'MISA',
    description: 'Tra cứu và tải PDF HĐĐT gốc từ cổng MISA meInvoice (meinvoice.vn) qua Mã tra cứu và MST bên bán',
    sampleUrl: 'https://www.meinvoice.vn/tra-cuu',
    supportsCaptcha: false,
    requiredFields: ['sellerTaxCode', 'lookupCode']
  };

  /**
   * Nhận diện hóa đơn MISA thông qua:
   * - Mã số thuế đơn vị giải pháp (MSTTCGP = 0101243150)
   * - Tên tổ chức chứng thư số có chữ "MISA"
   * - URL tra cứu chứa "meinvoice.vn" hoặc "misa.vn"
   * - Thẻ TTin có Mã tra cứu định dạng MISA
   */
  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'MISA' || 
             Boolean(xmlData.lookupUrl?.includes('meinvoice.vn')) ||
             Boolean(xmlData.additionalData?.msttcgp === '0101243150');
    }

    const xml = xmlData;
    const msttcgp = this.extractXmlTag(xml, 'MSTTCGP');
    const website = this.extractXmlTag(xml, 'Website').toLowerCase();
    const signature = this.extractXmlTag(xml, 'X509IssuerName').toUpperCase() + 
                      this.extractXmlTag(xml, 'X509SubjectName').toUpperCase();

    if (msttcgp === '0101243150') return true;
    if (website.includes('meinvoice.vn') || website.includes('misa.vn') || website.includes('misa.com.vn')) return true;
    if (signature.includes('MISA')) return true;
    if (xml.includes('meinvoice.vn') || xml.includes('meInvoice')) return true;

    // Kiểm tra trường tùy biến trong <TTKhac> hoặc tên nhà cung cấp
    const lookupCustom = this.extractCustomField(xml, ['Mã tra cứu', 'MaTraCuu', 'MTCuu', 'MTC']);
    if (lookupCustom && (xml.includes('MISA') || xml.includes('meInvoice') || lookupCustom.startsWith('MS'))) {
      return true;
    }

    if (xml.toUpperCase().includes('MISA')) {
      return true;
    }

    return false;
  }

  /**
   * Trích xuất thông tin hóa đơn MISA từ XML
   */
  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst');
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C24TGT';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    // Tìm Mã tra cứu (MISA thường lưu trong <TTin><TTruong>Mã tra cứu</TTruong><DLieu>...</DLieu></TTin> hoặc <MTCuu>)
    let lookupCode = this.extractCustomField(xmlData, ['Mã tra cứu', 'MaTraCuu', 'MTCuu', 'LookupCode', 'MTC']);
    if (!lookupCode) {
      lookupCode = this.extractXmlTag(xmlData, 'MTCuu') || this.extractXmlTag(xmlData, 'MaTraCuu');
    }

    // Nếu mã tra cứu là một đường dẫn URL (ví dụ: https://www.meinvoice.vn/tra-cuu/?code=ABCXYZ)
    let lookupUrl = 'https://www.meinvoice.vn/tra-cuu';
    if (lookupCode && lookupCode.includes('http')) {
      try {
        const urlObj = new URL(lookupCode);
        lookupUrl = `${urlObj.origin}${urlObj.pathname}`;
        const codeParam = urlObj.searchParams.get('code') || urlObj.searchParams.get('c');
        if (codeParam) {
          lookupCode = codeParam;
        }
      } catch {
        // Giữ nguyên lookupCode
      }
    }

    const totalAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTTTBSo') || '0') || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTThue') || '0') || 0;

    return {
      provider: this.providerCode,
      providerName: 'MISA meInvoice',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      lookupCode: lookupCode || undefined,
      lookupUrl,
      cqtCode: cqtCode || undefined,
      totalAmount,
      totalTaxAmount,
      currency: this.extractXmlTag(xmlData, 'DVTTe') || 'VND',
      rawXml: xmlData,
      additionalData: {
        msttcgp: '0101243150'
      }
    };
  }

  /**
   * Tải PDF Hóa đơn gốc từ server MISA meinvoice.vn
   */
  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi chạy quy trình tải PDF gốc MISA cho HĐ ${info.invoiceSeries} - ${info.invoiceNo}`, logs);

    if (!info.lookupCode) {
      this.createLog('Cảnh báo: Không tìm thấy Mã tra cứu MISA trong XML. Sẽ dùng MST và Số hóa đơn.', logs);
    } else {
      this.createLog(`Mã tra cứu MISA phát hiện: "${info.lookupCode}"`, logs);
    }

    const timeoutMs = options?.timeoutMs || 12000;
    const cleanLookupCode = (info.lookupCode || '').trim();
    const cleanMst = (info.sellerTaxCode || '').trim();

    // Danh sách các endpoints API chính thức & viewer của MISA
    const candidateEndpoints = [
      {
        url: 'https://www.meinvoice.vn/api/viewer/download-pdf',
        method: 'POST',
        data: {
          code: cleanLookupCode,
          taxCode: cleanMst,
          invoiceNo: info.invoiceNo,
          series: info.invoiceSeries
        }
      },
      {
        url: `https://www.meinvoice.vn/api/v1/invoices/download-pdf?code=${encodeURIComponent(cleanLookupCode)}&taxCode=${encodeURIComponent(cleanMst)}`,
        method: 'GET'
      },
      {
        url: `https://meinvoice.vn/api/viewer/get-invoice-pdf-file?lookupCode=${encodeURIComponent(cleanLookupCode)}`,
        method: 'GET'
      }
    ];

    let lastError = '';

    for (const endpoint of candidateEndpoints) {
      try {
        this.createLog(`Đang gửi yêu cầu đến MISA: ${endpoint.url.substring(0, 70)}...`, logs);

        const response = await axios({
          url: endpoint.url,
          method: endpoint.method as any,
          data: endpoint.data,
          timeout: timeoutMs,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': 'application/pdf, application/json, */*',
            'Referer': 'https://www.meinvoice.vn/tra-cuu',
            'Origin': 'https://www.meinvoice.vn',
            ...(options?.customHeaders || {})
          },
          validateStatus: (status) => status < 500
        });

        if (response.status === 200 && response.data) {
          const buf = Buffer.from(response.data);

          // Kiểm tra header PDF magic bytes (%PDF)
          if (buf.length > 50 && buf.toString('utf-8', 0, 5).startsWith('%PDF')) {
            this.createLog(`Tải thành công file PDF gốc từ MISA (${(buf.length / 1024).toFixed(1)} KB)`, logs);
            return {
              success: true,
              provider: this.providerCode,
              driverName: this.name,
              pdfBuffer: buf,
              pdfBase64: buf.toString('base64'),
              contentType: 'application/pdf',
              filename: this.buildPdfFilename(info),
              isFallback: false,
              sourceUrl: endpoint.url,
              executionLogs: logs
            };
          }

          // Trường hợp trả về JSON chứa chuỗi Base64 PDF
          const jsonText = buf.toString('utf-8');
          if (jsonText.startsWith('{') && jsonText.includes('"data"')) {
            try {
              const parsed = JSON.parse(jsonText);
              const b64 = parsed.data || parsed.pdfBase64 || parsed.fileData;
              if (b64 && typeof b64 === 'string') {
                const cleanB64 = b64.replace(/^data:application\/pdf;base64,/, '');
                const pdfBuf = Buffer.from(cleanB64, 'base64');
                this.createLog(`Trích xuất thành công PDF Base64 từ JSON phản hồi MISA (${(pdfBuf.length / 1024).toFixed(1)} KB)`, logs);
                return {
                  success: true,
                  provider: this.providerCode,
                  driverName: this.name,
                  pdfBuffer: pdfBuf,
                  pdfBase64: cleanB64,
                  contentType: 'application/pdf',
                  filename: this.buildPdfFilename(info),
                  isFallback: false,
                  sourceUrl: endpoint.url,
                  executionLogs: logs
                };
              }
            } catch {
              // Bỏ qua và thử endpoint tiếp theo
            }
          }
        }
      } catch (err: any) {
        lastError = err.message || String(err);
        this.createLog(`Cổng MISA phản hồi cảnh báo: ${lastError}`, logs);
      }
    }

    throw new Error(`[MisaDriver] Không thể tải PDF gốc từ MISA (${lastError || 'Không tìm thấy hóa đơn hoặc mã tra cứu không hợp lệ'}).`);
  }
}
