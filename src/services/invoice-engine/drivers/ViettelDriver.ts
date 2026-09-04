/**
 * ViettelDriver: Driver tra cứu & tải PDF Hóa đơn điện tử Viettel (S-Invoice)
 * Cổng tra cứu: https://sinvoice.viettel.vn
 * Hỗ trợ tự động giải Captcha bằng OCR qua CaptchaSolver
 */

import axios, { AxiosInstance } from 'axios';
import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { CaptchaSolver } from '../captcha/CaptchaSolver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';

export class ViettelDriver extends BaseInvoiceProviderDriver {
  readonly name = 'Viettel S-Invoice Driver';
  readonly providerCode = 'VIETTEL';
  readonly metadata: DriverMetadata = {
    name: 'Viettel S-Invoice Driver',
    providerCode: 'VIETTEL',
    description: 'Tra cứu và tải PDF HĐĐT gốc từ cổng Viettel S-Invoice qua Số hóa đơn, Mã số bí mật và OCR Captcha',
    sampleUrl: 'https://sinvoice.viettel.vn/tra-cuu-hoa-don',
    supportsCaptcha: true,
    requiredFields: ['sellerTaxCode', 'invoiceNo', 'secretCode']
  };

  /**
   * Nhận diện hóa đơn Viettel S-Invoice theo đúng thứ tự ưu tiên nghiêm ngặt
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
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C24TGT';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    // Trích xuất Mã bí mật (SecretCode / ReservationCode)
    let secretCode = this.extractCustomField(xmlData, [
      'Mã số bí mật',
      'MaBiMat',
      'Mã bí mật',
      'ReservationCode',
      'SecretCode',
      'MaSoBiMat'
    ]);

    if (!secretCode) {
      secretCode = this.extractXmlTag(xmlData, 'ReservationCode') || this.extractXmlTag(xmlData, 'SecretCode');
    }

    const totalAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTTTBSo') || '0') || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, 'TgTThue') || '0') || 0;

    return {
      provider: this.providerCode,
      providerName: 'Viettel S-Invoice',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      secretCode: secretCode || undefined,
      lookupUrl: 'https://sinvoice.viettel.vn/tra-cuu-hoa-don',
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
   * Tải PDF Hóa đơn gốc Viettel với quy trình giải Captcha tự động bằng OCR
   */
  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi chạy Viettel S-Invoice Driver cho HĐ ${info.invoiceSeries} - ${info.invoiceNo}`, logs);

    if (!info.secretCode) {
      this.createLog('Cảnh báo: Không tìm thấy Mã bí mật (SecretCode) trong XML. Viettel Sinvoice yêu cầu mã bí mật.', logs);
    } else {
      this.createLog(`Mã bí mật Viettel phát hiện: "${info.secretCode}"`, logs);
    }

    const timeoutMs = options?.timeoutMs || 15000;
    let solvedCaptchaCode = '';

    // Tạo axios client với cookie jar giả lập phiên
    let cookieHeader = '';
    const client: AxiosInstance = axios.create({
      baseURL: 'https://sinvoice.viettel.vn',
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://sinvoice.viettel.vn/tra-cuu-hoa-don',
        'Origin': 'https://sinvoice.viettel.vn',
        ...(options?.customHeaders || {})
      }
    });

    try {
      // 1. Tải ảnh Captcha từ Viettel Sinvoice
      this.createLog('Đang kết nối đến cổng Viettel để lấy ảnh Captcha...', logs);
      const captchaEndpoints = [
        '/sinvoice-web/captcha',
        '/sinvoice-web/api/captcha',
        '/captcha'
      ];

      let captchaBuffer: Buffer | null = null;

      for (const ep of captchaEndpoints) {
        try {
          const capRes = await client.get(ep, {
            responseType: 'arraybuffer',
            validateStatus: (s) => s === 200
          });

          const contentType = String(capRes.headers['content-type'] || '');
          if (capRes.data && capRes.data.byteLength > 100) {
            const rawBuf = Buffer.from(capRes.data);
            if (contentType.includes('image') || CaptchaSolver.isValidImageBuffer(rawBuf)) {
              captchaBuffer = rawBuf;
              
              // Lưu Cookie phiên làm việc (JSESSIONID)
              const setCookie = capRes.headers['set-cookie'];
              if (setCookie && Array.isArray(setCookie)) {
                cookieHeader = setCookie.map(c => c.split(';')[0]).join('; ');
              }
              this.createLog(`Đã tải ảnh Captcha (${(captchaBuffer.length / 1024).toFixed(1)} KB), Session Cookie đã được thiết lập`, logs);
              break;
            } else {
              this.createLog(`Cổng Viettel trả về dữ liệu không phải ảnh (${contentType || 'HTML/Text'}), bỏ qua endpoint ${ep}`, logs);
            }
          }
        } catch {
          // Thử endpoint tiếp theo
        }
      }

      // 2. Nếu có Captcha, tiến hành giải mã bằng CaptchaSolver OCR
      if (captchaBuffer) {
        this.createLog('Đang chuyển ảnh Captcha sang module OCR Tesseract để giải mã...', logs);
        try {
          const ocrResult = await CaptchaSolver.solveWithDetails(captchaBuffer, {
            whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            timeoutMs: 8000
          });
          solvedCaptchaCode = ocrResult.code;
          this.createLog(`Giải Captcha Viettel thành công: "${solvedCaptchaCode}" (Độ tin cậy: ${ocrResult.confidence?.toFixed(0)}%)`, logs);
        } catch (ocrErr: any) {
          this.createLog(`Lỗi khi giải Captcha: ${ocrErr.message}`, logs);
        }
      }

      // 3. Đóng gói Payload gửi POST Request tra cứu & tải PDF
      const queryPayload = {
        supplierTaxCode: (info.sellerTaxCode || '').trim(),
        invoiceNo: (info.invoiceNo || '').trim(),
        reservationCode: (info.secretCode || '').trim(),
        secretCode: (info.secretCode || '').trim(),
        templateCode: info.templateCode || '1',
        series: info.invoiceSeries || '',
        captcha: solvedCaptchaCode
      };

      this.createLog(`Gửi yêu cầu tra cứu Viettel với MST: ${queryPayload.supplierTaxCode}, Số HĐ: ${queryPayload.invoiceNo}...`, logs);

      const downloadEndpoints = [
        '/sinvoice-web/public/invoice/view-invoice-pdf',
        '/sinvoice-web/public/invoice/get-invoice-pdf',
        '/sinvoice-web/api/invoice/download-pdf'
      ];

      for (const dep of downloadEndpoints) {
        try {
          const resp = await client.post(dep, queryPayload, {
            responseType: 'arraybuffer',
            headers: {
              ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
            }
          });

          if (resp.status === 200 && resp.data) {
            const buf = Buffer.from(resp.data);
            if (buf.length > 50 && buf.toString('utf-8', 0, 5).startsWith('%PDF')) {
              this.createLog(`Tải thành công file PDF gốc từ Viettel S-Invoice (${(buf.length / 1024).toFixed(1)} KB)`, logs);
              return {
                success: true,
                provider: this.providerCode,
                driverName: this.name,
                pdfBuffer: buf,
                pdfBase64: buf.toString('base64'),
                contentType: 'application/pdf',
                filename: this.buildPdfFilename(info),
                isFallback: false,
                sourceUrl: `https://sinvoice.viettel.vn${dep}`,
                captchaSolved: solvedCaptchaCode,
                executionLogs: logs
              };
            }
          }
        } catch (postErr: any) {
          this.createLog(`Endpoint ${dep} phản hồi cảnh báo: ${postErr.message}`, logs);
        }
      }
    } catch (err: any) {
      this.createLog(`Lỗi xử lý Viettel S-Invoice: ${err.message}`, logs);
    }

    throw new Error(`[ViettelDriver] Không thể tải PDF gốc từ Viettel Sinvoice. Vui lòng kiểm tra Mã bí mật và kết nối.`);
  }
}
