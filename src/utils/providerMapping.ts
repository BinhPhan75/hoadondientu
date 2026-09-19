import { GDTInvoice } from '../types';
import { detectProvider } from '../services/invoice-engine/providerDetector';

export interface InvoiceProviderInfo {
  mst: string;
  name: string;
  fullDisplay: string;
  portalUrl: string;
  lookupCode: string;
  shortBrand: string;
}

export const KNOWN_SOLUTION_PROVIDERS: Record<string, { name: string; defaultPortalUrl: string; shortBrand: string }> = {
  // 1. LCS Soft (PNJ)
  '0302999571': {
    name: 'Công ty TNHH L.C.S',
    defaultPortalUrl: 'https://eip.lcssoft.com.vn/desktop/#/login',
    shortBrand: 'LCS Soft'
  },
  // 2. VNPAY Invoice (Vietcombank)
  '0102182292': {
    name: 'Công ty Cổ phần giải pháp thanh toán Việt Nam',
    defaultPortalUrl: 'https://portal.vnpayinvoice.vn/',
    shortBrand: 'VNPAY'
  },
  // 3. VNPT Invoice
  '0100684378': {
    name: 'Tập Đoàn Bưu chính viễn thông Việt Nam',
    defaultPortalUrl: 'https://portaltool-miennam.vnpt-invoice.com.vn',
    shortBrand: 'VNPT'
  },
  // 4. FPT Information System
  '0104128565': {
    name: 'Công ty TNHH Hệ thống thông tin FPT',
    defaultPortalUrl: 'https://hoadon.ftg.vn/',
    shortBrand: 'FPT'
  },
  // 5. Viettel
  '0100109106': {
    name: 'Tập đoàn Công nghiệp - Viễn thông quân đội',
    defaultPortalUrl: 'https://vinvoice.viettel.vn/utilities/invoice-search',
    shortBrand: 'Viettel'
  },
  // 6. MISA
  '0101243150': {
    name: 'Công ty Cổ phần MISA',
    defaultPortalUrl: 'https://www.meinvoice.vn/tra-cuu',
    shortBrand: 'MISA'
  },
  // 7. 4Si
  '0315744883': {
    name: 'Công ty Cổ phần 4Si',
    defaultPortalUrl: 'https://inv.4si.vn/tra-cuu-hoa-don',
    shortBrand: '4Si'
  },
  // 8. Softdreams EasyInvoice
  '0105987432': {
    name: 'Công ty Cổ phần Đầu tư Công nghệ và Thương mại Softdreams',
    defaultPortalUrl: 'https://easyinvoice.vn',
    shortBrand: 'EasyInvoice'
  },
  // 9. Bkav eHoadon
  '0101360697': {
    name: 'Công ty Cổ phần Bkav',
    defaultPortalUrl: 'https://ehoadon.bkav.com/tra-cuu',
    shortBrand: 'Bkav'
  },
  // 10. Thái Sơn
  '0101300842': {
    name: 'Công ty TNHH Phát triển Công nghệ Thái Sơn',
    defaultPortalUrl: 'https://einvoice.vn/tra-cuu',
    shortBrand: 'Thái Sơn'
  },
  // 11. CyberLotus
  '0107871301': {
    name: 'Công ty Cổ phần CyberLotus',
    defaultPortalUrl: 'https://cyberbill.vn',
    shortBrand: 'CyberBill'
  }
};

/**
 * Trích xuất và định dạng thông tin Nhà cung cấp HĐĐT (MST, Tên tổ chức giải pháp, Cổng tra cứu, Mã tra cứu)
 * Chuẩn định dạng tương tự Cổng taihoadon.online
 */
export function getInvoiceProviderInfo(inv: Partial<GDTInvoice>): InvoiceProviderInfo {
  const msttcgp = (inv.msttcgp || '').trim();
  const tentcgp = (inv.tentcgp || '').trim();
  const nbmst = (inv.nbmst || '').trim();
  const nbten = (inv.nbten || '').toUpperCase();
  const provider = (inv.provider || '').toUpperCase();
  const rawLookupUrl = (inv.lookupUrl || '').trim();
  const isViettel = msttcgp.replace(/[^0-9]/g, '') === '0100109106' || provider === 'VIETTEL';
  const rawLookupCode = (isViettel ? inv.lookupCode : (inv.lookupCode || inv.mhdon))?.trim() || '';

  // 1. LCS Soft (PNJ: 0315018466 hoặc MST TCGP: 0302999571 hoặc domain eip.lcssoft.com.vn)
  if (
    msttcgp === '0302999571' ||
    nbmst === '0315018466' ||
    provider === 'LCS' ||
    tentcgp.includes('L.C.S') ||
    tentcgp.includes('LCSSOFT') ||
    rawLookupUrl.includes('lcssoft') ||
    nbten.includes('TRANG SỨC PNJ') ||
    nbten.includes('TRANG SUC PNJ')
  ) {
    const portalUrl = rawLookupUrl && !rawLookupUrl.includes('4si.vn')
      ? rawLookupUrl
      : 'https://eip.lcssoft.com.vn/desktop/#/login';
    // Mã tra cứu của LCS chính là mã CQT cấp (mhdon chuỗi hex 32 ký tự) hoặc lookupCode
    const lookupCode = inv.lookupCode || inv.mhdon || '';
    return {
      mst: '0302999571',
      name: 'Công ty TNHH L.C.S',
      fullDisplay: '0302999571 - Công ty TNHH L.C.S',
      portalUrl,
      lookupCode,
      shortBrand: 'LCS Soft'
    };
  }

  // 2. VNPAY Invoice (Vietcombank: 0100112437 hoặc MST TCGP: 0102182292)
  if (
    msttcgp === '0102182292' ||
    provider === 'VNPAY' ||
    nbmst === '0100112437' ||
    tentcgp.includes('VNPAY') ||
    tentcgp.includes('THANH TOÁN VIỆT NAM') ||
    tentcgp.includes('THANH TOAN VIET NAM') ||
    rawLookupUrl.includes('vnpayinvoice') ||
    nbten.includes('VIETCOMBANK')
  ) {
    return {
      mst: '0102182292',
      name: 'Công ty Cổ phần giải pháp thanh toán Việt Nam',
      fullDisplay: '0102182292 - Công ty Cổ phần giải pháp thanh toán Việt Nam',
      portalUrl: rawLookupUrl || 'https://portal.vnpayinvoice.vn/',
      lookupCode: rawLookupCode || 'Vietcombank',
      shortBrand: 'VNPAY'
    };
  }

  // 3. VNPT Invoice (Nghĩa Sơn: 4000344946 hoặc MST TCGP: 0100684378)
  if (
    msttcgp === '0100684378' ||
    provider === 'VNPT' ||
    nbmst === '4000344946' ||
    nbmst === '0400392256' ||
    tentcgp.includes('VNPT') ||
    rawLookupUrl.includes('vnpt-invoice') ||
    rawLookupUrl.includes('portaltool-miennam') ||
    nbten.includes('NGHĨA SƠN') ||
    nbten.includes('NGHIA SON')
  ) {
    const portalUrl = rawLookupUrl || (nbmst ? `https://${nbmst}-tt78.vnpt-invoice.com.vn` : 'https://portaltool-miennam.vnpt-invoice.com.vn');
    return {
      mst: '0100684378',
      name: 'Tập Đoàn Bưu chính viễn thông Việt Nam',
      fullDisplay: '0100684378 - Tập Đoàn Bưu chính viễn thông Việt Nam',
      portalUrl,
      lookupCode: rawLookupCode || inv.mhdon || '',
      shortBrand: 'VNPT'
    };
  }

  // 4. FPT Information System (MST TCGP: 0104128565)
  if (
    msttcgp === '0104128565' ||
    provider === 'FPT' ||
    tentcgp.includes('FPT') ||
    rawLookupUrl.includes('ftg.vn') ||
    rawLookupUrl.includes('fpt.com.vn')
  ) {
    return {
      mst: '0104128565',
      name: 'Công ty TNHH Hệ thống thông tin FPT',
      fullDisplay: '0104128565 - Công ty TNHH Hệ thống thông tin FPT',
      portalUrl: rawLookupUrl || 'https://hoadon.ftg.vn/',
      lookupCode: rawLookupCode || '',
      shortBrand: 'FPT'
    };
  }

  // 5. Viettel (MST TCGP: 0100109106)
  if (
    msttcgp === '0100109106' ||
    provider === 'VIETTEL' ||
    tentcgp.includes('VIETTEL') ||
    rawLookupUrl.includes('viettel') ||
    rawLookupUrl.includes('sinvoice')
  ) {
    return {
      mst: '0100109106',
      name: 'Tập đoàn Công nghiệp - Viễn thông quân đội',
      fullDisplay: '0100109106 - Tập đoàn Công nghiệp - Viễn thông quân đội',
      portalUrl: rawLookupUrl || 'https://vinvoice.viettel.vn/utilities/invoice-search',
      lookupCode: rawLookupCode || '',
      shortBrand: 'Viettel'
    };
  }

  // 6. MISA (MST TCGP: 0101243150, Tân Thanh Danh: 0317978711, Tài Trâm Anh: 0312105174, Xuân Vinh: 0400557356)
  if (
    msttcgp === '0101243150' ||
    provider === 'MISA' ||
    tentcgp.includes('MISA') ||
    rawLookupUrl.includes('meinvoice') ||
    nbmst === '0317978711' ||
    nbmst === '0312105174' ||
    nbmst === '0400557356' ||
    nbten.includes('TÂN THANH DANH') ||
    nbten.includes('TÀI TRÂM ANH') ||
    nbten.includes('XUÂN VINH')
  ) {
    return {
      mst: '0101243150',
      name: 'Công ty Cổ phần MISA',
      fullDisplay: '0101243150 - Công ty Cổ phần MISA',
      portalUrl: 'https://www.meinvoice.vn/tra-cuu',
      lookupCode: rawLookupCode || '',
      shortBrand: 'MISA'
    };
  }

  // 7. 4Si
  if (msttcgp === '0315744883' || provider === '4SI' || rawLookupUrl.includes('4si.vn')) {
    return {
      mst: '0315744883',
      name: 'Công ty Cổ phần 4Si',
      fullDisplay: '0315744883 - Công ty Cổ phần 4Si',
      portalUrl: 'https://inv.4si.vn/tra-cuu-hoa-don',
      lookupCode: rawLookupCode || '',
      shortBrand: '4Si'
    };
  }

  // 8. Softdreams EasyInvoice
  if (msttcgp === '0105987432' || provider === 'EASYINVOICE' || rawLookupUrl.includes('easyinvoice')) {
    return {
      mst: '0105987432',
      name: 'Công ty Cổ phần Đầu tư Công nghệ và Thương mại Softdreams',
      fullDisplay: '0105987432 - Softdreams EasyInvoice',
      portalUrl: rawLookupUrl || 'https://easyinvoice.vn',
      lookupCode: rawLookupCode || '',
      shortBrand: 'EasyInvoice'
    };
  }

  // 9. Bkav eHoadon
  if (msttcgp === '0101360697' || provider === 'BKAV' || rawLookupUrl.includes('bkav') || rawLookupUrl.includes('ehoadon')) {
    return {
      mst: '0101360697',
      name: 'Công ty Cổ phần Bkav',
      fullDisplay: '0101360697 - Công ty Cổ phần Bkav',
      portalUrl: rawLookupUrl || 'https://ehoadon.bkav.com/tra-cuu',
      lookupCode: rawLookupCode || '',
      shortBrand: 'Bkav'
    };
  }

  // 10. Check known registry by msttcgp
  if (msttcgp && KNOWN_SOLUTION_PROVIDERS[msttcgp]) {
    const known = KNOWN_SOLUTION_PROVIDERS[msttcgp];
    return {
      mst: msttcgp,
      name: known.name,
      fullDisplay: `${msttcgp} - ${known.name}`,
      portalUrl: rawLookupUrl || known.defaultPortalUrl,
      lookupCode: rawLookupCode || '',
      shortBrand: known.shortBrand
    };
  }

  // Fallback if msttcgp exists but name not mapped
  if (msttcgp) {
    const name = tentcgp || 'Nhà cung cấp giải pháp HĐĐT';
    return {
      mst: msttcgp,
      name,
      fullDisplay: `${msttcgp} - ${name}`,
      portalUrl: rawLookupUrl || 'https://hoadondientu.gdt.gov.vn',
      lookupCode: rawLookupCode || '',
      shortBrand: 'HĐĐT'
    };
  }

  // Mặc định Cổng Tổng cục Thuế
  return {
    mst: '',
    name: 'Tổng cục Thuế (GDT)',
    fullDisplay: 'Tổng cục Thuế (hoadondientu.gdt.gov.vn)',
    portalUrl: rawLookupUrl || 'https://hoadondientu.gdt.gov.vn',
    lookupCode: rawLookupCode || '',
    shortBrand: 'GDT'
  };
}

/**
 * Tạo link tra cứu hóa đơn trực tiếp có kèm tham số hoặc mở cổng tra cứu
 */
export function buildDirectLookupUrl(
  portalUrl?: string,
  lookupCode?: string,
  provider?: string,
  sellerTaxCode?: string
): string {
  const info = getInvoiceProviderInfo({
    lookupUrl: portalUrl,
    lookupCode,
    provider,
    nbmst: sellerTaxCode
  });

  const code = (lookupCode || info.lookupCode || '').trim();

  // MISA: thêm tham số fkey
  if (info.shortBrand === 'MISA' && code) {
    return `https://www.meinvoice.vn/tra-cuu?fkey=${encodeURIComponent(code)}`;
  }

  // VNPAY: thêm tham số lookupCode & taxCode để tự động điền form
  if (info.shortBrand === 'VNPAY') {
    const params = new URLSearchParams();
    if (code && code !== 'Vietcombank') params.set('lookupCode', code);
    const taxCode = sellerTaxCode || (info.mst !== '0102182292' ? info.mst : '');
    if (taxCode) params.set('taxCode', taxCode);
    const qs = params.toString();
    return qs ? `https://portal.vnpayinvoice.vn/?${qs}` : 'https://portal.vnpayinvoice.vn/';
  }

  return info.portalUrl;
}

export interface InvoiceProviderBadge {
  label: string;
  color: string;
  badgeClass: string;
  title: string;
  isDefault: boolean;
}

/**
 * Xác định nhãn hiển thị nhà cung cấp giải pháp hóa đơn điện tử (Misa, VNPT, Viettel, EasyInvoice,...)
 * Nếu không xác định được nhà cung cấp thì trả về 'Mặc định'.
 */
export function getInvoiceProviderBadge(inv: Partial<GDTInvoice>): InvoiceProviderBadge {
  const msttcgp = (inv.msttcgp || '').replace(/[^0-9]/g, '');
  const tentcgp = (inv.tentcgp || '').toUpperCase();
  const provider = (inv.provider || '').toUpperCase();
  const rawLookupUrl = (inv.lookupUrl || '').toLowerCase();
  const lookupCode = (inv.lookupCode || '').trim();
  const caProvider = (inv.caProvider || '').toUpperCase();
  const nbmst = (inv.nbmst || '').replace(/[^0-9]/g, '');
  const nbten = (inv.nbten || '').toUpperCase();
  const rawXml = (inv.rawXml || '').toLowerCase();

  // Kiểm tra qua hàm phân tích XML chuẩn nếu có rawXml
  if (inv.rawXml) {
    try {
      const xmlProvider = detectProvider(inv.rawXml);
      if (xmlProvider === 'VIETTEL') {
        return {
          label: 'Viettel',
          color: '#dc2626',
          badgeClass: 'text-red-700 bg-red-50 border-red-200',
          title: 'Hóa đơn phát hành qua giải pháp Viettel S-Invoice / vInvoice',
          isDefault: false
        };
      }
      if (xmlProvider === 'VNPT') {
        return {
          label: 'VNPT',
          color: '#0284c7',
          badgeClass: 'text-sky-700 bg-sky-50 border-sky-200',
          title: 'Hóa đơn phát hành qua giải pháp VNPT Invoice',
          isDefault: false
        };
      }
      if (xmlProvider === 'MISA') {
        return {
          label: 'Misa',
          color: '#1d4ed8',
          badgeClass: 'text-blue-700 bg-blue-50 border-blue-200',
          title: 'Hóa đơn phát hành qua giải pháp MISA meInvoice',
          isDefault: false
        };
      }
      if (xmlProvider === 'EASYINVOICE') {
        return {
          label: 'EasyInvoice',
          color: '#059669',
          badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          title: 'Hóa đơn phát hành qua giải pháp Softdreams EasyInvoice',
          isDefault: false
        };
      }
      if (xmlProvider === 'BKAV') {
        return {
          label: 'Bkav',
          color: '#ea580c',
          badgeClass: 'text-orange-700 bg-orange-50 border-orange-200',
          title: 'Hóa đơn phát hành qua giải pháp Bkav eHoadon',
          isDefault: false
        };
      }
      if (xmlProvider === 'FPT') {
        return {
          label: 'FPT',
          color: '#c2410c',
          badgeClass: 'text-amber-800 bg-amber-50 border-amber-200',
          title: 'Hóa đơn phát hành qua giải pháp FPT Electronic Invoice',
          isDefault: false
        };
      }
      if (xmlProvider === 'VNPAY') {
        return {
          label: 'VNPAY',
          color: '#4338ca',
          badgeClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
          title: 'Hóa đơn phát hành qua giải pháp VNPAY Invoice',
          isDefault: false
        };
      }
      if (xmlProvider === 'LCS') {
        return {
          label: 'LCS Soft',
          color: '#0f766e',
          badgeClass: 'text-teal-700 bg-teal-50 border-teal-200',
          title: 'Hóa đơn phát hành qua giải pháp LCS Soft EIP',
          isDefault: false
        };
      }
      if (xmlProvider === '4SI') {
        return {
          label: '4Si',
          color: '#7e22ce',
          badgeClass: 'text-purple-700 bg-purple-50 border-purple-200',
          title: 'Hóa đơn phát hành qua giải pháp 4Si E-Invoice',
          isDefault: false
        };
      }
      if (xmlProvider === 'THAISON') {
        return {
          label: 'Thái Sơn',
          color: '#be123c',
          badgeClass: 'text-rose-700 bg-rose-50 border-rose-200',
          title: 'Hóa đơn phát hành qua giải pháp Thái Sơn E-Invoice',
          isDefault: false
        };
      }
      if (xmlProvider === 'CYBERBILL') {
        return {
          label: 'CyberBill',
          color: '#0e7490',
          badgeClass: 'text-cyan-700 bg-cyan-50 border-cyan-200',
          title: 'Hóa đơn phát hành qua giải pháp CyberLotus CyberBill',
          isDefault: false
        };
      }
    } catch {
      // Fallback xuống kiểm tra theo các trường metadata
    }
  }

  // 1. VIETTEL
  if (
    msttcgp === '0100109106' ||
    provider === 'VIETTEL' ||
    caProvider.includes('VIETTEL') ||
    tentcgp.includes('VIETTEL') ||
    rawLookupUrl.includes('viettel') ||
    rawLookupUrl.includes('sinvoice') ||
    rawLookupUrl.includes('vinvoice') ||
    lookupCode.includes('0100109106') ||
    nbmst === '0100109106' ||
    Boolean(inv.secretCode) ||
    rawXml.includes('viettel') ||
    rawXml.includes('sinvoice') ||
    rawXml.includes('vinvoice') ||
    rawXml.includes('0100109106')
  ) {
    return {
      label: 'Viettel',
      color: '#dc2626',
      badgeClass: 'text-red-700 bg-red-50 border-red-200',
      title: 'Hóa đơn phát hành qua giải pháp Viettel S-Invoice / vInvoice',
      isDefault: false
    };
  }

  // 2. VNPT
  if (
    msttcgp === '0100684378' ||
    provider === 'VNPT' ||
    provider === 'NGHIA_SON' ||
    caProvider.includes('VNPT') ||
    tentcgp.includes('VNPT') ||
    tentcgp.includes('BƯU CHÍNH VIỄN THÔNG') ||
    rawLookupUrl.includes('vnpt-invoice') ||
    rawLookupUrl.includes('portaltool-miennam') ||
    rawLookupUrl.includes('invoice.vnpt') ||
    lookupCode.includes('0100684378') ||
    nbmst === '0100684378' ||
    nbmst === '0400102140' || // Viễn thông Đà Nẵng
    nbmst === '4000344946' || // Nghĩa Sơn (trước đây hiển thị Nghĩa Sơn)
    nbmst === '0400392256' ||
    nbten.includes('VNPT') ||
    nbten.includes('BƯU CHÍNH VIỄN THÔNG') ||
    nbten.includes('VIỄN THÔNG') ||
    nbten.includes('NGHĨA SƠN') ||
    nbten.includes('NGHIA SON') ||
    rawXml.includes('vnpt-invoice') ||
    rawXml.includes('0100684378') ||
    rawXml.includes('vnpt-ca')
  ) {
    return {
      label: 'VNPT',
      color: '#0284c7',
      badgeClass: 'text-sky-700 bg-sky-50 border-sky-200',
      title: 'Hóa đơn phát hành qua giải pháp VNPT Invoice',
      isDefault: false
    };
  }

  // 3. MISA
  if (
    msttcgp === '0101243150' ||
    provider === 'MISA' ||
    provider === 'XUAN_VINH' ||
    provider === 'TAN_THANH_DANH' ||
    provider === 'TAI_TRAM_ANH' ||
    caProvider.includes('MISA') ||
    tentcgp.includes('MISA') ||
    rawLookupUrl.includes('meinvoice') ||
    rawLookupUrl.includes('misa.vn') ||
    lookupCode.includes('0101243150') ||
    nbmst === '0101243150' ||
    nbmst === '0400557356' || // CÔNG TY TNHH XUÂN VINH (trước đây hiển thị Xuân Vinh)
    nbmst === '0317978711' || // CÔNG TY TNHH VÀNG BẠC TÂN THANH DANH (trước đây hiển thị Tân Thanh Danh)
    nbmst === '0312105174' || // DNTN GIA CÔNG TRANG SỨC TÀI TRÂM ANH (trước đây hiển thị Tài Trâm Anh)
    nbten.includes('MISA') ||
    nbten.includes('XUÂN VINH') ||
    nbten.includes('XUAN VINH') ||
    nbten.includes('TÂN THANH DANH') ||
    nbten.includes('TAN THANH DANH') ||
    nbten.includes('TÀI TRÂM ANH') ||
    nbten.includes('TAI TRAM ANH') ||
    nbten.includes('ĐẠI ĐOÀN KẾT') ||
    nbten.includes('DAI DOAN KET') ||
    rawXml.includes('meinvoice.vn') ||
    rawXml.includes('0101243150') ||
    rawXml.includes('misa-ca')
  ) {
    return {
      label: 'Misa',
      color: '#1d4ed8',
      badgeClass: 'text-blue-700 bg-blue-50 border-blue-200',
      title: 'Hóa đơn phát hành qua giải pháp MISA meInvoice',
      isDefault: false
    };
  }

  // 4. EASYINVOICE (Softdreams)
  if (
    msttcgp === '0105987432' ||
    provider === 'EASYINVOICE' ||
    provider === 'BAO_DUY' ||
    provider === 'KIM_LOAN_TUAN' ||
    provider === 'TKJ' ||
    caProvider.includes('EASY') ||
    caProvider.includes('SOFTDREAMS') ||
    tentcgp.includes('SOFTDREAMS') ||
    tentcgp.includes('EASYINVOICE') ||
    rawLookupUrl.includes('easyinvoice') ||
    rawLookupUrl.includes('softdreams') ||
    lookupCode.includes('0105987432') ||
    nbmst === '0105987432' ||
    nbmst === '0318657735' || // TRANG SỨC BẢO DUY (trước đây hiển thị Bảo Duy)
    nbmst === '0318391940' || // KIM LOAN TUẤN (trước đây hiển thị Kim Loan Tuấn)
    nbmst === '0318443500' || // TKJ (trước đây hiển thị TKJ)
    nbten.includes('SOFTDREAMS') ||
    nbten.includes('EASYINVOICE') ||
    nbten.includes('BẢO DUY') ||
    nbten.includes('BAO DUY') ||
    nbten.includes('KIM LOAN TUẤN') ||
    nbten.includes('KIM LOAN TUAN') ||
    nbten.includes('TKJ') ||
    rawXml.includes('easyinvoice') ||
    rawXml.includes('softdreams') ||
    rawXml.includes('0105987432') ||
    rawXml.includes('easyca')
  ) {
    return {
      label: 'EasyInvoice',
      color: '#059669',
      badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      title: 'Hóa đơn phát hành qua giải pháp Softdreams EasyInvoice',
      isDefault: false
    };
  }

  // 5. BKAV
  if (
    msttcgp === '0101360697' ||
    provider === 'BKAV' ||
    caProvider.includes('BKAV') ||
    tentcgp.includes('BKAV') ||
    rawLookupUrl.includes('bkav') ||
    rawLookupUrl.includes('ehoadon') ||
    nbmst === '0101360697' ||
    nbten.includes('BKAV') ||
    rawXml.includes('ehoadon.bkav') ||
    rawXml.includes('0101360697') ||
    rawXml.includes('bkav-ca')
  ) {
    return {
      label: 'Bkav',
      color: '#ea580c',
      badgeClass: 'text-orange-700 bg-orange-50 border-orange-200',
      title: 'Hóa đơn phát hành qua giải pháp Bkav eHoadon',
      isDefault: false
    };
  }

  // 6. FPT
  if (
    msttcgp === '0104128565' ||
    provider === 'FPT' ||
    caProvider.includes('FPT') ||
    tentcgp.includes('FPT') ||
    rawLookupUrl.includes('ftg.vn') ||
    rawLookupUrl.includes('fpt.com.vn') ||
    rawLookupUrl.includes('hoadondientu.fpt') ||
    lookupCode.includes('0104128565') ||
    nbmst === '0104128565' ||
    nbten.includes('FPT') ||
    rawXml.includes('hoadon.ftg.vn') ||
    rawXml.includes('0104128565') ||
    rawXml.includes('fpt-ca')
  ) {
    return {
      label: 'FPT',
      color: '#c2410c',
      badgeClass: 'text-amber-800 bg-amber-50 border-amber-200',
      title: 'Hóa đơn phát hành qua giải pháp FPT Electronic Invoice',
      isDefault: false
    };
  }

  // 7. VNPAY
  if (
    msttcgp === '0102182292' ||
    provider === 'VNPAY' ||
    tentcgp.includes('VNPAY') ||
    tentcgp.includes('THANH TOÁN VIỆT NAM') ||
    tentcgp.includes('THANH TOAN VIET NAM') ||
    rawLookupUrl.includes('vnpayinvoice') ||
    lookupCode.includes('0102182292') ||
    nbmst === '0102182292' ||
    nbmst === '0100112437' || // Vietcombank
    nbten.includes('VIETCOMBANK') ||
    nbten.includes('VNPAY') ||
    rawXml.includes('vnpayinvoice')
  ) {
    return {
      label: 'VNPAY',
      color: '#4338ca',
      badgeClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      title: 'Hóa đơn phát hành qua giải pháp VNPAY Invoice',
      isDefault: false
    };
  }

  // 8. LCS Soft
  if (
    msttcgp === '0302999571' ||
    provider === 'LCS' ||
    provider === 'LCS_SOFT' ||
    provider === 'PNJ' ||
    tentcgp.includes('L.C.S') ||
    tentcgp.includes('LCSSOFT') ||
    rawLookupUrl.includes('lcssoft') ||
    rawLookupUrl.includes('eip.lcssoft') ||
    nbmst === '0302999571' ||
    nbmst === '0315018466' || // PNJ
    nbten.includes('TRANG SỨC PNJ') ||
    nbten.includes('TRANG SUC PNJ') ||
    rawXml.includes('lcssoft')
  ) {
    return {
      label: 'LCS Soft',
      color: '#0f766e',
      badgeClass: 'text-teal-700 bg-teal-50 border-teal-200',
      title: 'Hóa đơn phát hành qua giải pháp LCS Soft EIP',
      isDefault: false
    };
  }

  // 9. 4Si
  if (
    msttcgp === '0315744883' ||
    provider === '4SI' ||
    rawLookupUrl.includes('4si.vn') ||
    rawXml.includes('4si.vn')
  ) {
    return {
      label: '4Si',
      color: '#7e22ce',
      badgeClass: 'text-purple-700 bg-purple-50 border-purple-200',
      title: 'Hóa đơn phát hành qua giải pháp 4Si E-Invoice',
      isDefault: false
    };
  }

  // 10. Thái Sơn
  if (
    msttcgp === '0101300842' ||
    provider === 'THAISON' ||
    tentcgp.includes('THÁI SƠN') ||
    tentcgp.includes('THAISON') ||
    rawLookupUrl.includes('einvoice.vn') ||
    rawLookupUrl.includes('thaison.vn') ||
    rawXml.includes('einvoice.vn')
  ) {
    return {
      label: 'Thái Sơn',
      color: '#be123c',
      badgeClass: 'text-rose-700 bg-rose-50 border-rose-200',
      title: 'Hóa đơn phát hành qua giải pháp Thái Sơn E-Invoice',
      isDefault: false
    };
  }

  // 11. CyberBill
  if (
    msttcgp === '0107871301' ||
    provider === 'CYBERBILL' ||
    tentcgp.includes('CYBERLOTUS') ||
    tentcgp.includes('CYBERBILL') ||
    rawLookupUrl.includes('cyberbill.vn') ||
    rawLookupUrl.includes('cyberlotus') ||
    rawXml.includes('cyberbill.vn')
  ) {
    return {
      label: 'CyberBill',
      color: '#0e7490',
      badgeClass: 'text-cyan-700 bg-cyan-50 border-cyan-200',
      title: 'Hóa đơn phát hành qua giải pháp CyberLotus CyberBill',
      isDefault: false
    };
  }

  // 12. Tra cứu từ từ điển nhà cung cấp giải pháp đã lưu
  if (msttcgp && KNOWN_SOLUTION_PROVIDERS[msttcgp]) {
    const known = KNOWN_SOLUTION_PROVIDERS[msttcgp];
    const brandName = known.shortBrand === 'MISA' ? 'Misa' : known.shortBrand;
    return {
      label: brandName,
      color: '#2563eb',
      badgeClass: 'text-blue-700 bg-blue-50 border-blue-200',
      title: `Nhà cung cấp: ${known.name}`,
      isDefault: false
    };
  }

  // 13. Mặc định nếu không tìm thấy nhà cung cấp
  return {
    label: 'Mặc định',
    color: '#6b7280',
    badgeClass: 'text-gray-500 bg-gray-100 border-gray-200',
    title: 'Sử dụng mẫu mặc định chuẩn Nghị định 123',
    isDefault: true
  };
}
