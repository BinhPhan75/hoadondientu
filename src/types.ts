export interface GDTAccountConfig {
  taxCode: string; // Mã số thuế (MST)
  password?: string; // Mật khẩu do CQT cấp
  taxpayerName?: string; // Tên người nộp thuế
  address?: string; // Địa chỉ doanh nghiệp
  province?: string;
  rememberMe: boolean;
  autoSaveSession: boolean;
  useHeadlessBrowser?: boolean;
}

export interface InvoiceItem {
  id?: string;
  lineNo: number; // STT
  itemName: string; // Tên hàng hóa, dịch vụ
  unit: string; // Đơn vị tính (kg, chiếc, gói, tháng, giờ, v.v.)
  quantity: number; // Số lượng
  unitPrice: number; // Đơn giá
  amount: number; // Thành tiền chưa thuế
  taxRate: string; // Thuế suất (0%, 5%, 8%, 10%, KCT - Không chịu thuế, KKKNT - Không kê khai nộp thuế)
  taxRatePercent: number; // 0, 5, 8, 10
  taxAmount: number; // Tiền thuế GTGT
  totalAmount: number; // Tổng cộng thành tiền sau thuế
}

export interface GDTInvoice {
  id: string; // Unique identifier or CQT ID
  khmshdon: string; // Ký hiệu mẫu số hóa đơn (ví dụ: '1' - Hóa đơn GTGT, '2' - Hóa đơn bán hàng)
  khhdon: string; // Ký hiệu hóa đơn (ví dụ: '1C24TGT', '1C24TAA', '2K24MYY')
  shdon: string; // Số hóa đơn (ví dụ: '0000123', '0004589')
  tdlap: string; // Thời điểm lập hóa đơn (YYYY-MM-DDTHH:mm:ss)
  
  // Thông tin bên bán (Seller)
  nbmst: string; // MST bên bán
  nbten: string; // Tên bên bán
  nbdchi: string; // Địa chỉ bên bán
  nbsdt?: string; // SĐT bên bán
  nbemail?: string; // Email bên bán
  nbstk?: string; // Số tài khoản bên bán
  nbnhang?: string; // Ngân hàng bên bán

  // Thông tin bên mua (Buyer)
  nmmst: string; // MST bên mua
  nmten: string; // Tên bên mua
  nmdchi: string; // Địa chỉ bên mua
  nmsdt?: string;
  nmemail?: string;
  nmstk?: string;
  nmnhang?: string;

  // Giá trị tiền & Thuế
  tgtcthue: number; // Tổng tiền chưa thuế (VND)
  tgtthue: number; // Tiền thuế GTGT (VND)
  tgtttbso: number; // Tổng tiền thanh toán bằng số (VND)
  tgtttbchu: string; // Tổng tiền thanh toán bằng chữ
  htttoan?: string; // Hình thức thanh toán: TM/CK (Tiền mặt / Chuyển khoản)
  dvtte?: string; // Đơn vị tiền tệ (VND, USD)
  tygia?: number; // Tỷ giá (mặc định 1)

  // Trạng thái hóa đơn & Cơ quan thuế
  tthdon: number; // 1: Mới, 2: Thay thế, 3: Điều chỉnh, 4: Hủy, 5: Bị thay thế, 6: Bị điều chỉnh
  tthdonLabel?: string;
  ttxly: number; // 1: Đã cấp mã CQT, 2: Không mã, 3: Lỗi mã, 4: Đã tiếp nhận
  ttxlyLabel?: string;
  mhdon?: string; // Mã cơ quan thuế cấp (ví dụ: 00E9C762DA374972B...)
  hsgcma: boolean; // Có mã của CQT hay không
  loaiHdon: 'purchase' | 'sold'; // Mua vào hoặc Bán ra
  
  // Chữ ký số
  hasDigitalSignature?: boolean;
  signerName?: string;
  signedDate?: string;
  caProvider?: string; // VNPT, Viettel, MISA, BKAV, FPT...

  // Hàng hóa chi tiết
  items: InvoiceItem[];

  // Dữ liệu XML gốc
  rawXml?: string;
}

export interface FilterParams {
  invoiceType: 'purchase' | 'sold' | 'both';
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  status: string; // 'all' | '1' | '2' | '3' | '4'
  cqtCodeStatus: 'all' | 'with_code' | 'without_code';
  sellerTaxCode: string;
  buyerTaxCode: string;
  searchKeyword: string;
  taxRateFilter: string; // 'all' | '0%' | '5%' | '8%' | '10%' | 'kct'
  minAmount?: number;
  maxAmount?: number;
}

export interface BatchDownloadConfig {
  includeXml: boolean;
  includePdf: boolean;
  includeExcel: boolean;
  folderStructure: 'flat' | 'by_month' | 'by_seller' | 'by_tax_rate';
  namingConvention: 'cqt_standard' | 'readable_seller_no' | 'date_mst_no';
  selectedInvoiceIds: string[];
}

export interface SeleniumLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'step';
  message: string;
  stepName?: string;
  progress?: number; // 0 - 100
}

export interface GDTConnectionStatus {
  isConnected: boolean;
  isDemoMode: boolean;
  taxCode: string | null;
  taxpayerName: string | null;
  tokenExpire?: string;
  lastSyncTime?: string;
  totalInvoicesCount?: number;
}
