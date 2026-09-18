import { GDTInvoice } from '../types';

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

  return info.portalUrl;
}
