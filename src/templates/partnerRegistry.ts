import { GDTInvoice } from '../types';
import { PartnerInvoiceTemplateId, PartnerMeta } from './types';

export const PARTNER_METAS: PartnerMeta[] = [
  {
    id: 'BAO_DUY',
    name: 'CÔNG TY TNHH THƯƠNG MẠI TRANG SỨC BẢO DUY',
    shortName: 'Trang Sức Bảo Duy',
    taxCode: '0318657735',
    defaultAddress: '324/2 Ấp Chánh 1, Xã Hóc Môn, Thành phố Hồ Chí Minh, Việt Nam',
    portalUrl: 'http://0318657735hd.easyinvoice.com.vn',
    providerBrand: 'Softdreams EasyInvoice',
    badge: 'Bảo Duy',
    color: '#db2777',
    description: 'Mẫu hóa đơn khởi tạo từ máy tính tiền Softdreams EasyInvoice - Viền hồng cánh sen đặc trưng',
    isCustomPartner: true
  },
  {
    id: 'PNJ',
    name: 'Công ty TNHH MTV Chế Tác và Kinh Doanh Trang sức PNJ (LCS Soft)',
    shortName: 'Trang Sức PNJ (Mẫu GDT)',
    taxCode: '0315018466',
    defaultAddress: 'Số 23 Đường số 14, Phường An Nhơn, Thành Phố Hồ Chí Minh, Việt Nam',
    portalUrl: 'https://eip.lcssoft.com.vn/desktop/#/login',
    providerBrand: 'LCS Soft (eip.lcssoft.com.vn)',
    badge: 'PNJ (LCS)',
    color: '#0891b2',
    description: 'Áp dụng mẫu chuẩn Tổng cục Thuế (GDT), tra cứu trực tiếp tại Cổng LCS Soft EIP',
    isCustomPartner: true
  },
  {
    id: 'LCS_SOFT',
    name: 'CÔNG TY TNHH L.C.S (LCS SOFT)',
    shortName: 'LCS Soft EIP',
    taxCode: '0302999571',
    defaultAddress: 'Thành phố Hồ Chí Minh, Việt Nam',
    portalUrl: 'https://eip.lcssoft.com.vn/desktop/#/login',
    providerBrand: 'LCS Soft',
    badge: 'LCS Soft',
    color: '#0891b2',
    description: 'Cổng tra cứu hóa đơn điện tử LCS Soft EIP (eip.lcssoft.com.vn)',
    isCustomPartner: true
  },
  {
    id: 'VNPAY',
    name: 'CÔNG TY CỔ PHẦN GIẢI PHÁP THANH TOÁN VIỆT NAM (VNPAY)',
    shortName: 'VNPAY Invoice',
    taxCode: '0102182292',
    defaultAddress: 'Tầng 8, Số 22 Láng Hạ, Đống Đa, Hà Nội',
    portalUrl: 'https://portal.vnpayinvoice.vn/',
    providerBrand: 'VNPAY Invoice',
    badge: 'VNPAY',
    color: '#0284c7',
    description: 'Cổng tra cứu hóa đơn điện tử VNPAY Invoice (Vietcombank...)',
    isCustomPartner: true
  },
  {
    id: 'FPT',
    name: 'CÔNG TY TNHH HỆ THỐNG THÔNG TIN FPT (FPT IS)',
    shortName: 'FPT Electronic Invoice',
    taxCode: '0104128565',
    defaultAddress: 'Tòa nhà FPT, Phố Duy Tân, Cầu Giấy, Hà Nội',
    portalUrl: 'https://hoadon.ftg.vn/',
    providerBrand: 'FPT Invoice',
    badge: 'FPT',
    color: '#ea580c',
    description: 'Cổng tra cứu hóa đơn điện tử FPT Electronic Invoice',
    isCustomPartner: true
  },
  {
    id: 'TAI_TRAM_ANH',
    name: 'DOANH NGHIỆP TƯ NHÂN GIA CÔNG TRANG SỨC TÀI TRÂM ANH',
    shortName: 'Gia Công Trang Sức Tài Trâm Anh',
    taxCode: '0312105174',
    defaultAddress: '272-274-276-278 Đường 490, ấp 1, Xã Nhuận Đức, Thành phố Hồ Chí Minh, Việt Nam.',
    portalUrl: 'https://www.meinvoice.vn/tra-cuu',
    providerBrand: 'MISA meInvoice',
    badge: 'Tài Trâm Anh',
    color: '#1e40af',
    description: 'Mẫu hóa đơn bán hàng MISA meInvoice, Logo TTJ lồng xoắn, Thủy ấn TTJ chìm toàn trang',
    isCustomPartner: true
  },
  {
    id: 'XUAN_VINH',
    name: 'CÔNG TY TNHH XUÂN VINH',
    shortName: 'Xuân Vinh Computer',
    taxCode: '0400557356',
    defaultAddress: '92-94 Hàm Nghi, Phường Thanh Khê, Thành phố Đà Nẵng, Việt Nam.',
    portalUrl: 'https://www.meinvoice.vn/tra-cuu',
    providerBrand: 'MISA meInvoice',
    badge: 'Xuân Vinh',
    color: '#dc2626',
    description: 'Mẫu hóa đơn GTGT MISA meInvoice 1C26TXV, Viền đỏ kép, Logo công nghệ và Thủy ấn XUÂN VINH',
    isCustomPartner: true
  },
  {
    id: 'KIM_LOAN_TUAN',
    name: 'CÔNG TY TNHH KINH DOANH VÀNG BẠC KIM LOAN TUẤN',
    shortName: 'Vàng Bạc Kim Loan Tuấn',
    taxCode: '0318391940',
    defaultAddress: 'Số 55 - 57 Đường Nghĩa Thục, Phường An Đông, Thành phố Hồ Chí Minh, Việt Nam',
    portalUrl: 'http://0318391940hd.easyinvoice.com.vn',
    providerBrand: 'Softdreams EasyInvoice',
    badge: 'Kim Loan Tuấn',
    color: '#b45309',
    description: 'Mẫu hóa đơn máy tính tiền 7 cột vàng bạc (Số lượng & Trọng lượng chỉ), Hoa cúc vàng kim',
    isCustomPartner: true
  },
  {
    id: 'TKJ',
    name: 'CÔNG TY TNHH TM DV VÀNG BẠC TKJ',
    shortName: 'Vàng Bạc TKJ',
    taxCode: '0318443500',
    defaultAddress: '854-856 Trần Hưng Đạo, Phường An Đông, Thành phố Hồ Chí Minh, Việt Nam',
    portalUrl: 'http://0318443500hd.easyinvoice.com.vn',
    providerBrand: 'Softdreams EasyInvoice',
    badge: 'TKJ',
    color: '#15803d',
    description: 'Mẫu hóa đơn bán hàng máy tính tiền Softdreams, Viền xanh lục hoa văn, Thanh toán đối trừ công nợ',
    isCustomPartner: true
  },
  {
    id: 'NGHIA_SON',
    name: 'CÔNG TY TNHH NGHĨA SƠN',
    shortName: 'Nghĩa Sơn',
    taxCode: '4000344946',
    defaultAddress: '68 Trần Quý Cáp, Phường Tân Thạnh, Thành phố Tam Kỳ, Tỉnh Quảng Nam, Việt Nam',
    portalUrl: 'https://4000344946-tt78.vnpt-invoice.com.vn',
    providerBrand: 'VNPT Invoice',
    badge: 'Nghĩa Sơn',
    color: '#0284c7',
    description: 'Mẫu hóa đơn GTGT VNPT Invoice, 3 ô chữ ký (Người mua, Thuế, Người bán), Thuế suất 10%',
    isCustomPartner: true
  },
  {
    id: 'TAN_THANH_DANH',
    name: 'CÔNG TY TNHH KINH DOANH VÀNG BẠC TÂN THANH DANH',
    shortName: 'Vàng Bạc Tân Thanh Danh',
    taxCode: '0317978711',
    defaultAddress: '25-27 An Dương Vương, Phường An Đông, Thành phố Hồ Chí Minh, Việt Nam',
    portalUrl: 'https://www.meinvoice.vn/tra-cuu',
    providerBrand: 'MISA meInvoice',
    badge: 'Tân Thanh Danh',
    color: '#059669',
    description: 'Mẫu hóa đơn bán hàng 2C26MTD MISA meInvoice - Vàng Bạc Tân Thanh Danh',
    isCustomPartner: true
  },
  {
    id: 'DEFAULT',
    name: 'Mẫu Hóa Đơn Điện Tử Chuẩn Tổng Cục Thuế (GDT)',
    shortName: 'Mẫu Tổng cục Thuế',
    taxCode: '',
    portalUrl: 'https://hoadondientu.gdt.gov.vn',
    providerBrand: 'Tổng cục Thuế (GDT)',
    badge: '🏛️ Tổng cục Thuế',
    color: '#915715',
    description: 'Mẫu thể hiện hóa đơn điện tử chính thức từ Cổng Thông tin HĐĐT Tổng cục Thuế (áp dụng cho hóa đơn chưa nhận diện, 4SI của PNJ, viễn thông, điện lực, thu phí ngân hàng...)',
    isCustomPartner: false
  }
];

/**
 * Remove Vietnamese accents and trim for robust string matching
 */
function normalizeStr(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Automatically detects whether an invoice belongs to one of the main partners.
 * Falls back to 'DEFAULT' (Mẫu chuẩn Tổng cục Thuế) for all un-recognized entities,
 * 4SI / PNJ, telecom, electricity, bank fees...
 */
export function detectPartnerTemplate(invoice: GDTInvoice, rawXml?: string): PartnerInvoiceTemplateId {
  const nbmst = (invoice.nbmst || '').replace(/[^0-9]/g, '');
  const nbten = normalizeStr(invoice.nbten || '');
  const xml = rawXml ? rawXml.toLowerCase() : '';

  // 1. Check Tax Codes (Highest Accuracy)
  if (nbmst === '0318657735') return 'BAO_DUY';
  // PNJ và 4SI: Theo chỉ đạo của người dùng, sử dụng theo mẫu của GDT cung cấp (DEFAULT)
  if (nbmst === '0315018466') return 'DEFAULT';
  if (nbmst === '0312105174') return 'TAI_TRAM_ANH';
  if (nbmst === '0400557356') return 'XUAN_VINH';
  if (nbmst === '0318391940') return 'KIM_LOAN_TUAN';
  if (nbmst === '0318443500') return 'TKJ';
  if (nbmst === '4000344946') return 'NGHIA_SON';
  if (nbmst === '0317978711') return 'TAN_THANH_DANH';

  // 1b. Nhà cung cấp phần mềm HĐĐT (msttcgp)
  const msttcgp = (invoice.msttcgp || '').replace(/[^0-9]/g, '');
  if (msttcgp === '0302999571' || msttcgp === '0315744883') return 'DEFAULT'; // 4SI / LCS -> Dùng mẫu GDT
  if (msttcgp === '0100684378') return 'NGHIA_SON'; // VNPT Invoice (mẫu VNPT Nghĩa Sơn)

  // 2. Check Seller Names
  if (nbten.includes('baoduy')) return 'BAO_DUY';
  if (nbten.includes('pnj') || (nbten.includes('chetac') && nbten.includes('trangsuc'))) return 'DEFAULT'; // PNJ -> Dùng mẫu GDT
  if (nbten.includes('taitramanh') || nbten.includes('tramanh')) return 'TAI_TRAM_ANH';
  if (nbten.includes('xuanvinh')) return 'XUAN_VINH';
  if (nbten.includes('kimloantuan')) return 'KIM_LOAN_TUAN';
  if (nbten.includes('tkj')) return 'TKJ';
  if (nbten.includes('nghiason')) return 'NGHIA_SON';
  if (nbten.includes('tanthanhdanh') || nbten.includes('thanhdanh')) return 'TAN_THANH_DANH';

  // 3. Check raw XML content if available
  if (xml) {
    if (xml.includes('0318657735') || xml.includes('bảo duy') || xml.includes('bao duy')) return 'BAO_DUY';
    if (xml.includes('0315018466') || xml.includes('4si.vn') || xml.includes('l.c.s') || xml.includes('pnj')) return 'DEFAULT'; // 4SI / PNJ -> Dùng mẫu GDT
    if (xml.includes('0312105174') || xml.includes('tài trâm anh') || xml.includes('tai tram anh')) return 'TAI_TRAM_ANH';
    if (xml.includes('0400557356') || xml.includes('xuân vinh') || xml.includes('xuan vinh')) return 'XUAN_VINH';
    if (xml.includes('0318391940') || xml.includes('kim loan tuấn') || xml.includes('kim loan tuan')) return 'KIM_LOAN_TUAN';
    if (xml.includes('0318443500') || xml.includes('tkj')) return 'TKJ';
    if (xml.includes('4000344946') || xml.includes('nghĩa sơn') || xml.includes('nghia son')) return 'NGHIA_SON';
    if (xml.includes('0317978711') || xml.includes('tân thanh danh') || xml.includes('tan thanh danh')) return 'TAN_THANH_DANH';
  }

  // 4. Mặc định: Tất cả các hóa đơn chưa nhận diện, viễn thông, điện lực, phí ngân hàng... đều dùng mẫu Tổng cục Thuế (DEFAULT)
  return 'DEFAULT';
}

export function getPartnerMeta(id: PartnerInvoiceTemplateId): PartnerMeta {
  const found = PARTNER_METAS.find(p => p.id === id);
  if (found) return found;

  return PARTNER_METAS.find(p => p.id === 'DEFAULT')!;
}
