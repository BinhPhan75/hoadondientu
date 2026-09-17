/**
 * VnptDriver: Driver tra cứu & tải PDF Hóa đơn điện tử VNPT (VNPT Invoice)
 * Cổng tra cứu: https://tracuu.vnpt-invoice.com.vn
 */

import axios from 'axios';
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { CaptchaSolver } from '../captcha/CaptchaSolver';
import { GenericFallbackDriver } from './GenericFallbackDriver';

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

    // Trích xuất mã tra cứu của VNPT (Đối với hóa đơn VNPT: mã tra cứu có thể là Fkey hoặc mã CQT)
    let lookupCode = cqtCode || this.extractCustomField(xmlData, ['Fkey', 'Mã Fkey', 'Mã tra cứu', 'MaTraCuu']);
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

    const timeoutMs = options?.timeoutMs || 15000;
    let lastError = '';

    // 1. Thử các cổng tải trực tiếp (không yêu cầu Captcha)
    const directEndpoints = [
      `https://tracuu.vnpt-invoice.com.vn/api/invoices/download-pdf?fkey=${encodeURIComponent(fkey)}&taxCode=${encodeURIComponent(cleanMst)}`,
      `https://portal.vnpt-invoice.com.vn/api/download-pdf?fkey=${encodeURIComponent(fkey)}`
    ];

    for (const url of directEndpoints) {
      try {
        this.createLog(`Đang thử tải trực tiếp từ VNPT: ${url.substring(0, 65)}...`, logs);
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
        lastError = err.message || String(err);
      }
    }

    // 2. Thử cơ chế vượt Captcha trên cổng Portal VNPT Invoice
    const portalCandidates = [
      info.lookupUrl ? info.lookupUrl.replace(/\/+$/, '') : null,
      cleanMst ? `https://${cleanMst}-tt78.vnpt-invoice.com.vn` : null,
      'https://tracuu.vnpt-invoice.com.vn',
      'https://portal.vnpt-invoice.com.vn'
    ].filter(Boolean) as string[];

    for (const portal of portalCandidates) {
      try {
        const captchaUrl = `${portal}/Captcha.ashx`;
        this.createLog(`Yêu cầu ảnh Captcha từ cổng VNPT: ${captchaUrl}`, logs);

        const captchaResp = await axios.get(captchaUrl, {
          timeout: 8000,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Referer': portal
          },
          validateStatus: (s) => s === 200
        });

        const cookieHeader = captchaResp.headers['set-cookie'] 
          ? (Array.isArray(captchaResp.headers['set-cookie']) ? captchaResp.headers['set-cookie'].join('; ') : captchaResp.headers['set-cookie'])
          : '';

        if (captchaResp.data && captchaResp.data.byteLength > 20) {
          this.createLog('Đã nhận ảnh Captcha từ VNPT. Đang trích xuất mã Captcha...', logs);
          const captchaResult = await CaptchaSolver.solveWithDetails(Buffer.from(captchaResp.data));
          const captchaCode = captchaResult.code;
          this.createLog(`Đã giải Captcha VNPT thành công: "${captchaCode}" (Engine: ${captchaResult.engine})`, logs);

          // Gửi yêu cầu xác thực tải hóa đơn kèm Captcha
          const queryUrl = `${portal}/TraCuu/TraCuuHoaDon`;
          const queryResp = await axios.post(queryUrl, {
            fkey,
            mst: cleanMst,
            captcha: captchaCode,
            sohd: info.invoiceNo,
            khhdon: info.invoiceSeries
          }, {
            timeout: timeoutMs,
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
              'Referer': portal,
              'Cookie': cookieHeader,
              ...(options?.customHeaders || {})
            },
            validateStatus: (s) => s < 500
          });

          if (queryResp.data && queryResp.data.byteLength > 50) {
            const buf = Buffer.from(queryResp.data);
            if (buf.toString('utf-8', 0, 5).startsWith('%PDF')) {
              this.createLog(`Vượt Captcha và tải thành công file PDF gốc từ VNPT (${(buf.length / 1024).toFixed(1)} KB)`, logs);
              return {
                success: true,
                provider: this.providerCode,
                driverName: this.name,
                pdfBuffer: buf,
                pdfBase64: buf.toString('base64'),
                contentType: 'application/pdf',
                filename: this.buildPdfFilename(info),
                isFallback: false,
                sourceUrl: queryUrl,
                captchaSolved: captchaCode,
                executionLogs: logs
              };
            }
          }
        }
      } catch (portalErr: any) {
        this.createLog(`Cổng VNPT ${portal} chưa hoàn tất: ${portalErr.message}`, logs);
      }
    }

    // 3. Nếu các cổng trực tuyến không phản hồi hoặc bị hạn chế IP, kích hoạt Fallback chuẩn Nghị định 123
    this.createLog(`Kích hoạt Fallback chuẩn Nghị định 123 / Thông tư 78 cho HĐ VNPT`, logs);
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
}
