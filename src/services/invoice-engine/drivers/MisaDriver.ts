/**
 * MisaDriver: Driver tra cứu & tải PDF Hóa đơn điện tử MISA (meInvoice)
 * Cổng tra cứu: https://www.meinvoice.vn/tra-cuu
 */

import axios from 'axios';
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { extractLookupDetailsFromXml } from '../../../utils/xmlParser';
import { OriginalInvoiceError } from '../OriginalInvoiceError';

function findMisaPdfUrl(payload: unknown, seen = new Set<unknown>()): string | undefined {
  if (!payload || typeof payload !== 'object' || seen.has(payload)) return undefined;
  seen.add(payload);

  if (Array.isArray(payload)) {
    for (const value of payload) {
      if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
      const found = findMisaPdfUrl(value, seen);
      if (found) return found;
    }
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  for (const key of ['pdfUrl', 'pdfURL', 'fileUrl', 'fileURL', 'downloadUrl', 'downloadURL', 'url', 'Url', 'link', 'Link']) {
    const value = record[key];
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
  }
  for (const value of Object.values(record)) {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
    const found = findMisaPdfUrl(value, seen);
    if (found) return found;
  }
  return undefined;
}

export class MisaDriver extends BaseInvoiceProviderDriver {
  readonly name = 'MISA meInvoice Driver';
  readonly providerCode = 'MISA';
  readonly metadata: DriverMetadata = {
    name: 'MISA meInvoice Driver',
    providerCode: 'MISA',
    description: 'Tra cứu và tải PDF HĐĐT gốc từ cổng MISA meInvoice (meinvoice.vn) qua Mã tra cứu và MST bên bán',
    sampleUrl: 'https://www.meinvoice.vn/tra-cuu',
    supportsCaptcha: true,
    requiredFields: ['sellerTaxCode', 'lookupCode']
  };

  /**
   * Nhận diện hóa đơn MISA theo đúng thứ tự ưu tiên nghiêm ngặt
   */
  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'MISA';
    }

    return detectProvider(xmlData) === 'MISA';
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

    // Tìm Mã tra cứu và URL tra cứu MISA từ XML bằng bộ trích xuất chuẩn hóa
    const { lookupCode: extractedCode, lookupUrl: extractedUrl } = extractLookupDetailsFromXml(xmlData);
    let lookupCode = extractedCode || this.extractCustomField(xmlData, ['Mã tra cứu', 'MaTraCuu', 'MTCuu', 'LookupCode', 'MTC', 'TransactionID']);
    if (!lookupCode) {
      lookupCode = this.extractXmlTag(xmlData, 'TransactionID') || this.extractXmlTag(xmlData, 'MTCuu') || this.extractXmlTag(xmlData, 'MaTraCuu');
    }

    // Nếu mã tra cứu là một đường dẫn URL (ví dụ: https://www.meinvoice.vn/tra-cuu/?sc=ABCXYZ hoặc ?code=ABCXYZ)
    let lookupUrl = extractedUrl || 'https://www.meinvoice.vn/tra-cuu';
    if (lookupCode && lookupCode.includes('http')) {
      try {
        const urlObj = new URL(lookupCode);
        lookupUrl = `${urlObj.origin}${urlObj.pathname}`;
        const codeParam = urlObj.searchParams.get('sc') || urlObj.searchParams.get('code') || urlObj.searchParams.get('c');
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
      lookupUrl: lookupUrl || 'https://www.meinvoice.vn/tra-cuu',
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
    let lastError = '';

    // Public MISA lookup links issue the original PDF directly from
    // DownloadHandler.ashx. This is the current documented buyer-facing
    // route; the older v3 linkview API is retained below only for older
    // invoices whose lookup code needs resolving first.
    const candidateEndpoints: Array<{ url: string; method: string; data?: any }> = [];

    if (cleanLookupCode) {
      try {
        this.createLog('[MISA] Mở cổng tra cứu để khởi tạo phiên tải PDF công khai...', logs);
        const portal = await axios.get('https://www.meinvoice.vn/tra-cuu/', {
          timeout: timeoutMs,
          headers: {
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
          },
          validateStatus: status => status < 500,
        });
        const setCookie = portal.headers['set-cookie'];
        const cookie = (Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [])
          .map(value => value.split(';', 1)[0])
          .join('; ');
        const direct = await axios.get(
          `https://www.meinvoice.vn/tra-cuu/DownloadHandler.ashx?Type=pdf&Viewer=1&Code=${encodeURIComponent(cleanLookupCode)}`,
          {
            timeout: timeoutMs,
            responseType: 'arraybuffer',
            headers: {
              Accept: 'application/pdf,application/octet-stream,*/*',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
              Referer: 'https://www.meinvoice.vn/tra-cuu/',
              Origin: 'https://www.meinvoice.vn',
              ...(cookie ? { Cookie: cookie } : {}),
            },
            validateStatus: status => status < 500,
          },
        );
        const pdfBuffer = Buffer.from(direct.data || '');
        if (direct.status === 200 && pdfBuffer.length > 50 && pdfBuffer.toString('latin1', 0, 5).startsWith('%PDF')) {
          this.createLog(`[MISA] Tải thành công PDF qua DownloadHandler (${(pdfBuffer.length / 1024).toFixed(1)} KB)`, logs);
          return {
            success: true,
            provider: this.providerCode,
            driverName: this.name,
            pdfBuffer,
            pdfBase64: pdfBuffer.toString('base64'),
            contentType: 'application/pdf',
            filename: this.buildPdfFilename(info),
            isFallback: false,
            sourceUrl: direct.config.url,
            executionLogs: logs,
          };
        }
        lastError = direct.status === 200
          ? 'MISA không tìm thấy PDF theo mã tra cứu.'
          : `HTTP ${direct.status}`;
      } catch (error: any) {
        lastError = error.message || String(error);
        this.createLog(`[MISA] DownloadHandler chưa dùng được: ${lastError}`, logs);
      }
    }

    // Public meInvoice API: resolve the transaction ID to the provider's
    // signed PDF URL before trying legacy viewer endpoints.
    if (cleanLookupCode) {
      try {
        this.createLog('[MISA] Xin link PDF chính thức qua invoicepublished/linkview...', logs);
        const linkResponse = await axios.post(
          'https://www.meinvoice.vn/api/v3/invoicepublished/linkview',
          JSON.stringify([cleanLookupCode]),
          {
            timeout: timeoutMs,
            responseType: 'json',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json, text/plain, */*',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
              Referer: 'https://www.meinvoice.vn/tra-cuu'
            }
          }
        );
        const pdfUrl = findMisaPdfUrl(linkResponse.data);
        if (pdfUrl) {
          const pdfResponse = await axios.get(pdfUrl, {
            timeout: timeoutMs,
            responseType: 'arraybuffer',
            headers: {
              Accept: 'application/pdf,application/octet-stream,*/*',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
              Referer: 'https://www.meinvoice.vn/tra-cuu'
            }
          });
          const pdfBuffer = Buffer.from(pdfResponse.data);
          if (pdfBuffer.length > 50 && pdfBuffer.toString('latin1', 0, 5).startsWith('%PDF')) {
            this.createLog(`[MISA] Tải thành công PDF qua linkview (${(pdfBuffer.length / 1024).toFixed(1)} KB)`, logs);
            return {
              success: true,
              provider: this.providerCode,
              driverName: this.name,
              pdfBuffer,
              pdfBase64: pdfBuffer.toString('base64'),
              contentType: 'application/pdf',
              filename: this.buildPdfFilename(info),
              isFallback: false,
              sourceUrl: pdfUrl,
              executionLogs: logs
            };
          }
        }
        this.createLog('[MISA] linkview không trả về URL PDF hợp lệ, tiếp tục thử endpoint tương thích.', logs);
      } catch (err: any) {
        lastError = err.message || String(err);
        this.createLog(`[MISA] linkview chưa dùng được: ${lastError}`, logs);
      }
    }

    // Compatibility endpoints for legacy MISA invoices.
    candidateEndpoints.push(
      {
        url: 'https://www.meinvoice.vn/api/viewer/download-pdf',
        method: 'POST',
        data: {
          code: cleanLookupCode,
          transactionID: cleanLookupCode,
          taxCode: cleanMst,
          invoiceNo: info.invoiceNo,
          series: info.invoiceSeries
        }
      },
      {
        url: 'https://www.meinvoice.vn/api/viewer/get-invoice-pdf-file',
        method: 'POST',
        data: {
          transactionID: cleanLookupCode,
          code: cleanLookupCode,
          taxCode: cleanMst
        }
      },
      {
        url: `https://www.meinvoice.vn/api/viewer/get-invoice-pdf-file?transactionId=${encodeURIComponent(cleanLookupCode)}&taxCode=${encodeURIComponent(cleanMst)}`,
        method: 'GET'
      },
      {
        url: `https://www.meinvoice.vn/api/viewer/download-pdf?sc=${encodeURIComponent(cleanLookupCode)}&taxCode=${encodeURIComponent(cleanMst)}`,
        method: 'GET'
      },
      {
        url: `https://www.meinvoice.vn/api/v1/invoices/download-pdf?code=${encodeURIComponent(cleanLookupCode)}&taxCode=${encodeURIComponent(cleanMst)}`,
        method: 'GET'
      },
      {
        url: `https://meinvoice.vn/api/viewer/get-invoice-pdf-file?lookupCode=${encodeURIComponent(cleanLookupCode)}`,
        method: 'GET'
      }
    );

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
        lastError = `HTTP ${response.status}`;
      } catch (err: any) {
        lastError = err.message || String(err);
        this.createLog(`Cổng MISA phản hồi cảnh báo: ${lastError}`, logs);
      }
    }

    throw new OriginalInvoiceError(
      `Không thể tải PDF gốc từ MISA (${lastError || 'Không tìm thấy hóa đơn hoặc mã tra cứu không hợp lệ'}).`,
      this.providerCode,
      'ORIGINAL_DOWNLOAD_FAILED',
      502,
      info.lookupUrl,
    );
  }
}
