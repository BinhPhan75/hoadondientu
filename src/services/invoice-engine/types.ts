/**
 * Types & Interfaces for Vietnamese E-Invoice Downloader System
 * Architecture: Adapter Pattern Driver Engine + Captcha OCR Solver
 */

export interface ExtractedInvoiceInfo {
  provider: string; // 'MISA' | 'VIETTEL' | '4SI' | 'VNPT' | 'EASYINVOICE' | 'GENERIC' | string
  providerName?: string;
  sellerTaxCode: string; // Mã số thuế bên bán
  sellerName?: string; // Tên bên bán
  buyerTaxCode?: string; // Mã số thuế bên mua
  buyerName?: string; // Tên bên mua
  invoiceNo: string; // Số hóa đơn (SHDon)
  invoiceSeries: string; // Ký hiệu hóa đơn (KHHDon)
  templateCode: string; // Ký hiệu mẫu số (KHMSHDon - ví dụ: 1, 2)
  invoiceDate: string; // Ngày lập hóa đơn (NLap)
  lookupCode?: string; // Mã tra cứu hóa đơn (MTCuu / MaTraCuu)
  secretCode?: string; // Mã số bí mật (Viettel Sinvoice / Reservation code)
  lookupUrl?: string; // Đường dẫn tra cứu của bên bán
  cqtCode?: string; // Mã của Cơ quan thuế (MCCQT)
  totalAmount?: number; // Tổng tiền thanh toán
  totalTaxAmount?: number; // Tiền thuế GTGT
  currency?: string; // Đơn vị tiền tệ (VND)
  rawXml: string; // Chuỗi XML gốc
  additionalData?: Record<string, any>; // Dữ liệu bổ sung tùy driver
}

export interface DownloadResult {
  success: boolean;
  provider: string; // Nhà cung cấp phát hiện
  driverName: string; // Tên Driver xử lý
  pdfBuffer: Buffer; // Dữ liệu PDF dạng Buffer
  pdfBase64: string; // Dữ liệu PDF dạng Base64
  contentType: string; // 'application/pdf' | 'text/html'
  filename: string; // Tên file đề xuất
  isFallback: boolean; // True nếu chạy qua GenericFallbackDriver
  sourceUrl?: string; // URL tải thực tế
  captchaSolved?: string; // Mã Captcha đã giải (nếu có)
  executionLogs: string[]; // Nhật ký từng bước thực thi
  error?: string; // Thông báo lỗi nếu có
}

export interface DownloadOptions {
  timeoutMs?: number; // Thời gian chờ tối đa (ms)
  maxRetries?: number; // Số lần thử lại
  forceFallback?: boolean; // Ép dùng GenericFallbackDriver
  ocrLanguage?: string; // Ngôn ngữ OCR (mặc định 'eng')
  customHeaders?: Record<string, string>; // Headers bổ sung khi crawl
  overrideProvider?: string; // Ép dùng một Provider Driver cụ thể ('MISA' | 'VIETTEL' | 'VNPT' | '4SI' | 'EASYINVOICE' | 'BKAV' | 'THAISON' | 'CYBERBILL' | 'GENERIC' | string)
  customInfo?: Partial<ExtractedInvoiceInfo>; // Thông tin tùy chỉnh do người dùng nhập (lookupCode, secretCode, lookupUrl, sellerTaxCode, v.v.)
}

export interface CaptchaSolveOptions {
  whitelist?: string; // Ký tự cho phép (mặc định: A-Z0-9)
  timeoutMs?: number; // Timeout OCR
  preprocess?: boolean; // Tiền xử lý ảnh
  lang?: string; // 'eng' | 'vie'
}

export interface CaptchaSolveResult {
  code: string;
  confidence?: number;
  engine: 'tesseract' | 'gemini' | 'regex';
  processingTimeMs: number;
}

export interface DriverMetadata {
  name: string;
  providerCode: string;
  description: string;
  sampleUrl?: string;
  supportsCaptcha: boolean;
  requiredFields: string[];
}

export interface InvoiceProviderDriver {
  readonly name: string;
  readonly providerCode: string;
  readonly metadata: DriverMetadata;

  /**
   * Kiểm tra xem Driver này có thể xử lý dữ liệu XML được cung cấp hay không.
   */
  canHandle(xmlData: string | ExtractedInvoiceInfo): Promise<boolean> | boolean;

  /**
   * Trích xuất thông tin cần thiết (Mã tra cứu, Mã bí mật, MST, Số HĐ...) từ dữ liệu XML.
   */
  extractInfo(xmlData: string): Promise<ExtractedInvoiceInfo> | ExtractedInvoiceInfo;

  /**
   * Thực hiện tra cứu và tải file PDF Hóa đơn gốc từ server của nhà cung cấp.
   */
  fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult>;
}
