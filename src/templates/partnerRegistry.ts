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
    name: 'Công ty TNHH MTV Chế Tác và Kinh Doanh Trang sức PNJ',
    shortName: 'Trang Sức PNJ',
    taxCode: '0315018466',
    defaultAddress: 'Số 23 Đường số 14, Phường An Nhơn, Thành Phố Hồ Chí Minh, Việt Nam',
    portalUrl: 'https://inv.4si.vn/tra-cuu-hoa-don',
    providerBrand: '4Si / LCS',
    badge: 'PNJ',
    color: '#d97706',
    description: 'Mẫu hóa đơn bán hàng 7 cột (kèm trọng lượng chi tiết), Logo kim cương PNJ, Cung cấp bởi L.C.S',
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
    id: 'DEFAULT',
    name: 'Mẫu Hóa Đơn Chuẩn Nghị Định 123 (Mặc Định)',
    shortName: 'Mặc định hệ thống',
    taxCode: '',
    portalUrl: '',
    providerBrand: 'Hóa Đơn Điện Tử Chuẩn',
    badge: 'Mặc định',
    color: '#334155',
    description: 'Mẫu hóa đơn tiêu chuẩn áp dụng cho tất cả các đối tác và đơn vị ngoài danh sách đối tác chính',
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
 * Automatically detects whether an invoice belongs to one of the 7 main partners.
 * Falls back to 'DEFAULT' for all other entities.
 */
export function detectPartnerTemplate(invoice: GDTInvoice, rawXml?: string): PartnerInvoiceTemplateId {
  const nbmst = (invoice.nbmst || '').replace(/[^0-9]/g, '');
  const nbten = normalizeStr(invoice.nbten || '');
  const xml = rawXml ? rawXml.toLowerCase() : '';

  // 1. Check Tax Codes (Highest Accuracy)
  if (nbmst === '0318657735') return 'BAO_DUY';
  if (nbmst === '0315018466') return 'PNJ';
  if (nbmst === '0312105174') return 'TAI_TRAM_ANH';
  if (nbmst === '0400557356') return 'XUAN_VINH';
  if (nbmst === '0318391940') return 'KIM_LOAN_TUAN';
  if (nbmst === '0318443500') return 'TKJ';
  if (nbmst === '4000344946') return 'NGHIA_SON';

  // 1b. Nhà cung cấp phần mềm HĐĐT (msttcgp) - áp dụng mẫu tổng quát cho
  // BẤT KỲ người bán nào khác dùng cùng phần mềm, không riêng đối tác đã
  // đặt tên ở trên. Tránh rơi về DEFAULT (mất bố cục đúng) hoặc gán nhầm
  // vào mẫu của 1 công ty cụ thể khác.
  const msttcgp = (invoice.msttcgp || '').replace(/[^0-9]/g, '');
  if (msttcgp === '0302999571') return '4SI'; // Công ty TNHH L.C.S
  if (msttcgp === '0100684378') return 'NGHIA_SON'; // VNPT Invoice (mẫu VNPT tổng quát)

  // 2. Check Seller Names
  if (nbten.includes('baoduy')) return 'BAO_DUY';
  if (nbten.includes('pnj') || (nbten.includes('chetac') && nbten.includes('trangsuc'))) return 'PNJ';
  if (nbten.includes('taitramanh') || nbten.includes('tramanh')) return 'TAI_TRAM_ANH';
  if (nbten.includes('xuanvinh')) return 'XUAN_VINH';
  if (nbten.includes('kimloantuan')) return 'KIM_LOAN_TUAN';
  if (nbten.includes('tkj')) return 'TKJ';
  if (nbten.includes('nghiason')) return 'NGHIA_SON';

  // 3. Check raw XML content if available
  if (xml) {
    if (xml.includes('0318657735') || xml.includes('bảo duy') || xml.includes('bao duy')) return 'BAO_DUY';
    if (xml.includes('0315018466') || xml.includes('4si.vn') || xml.includes('l.c.s') || xml.includes('pnj')) return 'PNJ';
    if (xml.includes('0312105174') || xml.includes('tài trâm anh') || xml.includes('tai tram anh')) return 'TAI_TRAM_ANH';
    if (xml.includes('0400557356') || xml.includes('xuân vinh') || xml.includes('xuan vinh')) return 'XUAN_VINH';
    if (xml.includes('0318391940') || xml.includes('kim loan tuấn') || xml.includes('kim loan tuan')) return 'KIM_LOAN_TUAN';
    if (xml.includes('0318443500') || xml.includes('tkj')) return 'TKJ';
    if (xml.includes('4000344946') || xml.includes('nghĩa sơn') || xml.includes('nghia son')) return 'NGHIA_SON';
  }

  // 4. Default for all entities outside the list
  return 'DEFAULT';
}

export function getPartnerMeta(id: PartnerInvoiceTemplateId): PartnerMeta {
  const found = PARTNER_METAS.find(p => p.id === id);
  if (found) return found;

  return PARTNER_METAS.find(p => p.id === 'DEFAULT')!;
}
