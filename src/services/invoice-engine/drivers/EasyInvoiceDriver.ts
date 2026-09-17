/**
 * EasyInvoiceDriver: Driver hỗ trợ nhận diện và xử lý Hóa đơn điện tử EasyInvoice (Softdreams)
 * Cổng tra cứu: https://easyinvoice.vn
 */

import axios from 'axios';
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { CaptchaSolver } from '../captcha/CaptchaSolver';
import { GenericFallbackDriver } from './GenericFallbackDriver';

export class EasyInvoiceDriver extends BaseInvoiceProviderDriver {
  readonly name = 'Softdreams EasyInvoice Driver';
  readonly providerCode = 'EASYINVOICE';
  readonly metadata: DriverMetadata = {
    name: 'Softdreams EasyInvoice Driver',
    providerCode: 'EASYINVOICE',
    description: 'Tra cứu & xử lý hóa đơn điện tử EasyInvoice (Softdreams) qua Mã tra cứu / Chữ ký số EasyCA và vượt Captcha tự động',
    sampleUrl: 'https://easyinvoice.vn/tra-cuu',
    supportsCaptcha: true,
    requiredFields: ['lookupCode', 'sellerTaxCode']
  };

  private fallback = new GenericFallbackDriver();

  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'EASYINVOICE';
    }
    return detectProvider(xmlData) === 'EASYINVOICE';
  }

  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst');
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C25TEI';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    const lookupCode = this.extractCustomField(xmlData, ['Mã tra cứu', 'MaTraCuu', 'MTCuu', 'Fkey', 'Ikey', 'EasyInvoice']) || 
                       this.extractXmlTag(xmlData, 'MTCuu') || 
                       this.extractXmlTag(xmlData, 'MaTraCuu');

    return {
      provider: this.providerCode,
      providerName: 'Softdreams EasyInvoice',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      cqtCode,
      lookupCode,
      lookupUrl: 'https://easyinvoice.vn/tra-cuu',
      rawXml: xmlData
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi động xử lý HĐĐT EasyInvoice: Số ${info.invoiceNo}, Mẫu ${info.templateCode}/${info.invoiceSeries}`, logs);

    const lookupCode = (info.lookupCode || '').trim();
    const cleanMst = (info.sellerTaxCode || '').trim();
    this.createLog(`Mã tra cứu EasyInvoice: "${lookupCode}", MST: "${cleanMst}"`, logs);

    const timeoutMs = options?.timeoutMs || 15000;

    // 1. Thử cơ chế vượt Captcha trên các cổng Portal EasyInvoice
    const portalCandidates = [
      info.lookupUrl ? info.lookupUrl.replace(/\/+$/, '') : null,
      'https://easyinvoice.vn',
      'https://tracuu.easyinvoice.vn',
      cleanMst ? `https://${cleanMst}.easyinvoice.com.vn` : null
    ].filter(Boolean) as string[];

    for (const portal of portalCandidates) {
      try {
        const captchaUrl = `${portal}/Home/GetCaptcha`;
        this.createLog(`Đang lấy ảnh Captcha từ cổng EasyInvoice: ${captchaUrl}`, logs);

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
          this.createLog('Đã nhận ảnh Captcha EasyInvoice. Đang trích xuất mã Captcha...', logs);
          const captchaResult = await CaptchaSolver.solveWithDetails(Buffer.from(captchaResp.data));
          const captchaCode = captchaResult.code;
          this.createLog(`Đã giải Captcha EasyInvoice thành công: "${captchaCode}" (Engine: ${captchaResult.engine})`, logs);

          // Gửi yêu cầu xác thực tải PDF hóa đơn
          const queryUrl = `${portal}/Home/TraCuuHoaDon`;
          const queryResp = await axios.post(queryUrl, {
            Ikey: lookupCode,
            Mst: cleanMst,
            Captcha: captchaCode,
            Pattern: info.templateCode,
            Serial: info.invoiceSeries
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
              this.createLog(`Vượt Captcha và tải thành công file PDF gốc từ EasyInvoice (${(buf.length / 1024).toFixed(1)} KB)`, logs);
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
        this.createLog(`Cổng EasyInvoice ${portal} chưa hoàn tất: ${portalErr.message}`, logs);
      }
    }

    // 2. Chuyển sang bộ tạo bản thể hiện PDF chuẩn Nghị định 123 / Thông tư 78
    this.createLog(`Chuyển sang bộ tạo bản thể hiện PDF chuẩn Nghị định 123 / Thông tư 78`, logs);
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
}
