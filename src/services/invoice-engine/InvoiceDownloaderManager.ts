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
import { GenericFallbackDriver } from './drivers/GenericFallbackDriver';

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
   * Tự động quét và chọn Driver phù hợp nhất với dữ liệu XML
   */
  public async selectDriver(xmlContent: string): Promise<InvoiceProviderDriver> {
    for (const driver of this.drivers) {
      try {
        const canHandle = await driver.canHandle(xmlContent);
        if (canHandle) {
          return driver;
        }
      } catch (err) {
        console.warn(`[InvoiceDownloaderManager] Lỗi khi kiểm tra driver ${driver.name}:`, err);
      }
    }

    // Không tìm thấy driver đặc thù, dùng Fallback
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

    // 2. Tự động nhận diện Driver phù hợp
    let selectedDriver: InvoiceProviderDriver = this.fallbackDriver;
    try {
      selectedDriver = await this.selectDriver(xmlContent);
      this.log(`Tự động chọn Driver: [${selectedDriver.name}] (${selectedDriver.providerCode})`, overallLogs);
    } catch (err: any) {
      this.log(`Lỗi khi phát hiện Driver, chuyển sang Fallback: ${err.message}`, overallLogs);
      selectedDriver = this.fallbackDriver;
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
