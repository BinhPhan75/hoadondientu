/**
 * InvoiceDownloaderManager: Bộ điều phối trung tâm (Provider Manager / Factory)
 * - Tự động quản lý danh sách các Driver đã đăng ký (MISA, Viettel, 4Si, VNPT, Fallback...)
 * - Tự động nhận diện nhà cung cấp từ XML
 * - Tự động giải Captcha bằng OCR Tesseract khi cần
 * - Tự động kích hoạt GenericFallbackDriver khi gặp lỗi, bảo đảm hệ thống không bao giờ bị gián đoạn
 */

import { 
  InvoiceProviderDriver, 
  ExtractedInvoiceInfo, 
  DownloadResult, 
  DownloadOptions,
  DriverMetadata
} from './types';
import { CaptchaSolver } from './captcha/CaptchaSolver';
import { MisaDriver } from './drivers/MisaDriver';
import { ViettelDriver } from './drivers/ViettelDriver';
import { FourSiDriver } from './drivers/FourSiDriver';
import { VnptDriver } from './drivers/VnptDriver';
import { EasyInvoiceDriver } from './drivers/EasyInvoiceDriver';
import { BkavDriver } from './drivers/BkavDriver';
import { ThaiSonDriver } from './drivers/ThaiSonDriver';
import { CyberBillDriver } from './drivers/CyberBillDriver';
import { GenericFallbackDriver } from './drivers/GenericFallbackDriver';
import { detectProvider, detectProviderWithDetails, DetectedInvoiceProvider, DetectionResultDetails } from './providerDetector';

export class InvoiceDownloaderManager {
  private static instance: InvoiceDownloaderManager | null = null;
  private drivers: InvoiceProviderDriver[] = [];
  private fallbackDriver: GenericFallbackDriver;

  /**
   * Khởi tạo Singleton với các Driver mặc định
   */
  constructor() {
    this.fallbackDriver = new GenericFallbackDriver();

    // Đăng ký các Driver tiêu chuẩn (theo thứ tự ưu tiên kiểm tra)
    this.registerDriver(new MisaDriver());
    this.registerDriver(new ViettelDriver());
    this.registerDriver(new FourSiDriver());
    this.registerDriver(new VnptDriver());
    this.registerDriver(new EasyInvoiceDriver());
    this.registerDriver(new BkavDriver());
    this.registerDriver(new ThaiSonDriver());
    this.registerDriver(new CyberBillDriver());
  }

  /**
   * Lấy thể hiện duy nhất của Manager
   */
  public static getInstance(): InvoiceDownloaderManager {
    if (!this.instance) {
      this.instance = new InvoiceDownloaderManager();
    }
    return this.instance;
  }

  /**
   * Nhận diện nhà cung cấp từ chuỗi XML theo quy tắc ưu tiên nghiêm ngặt
   */
  public detectProvider(xmlContent: string): DetectedInvoiceProvider {
    return detectProvider(xmlContent);
  }

  /**
   * Nhận diện chi tiết kèm cấp độ ưu tiên và lý do
   */
  public detectProviderDetails(xmlContent: string): DetectionResultDetails {
    return detectProviderWithDetails(xmlContent);
  }

  /**
   * Đăng ký thêm một Driver mới vào hệ thống (Open-Closed Principle)
   */
  public registerDriver(driver: InvoiceProviderDriver, atStart = false): void {
    // Tránh đăng ký trùng
    const exists = this.drivers.some(d => d.providerCode === driver.providerCode);
    if (!exists) {
      if (atStart) {
        this.drivers.unshift(driver);
      } else {
        this.drivers.push(driver);
      }
      console.log(`[InvoiceDownloaderManager] Đã đăng ký Driver: "${driver.name}" (${driver.providerCode})`);
    }
  }

  /**
   * Lấy danh sách các Driver đã đăng ký
   */
  public getRegisteredDrivers(): DriverMetadata[] {
    const list = this.drivers.map(d => d.metadata);
    list.push(this.fallbackDriver.metadata);
    return list;
  }

  /**
   * Tự động quét và chọn Driver phù hợp nhất theo thứ tự ưu tiên nghiêm ngặt:
   * - Nếu detectProvider(xmlContent) trả về 'UNKNOWN' -> Trả về ngay fallbackDriver (GenericFallbackDriver)
   *   (Tuyệt đối không đoán mò thành Viettel hay MISA)
   * - Nếu khớp nhà cung cấp hợp lệ ('MISA', 'VIETTEL', 'VNPT', '4SI', 'EASYINVOICE', 'BKAV') -> Chọn Driver tương ứng
   */
  public async selectDriver(xmlContent: string): Promise<InvoiceProviderDriver> {
    const detected = detectProvider(xmlContent);

    // Fallback an toàn: Nếu là UNKNOWN, không đoán mò mà chuyển thẳng sang GenericFallbackDriver
    if (detected === 'UNKNOWN') {
      return this.fallbackDriver;
    }

    // Tìm driver đã đăng ký tương ứng với nhà cung cấp được nhận diện chính xác
    const matched = this.drivers.find(d => d.providerCode === detected);
    if (matched) {
      return matched;
    }

    // Nếu đã nhận diện nhưng driver đặc thù chưa hỗ trợ tải trực tiếp, dùng Fallback chuẩn NĐ 123
    return this.fallbackDriver;
  }

  /**
   * Phân tích và trích xuất thông tin tổng quát từ XML
   */
  public async extractInfo(xmlContent: string): Promise<ExtractedInvoiceInfo> {
    const driver = await this.selectDriver(xmlContent);
    return driver.extractInfo(xmlContent);
  }

  /**
   * HÀM ĐIỀU PHỐI CHÍNH: Tải PDF Hóa đơn gốc tự động
   * @param xmlContent Chuỗi nội dung XML hóa đơn điện tử
   * @param options Tùy chọn tải (timeout, ép fallback, v.v.)
   * @returns Kết quả tải kèm Buffer PDF và nhật ký thực thi
   */
  public async downloadInvoicePdf(
    xmlContent: string, 
    options?: DownloadOptions
  ): Promise<DownloadResult> {
    const overallLogs: string[] = [];
    const startTime = Date.now();

    this.log(`[BẮT ĐẦU] Tiếp nhận yêu cầu tải PDF cho dữ liệu XML (${xmlContent.length} ký tự)`, overallLogs);

    if (!xmlContent || typeof xmlContent !== 'string') {
      throw new Error('[InvoiceDownloaderManager] Nội dung XML rỗng hoặc không đúng định dạng.');
    }

    // 1. Trường hợp người dùng yêu cầu ép dùng GenericFallbackDriver
    if (options?.forceFallback) {
      this.log('Người dùng yêu cầu ép sử dụng GenericFallbackDriver.', overallLogs);
      const fallbackInfo = await this.fallbackDriver.extractInfo(xmlContent);
      const res = await this.fallbackDriver.fetchPdf(fallbackInfo, options);
      res.executionLogs = overallLogs.concat(res.executionLogs);
      return res;
    }

    // 2. Tự động nhận diện Driver phù hợp HOẶC áp dụng Driver do người dùng chỉ định
    let selectedDriver: InvoiceProviderDriver = this.fallbackDriver;
    const isExplicitOverride = Boolean(options?.overrideProvider && options.overrideProvider !== 'AUTO');

    if (isExplicitOverride) {
      if (options!.overrideProvider === 'GENERIC' || options!.overrideProvider === 'FALLBACK') {
        selectedDriver = this.fallbackDriver;
        this.log(`Áp dụng Nhà cung cấp do Người dùng chỉ định: [${this.fallbackDriver.name}] (Safeguard Fallback)`, overallLogs);
      } else {
        const manual = this.drivers.find(d => d.providerCode.toUpperCase() === options!.overrideProvider?.toUpperCase());
        if (manual) {
          selectedDriver = manual;
          this.log(`Áp dụng Nhà cung cấp do Người dùng chỉ định: [${selectedDriver.name}] (${selectedDriver.providerCode})`, overallLogs);
        } else {
          this.log(`Không tìm thấy Driver tương ứng mã [${options!.overrideProvider}], chuyển về Generic Fallback`, overallLogs);
          selectedDriver = this.fallbackDriver;
        }
      }
    } else if (!options?.forceFallback) {
      try {
        selectedDriver = await this.selectDriver(xmlContent);
        this.log(`Tự động chọn Driver: [${selectedDriver.name}] (${selectedDriver.providerCode})`, overallLogs);
      } catch (err: any) {
        this.log(`Lỗi khi phát hiện Driver, chuyển sang Fallback: ${err.message}`, overallLogs);
        selectedDriver = this.fallbackDriver;
      }
    }

    // 3. Trích xuất thông tin cần thiết từ XML
    let invoiceInfo: ExtractedInvoiceInfo;
    try {
      invoiceInfo = await selectedDriver.extractInfo(xmlContent);
      this.log(`Trích xuất metadata: Bên bán "${invoiceInfo.sellerName || invoiceInfo.sellerTaxCode}", HĐ: ${invoiceInfo.invoiceSeries}-${invoiceInfo.invoiceNo}`, overallLogs);
    } catch (extractErr: any) {
      this.log(`Lỗi trích xuất metadata: ${extractErr.message}. Sử dụng Fallback parser.`, overallLogs);
      invoiceInfo = await this.fallbackDriver.extractInfo(xmlContent);
    }

    // 3.1 Hợp nhất thông tin tùy chỉnh từ người dùng (customInfo: lookupCode, secretCode, lookupUrl, sellerTaxCode)
    if (options?.customInfo) {
      if (options.customInfo.lookupCode) {
        invoiceInfo.lookupCode = options.customInfo.lookupCode;
        this.log(`Áp dụng Mã tra cứu do người dùng cung cấp: "${invoiceInfo.lookupCode}"`, overallLogs);
      }
      if (options.customInfo.secretCode) {
        invoiceInfo.secretCode = options.customInfo.secretCode;
        this.log(`Áp dụng Mã bí mật do người dùng cung cấp: "${invoiceInfo.secretCode}"`, overallLogs);
      }
      if (options.customInfo.lookupUrl) {
        invoiceInfo.lookupUrl = options.customInfo.lookupUrl;
        this.log(`Áp dụng Cổng tra cứu tùy chỉnh: "${invoiceInfo.lookupUrl}"`, overallLogs);
      }
      if (options.customInfo.sellerTaxCode) {
        invoiceInfo.sellerTaxCode = options.customInfo.sellerTaxCode;
      }
    }

    // 4. Thực thi tải PDF qua Driver được chọn
    if (selectedDriver.providerCode !== 'GENERIC') {
      try {
        this.log(`Đang thực thi crawl từ server nhà cung cấp [${selectedDriver.providerCode}]...`, overallLogs);
        const result = await selectedDriver.fetchPdf(invoiceInfo, options);
        
        result.executionLogs = overallLogs.concat(result.executionLogs);
        this.log(`[HOÀN TẤT] Tải PDF gốc thành công trong ${Date.now() - startTime}ms`, result.executionLogs);
        return result;
      } catch (crawlError: any) {
        this.log(`[CẢNH BÁO CRAWL THẤT BẠI]: ${crawlError.message}`, overallLogs);
        this.log(`TỰ ĐỘNG CHUYỂN SANG GENERIC FALLBACK DRIVER ĐỂ ĐẢM BẢO HỆ THỐNG KHÔNG BỊ GIÁN ĐOẠN...`, overallLogs);
      }
    }

    // 5. KÍCH HOẠT FALLBACK SAFEGUARD: Render bản thể hiện nội bộ đạt chuẩn pháp lý
    try {
      const fallbackResult = await this.fallbackDriver.fetchPdf(invoiceInfo, options);
      fallbackResult.executionLogs = overallLogs.concat(fallbackResult.executionLogs);
      this.log(`[SAFEGUARD HOÀN TẤT] Đã tạo bản thể hiện nội bộ thành công trong ${Date.now() - startTime}ms`, fallbackResult.executionLogs);
      return fallbackResult;
    } catch (fallbackError: any) {
      // Trường hợp cực kỳ hi hữu
      throw new Error(`Không thể khởi tạo bản PDF dự phòng: ${fallbackError.message}`);
    }
  }

  /**
   * Helper gọi giải Captcha độc lập
   */
  public async solveCaptcha(imageInput: Buffer | string): Promise<string> {
    return CaptchaSolver.solve(imageInput);
  }

  private log(msg: string, logs: string[]): void {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    const entry = `[${timestamp}] [Manager] ${msg}`;
    logs.push(entry);
    console.log(entry);
  }
}
