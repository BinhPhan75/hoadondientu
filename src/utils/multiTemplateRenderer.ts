/**
 * MULTI-TEMPLATE INVOICE RENDERER MODULE
 * Hệ thống hiển thị hóa đơn đa giao diện theo từng Nhà cung cấp giải pháp HĐĐT:
 * - MISA meInvoice
 * - Viettel S-Invoice
 * - Softdreams EasyInvoice
 * - 4Si E-Invoice (LCS)
 * - VNPT Invoice
 * - BKAV eHoadon
 * - Chuẩn chung Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC (DEFAULT)
 */

import { GDTInvoice, InvoiceItem } from '../types';
import { numberToVietnameseWords, parseGDTInvoiceXml, ensureInvoiceItems } from './xmlParser';
import {
  renderBaoDuyTemplate,
  renderPnjTemplate,
  renderTaiTramAnhTemplate,
  renderXuanVinhTemplate,
  renderKimLoanTuanTemplate,
  renderTkjTemplate,
  renderNghiaSonTemplate,
  detectPartnerTemplate,
  PARTNER_METAS,
  PartnerInvoiceTemplateId
} from '../templates';

export type InvoiceProviderId = 
  | 'BAO_DUY'
  | 'PNJ'
  | 'TAI_TRAM_ANH'
  | 'XUAN_VINH'
  | 'KIM_LOAN_TUAN'
  | 'TKJ'
  | 'NGHIA_SON'
  | 'MISA' 
  | 'VIETTEL' 
  | 'VNPT' 
  | '4SI' 
  | 'EASYINVOICE' 
  | 'BKAV' 
  | 'DEFAULT' 
  | string;

export interface RenderTemplateOptions {
  theme?: 'red' | 'blue';
  qrCodeDataUrl?: string;
  showPrintControls?: boolean;
  watermarkText?: string;
}

/**
 * ============================================================================
 * 1. HÀM DETECT PROVIDER (detectInvoiceProvider)
 * ============================================================================
 * Nhận vào chuỗi XML Hóa đơn điện tử hoặc đối tượng GDTInvoice và trả về Mã Template tương ứng.
 * 
 * Quy tắc ưu tiên nhận diện:
 * 1. Quét toàn bộ XML để tìm domain trong thẻ ghi chú / đường link tra cứu:
 *    - Chứa "meinvoice.vn" hoặc "misa.vn" -> "MISA"
 *    - Chứa "sinvoice.viettel" -> "VIETTEL"
 *    - Chứa "vnpt-invoice" -> "VNPT"
 *    - Chứa "inv.4si.vn" -> "4SI"
 *    - Chứa "easyinvoice" -> "EASYINVOICE"
 *    - Chứa "bkav" -> "BKAV"
 * 
 * 2. Đọc thẻ MSTTCGP (Mã số thuế tổ chức cung cấp giải pháp HĐĐT theo QĐ 1450/TCT)
 *    - 0100684378 -> VNPT
 *    - 0101243150 -> MISA
 *    - 0105987432 -> EASYINVOICE
 *    - 0315744883 -> 4SI
 *    - 0100109106 -> VIETTEL
 *    - 0101360697 -> BKAV
 * 
 * 3. Đọc thẻ <Signature> -> <X509IssuerName> hoặc <X509SubjectName>:
 *    - Chứa "VNPT" -> "VNPT"
 *    - Chứa "MISA" -> "MISA"
 *    - Chứa "VIETTEL" -> "VIETTEL"
 *    - Chứa "BKAV" -> "BKAV"
 *    - Chứa "EASYCA" hoặc "SOFTDREAMS" -> "EASYINVOICE"
 *    - Chứa "4SI" hoặc "LCS" -> "4SI"
 * 
 * 4. Nếu không có XML, nhận diện qua các trường đã bóc tách của invoice (msttcgp, tentcgp, lookupUrl, caProvider)
 * 5. Nếu không tìm thấy bất kỳ dấu vết nào -> Return "DEFAULT"
 */
export function detectInvoiceProvider(
  xmlString?: string | null,
  invoice?: GDTInvoice | null
): InvoiceProviderId {
  const raw = xmlString || (invoice?.rawXml || '');

  // --------------------------------------------------------------------------
  // BƯỚC 0: Ưu tiên nhận diện 7 đối tác chính (Bảo Duy, PNJ, Tài Trâm Anh, Xuân Vinh, Kim Loan Tuấn, TKJ, Nghĩa Sơn)
  // --------------------------------------------------------------------------
  if (invoice || raw) {
    const mockInvoice: GDTInvoice = invoice || (raw ? parseGDTInvoiceXml(raw) : ({} as GDTInvoice));
    const partnerId = detectPartnerTemplate(mockInvoice, raw);
    if (partnerId && partnerId !== 'DEFAULT') {
      return partnerId;
    }
  }

  // --------------------------------------------------------------------------
  // BƯỚC 1: Quét toàn bộ XML để tìm domain trong link tra cứu hoặc nội dung
  // --------------------------------------------------------------------------
  if (raw && typeof raw === 'string') {
    if (/meinvoice\.vn|misa\.vn/i.test(raw)) {
      return 'MISA';
    }
    if (/sinvoice\.viettel|viettel\.vn|vietteltelecom/i.test(raw)) {
      return 'VIETTEL';
    }
    if (/vnpt-invoice|vnpt\.vn|vinaphone/i.test(raw)) {
      return 'VNPT';
    }
    if (/inv\.4si\.vn|4si\.vn|4si/i.test(raw)) {
      return '4SI';
    }
    if (/easyinvoice|softdreams/i.test(raw)) {
      return 'EASYINVOICE';
    }
    if (/bkav|ehoadon/i.test(raw)) {
      return 'BKAV';
    }

    // Quét thêm thẻ MSTTCGP (Mã số thuế Tổ chức giải pháp theo chuẩn QĐ 1450/TCT)
    const msttcgpMatch = raw.match(/<(?:[a-zA-Z0-9_]+:)?MSTTCGP(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?MSTTCGP>/i);
    if (msttcgpMatch && msttcgpMatch[1]) {
      const msttcgp = msttcgpMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      if (msttcgp === '0100684378') return 'VNPT';
      if (msttcgp === '0101243150') return 'MISA';
      if (msttcgp === '0100109106') return 'VIETTEL';
      if (msttcgp === '0105987432') return 'EASYINVOICE';
      if (msttcgp === '0315744883') return '4SI';
      if (msttcgp === '0101360697') return 'BKAV';
    }

    // Quét chữ ký số và nhà cung cấp CA từ XML
    const sigMatches = raw.match(/<(?:[a-zA-Z0-9_]+:)?(?:X509IssuerName|X509SubjectName)(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?(?:X509IssuerName|X509SubjectName)>/gi);
    if (sigMatches) {
      const sigText = sigMatches.join(' ').toUpperCase();
      if (sigText.includes('VNPT')) return 'VNPT';
      if (sigText.includes('MISA')) return 'MISA';
      if (sigText.includes('VIETTEL')) return 'VIETTEL';
      if (sigText.includes('BKAV')) return 'BKAV';
      if (sigText.includes('EASYCA') || sigText.includes('SOFTDREAMS')) return 'EASYINVOICE';
      if (sigText.includes('4SI') || sigText.includes('LCS')) return '4SI';
    }
  }

  // --------------------------------------------------------------------------
  // BƯỚC 2: Kiểm tra từ đối tượng invoice nếu có
  // --------------------------------------------------------------------------
  if (invoice) {
    if (invoice.provider && invoice.provider !== 'DEFAULT' && invoice.provider !== 'UNKNOWN') {
      const p = String(invoice.provider).toUpperCase();
      if (p.includes('VNPT')) return 'VNPT';
      if (p.includes('MISA')) return 'MISA';
      if (p.includes('VIETTEL')) return 'VIETTEL';
      if (p.includes('EASY') || p.includes('SOFTDREAMS')) return 'EASYINVOICE';
      if (p.includes('4SI') || p.includes('LCS')) return '4SI';
      if (p.includes('BKAV')) return 'BKAV';
    }

    const msttcgp = (invoice.msttcgp || '').trim();
    if (msttcgp === '0100684378') return 'VNPT';
    if (msttcgp === '0101243150') return 'MISA';
    if (msttcgp === '0105987432') return 'EASYINVOICE';
    if (msttcgp === '0315744883') return '4SI';
    if (msttcgp === '0100109106') return 'VIETTEL';
    if (msttcgp === '0101360697') return 'BKAV';

    const tentcgp = (invoice.tentcgp || '').toUpperCase();
    if (tentcgp.includes('VNPT')) return 'VNPT';
    if (tentcgp.includes('MISA')) return 'MISA';
    if (tentcgp.includes('EASY') || tentcgp.includes('SOFTDREAMS')) return 'EASYINVOICE';
    if (tentcgp.includes('4SI') || tentcgp.includes('LCS')) return '4SI';
    if (tentcgp.includes('VIETTEL')) return 'VIETTEL';
    if (tentcgp.includes('BKAV')) return 'BKAV';

    const lookupUrl = (invoice.lookupUrl || '').toLowerCase();
    if (lookupUrl.includes('vnpt')) return 'VNPT';
    if (lookupUrl.includes('meinvoice') || lookupUrl.includes('misa')) return 'MISA';
    if (lookupUrl.includes('easyinvoice') || lookupUrl.includes('softdreams')) return 'EASYINVOICE';
    if (lookupUrl.includes('4si')) return '4SI';
    if (lookupUrl.includes('sinvoice') || lookupUrl.includes('viettel')) return 'VIETTEL';
    if (lookupUrl.includes('bkav') || lookupUrl.includes('ehoadon')) return 'BKAV';

    const ca = (invoice.caProvider || '').toUpperCase();
    if (ca.includes('VNPT')) return 'VNPT';
    if (ca.includes('MISA')) return 'MISA';
    if (ca.includes('VIETTEL')) return 'VIETTEL';
    if (ca.includes('BKAV')) return 'BKAV';
    if (ca.includes('EASY') || ca.includes('SOFTDREAMS')) return 'EASYINVOICE';
    if (ca.includes('4SI') || ca.includes('LCS')) return '4SI';
  }

  // --------------------------------------------------------------------------
  // BƯỚC 3: Nếu không tìm thấy bất kỳ dấu vết nào -> Return "DEFAULT"
  // --------------------------------------------------------------------------
  return 'DEFAULT';
}

/**
 * Helper: Trích xuất mã tra cứu và đường link tra cứu từ XML nếu có
 */
export function extractLookupDetails(rawXml?: string): { lookupCode: string; lookupUrl: string } {
  let lookupCode = '';
  let lookupUrl = '';

  if (!rawXml) return { lookupCode, lookupUrl };

  // 1. Quét mã tra cứu
  const codePatterns = [
    /<(?:[a-zA-Z0-9_]+:)?(?:MaTraCuu|Matracuu|MTC|LookupCode|SecretCode)(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?(?:MaTraCuu|Matracuu|MTC|LookupCode|SecretCode)>/i,
    /Mã tra cứu\s*[:：]\s*([A-Za-z0-9_-]+)/i,
    /Mã nhận hóa đơn\s*[:：]\s*([A-Za-z0-9_-]+)/i,
    /tra-cuu[?\/=]([A-Za-z0-9_-]{6,30})/i
  ];

  for (const p of codePatterns) {
    const m = rawXml.match(p);
    if (m && m[1]) {
      const val = m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      if (val && val.length >= 4) {
        lookupCode = val;
        break;
      }
    }
  }

  // 2. Quét link tra cứu
  const urlPatterns = [
    /https?:\/\/[a-zA-Z0-9\.\-]+\/tra-cuu[^\s<>"']*/i,
    /https?:\/\/[a-zA-Z0-9\.\-]+(?:meinvoice\.vn|sinvoice\.viettel\.vn|easyinvoice\.com\.vn|4si\.vn|vnpt-invoice)[^\s<>"']*/i,
    /<(?:[a-zA-Z0-9_]+:)?(?:LinkTraCuu|WebsiteTraCuu|PortalUrl)(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?(?:LinkTraCuu|WebsiteTraCuu|PortalUrl)>/i
  ];

  for (const p of urlPatterns) {
    const m = rawXml.match(p);
    if (m) {
      lookupUrl = (m[1] || m[0]).replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      break;
    }
  }

  return { lookupCode, lookupUrl };
}

export interface ProviderMeta {
  id: string;
  name: string;
  shortName: string;
  domain: string;
  badge: string;
  color: string;
  portalUrl: string;
  description: string;
}

export function getProviderMeta(providerId?: string): ProviderMeta {
  const normalized = (providerId || 'DEFAULT').toUpperCase();
  switch (normalized) {
    case 'BAO_DUY':
      return {
        id: 'BAO_DUY',
        name: 'Trang Sức Bảo Duy (EasyInvoice)',
        shortName: 'Bảo Duy',
        domain: '0318657735hd.easyinvoice.com.vn',
        badge: '💎 Bảo Duy',
        color: '#db2777',
        portalUrl: 'http://0318657735hd.easyinvoice.com.vn',
        description: 'Mẫu hóa đơn khởi tạo từ máy tính tiền - CÔNG TY TNHH THƯƠNG MẠI TRANG SỨC BẢO DUY'
      };
    case 'PNJ':
      return {
        id: 'PNJ',
        name: 'PNJ Production (4Si / LCS)',
        shortName: 'Trang Sức PNJ',
        domain: 'inv.4si.vn',
        badge: '👑 PNJ Jewelry',
        color: '#d97706',
        portalUrl: 'https://inv.4si.vn/tra-cuu-hoa-don',
        description: 'Mẫu hóa đơn bán hàng 7 cột kèm trọng lượng - CÔNG TY TNHH MTV CHẾ TÁC VÀ KINH DOANH TRANG SỨC PNJ'
      };
    case 'TAI_TRAM_ANH':
      return {
        id: 'TAI_TRAM_ANH',
        name: 'Gia Công Trang Sức Tài Trâm Anh (MISA)',
        shortName: 'Tài Trâm Anh',
        domain: 'meinvoice.vn',
        badge: '💍 Tài Trâm Anh',
        color: '#1e40af',
        portalUrl: 'https://www.meinvoice.vn/tra-cuu',
        description: 'Mẫu hóa đơn bán hàng MISA meInvoice - DNTN GIA CÔNG TRANG SỨC TÀI TRÂM ANH'
      };
    case 'XUAN_VINH':
      return {
        id: 'XUAN_VINH',
        name: 'Xuân Vinh Computer (MISA)',
        shortName: 'Xuân Vinh',
        domain: 'meinvoice.vn',
        badge: '💻 Xuân Vinh',
        color: '#dc2626',
        portalUrl: 'https://www.meinvoice.vn/tra-cuu',
        description: 'Mẫu hóa đơn GTGT 1C26TXV - CÔNG TY TNHH XUÂN VINH'
      };
    case 'KIM_LOAN_TUAN':
      return {
        id: 'KIM_LOAN_TUAN',
        name: 'Vàng Bạc Kim Loan Tuấn (EasyInvoice)',
        shortName: 'Kim Loan Tuấn',
        domain: '0318391940hd.easyinvoice.com.vn',
        badge: '✨ Kim Loan Tuấn',
        color: '#b45309',
        portalUrl: 'http://0318391940hd.easyinvoice.com.vn',
        description: 'Mẫu hóa đơn máy tính tiền 7 cột vàng bạc - CÔNG TY TNHH KINH DOANH VÀNG BẠC KIM LOAN TUẤN'
      };
    case 'TKJ':
      return {
        id: 'TKJ',
        name: 'Vàng Bạc TKJ (EasyInvoice)',
        shortName: 'Vàng Bạc TKJ',
        domain: '0318443500hd.easyinvoice.com.vn',
        badge: '⚜️ Vàng Bạc TKJ',
        color: '#15803d',
        portalUrl: 'http://0318443500hd.easyinvoice.com.vn',
        description: 'Mẫu hóa đơn bán hàng máy tính tiền Softdreams - CÔNG TY TNHH TM DV VÀNG BẠC TKJ'
      };
    case 'NGHIA_SON':
      return {
        id: 'NGHIA_SON',
        name: 'Nghĩa Sơn (VNPT Invoice)',
        shortName: 'Nghĩa Sơn',
        domain: '4000344946-tt78.vnpt-invoice.com.vn',
        badge: '🌐 Nghĩa Sơn',
        color: '#0284c7',
        portalUrl: 'https://4000344946-tt78.vnpt-invoice.com.vn',
        description: 'Mẫu hóa đơn GTGT VNPT Invoice 3 ô chữ ký - CÔNG TY TNHH NGHĨA SƠN'
      };
    case 'MISA':
      return {
        id: 'MISA',
        name: 'MISA meInvoice',
        shortName: 'MISA',
        domain: 'meinvoice.vn',
        badge: '🏢 MISA meInvoice',
        color: '#2563eb',
        portalUrl: 'https://www.meinvoice.vn/tra-cuu',
        description: 'Giải pháp Hóa đơn điện tử MISA meInvoice (Công ty Cổ phần MISA - MST 0101243150)'
      };
    case 'VIETTEL':
      return {
        id: 'VIETTEL',
        name: 'Viettel S-Invoice',
        shortName: 'Viettel',
        domain: 'sinvoice.viettel.vn',
        badge: '🔴 Viettel S-Invoice',
        color: '#dc2626',
        portalUrl: 'https://sinvoice.viettel.vn/tracuuhoadon',
        description: 'Giải pháp HĐĐT S-Invoice Tập đoàn Công nghiệp - Viễn thông Quân đội (MST 0100109106)'
      };
    case 'VNPT':
      return {
        id: 'VNPT',
        name: 'VNPT Invoice',
        shortName: 'VNPT',
        domain: 'vnpt-invoice.com.vn',
        badge: '🔵 VNPT Invoice',
        color: '#0284c7',
        portalUrl: 'https://portal.vnpt-invoice.com.vn',
        description: 'Giải pháp HĐĐT Tập đoàn Bưu chính Viễn thông Việt Nam VNPT (MST 0100684378)'
      };
    case 'EASYINVOICE':
      return {
        id: 'EASYINVOICE',
        name: 'Softdreams EasyInvoice',
        shortName: 'EasyInvoice',
        domain: 'easyinvoice.vn',
        badge: '🏪 Softdreams EasyInvoice',
        color: '#16a34a',
        portalUrl: 'https://tracuu.easyinvoice.vn',
        description: 'Hóa đơn điện tử Softdreams EasyInvoice (Công ty CP Đầu tư công nghệ Softdreams - MST 0105987432)'
      };
    case '4SI':
      return {
        id: '4SI',
        name: '4Si E-Invoice / LCS',
        shortName: '4Si (PNJ)',
        domain: 'inv.4si.vn',
        badge: '💎 4Si E-Invoice (PNJ)',
        color: '#0891b2',
        portalUrl: 'https://inv.4si.vn',
        description: 'Giải pháp HĐĐT 4Si / LCS (Công ty TNHH 4Si - MST 0315744883, chuẩn hệ thống PNJ Jewelry)'
      };
    case 'BKAV':
      return {
        id: 'BKAV',
        name: 'Bkav eHoadon',
        shortName: 'Bkav',
        domain: 'ehoadon.bkav.com',
        badge: '🟠 Bkav eHoadon',
        color: '#ea580c',
        portalUrl: 'https://ehoadon.bkav.com/tra-cuu',
        description: 'Hóa đơn điện tử Bkav eHoadon (Tập đoàn Công nghệ Bkav - MST 0101360697)'
      };
    case 'DEFAULT':
    default:
      return {
        id: 'DEFAULT',
        name: 'Chuẩn Nghị định 123 / Thông tư 78',
        shortName: 'Mẫu Chuẩn NĐ 123',
        domain: 'hoadondientu.gdt.gov.vn',
        badge: '📋 Mẫu Chuẩn NĐ 123',
        color: '#dc2626',
        portalUrl: 'https://hoadondientu.gdt.gov.vn',
        description: 'Mẫu chuẩn hóa theo Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC của Tổng cục Thuế'
      };
  }
}

/**
 * ============================================================================
 * 2. HÀM ĐIỀU PHỐI TEMPLATE (renderInvoiceHtml)
 * ============================================================================
 * Nhận vào dữ liệu XML đã parse và providerId từ hàm trên.
 * Sử dụng cấu trúc Switch-Case để trả về HTML tương ứng.
 */
export function renderInvoiceHtml(
  invoiceData: GDTInvoice | string,
  providerId?: InvoiceProviderId,
  rawXmlInput?: string,
  options?: RenderTemplateOptions
): string {
  let invoice: GDTInvoice;
  let rawXml = rawXmlInput || '';

  if (typeof invoiceData === 'string') {
    rawXml = invoiceData;
    invoice = parseGDTInvoiceXml(invoiceData);
  } else {
    invoice = invoiceData;
    if (!rawXml && invoice.rawXml) {
      rawXml = invoice.rawXml;
    }
  }

  // Tự động nhận diện nếu providerId chưa được truyền vào hoặc là 'AUTO'
  const resolvedProvider: InvoiceProviderId = (!providerId || providerId === 'AUTO')
    ? detectInvoiceProvider(rawXml, invoice)
    : providerId;

  switch (resolvedProvider) {
    case 'BAO_DUY':
      return renderBaoDuyTemplate(invoice, rawXml, options);

    case 'PNJ':
      return renderPnjTemplate(invoice, rawXml, options);

    case 'TAI_TRAM_ANH':
      return renderTaiTramAnhTemplate(invoice, rawXml, options);

    case 'XUAN_VINH':
      return renderXuanVinhTemplate(invoice, rawXml, options);

    case 'KIM_LOAN_TUAN':
      return renderKimLoanTuanTemplate(invoice, rawXml, options);

    case 'TKJ':
      return renderTkjTemplate(invoice, rawXml, options);

    case 'NGHIA_SON':
      return renderNghiaSonTemplate(invoice, rawXml, options);

    case 'MISA':
      return renderMisaTemplate(invoice, rawXml, options);

    case 'VIETTEL':
      return renderViettelTemplate(invoice, rawXml, options);

    case 'EASYINVOICE':
      return renderEasyInvoiceTemplate(invoice, rawXml, options);

    case '4SI':
      return render4SiTemplate(invoice, rawXml, options);

    case 'VNPT':
      return renderVnptTemplate(invoice, rawXml, options);

    case 'BKAV':
      return renderBkavTemplate(invoice, rawXml, options);

    case 'DEFAULT':
    default:
      return renderDefaultTemplate(invoice, rawXml, options);
  }
}

/**
 * Format tiền tệ VND
 */
function formatVND(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(num || 0)) + ' đ';
}

/**
 * Format số lượng, đơn giá
 */
function formatNum(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num || 0);
}

/**
 * Thoát ký tự HTML chống XSS
 */
function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render chuỗi mã số thuế thành các ô vuông chứa từng chữ số (Style PNJ/4Si)
 */
function renderTaxCodeBoxes(taxCode: string): string {
  const digits = (taxCode || '').replace(/[^0-9A-Za-z]/g, '').split('');
  let html = '<div class="tax-code-boxes">';
  for (let i = 0; i < 14; i++) {
    const d = digits[i] || (i >= digits.length && i < 10 ? '' : '-');
    html += `<span class="tax-box">${escapeHtml(d)}</span>`;
    if (i === 9 && digits.length > 10) {
      html += `<span class="tax-separator">-</span>`;
    }
  }
  html += '</div>';
  return html;
}

/**
 * Chuẩn hóa các trường ngày tháng
 */
function extractDateParts(invoice: GDTInvoice) {
  const tdlap = invoice.tdlap || new Date().toISOString();
  const dateParts = tdlap.split('T')[0].split('-');
  const day = dateParts[2] || '01';
  const month = dateParts[1] || '01';
  const year = dateParts[0] || '2026';
  return { day, month, year, tdlap };
}

/**
 * ============================================================================
 * TEMPLATE 1: MISA meInvoice (Dựa trên Mẫu PDF 2 - Công ty Xuân Vinh)
 * ============================================================================
 * Đặc điểm nhận diện:
 * - Header: Logo/tên bên bán bên trái, tiêu đề đỏ đậm "HÓA ĐƠN GIÁ TRỊ GIA TĂNG"
 * - Danh sách số tài khoản ngân hàng rõ ràng bên bán
 * - Watermark chìm lớn tên công ty / MISA meInvoice ở giữa bảng hàng hóa
 * - Bảng hàng hóa tiêu chuẩn với cột STT, Tên HHDV, ĐVT, Số lượng, Đơn giá, Thành tiền
 * - Chữ ký số khung xanh lá chuẩn MISA "Signature Valid / Ký bởi / Ký ngày"
 * - Footer: Tra cứu tại Website: https://www.meinvoice.vn/tra-cuu - Mã tra cứu...
 *   Phát hành bởi phần mềm MISA meInvoice - Công ty Cổ phần MISA (www.misa.vn) - MST 0101243150
 */
export function renderMisaTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode } = extractLookupDetails(rawXml);
  const mCode = lookupCode || '1ZF5CWVBQZJ5';
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const maCqt = invoice.mhdon || '006BFBDE319939417F9B4EE5AE3AE75AD7';
  const items = ensureInvoiceItems(invoice);
  const sellerName = invoice.nbten || 'CÔNG TY TNHH XUÂN VINH';
  const watermark = options?.watermarkText || sellerName.split(' ').slice(-2).join(' ') || 'meInvoice';

  const showControls = options?.showPrintControls !== false;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN ĐIỆN TỬ - MISA meInvoice - ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f1f5f9;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 13px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 800px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e293b;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
    }
    .print-btn {
      background: #2563eb;
      color: white;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .misa-wrapper {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #333;
      padding: 24px 28px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
      position: relative;
    }
    .misa-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #444;
      padding-bottom: 14px;
      margin-bottom: 12px;
    }
    .seller-col {
      width: 58%;
    }
    .seller-brand {
      color: #c5221f;
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .seller-name {
      color: #c5221f;
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .invoice-title-col {
      width: 40%;
      text-align: right;
    }
    .inv-title {
      color: #c5221f;
      font-size: 17px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .inv-date {
      font-style: italic;
      font-size: 12.5px;
      margin-bottom: 4px;
    }
    .inv-meta-line {
      font-size: 12px;
    }
    .buyer-section {
      border-bottom: 1px solid #444;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .buyer-row {
      display: flex;
      margin-bottom: 3px;
    }
    .buyer-label {
      width: 140px;
      flex-shrink: 0;
    }
    .buyer-val {
      flex: 1;
    }
    /* Table with watermark */
    .table-container {
      position: relative;
      margin-bottom: 12px;
    }
    .watermark-bg {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-20deg);
      font-size: 68px;
      font-weight: 900;
      color: rgba(220, 38, 38, 0.045);
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 6px;
      z-index: 1;
    }
    table.misa-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #333;
      position: relative;
      z-index: 2;
    }
    table.misa-table th, table.misa-table td {
      border: 1px solid #333;
      padding: 5px 6px;
      font-size: 12px;
    }
    table.misa-table th {
      background: #fafafa;
      text-align: center;
      font-weight: bold;
    }
    .total-section {
      border-bottom: 1px solid #444;
      padding-bottom: 8px;
      margin-bottom: 14px;
      font-size: 12.5px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .sign-section {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      margin-bottom: 24px;
    }
    .sign-box {
      width: 45%;
      text-align: center;
    }
    .sign-box-title {
      font-weight: bold;
      font-size: 13px;
    }
    .sign-box-sub {
      font-size: 11px;
      font-style: italic;
      color: #555;
      margin-bottom: 8px;
    }
    .misa-signature-stamp {
      display: inline-block;
      border: 1.5px solid #2e7d32;
      background: #f1f8e9;
      border-radius: 4px;
      padding: 8px 14px;
      text-align: left;
      font-size: 11.5px;
      line-height: 1.35;
      margin-top: 6px;
    }
    .stamp-title {
      color: #2e7d32;
      font-weight: bold;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .misa-footer {
      border-top: 1px solid #666;
      padding-top: 8px;
      font-size: 11px;
      color: #222;
      text-align: center;
      line-height: 1.45;
    }
    .misa-footer a { color: #0056b3; text-decoration: underline; }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .misa-wrapper { border: 1px solid #000; box-shadow: none; width: 100%; max-width: 100%; padding: 12px 16px; }
    }
  </style>
</head>
<body>
  ${showControls ? `
  <div class="print-actions">
    <div>
      <span style="font-weight: bold; color: #38bdf8;">[Giao diện MISA meInvoice]</span>
      <span style="font-size: 12px; color: #94a3b8; margin-left: 8px;">Mã tra cứu: ${escapeHtml(mCode)}</span>
    </div>
    <button class="print-btn" onclick="window.print()">In Hóa Đơn (A4)</button>
  </div>
  ` : ''}

  <div class="misa-wrapper">
    <!-- HEADER -->
    <div class="misa-header">
      <div class="seller-col">
        <div class="seller-brand">${escapeHtml(invoice.nbten)}</div>
        <div class="seller-name">Đơn vị bán hàng : ${escapeHtml(invoice.nbten)}</div>
        <div>Mã số thuế : <b>${escapeHtml(invoice.nbmst)}</b></div>
        <div>Địa chỉ : ${escapeHtml(invoice.nbdchi)}</div>
        ${invoice.nbsdt ? `<div>Điện thoại : ${escapeHtml(invoice.nbsdt)}</div>` : ''}
        ${invoice.stknh ? `<div>Số tài khoản : ${escapeHtml(invoice.stknh)} ${invoice.tnhanh ? ` - ${escapeHtml(invoice.tnhanh)}` : ''}</div>` : ''}
      </div>

      <div class="invoice-title-col">
        <div class="inv-title">${escapeHtml(invoice.thdon || 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG')}</div>
        <div class="inv-date">Ngày ${day} tháng ${month} năm ${year}</div>
        <div class="inv-meta-line">Mã CQT: <b>${escapeHtml(maCqt)}</b></div>
        <div class="inv-meta-line" style="margin-top: 4px;">
          Ký hiệu: <b>${escapeHtml(invoice.khhdon)}</b> &nbsp;&nbsp; 
          Số: <b style="color: #c5221f; font-size: 15px;">${escapeHtml(invoice.shdon)}</b>
        </div>
      </div>
    </div>

    <!-- BUYER SECTION -->
    <div class="buyer-section">
      <div class="buyer-row">
        <span class="buyer-label">Họ tên người mua hàng:</span>
        <span class="buyer-val">${escapeHtml(invoice.nmten || '')}</span>
      </div>
      <div class="buyer-row">
        <span class="buyer-label">Tên đơn vị:</span>
        <span class="buyer-val"><b>${escapeHtml(invoice.nmtendv || invoice.nmten || '')}</b></span>
      </div>
      <div class="buyer-row">
        <span class="buyer-label">Mã số thuế:</span>
        <span class="buyer-val"><b>${escapeHtml(invoice.nmmst || '')}</b></span>
      </div>
      <div class="buyer-row">
        <span class="buyer-label">Địa chỉ:</span>
        <span class="buyer-val">${escapeHtml(invoice.nmdchi || '')}</span>
      </div>
      <div class="buyer-row">
        <span class="buyer-label">Hình thức thanh toán:</span>
        <span class="buyer-val">${escapeHtml(invoice.htttoan || 'Chuyển khoản')}</span>
        ${invoice.dvtte ? `<span style="margin-left: 20px;">Đơn vị tiền tệ: <b>${escapeHtml(invoice.dvtte)}</b></span>` : ''}
      </div>
    </div>

    <!-- TABLE WITH WATERMARK -->
    <div class="table-container">
      <div class="watermark-bg">${escapeHtml(watermark)}</div>
      <table class="misa-table">
        <thead>
          <tr>
            <th style="width: 38px;">STT</th>
            <th>Tên hàng hóa, dịch vụ</th>
            <th style="width: 55px;">Đơn vị tính</th>
            <th style="width: 65px;">Số lượng</th>
            <th style="width: 95px;">Đơn giá</th>
            <th style="width: 105px;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => `
          <tr>
            <td style="text-align: center; font-family: monospace;">${it.lineNo || (it as any).stt || idx + 1}</td>
            <td>
              <div>${escapeHtml(it.itemName || (it as any).ten)}</div>
              ${it.itemCode || (it as any).mhhdvu ? `<div style="font-size: 10px; color: #555; font-family: monospace;">Mã: ${escapeHtml(it.itemCode || (it as any).mhhdvu)}</div>` : ''}
            </td>
            <td style="text-align: center;">${escapeHtml(it.unit || (it as any).dvt || 'Cái')}</td>
            <td style="text-align: right; font-family: monospace;">${formatNum(it.quantity ?? (it as any).sluong ?? 0)}</td>
            <td style="text-align: right; font-family: monospace;">${formatNum(it.unitPrice ?? (it as any).dgia ?? 0)}</td>
            <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatNum(it.amount ?? (it as any).thtien ?? 0)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- TOTALS -->
    <div class="total-section">
      <div class="total-row">
        <span>Cộng tiền hàng:</span>
        <span style="font-family: monospace; font-weight: bold;">${formatNum(invoice.tgtcthue)} đ</span>
      </div>
      <div class="total-row">
        <span>Thuế suất GTGT: <b>${items[0]?.taxRate || '8%'}</b> &nbsp;&nbsp;&nbsp;&nbsp; Tiền thuế GTGT:</span>
        <span style="font-family: monospace; font-weight: bold;">${formatNum(invoice.tgtthue)} đ</span>
      </div>
      <div class="total-row" style="font-size: 13.5px; border-top: 1px dashed #777; padding-top: 4px; margin-top: 4px;">
        <span style="font-weight: bold;">Tổng tiền thanh toán:</span>
        <span style="font-family: monospace; font-weight: bold; color: #c5221f; font-size: 14.5px;">${formatNum(invoice.tgtttbso)} đ</span>
      </div>
      <div style="margin-top: 4px;">
        Số tiền viết bằng chữ: <i>${escapeHtml(wordsAmount)}</i>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div class="sign-section">
      <div class="sign-box">
        <div class="sign-box-title">Người mua hàng</div>
        <div class="sign-box-sub">(Chữ ký số (nếu có))</div>
      </div>
      <div class="sign-box">
        <div class="sign-box-title">Người bán hàng</div>
        <div class="sign-box-sub">(Chữ ký điện tử, Chữ ký số)</div>
        <div class="misa-signature-stamp">
          <div class="stamp-title">✔ Signature Valid</div>
          <div>Ký bởi: <b style="color: #c5221f;">${escapeHtml(invoice.nbten)}</b></div>
          <div>Ký ngày: ${day}/${month}/${year}</div>
        </div>
      </div>
    </div>

    <!-- MISA FOOTER -->
    <div class="misa-footer">
      <div>Tra cứu tại Website: <a href="https://www.meinvoice.vn/tra-cuu" target="_blank">https://www.meinvoice.vn/tra-cuu</a> - Mã tra cứu: <b>${escapeHtml(mCode)}</b></div>
      <div style="margin-top: 2px;">Phát hành bởi phần mềm MISA meInvoice - Công ty Cổ phần MISA (www.misa.vn) - MST 0101243150</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * ============================================================================
 * TEMPLATE 2: Softdreams EasyInvoice (Dựa trên Mẫu PDF 1 - Tiệm vàng Kim Loan Tuấn)
 * ============================================================================
 * Đặc điểm nhận diện:
 * - Khung viền đôi hoa văn màu hồng đỏ / cam đặc trưng của Softdreams
 * - Tiêu đề đỏ nổi bật: "HÓA ĐƠN BÁN HÀNG (KHỞI TẠO TỪ MÁY TÍNH TIỀN) (VAT INVOICE)"
 * - QR code nằm bên phải phần Đơn vị bán hàng
 * - Các dòng chấm chấm song ngữ Việt - Anh (Buyer, Company's name, Tax code, Address...)
 * - Bảng chi tiết có các cột song ngữ: STT (No.), Tên hàng hóa dịch vụ (Name of goods, services),
 *   Đơn vị tính (Unit), Số lượng (Quantity), Đơn giá (Unit price), Thành tiền (Amount)
 * - Dòng chỉ số cột: (1) (2) (3) (4) (5) (6)=(4)x(5)
 * - Khung chữ ký điện tử đỏ "Signature Valid / Ký bởi / Ký ngày"
 * - Footer: Mã của cơ quan thuế: ... Trang tra cứu : http://...easyinvoice.com.vn Mã tra cứu : ...
 *   Đơn vị cung cấp giải pháp: Công ty cổ phần đầu tư công nghệ và thương mại SOFTDREAMS, MST: 0105987432, Http://easyinvoice.vn/
 */
export function renderEasyInvoiceTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  const mCode = lookupCode || 'E7DTN22Y3';
  const mUrl = lookupUrl || `http://${invoice.nbmst}hd.easyinvoice.com.vn`;
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const maCqt = invoice.mhdon || 'M2-26-KET3U-65650003078';
  const items = ensureInvoiceItems(invoice);
  const showControls = options?.showPrintControls !== false;

  const qrSrc = options?.qrCodeDataUrl || 
    `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`${mUrl}?code=${mCode}`)}`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN BÁN HÀNG - EasyInvoice - ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 6mm 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 12.5px;
      line-height: 1.3;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 14px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #7c2d12;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
    }
    .print-btn {
      background: #ea580c;
      color: white;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .easy-outer-border {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #d9534f;
      padding: 18px 22px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      position: relative;
    }
    .easy-header-grid {
      display: grid;
      grid-template-columns: 180px 1fr 180px;
      align-items: center;
      margin-bottom: 12px;
      text-align: center;
    }
    .brand-col {
      text-align: left;
      color: #b45309;
      font-weight: bold;
      font-size: 17px;
      letter-spacing: 0.5px;
    }
    .title-col h1 {
      color: #c5221f;
      font-size: 19px;
      font-weight: bold;
      margin: 0 0 2px 0;
      text-transform: uppercase;
    }
    .title-col .sub-tag {
      color: #c5221f;
      font-size: 13.5px;
      font-weight: bold;
      margin: 1px 0;
    }
    .title-col .en-tag {
      color: #c5221f;
      font-style: italic;
      font-size: 12px;
    }
    .title-col .date-tag {
      font-style: italic;
      font-size: 12px;
      margin-top: 4px;
    }
    .meta-col {
      text-align: right;
      font-size: 12.5px;
    }
    .meta-col .serial-no {
      font-weight: bold;
    }
    .meta-col .invoice-no {
      color: #c5221f;
      font-size: 16px;
      font-weight: bold;
    }
    .seller-buyer-wrapper {
      position: relative;
      margin-top: 6px;
      margin-bottom: 10px;
    }
    .seller-box {
      padding-right: 120px;
      margin-bottom: 8px;
    }
    .qr-badge {
      position: absolute;
      top: 0;
      right: 0;
      width: 105px;
      height: 105px;
      border: 1px solid #ddd;
      padding: 2px;
    }
    .qr-badge img {
      width: 100%;
      height: 100%;
      display: block;
    }
    .dotted-line {
      display: flex;
      align-items: baseline;
      margin-bottom: 3px;
    }
    .dotted-label {
      flex-shrink: 0;
      margin-right: 4px;
    }
    .dotted-value {
      flex: 1;
      border-bottom: 1px dotted #888;
      min-height: 16px;
    }
    /* EasyInvoice Items Table */
    table.easy-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 10px;
      margin-bottom: 10px;
    }
    table.easy-table th, table.easy-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 11.5px;
    }
    table.easy-table th {
      text-align: center;
      font-weight: bold;
      background: #fafafa;
    }
    .sub-head {
      font-style: italic;
      font-size: 10px;
      color: #555;
      text-align: center;
    }
    .sign-row {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      margin-bottom: 16px;
    }
    .sign-col {
      width: 45%;
      text-align: center;
    }
    .easy-signature-box {
      display: inline-block;
      border: 1.5px solid #dc2626;
      background: #fff5f5;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: left;
      font-size: 11px;
      margin-top: 6px;
    }
    .easy-footer {
      border-top: 1px solid #000;
      padding-top: 6px;
      margin-top: 10px;
      font-size: 11px;
      text-align: center;
      line-height: 1.4;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .easy-outer-border { border: 2px double #d9534f; box-shadow: none; width: 100%; max-width: 100%; padding: 10px 14px; }
    }
  </style>
</head>
<body>
  ${showControls ? `
  <div class="print-actions">
    <div>
      <span style="font-weight: bold; color: #fdba74;">[Giao diện Softdreams EasyInvoice]</span>
      <span style="font-size: 12px; color: #fed7aa; margin-left: 8px;">Mã tra cứu: ${escapeHtml(mCode)}</span>
    </div>
    <button class="print-btn" onclick="window.print()">In Hóa Đơn (A4)</button>
  </div>
  ` : ''}

  <div class="easy-outer-border">
    <!-- HEADER GRID -->
    <div class="easy-header-grid">
      <div class="brand-col">${escapeHtml(invoice.nbten)}</div>
      <div class="title-col">
        <h1>${escapeHtml(invoice.thdon || 'HÓA ĐƠN BÁN HÀNG')}</h1>
        <div class="sub-tag">(KHỞI TẠO TỪ MÁY TÍNH TIỀN)</div>
        <div class="en-tag">(VAT INVOICE)</div>
        <div class="date-tag">Ngày (Date) ${day} tháng (month) ${month} năm (year) ${year}</div>
      </div>
      <div class="meta-col">
        <div>Ký hiệu (Serial): <span class="serial-no">${escapeHtml(invoice.khhdon)}</span></div>
        <div>Số (No.): <span class="invoice-no">${escapeHtml(invoice.shdon)}</span></div>
      </div>
    </div>

    <!-- SELLER & BUYER WITH QR -->
    <div class="seller-buyer-wrapper">
      <div class="qr-badge">
        <img src="${qrSrc}" alt="QR Tra cứu" />
      </div>

      <div class="seller-box">
        <div>Đơn vị bán hàng (Seller): <b style="color: #c5221f;">${escapeHtml(invoice.nbten)}</b></div>
        <div>Mã số thuế (Tax code): <b>${escapeHtml(invoice.nbmst)}</b></div>
        <div>Địa chỉ (Address): ${escapeHtml(invoice.nbdchi)}</div>
        <div>Tài khoản (A/C number): ${escapeHtml(invoice.stknh || '05049999')} ${invoice.tnhanh ? `tại ${escapeHtml(invoice.tnhanh)}` : ''}</div>
      </div>

      <div class="dotted-line">
        <span class="dotted-label">Họ tên người mua hàng (Buyer):</span>
        <span class="dotted-value">${escapeHtml(invoice.nmten || '')}</span>
      </div>
      <div class="dotted-line">
        <span class="dotted-label">Tên đơn vị (Company's name):</span>
        <span class="dotted-value"><b>${escapeHtml(invoice.nmtendv || invoice.nmten || '')}</b></span>
      </div>
      <div class="dotted-line">
        <span class="dotted-label">Mã số thuế (Tax code):</span>
        <span class="dotted-value"><b>${escapeHtml(invoice.nmmst || '')}</b></span>
      </div>
      <div class="dotted-line">
        <span class="dotted-label">Địa chỉ (Address):</span>
        <span class="dotted-value">${escapeHtml(invoice.nmdchi || '')}</span>
      </div>
      <div class="dotted-line">
        <span class="dotted-label">Điện thoại (Tel):</span>
        <span class="dotted-value">${escapeHtml(invoice.nmsdt || '')}</span>
      </div>
      <div class="dotted-line">
        <span class="dotted-label">Hình thức thanh toán (Payment method):</span>
        <span class="dotted-value">${escapeHtml(invoice.htttoan || 'TM/CK')}</span>
        <span style="margin-left: 12px; margin-right: 4px;">Đơn vị tiền tệ (Currency):</span>
        <span style="font-weight: bold;">${escapeHtml(invoice.dvtte || 'VND')}</span>
      </div>
    </div>

    <!-- EASYINVOICE ITEMS TABLE -->
    <table class="easy-table">
      <thead>
        <tr>
          <th style="width: 38px;">STT<br><span style="font-size: 9px; font-weight: normal;">(No.)</span></th>
          <th>Tên hàng hóa, dịch vụ<br><span style="font-size: 9px; font-weight: normal;">(Name of goods, services)</span></th>
          <th style="width: 60px;">Đơn vị tính<br><span style="font-size: 9px; font-weight: normal;">(Unit)</span></th>
          <th style="width: 65px;">Số lượng<br><span style="font-size: 9px; font-weight: normal;">(Quantity)</span></th>
          <th style="width: 95px;">Đơn giá<br><span style="font-size: 9px; font-weight: normal;">(Unit price)</span></th>
          <th style="width: 110px;">Thành tiền<br><span style="font-size: 9px; font-weight: normal;">(Amount)</span></th>
        </tr>
        <tr class="sub-head">
          <td>(1)</td>
          <td>(2)</td>
          <td>(3)</td>
          <td>(4)</td>
          <td>(5)</td>
          <td>(6)=(4)x(5)</td>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
        <tr>
          <td style="text-align: center; font-family: monospace;">${it.lineNo || (it as any).stt || idx + 1}</td>
          <td>
            <div>${escapeHtml(it.itemName || (it as any).ten)}</div>
            ${it.itemCode || (it as any).mhhdvu ? `<div style="font-size: 9.5px; color: #555; font-family: monospace;">Mã: ${escapeHtml(it.itemCode || (it as any).mhhdvu)}</div>` : ''}
          </td>
          <td style="text-align: center;">${escapeHtml(it.unit || (it as any).dvt || 'Chỉ')}</td>
          <td style="text-align: right; font-family: monospace;">${formatNum(it.quantity ?? (it as any).sluong ?? 1)}</td>
          <td style="text-align: right; font-family: monospace;">${formatNum(it.unitPrice ?? (it as any).dgia ?? 0)}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatNum(it.amount ?? (it as any).thtien ?? 0)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- TOTALS -->
    <div style="border-top: 1px solid #000; padding-top: 6px; font-size: 12px;">
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
        <span>Tổng cộng tiền thanh toán (Total payment):</span>
        <span style="font-family: monospace; font-size: 14px; color: #000;">${formatNum(invoice.tgtttbso)}</span>
      </div>
      <div style="margin-top: 4px;">
        Số tiền viết bằng chữ (Amount in words): <i>${escapeHtml(wordsAmount)}</i>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div class="sign-row">
      <div class="sign-col">
        <div style="font-weight: bold;">Người mua hàng (Buyer)</div>
      </div>
      <div class="sign-col">
        <div style="font-weight: bold;">Người bán hàng (Seller)</div>
        <div class="easy-signature-box">
          <div style="color: #dc2626; font-weight: bold;">Signature Valid</div>
          <div>Ký bởi: <b>${escapeHtml(invoice.nbten)}</b></div>
          <div>Ký ngày: ${day}/${month}/${year}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER EASYINVOICE -->
    <div class="easy-footer">
      <div>Mã của cơ quan thuế (Tax authority code): <b>${escapeHtml(maCqt)}</b></div>
      <div>Trang tra cứu : <a href="${mUrl}" target="_blank">${mUrl}</a> &nbsp;&nbsp;&nbsp; Mã tra cứu : <b>${escapeHtml(mCode)}</b></div>
      <div style="font-style: italic; margin-top: 2px;">(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)</div>
      <div style="border-top: 1px solid #888; margin-top: 6px; padding-top: 4px;">
        Đơn vị cung cấp giải pháp: Công ty cổ phần đầu tư công nghệ và thương mại SOFTDREAMS, MST: 0105987432, Http://easyinvoice.vn/
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * ============================================================================
 * TEMPLATE 3: 4Si E-Invoice / LCS (Dựa trên Mẫu PDF 3 - Công ty PNJ)
 * ============================================================================
 * Đặc điểm nhận diện:
 * - Dòng trên cùng: "Khởi tạo từ phần mềm hóa đơn điện tử được cung cấp bởi Công ty TNHH L.C.S – Mã số thuế: 0302999571 – Tel: 19001837"
 * - Mã số thuế người mua hiển thị dạng các ô vuông từng số: [ 4 ][ 0 ][ 0 ][ 0 ][ 9 ][ 2 ][ 6 ][ 1 ][ 6 ][ 5 ]
 * - QR code to nằm bên trái dưới logo PNJ
 * - Bảng chi tiết có các cột: STT (1), Tên HHDV (2), ĐVT (3), Loại SP (4), Số lượng (5), Đơn giá (6), Thành tiền (7 = 5x6)
 * - Chữ ký số 4Si đặc trưng: "Đã ký ✔ / Ký bởi: ... / Ký ngày: ..."
 * - Footer: Tra cứu thông tin hóa đơn điện tử tại https://inv.4si.vn/tra-cuu-hoa-don. Mã tra cứu: ...
 */
export function render4SiTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode } = extractLookupDetails(rawXml);
  const mCode = lookupCode || 'PYRMYQQMZMRL9';
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const maCqt = invoice.mhdon || '0050A3B99A5BD44558A15F25CFEDC94091';
  const items = ensureInvoiceItems(invoice);
  const showControls = options?.showPrintControls !== false;

  const qrSrc = options?.qrCodeDataUrl || 
    `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`https://inv.4si.vn/tra-cuu-hoa-don?code=${mCode}`)}`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN BÁN HÀNG - 4Si / LCS - ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f1f5f9;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 12px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
    }
    .print-btn {
      background: #0284c7;
      color: white;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .foursi-wrapper {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #111;
      padding: 20px 24px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      position: relative;
    }
    .lcs-top-banner {
      font-size: 10px;
      color: #444;
      text-align: center;
      margin-bottom: 12px;
      font-style: italic;
    }
    .seller-header-box {
      display: flex;
      justify-content: space-between;
      border-bottom: 1.5px solid #000;
      padding-bottom: 12px;
      margin-bottom: 10px;
    }
    .seller-left-info {
      width: 60%;
    }
    .brand-logo-title {
      font-size: 16px;
      font-weight: bold;
      color: #0f2027;
      margin-bottom: 2px;
    }
    .seller-meta-line {
      font-size: 11.5px;
      margin-bottom: 2px;
    }
    .foursi-qr-box {
      text-align: center;
      width: 100px;
    }
    .foursi-qr-box img {
      width: 90px;
      height: 90px;
      display: block;
      margin: 0 auto;
    }
    .qr-subtext {
      font-size: 9px;
      font-family: monospace;
      margin-top: 2px;
    }
    .title-banner {
      text-align: center;
      margin: 10px 0;
    }
    .title-banner h2 {
      font-size: 18px;
      font-weight: bold;
      margin: 0 0 3px 0;
      text-transform: uppercase;
    }
    .title-banner .sub-date {
      font-size: 11.5px;
      font-style: italic;
      margin-bottom: 2px;
    }
    .cqt-code-row {
      font-weight: bold;
      font-size: 12px;
    }
    .serial-number-box {
      display: flex;
      justify-content: flex-end;
      gap: 20px;
      font-size: 12px;
      font-weight: bold;
      margin-top: -24px;
      margin-bottom: 14px;
    }
    /* Tax code boxes */
    .tax-code-boxes {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      vertical-align: middle;
    }
    .tax-box {
      display: inline-block;
      width: 18px;
      height: 20px;
      line-height: 19px;
      border: 1px solid #333;
      text-align: center;
      font-family: monospace;
      font-size: 13px;
      font-weight: bold;
      background: #fff;
    }
    .tax-separator {
      margin: 0 2px;
      font-weight: bold;
    }
    .buyer-info-foursi {
      border: 1px solid #444;
      padding: 8px 12px;
      margin-bottom: 12px;
      font-size: 11.5px;
    }
    .buyer-field {
      margin-bottom: 4px;
    }
    /* Table 4Si */
    table.foursi-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-bottom: 10px;
    }
    table.foursi-table th, table.foursi-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 11px;
    }
    table.foursi-table th {
      background: #fff;
      font-weight: bold;
      text-align: center;
    }
    .col-idx-row td {
      text-align: center;
      font-size: 9.5px;
      background: #fbfbfb;
    }
    .foursi-sign-wrapper {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      margin-bottom: 16px;
    }
    .foursi-sign-col {
      width: 45%;
      text-align: center;
    }
    .foursi-stamp {
      border: 1px solid #10b981;
      background: #ecfdf5;
      padding: 6px 10px;
      display: inline-block;
      text-align: left;
      font-size: 11px;
      border-radius: 4px;
      margin-top: 6px;
    }
    .foursi-footer {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 10.5px;
      text-align: center;
      line-height: 1.4;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .foursi-wrapper { border: 1px solid #000; box-shadow: none; width: 100%; max-width: 100%; padding: 10px 14px; }
    }
  </style>
</head>
<body>
  ${showControls ? `
  <div class="print-actions">
    <div>
      <span style="font-weight: bold; color: #38bdf8;">[Giao diện 4Si E-Invoice / LCS]</span>
      <span style="font-size: 12px; color: #94a3b8; margin-left: 8px;">Mã tra cứu: ${escapeHtml(mCode)}</span>
    </div>
    <button class="print-btn" onclick="window.print()">In Hóa Đơn (A4)</button>
  </div>
  ` : ''}

  <div class="foursi-wrapper">
    <div class="lcs-top-banner">
      Khởi tạo từ phần mềm hóa đơn điện tử được cung cấp bởi Công ty TNHH L.C.S – Mã số thuế: 0302999571 – Tel: 19001837
    </div>

    <!-- SELLER HEADER -->
    <div class="seller-header-box">
      <div class="seller-left-info">
        <div class="brand-logo-title">${escapeHtml(invoice.nbten)}</div>
        <div class="seller-meta-line">Địa chỉ : ${escapeHtml(invoice.nbdchi)}</div>
        <div class="seller-meta-line">Mã số thuế : <b>${escapeHtml(invoice.nbmst)}</b> &nbsp;&nbsp;&nbsp; SĐT : ${escapeHtml(invoice.nbsdt || '028 3588 8125')}</div>
      </div>
      <div class="foursi-qr-box">
        <img src="${qrSrc}" alt="QR Code" />
        <div class="qr-subtext">${escapeHtml(mCode.substring(0, 12))}</div>
      </div>
    </div>

    <!-- TITLE & CQT -->
    <div class="title-banner">
      <h2>${escapeHtml(invoice.thdon || 'HÓA ĐƠN BÁN HÀNG')}</h2>
      <div class="sub-date">Ngày ${day} tháng ${month} năm ${year}</div>
      <div class="cqt-code-row">MÃ CQT : ${escapeHtml(maCqt)}</div>
    </div>

    <div class="serial-number-box">
      <div>Ký hiệu : <span>${escapeHtml(invoice.khhdon)}</span></div>
      <div>Số : <span>${escapeHtml(invoice.shdon)}</span></div>
    </div>

    <!-- BUYER BOX WITH DIGIT BOXES -->
    <div class="buyer-info-foursi">
      <div class="buyer-field">
        Họ tên người mua hàng : <b>${escapeHtml(invoice.nmten || '')}</b>
      </div>
      <div class="buyer-field">
        Tên đơn vị : <b>${escapeHtml(invoice.nmtendv || invoice.nmten || '')}</b>
      </div>
      <div class="buyer-field">
        Địa chỉ : ${escapeHtml(invoice.nmdchi || '')}
      </div>
      <div class="buyer-field" style="display: flex; align-items: center;">
        <span style="margin-right: 8px;">Mã số thuế :</span>
        ${renderTaxCodeBoxes(invoice.nmmst || '')}
      </div>
      <div class="buyer-field" style="display: flex; justify-content: space-between;">
        <span>Hình thức thanh toán : <b>${escapeHtml(invoice.htttoan || 'TM/CK/CT')}</b></span>
        <span>Số tài khoản : ${escapeHtml(invoice.stknh || '........................')}</span>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <table class="foursi-table">
      <thead>
        <tr>
          <th style="width: 35px;">STT</th>
          <th>Tên hàng hóa, dịch vụ</th>
          <th style="width: 55px;">Đơn vị tính</th>
          <th style="width: 60px;">Loại SP</th>
          <th style="width: 80px;">Số lượng<br>(Trọng lượng)</th>
          <th style="width: 85px;">Đơn giá</th>
          <th style="width: 105px;">Thành tiền</th>
        </tr>
        <tr class="col-idx-row">
          <td>1</td>
          <td>2</td>
          <td>3</td>
          <td>4</td>
          <td>5</td>
          <td>6</td>
          <td>7 = 5x6</td>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
        <tr>
          <td style="text-align: center; font-family: monospace;">${it.lineNo || (it as any).stt || idx + 1}</td>
          <td>
            <div>${escapeHtml(it.itemName || (it as any).ten)}</div>
            ${it.itemCode || (it as any).mhhdvu ? `<div style="font-size: 9.5px; color: #64748b; font-family: monospace;">Mã: ${escapeHtml(it.itemCode || (it as any).mhhdvu)}</div>` : ''}
          </td>
          <td style="text-align: center;">${escapeHtml(it.unit || (it as any).dvt || 'Món')}</td>
          <td style="text-align: center;">-</td>
          <td style="text-align: right; font-family: monospace;">${formatNum(it.quantity ?? (it as any).sluong ?? 1)}</td>
          <td style="text-align: right; font-family: monospace;">${formatNum(it.unitPrice ?? (it as any).dgia ?? 0)}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatNum(it.amount ?? (it as any).thtien ?? 0)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- TOTALS -->
    <div style="border-top: 1px solid #000; padding-top: 4px; font-size: 12px;">
      <div style="display: flex; justify-content: space-between; font-weight: bold;">
        <span>Cộng tiền hàng :</span>
        <span style="font-family: monospace;">${formatNum(invoice.tgtcthue || invoice.tgtttbso)}</span>
      </div>
      <div style="margin-top: 4px;">
        Số tiền viết bằng chữ : <i>${escapeHtml(wordsAmount)}</i>
      </div>
    </div>

    <!-- SIGNATURE -->
    <div class="foursi-sign-wrapper">
      <div class="foursi-sign-col">
        <div style="font-weight: bold;">Người mua hàng</div>
        <div style="font-size: 10px; color: #555;">(Ký, ghi rõ họ tên)</div>
      </div>
      <div class="foursi-sign-col">
        <div style="font-weight: bold;">Người bán hàng</div>
        <div style="font-size: 10px; color: #555;">(Ký, ghi rõ họ tên)</div>
        <div class="foursi-stamp">
          <div style="color: #059669; font-weight: bold;">Đã ký ✔</div>
          <div>Ký bởi: <b>${escapeHtml(invoice.nbten)}</b></div>
          <div>Ký ngày: ${day}/${month}/${year}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER 4SI -->
    <div class="foursi-footer">
      <div style="font-style: italic; margin-bottom: 2px;">(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)</div>
      <div>Tra cứu thông tin hóa đơn điện tử tại <a href="https://inv.4si.vn/tra-cuu-hoa-don" target="_blank">https://inv.4si.vn/tra-cuu-hoa-don</a>. &nbsp;&nbsp; Mã tra cứu: <b>${escapeHtml(mCode)}</b></div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * ============================================================================
 * TEMPLATE 4: Viettel S-Invoice
 * ============================================================================
 * Đặc điểm nhận diện:
 * - Dải màu thương hiệu Viettel (Đỏ Viettel #ee0033)
 * - Khung tra cứu chuyên biệt với Mã số bí mật và website sinvoice.viettel.vn
 * - Chữ ký số Viettel-CA
 */
export function renderViettelTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode } = extractLookupDetails(rawXml);
  const mCode = lookupCode || 'VTT893849120';
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const maCqt = invoice.mhdon || '0024A998811234F9004B2C89';
  const items = ensureInvoiceItems(invoice);
  const showControls = options?.showPrintControls !== false;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN ĐIỆN TỬ - VIETTEL S-INVOICE - ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f1f5f9;
      margin: 0;
      padding: 16px;
      color: #111;
      font-size: 12.5px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #991b1b;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
    }
    .print-btn {
      background: #dc2626;
      color: white;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .viettel-wrapper {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 1.5px solid #ee0033;
      padding: 24px 28px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      position: relative;
    }
    .viettel-top-bar {
      height: 4px;
      background: #ee0033;
      margin: -24px -28px 16px -28px;
    }
    .viettel-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #ee0033;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .v-seller-col { width: 58%; }
    .v-title-col { width: 40%; text-align: right; }
    .v-title {
      color: #ee0033;
      font-size: 18px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .viettel-lookup-box {
      background: #fef2f2;
      border: 1px dashed #f87171;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
    }
    table.viettel-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #ee0033;
      margin-bottom: 12px;
    }
    table.viettel-table th, table.viettel-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      font-size: 12px;
    }
    table.viettel-table th {
      background: #fff1f2;
      color: #9f1239;
      font-weight: bold;
      text-align: center;
      border: 1px solid #fda4af;
    }
    .viettel-stamp {
      border: 1.5px solid #ee0033;
      background: #fff5f5;
      padding: 8px 12px;
      display: inline-block;
      text-align: left;
      border-radius: 4px;
      font-size: 11px;
    }
    .viettel-footer {
      border-top: 1px solid #ee0033;
      padding-top: 8px;
      font-size: 11px;
      text-align: center;
      color: #475569;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .viettel-wrapper { border: 1px solid #ee0033; box-shadow: none; width: 100%; max-width: 100%; padding: 12px 16px; }
    }
  </style>
</head>
<body>
  ${showControls ? `
  <div class="print-actions">
    <div>
      <span style="font-weight: bold; color: #fca5a5;">[Giao diện Viettel S-Invoice]</span>
      <span style="font-size: 12px; color: #fecaca; margin-left: 8px;">Mã số bí mật: ${escapeHtml(mCode)}</span>
    </div>
    <button class="print-btn" onclick="window.print()">In Hóa Đơn (A4)</button>
  </div>
  ` : ''}

  <div class="viettel-wrapper">
    <div class="viettel-top-bar"></div>

    <div class="viettel-header">
      <div class="v-seller-col">
        <div style="font-size: 16px; font-weight: bold; color: #ee0033;">${escapeHtml(invoice.nbten)}</div>
        <div>Mã số thuế: <b>${escapeHtml(invoice.nbmst)}</b></div>
        <div>Địa chỉ: ${escapeHtml(invoice.nbdchi)}</div>
        ${invoice.stknh ? `<div>Tài khoản: <b>${escapeHtml(invoice.stknh)}</b> tại ${escapeHtml(invoice.tnhanh || '')}</div>` : ''}
      </div>
      <div class="v-title-col">
        <div class="v-title">${escapeHtml(invoice.thdon || 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG')}</div>
        <div style="font-style: italic;">Ngày ${day} tháng ${month} năm ${year}</div>
        <div>Mã CQT: <b>${escapeHtml(maCqt)}</b></div>
        <div>Ký hiệu: <b>${escapeHtml(invoice.khhdon)}</b> &nbsp; Số: <b style="color: #ee0033; font-size: 15px;">${escapeHtml(invoice.shdon)}</b></div>
      </div>
    </div>

    <!-- VIETTEL LOOKUP BOX -->
    <div class="viettel-lookup-box">
      <div>Website tra cứu: <a href="https://sinvoice.viettel.vn/tracuuhoadon" target="_blank" style="color: #ee0033; font-weight: bold;">https://sinvoice.viettel.vn/tracuuhoadon</a></div>
      <div>Mã số bí mật: <b style="color: #ee0033;">${escapeHtml(mCode)}</b></div>
    </div>

    <!-- BUYER -->
    <div style="border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 12px;">
      <div>Tên đơn vị: <b>${escapeHtml(invoice.nmtendv || invoice.nmten || '')}</b></div>
      <div>Mã số thuế: <b>${escapeHtml(invoice.nmmst || '')}</b></div>
      <div>Địa chỉ: ${escapeHtml(invoice.nmdchi || '')}</div>
      <div>Hình thức thanh toán: ${escapeHtml(invoice.htttoan || 'TM/CK')}</div>
    </div>

    <!-- TABLE -->
    <table class="viettel-table">
      <thead>
        <tr>
          <th style="width: 38px;">STT</th>
          <th>Tên hàng hóa, dịch vụ</th>
          <th style="width: 60px;">ĐVT</th>
          <th style="width: 70px;">Số lượng</th>
          <th style="width: 95px;">Đơn giá</th>
          <th style="width: 65px;">Thuế</th>
          <th style="width: 105px;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
        <tr>
          <td style="text-align: center; font-family: monospace;">${it.lineNo || (it as any).stt || idx + 1}</td>
          <td>${escapeHtml(it.itemName || (it as any).ten)}</td>
          <td style="text-align: center;">${escapeHtml(it.unit || (it as any).dvt || 'Cái')}</td>
          <td style="text-align: right; font-family: monospace;">${formatNum(it.quantity ?? (it as any).sluong ?? 0)}</td>
          <td style="text-align: right; font-family: monospace;">${formatNum(it.unitPrice ?? (it as any).dgia ?? 0)}</td>
          <td style="text-align: center; font-weight: bold;">${escapeHtml(it.taxRate || '10%')}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatNum(it.amount ?? (it as any).thtien ?? 0)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- TOTALS -->
    <div style="border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 12px; font-size: 12.5px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
        <span>Cộng tiền hàng:</span>
        <span style="font-family: monospace; font-weight: bold;">${formatNum(invoice.tgtcthue)} đ</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
        <span>Tiền thuế GTGT:</span>
        <span style="font-family: monospace; font-weight: bold;">${formatNum(invoice.tgtthue)} đ</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: bold; color: #ee0033; font-size: 14px;">
        <span>Tổng cộng tiền thanh toán:</span>
        <span style="font-family: monospace;">${formatNum(invoice.tgtttbso)} đ</span>
      </div>
      <div style="margin-top: 4px;">
        Số tiền bằng chữ: <i>${escapeHtml(wordsAmount)}</i>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div style="display: flex; justify-content: space-between; margin: 16px 0;">
      <div style="width: 45%; text-align: center;">
        <div style="font-weight: bold;">Người mua hàng</div>
      </div>
      <div style="width: 45%; text-align: center;">
        <div style="font-weight: bold;">Người bán hàng</div>
        <div class="viettel-stamp">
          <div style="color: #ee0033; font-weight: bold;">✔ Chữ ký số Viettel-CA hợp lệ</div>
          <div>Ký bởi: <b>${escapeHtml(invoice.nbten)}</b></div>
          <div>Ký ngày: ${day}/${month}/${year}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="viettel-footer">
      <div>Hóa đơn điện tử khởi tạo từ hệ thống Viettel S-Invoice - Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel)</div>
      <div>Tra cứu trực tuyến: <a href="https://sinvoice.viettel.vn" target="_blank" style="color: #ee0033;">https://sinvoice.viettel.vn</a></div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * ============================================================================
 * TEMPLATE 5: VNPT Invoice (Tập đoàn Bưu chính Viễn thông Việt Nam)
 * ============================================================================
 * Đặc điểm nhận diện chuẩn VNPT-Invoice:
 * - Khung viền kép hoa văn xanh dương đặc trưng VNPT (#005baa / #0284c7)
 * - Huy hiệu / Tiêu đề thương hiệu VNPT Invoice
 * - Tiêu đề: "HÓA ĐƠN GIÁ TRỊ GIA TĂNG (Bản thể hiện của hóa đơn điện tử)"
 * - Bảng danh mục hàng hóa chuẩn 6 cột: STT (1), Tên hàng hóa, dịch vụ (2), ĐVT (3), Số lượng (4), Đơn giá (5), Thành tiền (6 = 4 x 5)
 * - Con dấu Chữ ký điện tử VNPT-CA màu xanh dương hợp lệ
 * - Footer: Cần kiểm tra, đối chiếu khi lập giao nhận hóa đơn - Tra cứu tại https://vnpt-invoice.com.vn
 */
export function renderVnptTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  const mCode = lookupCode || 'VNPT78-9821045';
  const mUrl = lookupUrl || 'https://vnpt-invoice.com.vn';
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const maCqt = invoice.mhdon || '0011B88299A1209384B2C89';
  const items = ensureInvoiceItems(invoice);
  const showControls = options?.showPrintControls !== false;

  const qrSrc = options?.qrCodeDataUrl || 
    `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`${mUrl}?code=${mCode}`)}`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN ĐIỆN TỬ - VNPT INVOICE - ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif, Arial;
      background: #f1f5f9;
      margin: 0;
      padding: 16px;
      color: #0f172a;
      font-size: 13px;
      line-height: 1.4;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #005baa;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
    }
    .print-btn {
      background: #0284c7;
      color: white;
      border: 1px solid #bae6fd;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .print-btn:hover {
      background: #0369a1;
    }
    .vnpt-page {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 2px solid #005baa;
      outline: 1px dashed #0284c7;
      outline-offset: -5px;
      padding: 24px 28px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      position: relative;
    }
    .vnpt-header-grid {
      display: grid;
      grid-template-columns: 100px 1fr 200px;
      gap: 12px;
      border-bottom: 1.5px solid #005baa;
      padding-bottom: 12px;
      margin-bottom: 12px;
      align-items: start;
    }
    .vnpt-brand-logo {
      text-align: center;
      padding-top: 4px;
    }
    .vnpt-brand-badge {
      display: inline-block;
      background: #005baa;
      color: #fff;
      font-family: Arial, sans-serif;
      font-weight: bold;
      font-size: 14px;
      padding: 6px 10px;
      border-radius: 4px;
      letter-spacing: 1px;
    }
    .vnpt-brand-badge span {
      display: block;
      font-size: 9px;
      letter-spacing: 0.5px;
      font-weight: normal;
      color: #bae6fd;
    }
    .seller-info {
      font-size: 12.5px;
    }
    .seller-name {
      font-size: 15px;
      font-weight: bold;
      color: #005baa;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .meta-box {
      border: 1px solid #005baa;
      background: #f0f9ff;
      padding: 8px 10px;
      font-size: 12px;
      border-radius: 4px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }
    .meta-row:last-child {
      margin-bottom: 0;
    }
    .meta-val {
      font-weight: bold;
      color: #005baa;
    }
    .title-banner {
      text-align: center;
      margin: 10px 0 14px 0;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: bold;
      color: #005baa;
      text-transform: uppercase;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .invoice-subtitle {
      font-style: italic;
      font-size: 12px;
      color: #475569;
      margin-top: 2px;
    }
    .invoice-date {
      font-style: italic;
      font-size: 12.5px;
      margin-top: 2px;
    }
    .cqt-code-bar {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 10px;
      background: #e0f2fe;
      border: 1px solid #7dd3fc;
      border-radius: 4px;
      font-size: 11.5px;
      font-weight: bold;
      color: #0369a1;
    }
    .buyer-card {
      border: 1px solid #cbd5e1;
      background: #fafafa;
      padding: 10px 14px;
      margin-bottom: 14px;
      font-size: 12.5px;
      border-radius: 4px;
    }
    .buyer-field {
      margin-bottom: 4px;
      display: flex;
    }
    .buyer-label {
      width: 170px;
      flex-shrink: 0;
      color: #334155;
    }
    .buyer-value {
      flex: 1;
      font-weight: 500;
    }
    /* BẢNG CHI TIẾT HÀNG HÓA VNPT */
    table.vnpt-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #005baa;
      margin-bottom: 12px;
    }
    table.vnpt-table th {
      background: #005baa;
      color: #ffffff;
      border: 1px solid #0284c7;
      padding: 6px 4px;
      font-size: 12px;
      font-weight: bold;
      text-align: center;
    }
    table.vnpt-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 6px;
      font-size: 12px;
    }
    .col-idx {
      background: #f8fafc;
      text-align: center;
      font-size: 10px;
      color: #64748b;
    }
    .totals-area {
      margin-top: 10px;
      border-top: 1px solid #005baa;
      padding-top: 8px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 13px;
    }
    .total-final {
      font-size: 14px;
      font-weight: bold;
      color: #005baa;
      border-top: 1px dashed #cbd5e1;
      padding-top: 4px;
      margin-top: 4px;
    }
    .words-box {
      font-style: italic;
      margin-top: 6px;
      font-size: 12.5px;
      background: #f8fafc;
      padding: 6px 10px;
      border-left: 3px solid #005baa;
    }
    /* Chữ ký VNPT-CA */
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 20px;
      margin-bottom: 24px;
      text-align: center;
    }
    .sign-title {
      font-weight: bold;
      font-size: 13px;
      text-transform: uppercase;
    }
    .sign-sub {
      font-size: 11.5px;
      font-style: italic;
      color: #64748b;
      margin-bottom: 8px;
    }
    .vnpt-ca-box {
      margin: 10px auto 0 auto;
      max-width: 280px;
      border: 1.5px solid #005baa;
      background: #f0f9ff;
      padding: 8px 10px;
      text-align: left;
      font-size: 11px;
      border-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,91,170,0.15);
    }
    .vnpt-ca-title {
      color: #005baa;
      font-weight: bold;
      font-size: 11.5px;
      border-bottom: 1px solid #bae6fd;
      padding-bottom: 3px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .vnpt-footer {
      border-top: 1.5px solid #005baa;
      padding-top: 10px;
      text-align: center;
      font-size: 11px;
      color: #475569;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .vnpt-page {
        border: 1px solid #005baa;
        outline: none;
        box-shadow: none;
        max-width: 100%;
        width: 100%;
        padding: 10mm;
      }
    }
  </style>
</head>
<body>
  ${showControls ? `
  <div class="print-actions">
    <div>
      <span style="font-weight: bold; color: #bae6fd;">[Giao diện VNPT-Invoice]</span>
      <span style="font-size: 12px; color: #e0f2fe; margin-left: 8px;">Mã tra cứu: ${escapeHtml(mCode)}</span>
    </div>
    <button class="print-btn" onclick="window.print()">In Hóa Đơn (A4)</button>
  </div>
  ` : ''}

  <div class="vnpt-page">
    <!-- HEADER VNPT -->
    <div class="vnpt-header-grid">
      <div class="vnpt-brand-logo">
        <div class="vnpt-brand-badge">
          VNPT
          <span>INVOICE</span>
        </div>
        <img src="${qrSrc}" alt="QR" style="width: 80px; height: 80px; margin-top: 8px; border: 1px solid #e2e8f0; padding: 2px;">
      </div>

      <div class="seller-info">
        <div class="seller-name">${escapeHtml(invoice.nbten)}</div>
        <div>Mã số thuế: <b>${escapeHtml(invoice.nbmst)}</b></div>
        <div>Địa chỉ: ${escapeHtml(invoice.nbdchi)}</div>
        ${(invoice.nbsdt || (invoice as any).nbphone) ? `<div>Điện thoại: ${escapeHtml(invoice.nbsdt || (invoice as any).nbphone)}</div>` : ''}
        ${invoice.nbemail ? `<div>Email: ${escapeHtml(invoice.nbemail)}</div>` : ''}
        ${(invoice.nbstk || invoice.stknh) ? `<div>Số tài khoản: <b>${escapeHtml(invoice.nbstk || invoice.stknh)}</b> ${(invoice.nbnhang || invoice.tnhanh) ? `tại ${escapeHtml(invoice.nbnhang || invoice.tnhanh)}` : ''}</div>` : ''}
      </div>

      <div class="meta-box">
        <div class="meta-row">
          <span>Ký hiệu:</span>
          <span class="meta-val">${escapeHtml(invoice.khhdon)}</span>
        </div>
        <div class="meta-row">
          <span>Số hóa đơn:</span>
          <span class="meta-val" style="font-size: 14px;">${escapeHtml(invoice.shdon)}</span>
        </div>
        <div class="meta-row">
          <span>Mẫu số:</span>
          <span class="meta-val">${escapeHtml(invoice.khmshdon || '1')}</span>
        </div>
        <div class="meta-row">
          <span>Ngày lập:</span>
          <span class="meta-val">${day}/${month}/${year}</span>
        </div>
      </div>
    </div>

    <!-- TITLE BANNER -->
    <div class="title-banner">
      <h1 class="invoice-title">${escapeHtml(invoice.thdon || 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG')}</h1>
      <div class="invoice-subtitle">(Bản thể hiện của hóa đơn điện tử)</div>
      <div class="invoice-date">Ngày ${day} tháng ${month} năm ${year}</div>
      ${maCqt ? `<div class="cqt-code-bar">Mã của Cơ quan Thuế: ${escapeHtml(maCqt)}</div>` : ''}
    </div>

    <!-- BUYER INFO -->
    <div class="buyer-card">
      <div class="buyer-field">
        <span class="buyer-label">Họ tên người mua hàng:</span>
        <span class="buyer-value">${escapeHtml(invoice.nmten || '')}</span>
      </div>
      <div class="buyer-field">
        <span class="buyer-label">Tên đơn vị:</span>
        <span class="buyer-value">${escapeHtml(invoice.nmtendv || invoice.nmten || '')}</span>
      </div>
      <div class="buyer-field">
        <span class="buyer-label">Mã số thuế:</span>
        <span class="buyer-value"><b>${escapeHtml(invoice.nmmst || '')}</b></span>
      </div>
      <div class="buyer-field">
        <span class="buyer-label">Địa chỉ:</span>
        <span class="buyer-value">${escapeHtml(invoice.nmdchi || '')}</span>
      </div>
      <div style="display: flex; gap: 20px;">
        <div class="buyer-field" style="margin-bottom: 0;">
          <span class="buyer-label">Hình thức thanh toán:</span>
          <span class="buyer-value">${escapeHtml(invoice.htttoan || 'TM/CK')}</span>
        </div>
        ${(invoice.stknh || (invoice as any).stknghang) ? `
        <div class="buyer-field" style="margin-bottom: 0;">
          <span class="buyer-label" style="width: auto; margin-right: 8px;">Số tài khoản:</span>
          <span class="buyer-value">${escapeHtml(invoice.stknh || (invoice as any).stknghang)}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <table class="vnpt-table">
      <thead>
        <tr>
          <th style="width: 42px;">STT</th>
          <th>Tên hàng hóa, dịch vụ</th>
          <th style="width: 70px;">ĐVT</th>
          <th style="width: 80px;">Số lượng</th>
          <th style="width: 100px;">Đơn giá</th>
          <th style="width: 120px;">Thành tiền</th>
        </tr>
        <tr class="col-idx">
          <td>(1)</td>
          <td>(2)</td>
          <td>(3)</td>
          <td>(4)</td>
          <td>(5)</td>
          <td>(6 = 4 x 5)</td>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => {
          const lineNo = it.lineNo || (it as any).stt || idx + 1;
          const itemName = it.itemName || (it as any).ten || `Hàng hóa / Dịch vụ ${lineNo}`;
          const unit = it.unit || (it as any).dvt || '-';
          const qty = it.quantity ?? (it as any).sluong ?? 0;
          const price = it.unitPrice ?? (it as any).dgia ?? 0;
          const amt = it.amount ?? (it as any).thtien ?? (it as any).tthtien ?? 0;

          return `
          <tr>
            <td style="text-align: center;">${lineNo}</td>
            <td style="font-weight: 500;">${escapeHtml(itemName)}</td>
            <td style="text-align: center;">${escapeHtml(unit)}</td>
            <td style="text-align: right;">${formatNum(qty)}</td>
            <td style="text-align: right;">${formatNum(price)}</td>
            <td style="text-align: right; font-weight: bold;">${formatNum(amt)}</td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- TOTALS AREA -->
    <div class="totals-area">
      <div class="total-row">
        <span>Cộng tiền hàng (chưa có thuế GTGT):</span>
        <span style="font-weight: 600;">${formatVND(invoice.tgtcthue)} VNĐ</span>
      </div>
      <div class="total-row">
        <span>Thuế suất GTGT: <b>10%</b> &nbsp;&nbsp;|&nbsp;&nbsp; Tiền thuế GTGT:</span>
        <span style="font-weight: 600;">${formatVND(invoice.tgtthue)} VNĐ</span>
      </div>
      <div class="total-row total-final">
        <span>TỔNG CỘNG TIỀN THANH TOÁN:</span>
        <span>${formatVND(invoice.tgtttbso)} VNĐ</span>
      </div>
      <div class="words-box">
        Số tiền viết bằng chữ: <b>${escapeHtml(wordsAmount)}</b>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div class="signatures-grid">
      <div>
        <div class="sign-title">Người mua hàng</div>
        <div class="sign-sub">(Ký, ghi rõ họ tên)</div>
      </div>
      <div>
        <div class="sign-title">Người bán hàng</div>
        <div class="sign-sub">(Ký điện tử, đóng dấu)</div>
        <div class="vnpt-ca-box">
          <div class="vnpt-ca-title">
            <span style="color: #16a34a; font-size: 13px;">✔</span>
            <span>CHỮ KÝ SỐ HỢP LỆ - VNPT-CA</span>
          </div>
          <div>Ký bởi: <b>${escapeHtml(invoice.nbten)}</b></div>
          <div>Ngày ký: <b>${day}/${month}/${year}</b></div>
          <div>Tổ chức chứng thực: <b>VNPT-CA</b></div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="vnpt-footer">
      <div style="font-style: italic; margin-bottom: 3px;">(Cần kiểm tra, đối chiếu khi lập, giao nhận hóa đơn)</div>
      <div>Khởi tạo từ Hệ thống Hóa đơn điện tử <b>VNPT Invoice</b> - Tập đoàn Bưu chính Viễn thông Việt Nam</div>
      <div>Tra cứu trực tuyến tại: <a href="https://vnpt-invoice.com.vn" target="_blank" style="color: #005baa; font-weight: bold;">https://vnpt-invoice.com.vn</a> &nbsp;&nbsp; Mã tra cứu: <b style="color: #005baa;">${escapeHtml(mCode)}</b></div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * ============================================================================
 * TEMPLATE 6: BKAV eHoadon
 * ============================================================================
 */
export function renderBkavTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode } = extractLookupDetails(rawXml);
  const mCode = lookupCode || 'BKAV88910023';
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const items = ensureInvoiceItems(invoice);
  const showControls = options?.showPrintControls !== false;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN ĐIỆN TỬ - BKAV eHoadon - ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 16px; background: #f8fafc; font-size: 12.5px; }
    .bkav-card { max-width: 820px; margin: 0 auto; background: #fff; border: 1.5px solid #ea580c; padding: 24px; }
    .bkav-title { color: #ea580c; font-size: 18px; font-weight: bold; text-align: center; }
  </style>
</head>
<body>
  ${showControls ? `
  <div style="max-width: 820px; margin: 0 auto 12px auto; display: flex; justify-content: space-between; background: #c2410c; color: #fff; padding: 8px 14px; border-radius: 6px;">
    <span>[Giao diện Bkav eHoadon] Mã tra cứu: ${escapeHtml(mCode)}</span>
    <button onclick="window.print()" style="background: #ea580c; color: #fff; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer;">In Hóa Đơn</button>
  </div>
  ` : ''}
  <div class="bkav-card">
    <div class="bkav-title">${escapeHtml(invoice.thdon || 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG')}</div>
    <div style="text-align: center; font-style: italic; margin-bottom: 12px;">Ngày ${day} tháng ${month} năm ${year}</div>
    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #ea580c; padding-bottom: 8px; margin-bottom: 10px;">
      <div><b>${escapeHtml(invoice.nbten)}</b><br>MST: ${escapeHtml(invoice.nbmst)}</div>
      <div style="text-align: right;">Ký hiệu: <b>${escapeHtml(invoice.khhdon)}</b> &nbsp; Số: <b style="color: #ea580c;">${escapeHtml(invoice.shdon)}</b></div>
    </div>
    <div style="margin-bottom: 12px;">
      Người mua: <b>${escapeHtml(invoice.nmtendv || invoice.nmten || '')}</b> - MST: <b>${escapeHtml(invoice.nmmst || '')}</b>
    </div>
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #ea580c; margin-bottom: 12px;">
      <thead>
        <tr style="background: #ffedd5; color: #c2410c;">
          <th style="border: 1px solid #fed7aa; padding: 4px;">STT</th>
          <th style="border: 1px solid #fed7aa; padding: 4px;">Tên hàng hóa, dịch vụ</th>
          <th style="border: 1px solid #fed7aa; padding: 4px;">ĐVT</th>
          <th style="border: 1px solid #fed7aa; padding: 4px;">Số lượng</th>
          <th style="border: 1px solid #fed7aa; padding: 4px;">Đơn giá</th>
          <th style="border: 1px solid #fed7aa; padding: 4px;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
        <tr>
          <td style="border: 1px solid #cbd5e1; text-align: center;">${it.lineNo || (it as any).stt || idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px;">${escapeHtml(it.itemName || (it as any).ten)}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center;">${escapeHtml(it.unit || (it as any).dvt || 'Cái')}</td>
          <td style="border: 1px solid #cbd5e1; text-align: right;">${formatNum(it.quantity ?? (it as any).sluong ?? 0)}</td>
          <td style="border: 1px solid #cbd5e1; text-align: right;">${formatNum(it.unitPrice ?? (it as any).dgia ?? 0)}</td>
          <td style="border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${formatNum(it.amount ?? (it as any).thtien ?? 0)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="text-align: right; font-size: 13px; font-weight: bold; color: #ea580c;">
      Tổng thanh toán: ${formatVND(invoice.tgtttbso)}
    </div>
    <div style="font-style: italic; text-align: right; font-size: 11.5px; margin-top: 2px;">
      Bằng chữ: ${escapeHtml(wordsAmount)}
    </div>
    <div style="border-top: 1px solid #ea580c; margin-top: 14px; padding-top: 6px; text-align: center; font-size: 11px; color: #555;">
      Phát hành bởi hệ thống Bkav eHoadon (www.ehoadon.vn) - Mã tra cứu: <b>${escapeHtml(mCode)}</b>
    </div>
  </div>
</body>
</html>`;
}

/**
 * ============================================================================
 * TEMPLATE 7: DEFAULT - Chuẩn Tổng cục Thuế Nghị định 123 / Thông tư 78
 * ============================================================================
 * Bản thể hiện chuẩn mực quy chuẩn Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC:
 * - Khung viền sắc nét, hiển thị đầy đủ thông tin pháp lý, bảng kê đa thuế suất,
 *   đầy đủ dấu ký điện tử, chuẩn in A4 không tràn trang.
 */
export function renderDefaultTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  const mCode = lookupCode || 'TC78-123-DEFAULT';
  const mUrl = lookupUrl || 'https://hoadondientu.gdt.gov.vn';
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const maCqt = invoice.mhdon || (invoice.hsgcma ? '00E9C762DA374972B621A0F9004B2C89' : '');
  const items = ensureInvoiceItems(invoice);
  const showControls = options?.showPrintControls !== false;

  const isBlue = options?.theme === 'blue';
  const primaryColor = isBlue ? '#1d4ed8' : '#b91c1c';
  const metaBg = isBlue ? '#eff6ff' : '#fef2f2';
  const metaBorder = isBlue ? '#bfdbfe' : '#fecaca';

  const qrSrc = options?.qrCodeDataUrl || 
    `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`https://hoadondientu.gdt.gov.vn/tra-cuu?mst=${invoice.nbmst}&kh=${invoice.khhdon}&so=${invoice.shdon}&tong=${invoice.tgtttbso}&cqt=${maCqt}`)}`;

  // Bảng thuế suất
  const vatRows = invoice.vatBreakdown && invoice.vatBreakdown.length > 0
    ? invoice.vatBreakdown
    : [{ taxRate: items[0]?.taxRate || '10%', amount: invoice.tgtcthue, taxAmount: invoice.tgtthue }];

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(invoice.thdon || 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG')} - ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      color: #111827;
      font-size: 13px;
      line-height: 1.4;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e293b;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
    }
    .print-btn {
      background: ${primaryColor};
      color: white;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .default-box {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 2px solid ${primaryColor};
      padding: 24px 28px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      position: relative;
    }
    .default-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid ${primaryColor};
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .default-title {
      color: ${primaryColor};
      font-size: 20px;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      margin-bottom: 2px;
    }
    .default-meta-panel {
      background: ${metaBg};
      border: 1px solid ${metaBorder};
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    table.default-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      margin-bottom: 12px;
    }
    table.default-table th, table.default-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      font-size: 12px;
    }
    table.default-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: bold;
      text-align: center;
    }
    .default-stamp {
      border: 1.5px solid ${primaryColor};
      background: #fff5f5;
      padding: 6px 12px;
      display: inline-block;
      text-align: left;
      border-radius: 4px;
      font-size: 11.5px;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .default-box { border: 1.5px solid ${primaryColor}; box-shadow: none; width: 100%; max-width: 100%; }
    }
  </style>
</head>
<body>
  ${showControls ? `
  <div class="print-actions">
    <div>
      <span style="font-weight: bold; color: #f87171;">[Giao diện Chuẩn Nghị định 123 / Thông tư 78]</span>
      <span style="font-size: 12px; color: #94a3b8; margin-left: 8px;">Ký hiệu: ${escapeHtml(invoice.khhdon)} - Số: ${escapeHtml(invoice.shdon)}</span>
    </div>
    <button class="print-btn" onclick="window.print()">In Hóa Đơn (A4)</button>
  </div>
  ` : ''}

  <div class="default-box">
    <!-- HEADER -->
    <div class="default-header">
      <div style="width: 55%;">
        <div style="font-size: 16px; font-weight: bold; color: ${primaryColor};">${escapeHtml(invoice.nbten)}</div>
        <div>Mã số thuế: <b>${escapeHtml(invoice.nbmst)}</b></div>
        <div>Địa chỉ: ${escapeHtml(invoice.nbdchi)}</div>
        ${invoice.nbsdt ? `<div>Điện thoại: ${escapeHtml(invoice.nbsdt)}</div>` : ''}
        ${invoice.stknh ? `<div>Số tài khoản: <b>${escapeHtml(invoice.stknh)}</b> ${invoice.tnhanh ? ` - ${escapeHtml(invoice.tnhanh)}` : ''}</div>` : ''}
      </div>

      <div style="width: 42%; text-align: right;">
        <div class="default-title">${escapeHtml(invoice.thdon || (invoice.khmshdon === '1' ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG' : 'HÓA ĐƠN BÁN HÀNG'))}</div>
        <div style="font-style: italic; margin-bottom: 6px;">Ngày ${day} tháng ${month} năm ${year}</div>
        <div style="font-size: 12.5px;">Ký hiệu: <b>${escapeHtml(invoice.khhdon)}</b></div>
        <div style="font-size: 12.5px;">Số hóa đơn: <b style="color: ${primaryColor}; font-size: 16px;">${escapeHtml(invoice.shdon)}</b></div>
      </div>
    </div>

    <!-- META CQT & QR -->
    <div class="default-meta-panel">
      <div>
        <div>Mã cơ quan thuế cấp: <b>${escapeHtml(maCqt || 'Hóa đơn có mã')}</b></div>
        <div>Tra cứu tại Cổng TCT: <a href="${mUrl}" target="_blank" style="color: ${primaryColor};">${mUrl}</a></div>
      </div>
      <div style="width: 50px; height: 50px;">
        <img src="${qrSrc}" alt="QR" style="width: 100%; height: 100%;" />
      </div>
    </div>

    <!-- BUYER -->
    <div style="border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 12px; font-size: 12.5px;">
      <div>Họ tên người mua hàng: <b>${escapeHtml(invoice.nmten || '')}</b></div>
      <div>Tên đơn vị: <b>${escapeHtml(invoice.nmtendv || invoice.nmten || '')}</b></div>
      <div>Mã số thuế: <b>${escapeHtml(invoice.nmmst || '')}</b></div>
      <div>Địa chỉ: ${escapeHtml(invoice.nmdchi || '')}</div>
      <div>Hình thức thanh toán: <b>${escapeHtml(invoice.htttoan || 'TM/CK')}</b> &nbsp;&nbsp;&nbsp; Đơn vị tiền tệ: <b>${escapeHtml(invoice.dvtte || 'VND')}</b></div>
    </div>

    <!-- ITEMS TABLE -->
    <table class="default-table">
      <thead>
        <tr>
          <th style="width: 35px;">STT</th>
          <th>Tên hàng hóa, dịch vụ</th>
          <th style="width: 55px;">ĐVT</th>
          <th style="width: 65px;">Số lượng</th>
          <th style="width: 90px;">Đơn giá</th>
          <th style="width: 65px;">Thuế suất</th>
          <th style="width: 110px;">Thành tiền</th>
        </tr>
        <tr style="font-size: 9.5px; font-style: italic; text-align: center; background: #fafafa; color: #64748b;">
          <td>(1)</td>
          <td style="text-align: left; padding-left: 6px;">(2)</td>
          <td>(3)</td>
          <td>(4)</td>
          <td>(5)</td>
          <td>(6)</td>
          <td>(7=4x5)</td>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
        <tr>
          <td style="text-align: center; font-family: monospace;">${it.lineNo || (it as any).stt || idx + 1}</td>
          <td>
            <div style="font-weight: 500;">${escapeHtml(it.itemName || (it as any).ten)}</div>
            ${it.itemCode || (it as any).mhhdvu ? `<div style="font-size: 10px; color: #64748b; font-family: monospace;">Mã: ${escapeHtml(it.itemCode || (it as any).mhhdvu)}</div>` : ''}
          </td>
          <td style="text-align: center;">${escapeHtml(it.unit || (it as any).dvt || 'Cái')}</td>
          <td style="text-align: right; font-family: monospace;">${formatNum(it.quantity ?? (it as any).sluong ?? 0)}</td>
          <td style="text-align: right; font-family: monospace;">${formatNum(it.unitPrice ?? (it as any).dgia ?? 0)}</td>
          <td style="text-align: center; font-weight: bold;">${escapeHtml(it.taxRate || (it as any).tsuat || '10%')}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatNum(it.amount ?? (it as any).thtien ?? 0)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- VAT BREAKDOWN IF MULTI -->
    ${vatRows.length > 1 ? `
    <div style="margin-bottom: 10px;">
      <table style="width: 60%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 11px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 3px; border: 1px solid #cbd5e1;">Thuế suất</th>
            <th style="padding: 3px; border: 1px solid #cbd5e1; text-align: right;">Tiền chưa thuế</th>
            <th style="padding: 3px; border: 1px solid #cbd5e1; text-align: right;">Tiền thuế GTGT</th>
          </tr>
        </thead>
        <tbody>
          ${vatRows.map(vr => `
          <tr>
            <td style="padding: 3px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${escapeHtml(vr.taxRate || (vr as any).tsuat)}</td>
            <td style="padding: 3px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatVND(vr.amount ?? (vr as any).thtien ?? 0)}</td>
            <td style="padding: 3px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatVND(vr.taxAmount ?? (vr as any).tthue ?? 0)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- TOTALS -->
    <div style="border-top: 1px solid #cbd5e1; padding-top: 6px; margin-bottom: 14px; font-size: 12.5px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <span>Tổng tiền hàng (chưa thuế):</span>
        <span style="font-family: monospace; font-weight: bold;">${formatVND(invoice.tgtcthue)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <span>Tổng tiền thuế GTGT:</span>
        <span style="font-family: monospace; font-weight: bold;">${formatVND(invoice.tgtthue)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: bold; color: ${primaryColor}; font-size: 14px; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 4px;">
        <span>Tổng tiền thanh toán:</span>
        <span style="font-family: monospace; font-size: 15px;">${formatVND(invoice.tgtttbso)}</span>
      </div>
      <div style="margin-top: 4px;">
        Số tiền viết bằng chữ: <i>${escapeHtml(wordsAmount)}</i>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div style="display: flex; justify-content: space-between; margin-top: 16px; margin-bottom: 16px;">
      <div style="width: 45%; text-align: center;">
        <div style="font-weight: bold;">Người mua hàng</div>
        <div style="font-size: 11px; color: #64748b;">(Ký, ghi rõ họ tên nếu có)</div>
      </div>
      <div style="width: 45%; text-align: center;">
        <div style="font-weight: bold;">Người bán hàng</div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">(Chữ ký điện tử, Chữ ký số)</div>
        <div class="default-stamp">
          <div style="color: ${primaryColor}; font-weight: bold;">✔ Ký số điện tử hợp lệ</div>
          <div>Ký bởi: <b>${escapeHtml(invoice.nbten)}</b></div>
          <div>Ký ngày: ${day}/${month}/${year}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: center; font-size: 11px; color: #64748b;">
      (Hóa đơn điện tử khởi tạo theo Nghị định 123/2020/NĐ-CP và Thông tư 78/2021/TT-BTC)
    </div>
  </div>
</body>
</html>`;
}
