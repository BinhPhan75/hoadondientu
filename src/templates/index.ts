import { GDTInvoice } from '../types';
import { PartnerInvoiceTemplateId, RenderTemplateOptions } from './types';
import { detectPartnerTemplate, PARTNER_METAS, getPartnerMeta } from './partnerRegistry';
import { renderDefaultTemplate } from './DefaultTemplate';

export * from './types';
export * from './partnerRegistry';
export * from './templateUtils';
export { renderDefaultTemplate } from './DefaultTemplate';

// Tuyệt đối không giả lập hóa đơn: mọi đối tác khi không có bản gốc đều hiển thị đúng mẫu chuẩn Tổng cục Thuế (GDT)
export const renderBaoDuyTemplate = renderDefaultTemplate;
export const renderPnjTemplate = renderDefaultTemplate;
export const renderTaiTramAnhTemplate = renderDefaultTemplate;
export const renderXuanVinhTemplate = renderDefaultTemplate;
export const renderKimLoanTuanTemplate = renderDefaultTemplate;
export const renderTkjTemplate = renderDefaultTemplate;
export const renderNghiaSonTemplate = renderDefaultTemplate;
export const renderTanThanhDanhTemplate = renderDefaultTemplate;
export const renderVnpayTemplate = renderDefaultTemplate;

/**
 * Hiển thị Hóa đơn điện tử:
 * Theo yêu cầu người dùng, ĐÃ XÓA TOÀN BỘ các mẫu hóa đơn giả lập nội bộ.
 * Khi không có bản gốc tải từ nhà cung cấp, ứng dụng LUÔN hiển thị và xuất
 * CHÍNH XÁC MẪU CHUẨN TỔNG CỤC THUẾ (GDT / Nghị định 123 / Thông tư 78).
 */
export function renderPartnerInvoiceHtml(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  // Luôn trả về Mẫu chuẩn chính xác của Tổng Cục Thuế (GDT)
  return renderDefaultTemplate(invoice, rawXml, options);
}
