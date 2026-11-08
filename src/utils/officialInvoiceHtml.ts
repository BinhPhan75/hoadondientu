import { GDTInvoice } from '../types';
import { parseGDTInvoiceXml } from './xmlParser';
import {
  detectInvoiceProvider,
  renderInvoiceHtml,
  InvoiceProviderId,
  renderMisaTemplate,
  renderViettelTemplate,
  renderEasyInvoiceTemplate,
  render4SiTemplate,
  renderVnptTemplate,
  renderBkavTemplate,
  renderDefaultTemplate,
  RenderTemplateOptions
} from './multiTemplateRenderer';

export {
  detectInvoiceProvider,
  renderInvoiceHtml,
  renderMisaTemplate,
  renderViettelTemplate,
  renderEasyInvoiceTemplate,
  render4SiTemplate,
  renderVnptTemplate,
  renderBkavTemplate,
  renderDefaultTemplate
};
export type { InvoiceProviderId };

export interface InvoiceHtmlOptions extends RenderTemplateOptions {
  theme?: 'red' | 'blue';
  qrCodeDataUrl?: string;
  showPrintControls?: boolean;
  provider?: InvoiceProviderId;
  templateId?: InvoiceProviderId;
  watermarkText?: string;
  disableAutoDetect?: boolean;
}

/**
 * Xuất bản thể hiện HTML hóa đơn điện tử:
 * Theo yêu cầu người dùng, ĐÃ XÓA TOÀN BỘ CÁC MẪU GIẢ LẬP.
 * Ứng dụng luôn trả về CHÍNH XÁC MẪU CHUẨN CỦA TỔNG CỤC THUẾ (GDT)
 * (Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC) khi không có bản gốc nhà cung cấp.
 */
export function generateOfficialInvoiceHtml(
  invoiceOrXml: GDTInvoice | string,
  options?: InvoiceHtmlOptions
): string {
  const invoice: GDTInvoice = typeof invoiceOrXml === 'string'
    ? parseGDTInvoiceXml(invoiceOrXml)
    : invoiceOrXml;

  const rawXml = typeof invoiceOrXml === 'string' ? invoiceOrXml : (invoice.rawXml || '');

  // Luôn luôn trả về bản thể hiện chuẩn chính xác theo mẫu Tổng cục Thuế (GDT)
  return renderDefaultTemplate(invoice, rawXml, options);
}

/**
 * Chuyển đổi trực tiếp chuỗi XML hóa đơn thành HTML bản thể hiện chuẩn Tổng cục Thuế.
 */
export function generateInvoiceHtmlFromXml(
  xmlString: string, 
  options?: InvoiceHtmlOptions
): string {
  const parsedInvoice = parseGDTInvoiceXml(xmlString);
  return generateOfficialInvoiceHtml(parsedInvoice, options);
}
