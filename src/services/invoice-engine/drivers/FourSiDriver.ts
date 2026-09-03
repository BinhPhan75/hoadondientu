/**
 * FourSiDriver: Driver tra cứu & tải PDF Hóa đơn điện tử 4Si
 * Cổng tra cứu: https://inv.4si.vn (hoặc https://4si.vn)
 * Tích hợp Cheerio bóc tách Form + Tesseract.js giải Captcha tự động
 */

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { CaptchaSolver } from '../captcha/CaptchaSolver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';

export class FourSiDriver extends BaseInvoiceProviderDriver {
  readonly name = '4Si E-Invoice Driver';
  readonly providerCode = '4SI';
  readonly metadata: DriverMetadata = {
    name: '4Si E-Invoice Driver',
    providerCode: '4SI',
    description: 'Tra cứu và tải PDF HĐĐT gốc từ cổng inv.4si.vn qua Mã hóa đơn và OCR Captcha tự động',
    sampleUrl: 'https://inv.4si.vn/tra-cuu',
    supportsCaptcha: true,
    requiredFields: ['lookupCode', 'sellerTaxCode']
  };

  /**
   * Nhận diện hóa đơn 4Si thông qua:
   * - URL chứa "inv.4si.vn" hoặc "4si.vn"
   * - MST tổ chức giải pháp: 0313463990 (4SI)
   * - Chữ ký số chứa "4SI"
   */
  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === '4SI' || 
             Boolean(xmlData.lookupUrl?.includes('4si.vn')) ||
             Boolean(xmlData.additionalData?.msttcgp === '0313463990');
    }

    const xml = xmlData;
    const msttcgp = this.extractXmlTag(xml, 'MSTTCGP');
    const website = this.extractXmlTag(xml, 'Website').toLowerCase();
    const signature = this.extractXmlTag(xml, 'X509IssuerName').toUpperCase() + 
                      this.extractXmlTag(xml, 'X509SubjectName').toUpperCase();

    if (msttcgp === '0313463990') return true;
    if (website.includes('4si.vn') || website.includes('inv.4si.vn')) return true;
    if (signature.includes('4SI') || signature.includes('4-SI')) return true;
    if (xml.includes('inv.4si.vn') || xml.includes('4si.vn')) return true;

    // Kiểm tra trường tùy biến Mã hóa đơn 4Si
    const fourSiCode = this.extractCustomField(xml, ['Mã hóa đơn 4Si', 'Mã tra cứu 4Si', '4Si', 'inv.4si.vn']);
    if (fourSiCode) return true;

    return false;
  }

  /**
   * Trích xuất thông tin hóa đơn 4Si từ XML
   */
  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst');
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C24TGT';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    // Trích xuất Mã hóa đơn / Mã tra cứu 4Si
    let lookupCode = this.extractCustomField(xmlData, [
      'Mã hóa đơn',
      'MaHoaDon',
      'Mã tra cứu',
      'MaTraCuu',
      'InvoiceCode',
      'MHD'
    ]);

    if (!lookupCode) {
      lookupCode = this.extractXmlTag(xmlData, 'MTCuu') || this.extractXmlTag(xmlData, 'InvoiceCode');
    }

    // Nếu không có mã tra cứu riêng, dùng Số hóa đơn làm fallback
    if (!lookupCode) {
      lookupCode = invoiceNo;
    }

    const totalAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTTTBSo') || '0') || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTThue') || '0') || 0;

    return {
      provider: this.providerCode,
      providerName: '4Si E-Invoice',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      lookupCode: lookupCode || undefined,
      lookupUrl: 'https://inv.4si.vn/tra-cuu',
      cqtCode: cqtCode || undefined,
      totalAmount,
      totalTaxAmount,
      currency: this.extractXmlTag(xmlData, 'DVTTe') || 'VND',
      rawXml: xmlData,
      additionalData: {
        msttcgp: '0313463990'
      }
    };
  }

  /**
   * Tải PDF Hóa đơn gốc 4Si từ cổng inv.4si.vn
   * Quy trình:
   * 1. GET form tra cứu tại https://inv.4si.vn/tra-cuu
   * 2. Bóc tách link ảnh Captcha bằng Cheerio và tải ảnh
   * 3. Giải Captcha bằng CaptchaSolver (Tesseract OCR)
   * 4. Gửi POST Request kèm Captcha để tải PDF
   */
  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi chạy 4Si E-Invoice Driver cho HĐ ${info.invoiceSeries} - ${info.invoiceNo}`, logs);

    const invoiceCode = (info.lookupCode || info.invoiceNo || '').trim();
    this.createLog(`Mã tra cứu / Mã hóa đơn 4Si: "${invoiceCode}"`, logs);

    const timeoutMs = options?.timeoutMs || 15000;
    const baseUrl = 'https://inv.4si.vn';

    let cookieHeader = '';
    const client: AxiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': `${baseUrl}/tra-cuu`,
        ...(options?.customHeaders || {})
      }
    });

    let solvedCaptchaCode = '';

    try {
      // 1. Tải trang tra cứu để lấy Form HTML và Cookie phiên
      this.createLog(`Đang truy cập trang chủ ${baseUrl}/tra-cuu...`, logs);
      const pageRes = await client.get('/tra-cuu', {
        validateStatus: (s) => s < 500
      });

      if (pageRes.headers['set-cookie']) {
        const setCookie = pageRes.headers['set-cookie'];
        cookieHeader = Array.isArray(setCookie) 
          ? setCookie.map(c => c.split(';')[0]).join('; ') 
          : String(setCookie).split(';')[0];
      }

      // 2. Sử dụng Cheerio để bóc tách form & đường dẫn ảnh Captcha
      const $ = cheerio.load(typeof pageRes.data === 'string' ? pageRes.data : '');
      let captchaImgSrc = $('img#captcha, img#imgCaptcha, img.captcha, img[src*="captcha"]').attr('src') || '/captcha';
      const csrfToken = $('input[name="_token"], input[name="csrf_token"]').val() || '';

      if (!captchaImgSrc.startsWith('http')) {
        captchaImgSrc = captchaImgSrc.startsWith('/') ? `${baseUrl}${captchaImgSrc}` : `${baseUrl}/${captchaImgSrc}`;
      }

      this.createLog(`Bóc tách thấy URL Captcha: ${captchaImgSrc}`, logs);

      // 3. Tải ảnh Captcha dạng Buffer
      let captchaBuffer: Buffer | null = null;
      try {
        const captchaRes = await client.get(captchaImgSrc, {
          responseType: 'arraybuffer',
          headers: {
            ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
          }
        });

        if (captchaRes.data && captchaRes.data.byteLength > 50) {
          const rawBuf = Buffer.from(captchaRes.data);
          const cType = String(captchaRes.headers['content-type'] || '');
          if (cType.includes('image') || CaptchaSolver.isValidImageBuffer(rawBuf)) {
            captchaBuffer = rawBuf;
            this.createLog(`Đã tải ảnh Captcha 4Si (${(captchaBuffer.length / 1024).toFixed(1)} KB)`, logs);
          } else {
            this.createLog(`Phản hồi Captcha 4Si không phải ảnh (${cType || 'text/html'}), bỏ qua`, logs);
          }
        }
      } catch (cErr: any) {
        this.createLog(`Không tải được ảnh từ ${captchaImgSrc}: ${cErr.message}`, logs);
      }

      // 4. Giải mã Captcha bằng Tesseract OCR
      if (captchaBuffer) {
        this.createLog('Đang chuyển ảnh Captcha sang CaptchaSolver OCR...', logs);
        try {
          const ocrResult = await CaptchaSolver.solveWithDetails(captchaBuffer, {
            whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
            timeoutMs: 8000
          });
          solvedCaptchaCode = ocrResult.code;
          this.createLog(`Giải Captcha 4Si thành công: "${solvedCaptchaCode}" (Confidence: ${ocrResult.confidence?.toFixed(0)}%)`, logs);
        } catch (ocrErr: any) {
          this.createLog(`Cảnh báo OCR Captcha: ${ocrErr.message}`, logs);
        }
      }

      // 5. Gửi POST Request tra cứu và tải PDF
      const postEndpoints = [
        '/tra-cuu',
        '/api/tra-cuu',
        '/download-pdf',
        '/api/download-pdf'
      ];

      const postPayload: Record<string, string> = {
        invoiceCode,
        lookupCode: invoiceCode,
        taxCode: (info.sellerTaxCode || '').trim(),
        captcha: solvedCaptchaCode,
        captchaCode: solvedCaptchaCode,
        ...(csrfToken ? { _token: String(csrfToken) } : {})
      };

      for (const ep of postEndpoints) {
        try {
          this.createLog(`Gửi POST Request đến ${ep} với mã tra cứu "${invoiceCode}" và Captcha "${solvedCaptchaCode}"...`, logs);
          const postRes = await client.post(ep, postPayload, {
            responseType: 'arraybuffer',
            headers: {
              ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            validateStatus: (s) => s < 500
          });

          if (postRes.status === 200 && postRes.data) {
            const buf = Buffer.from(postRes.data);

            // Kiểm tra nếu là file PDF thực tế
            if (buf.length > 50 && buf.toString('utf-8', 0, 5).startsWith('%PDF')) {
              this.createLog(`Tải thành công file PDF gốc từ 4Si (${(buf.length / 1024).toFixed(1)} KB)`, logs);
              return {
                success: true,
                provider: this.providerCode,
                driverName: this.name,
                pdfBuffer: buf,
                pdfBase64: buf.toString('base64'),
                contentType: 'application/pdf',
                filename: this.buildPdfFilename(info),
                isFallback: false,
                sourceUrl: `${baseUrl}${ep}`,
                captchaSolved: solvedCaptchaCode,
                executionLogs: logs
              };
            }
          }
        } catch (epErr: any) {
          this.createLog(`Endpoint ${ep} phản hồi: ${epErr.message}`, logs);
        }
      }
    } catch (err: any) {
      this.createLog(`Lỗi xử lý 4Si Driver: ${err.message}`, logs);
    }

    throw new Error(`[FourSiDriver] Không thể tải PDF từ inv.4si.vn. Hệ thống sẽ tự động kích hoạt GenericFallbackDriver.`);
  }
}
