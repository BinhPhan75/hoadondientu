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
 * Xuất bản thể hiện HTML hóa đơn điện tử sắc nét, chuẩn xác 100% theo mẫu của Đơn vị cung cấp giải pháp HĐĐT
 * (MISA meInvoice, Viettel S-Invoice, Softdreams EasyInvoice, 4Si, VNPT Invoice, BKAV eHoadon, Nghị định 123/TT 78).
 * 
 * Tự động dò tìm nhà cung cấp từ XML / thông tin HĐ (MSTTCGP, Tên nhà cung cấp, CA chữ ký số)
 * và trả về đúng template của đơn vị đó, đảm bảo đầy đủ hàng hóa chi tiết.
 */
export function generateOfficialInvoiceHtml(
  invoiceOrXml: GDTInvoice | string,
  options?: InvoiceHtmlOptions
): string {
  const invoice: GDTInvoice = typeof invoiceOrXml === 'string'
    ? parseGDTInvoiceXml(invoiceOrXml)
    : invoiceOrXml;

  const rawXml = typeof invoiceOrXml === 'string' ? invoiceOrXml : (invoice.rawXml || '');

  // Nhận diện nhà cung cấp giải pháp HĐĐT:
  // 1. Ưu tiên mẫu do người dùng chủ động chọn (options.provider hoặc options.templateId)
  // 2. Nếu là 'AUTO' hoặc chưa chỉ định -> Dò tìm nhà cung cấp qua XML/thông tin HĐ (MISA, VIETTEL, VNPT, 4SI, EASYINVOICE, BKAV, DEFAULT)
  const targetProvider: InvoiceProviderId = (options?.provider && options.provider !== 'AUTO')
    ? options.provider
    : (options?.templateId && options.templateId !== 'AUTO')
      ? options.templateId
      : detectInvoiceProvider(rawXml, invoice);

  // Luôn luôn trả về bản thể hiện chuẩn theo template của nhà cung cấp đã dò tìm
  return renderInvoiceHtml(invoice, targetProvider, rawXml, options);
}

/**
 * Chuyển đổi trực tiếp chuỗi XML hóa đơn thành HTML bản thể hiện theo mẫu nhà cung cấp.
 */
export function generateInvoiceHtmlFromXml(
  xmlString: string, 
  options?: InvoiceHtmlOptions
): string {
  const parsedInvoice = parseGDTInvoiceXml(xmlString);
  return generateOfficialInvoiceHtml(parsedInvoice, options);
}
