/**
 * MULTI-TEMPLATE INVOICE RENDERER MODULE
 * 
 * Theo yêu cầu người dùng:
 * - ĐÃ XÓA TOÀN BỘ các mẫu hóa đơn giả lập nội bộ đã từng thiết kế trong phần mềm.
 * - Khi không có tệp hóa đơn gốc từ nhà cung cấp, hệ thống LUÔN hiển thị và kết xuất
 *   CHÍNH XÁC MẪU CHUẨN CỦA TỔNG CỤC THUẾ (GDT / Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC).
 * - Giữ lại module nhận diện Nhà cung cấp (detectInvoiceProvider & getProviderMeta) để phục vụ:
 *   + Nhận diện đúng Driver tải hóa đơn gốc từ cổng nhà cung cấp
 *   + Cung cấp link tra cứu và mã FKey chính xác
 *   + Phân loại nhãn nhà cung cấp trên bảng kê
 */

import { GDTInvoice } from '../types';
import { renderDefaultTemplate as renderGDTDefaultTemplate } from '../templates/DefaultTemplate';
import { extractLookupDetailsFromXml } from './xmlParser';
import { buildDirectLookupUrl } from '../templates/templateUtils';

export type InvoiceProviderId = 
  | 'MISA' 
  | 'VIETTEL' 
  | 'VNPT' 
  | '4SI' 
  | 'EASYINVOICE' 
  | 'BKAV' 
  | 'THAISON'
  | 'CYBERBILL'
  | 'VNPAY'
  | 'DEFAULT' 
  | string;

export interface RenderTemplateOptions {
  theme?: 'red' | 'blue';
  qrCodeDataUrl?: string;
  showPrintControls?: boolean;
  watermarkText?: string;
  provider?: InvoiceProviderId;
  templateId?: InvoiceProviderId;
}

/**
 * Nhận diện nhà cung cấp giải pháp HĐĐT để phục vụ tải hóa đơn gốc từ API/Cổng nhà cung cấp
 */
export function detectInvoiceProvider(
  xmlString?: string | null,
  invoice?: GDTInvoice | null
): InvoiceProviderId {
  const raw = xmlString || (invoice?.rawXml || '');

  // 1. Quét XML tìm domain hoặc từ khóa
  if (raw && typeof raw === 'string') {
    if (/vnpayinvoice|0102182292/i.test(raw)) return 'VNPAY';
    if (/meinvoice\.vn|misa\.vn/i.test(raw)) return 'MISA';
    if (/sinvoice|vinvoice|viettel\.vn|vietteltelecom|viettel-invoice|0100109106/i.test(raw)) return 'VIETTEL';
    if (/vnpt-invoice|vnpt\.vn|vinaphone|0100684378/i.test(raw)) return 'VNPT';
    if (/inv\.4si\.vn|4si\.vn|0315744883/i.test(raw)) return '4SI';
    if (/easyinvoice|softdreams|0105987432/i.test(raw)) return 'EASYINVOICE';
    if (/bkav|ehoadon|0101360697/i.test(raw)) return 'BKAV';
    if (/thaison|einvoice\.vn|0101300842/i.test(raw)) return 'THAISON';
    if (/cyberbill|cyberlotus|0105342416/i.test(raw)) return 'CYBERBILL';

    // Quét thẻ MSTTCGP
    const msttcgpMatch = raw.match(/<(?:[a-zA-Z0-9_]+:)?MSTTCGP(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?MSTTCGP>/i);
    if (msttcgpMatch && msttcgpMatch[1]) {
      const msttcgp = msttcgpMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      if (msttcgp === '0100684378') return 'VNPT';
      if (msttcgp === '0101243150') return 'MISA';
      if (msttcgp === '0100109106') return 'VIETTEL';
      if (msttcgp === '0105987432') return 'EASYINVOICE';
      if (msttcgp === '0101360697') return 'BKAV';
      if (msttcgp === '0102182292') return 'VNPAY';
      if (msttcgp === '0315744883') return '4SI';
    }

    // Quét thẻ X509IssuerName / X509SubjectName
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

  // 2. Kiểm tra từ đối tượng invoice nếu có
  if (invoice) {
    if (invoice.provider && invoice.provider !== 'DEFAULT' && invoice.provider !== 'UNKNOWN') {
      return invoice.provider as InvoiceProviderId;
    }
    const tentcgp = (invoice.tentcgp || '').toUpperCase();
    if (tentcgp.includes('VNPT')) return 'VNPT';
    if (tentcgp.includes('MISA')) return 'MISA';
    if (tentcgp.includes('EASY') || tentcgp.includes('SOFTDREAMS')) return 'EASYINVOICE';
    if (tentcgp.includes('VIETTEL')) return 'VIETTEL';
    if (tentcgp.includes('BKAV')) return 'BKAV';
    if (tentcgp.includes('VNPAY')) return 'VNPAY';
    if (tentcgp.includes('4SI') || tentcgp.includes('LCS')) return '4SI';

    const lookupUrl = (invoice.lookupUrl || '').toLowerCase();
    if (lookupUrl.includes('vnpt')) return 'VNPT';
    if (lookupUrl.includes('meinvoice') || lookupUrl.includes('misa')) return 'MISA';
    if (lookupUrl.includes('easyinvoice') || lookupUrl.includes('softdreams')) return 'EASYINVOICE';
    if (lookupUrl.includes('sinvoice') || lookupUrl.includes('viettel')) return 'VIETTEL';
    if (lookupUrl.includes('bkav') || lookupUrl.includes('ehoadon')) return 'BKAV';
  }

  return 'DEFAULT';
}

export function extractLookupDetails(rawXml?: string): { lookupCode: string; lookupUrl: string } {
  return extractLookupDetailsFromXml(rawXml);
}

export { buildDirectLookupUrl };

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
    case 'MISA':
      return {
        id: 'MISA',
        name: 'MISA meInvoice',
        shortName: 'MISA',
        domain: 'meinvoice.vn',
        badge: 'meInvoice',
        color: '#2563eb',
        portalUrl: 'https://www.meinvoice.vn/tra-cuu',
        description: 'Phần mềm hóa đơn điện tử MISA meInvoice (CTCP MISA)'
      };
    case 'VIETTEL':
      return {
        id: 'VIETTEL',
        name: 'Viettel vInvoice / S-Invoice',
        shortName: 'Viettel',
        domain: 'vinvoice.viettel.vn',
        badge: 'vInvoice',
        color: '#dc2626',
        portalUrl: 'https://vinvoice.viettel.vn/utilities/invoice-search',
        description: 'Giải pháp Hóa đơn điện tử Viettel (Tập đoàn Công nghiệp - Viễn thông Quân đội)'
      };
    case 'VNPT':
      return {
        id: 'VNPT',
        name: 'VNPT Invoice',
        shortName: 'VNPT',
        domain: 'vnpt-invoice.com.vn',
        badge: 'VNPT',
        color: '#0284c7',
        portalUrl: 'https://vnpt-invoice.com.vn',
        description: 'Dịch vụ Hóa đơn điện tử VNPT Invoice'
      };
    case '4SI':
      return {
        id: '4SI',
        name: '4Si / LCS E-Invoice',
        shortName: '4Si (LCS)',
        domain: 'inv.4si.vn',
        badge: '4Si',
        color: '#d97706',
        portalUrl: 'https://inv.4si.vn',
        description: 'Giải pháp Hóa đơn điện tử 4Si - LCS (PNJ, Doji...)'
      };
    case 'EASYINVOICE':
      return {
        id: 'EASYINVOICE',
        name: 'EasyInvoice',
        shortName: 'EasyInvoice',
        domain: 'easyinvoice.vn',
        badge: 'EasyInvoice',
        color: '#059669',
        portalUrl: 'https://tracuu.easyinvoice.vn',
        description: 'Hóa đơn điện tử EasyInvoice (Softdreams)'
      };
    case 'BKAV':
      return {
        id: 'BKAV',
        name: 'BKAV eHoadon',
        shortName: 'BKAV',
        domain: 'ehoadon.vn',
        badge: 'eHoadon',
        color: '#ea580c',
        portalUrl: 'https://tracuu.ehoadon.vn',
        description: 'Hóa đơn điện tử Bkav eHoadon'
      };
    case 'VNPAY':
      return {
        id: 'VNPAY',
        name: 'VNPAY Invoice',
        shortName: 'VNPAY',
        domain: 'portal.vnpayinvoice.vn',
        badge: 'VNPAY',
        color: '#0284c7',
        portalUrl: 'https://portal.vnpayinvoice.vn/',
        description: 'Cổng tra cứu hóa đơn điện tử VNPAY Invoice (Vietcombank...)'
      };
    case 'THAISON':
      return {
        id: 'THAISON',
        name: 'Thái Sơn E-Invoice',
        shortName: 'Thái Sơn',
        domain: 'einvoice.vn',
        badge: 'Thái Sơn',
        color: '#0284c7',
        portalUrl: 'https://einvoice.vn/tra-cuu',
        description: 'Hóa đơn điện tử Thái Sơn E-Invoice'
      };
    case 'CYBERBILL':
      return {
        id: 'CYBERBILL',
        name: 'CyberLotus CyberBill',
        shortName: 'CyberBill',
        domain: 'cyberbill.vn',
        badge: 'CyberBill',
        color: '#0284c7',
        portalUrl: 'https://tracuu.cyberbill.vn',
        description: 'Hóa đơn điện tử CyberLotus CyberBill'
      };
    default:
      return {
        id: 'DEFAULT',
        name: 'Mẫu Chuẩn Tổng Cục Thuế (GDT)',
        shortName: 'GDT (TT78/NĐ123)',
        domain: 'hoadondientu.gdt.gov.vn',
        badge: 'Tổng Cục Thuế',
        color: '#b91c1c',
        portalUrl: 'https://hoadondientu.gdt.gov.vn',
        description: 'Bản thể hiện chuẩn hóa đơn điện tử chính thức của Tổng cục Thuế (Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC)'
      };
  }
}

/**
 * RENDERER CHÍNH THỨC:
 * Đã xóa toàn bộ các mẫu giả lập tự tạo.
 * LUÔN trả về CHÍNH XÁC MẪU CHUẨN CỦA TỔNG CỤC THUẾ (GDT).
 */
export function renderDefaultTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  return renderGDTDefaultTemplate(invoice, rawXml, options);
}

export function renderInvoiceHtml(
  invoice: GDTInvoice,
  _providerId?: InvoiceProviderId,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  // Bỏ mọi mẫu giả lập -> Luôn trả về Mẫu chuẩn chính xác của Tổng Cục Thuế
  return renderGDTDefaultTemplate(invoice, rawXml, options);
}

export const renderMisaTemplate = renderDefaultTemplate;
export const renderViettelTemplate = renderDefaultTemplate;
export const renderEasyInvoiceTemplate = renderDefaultTemplate;
export const render4SiTemplate = renderDefaultTemplate;
export const renderVnptTemplate = renderDefaultTemplate;
export const renderBkavTemplate = renderDefaultTemplate;
