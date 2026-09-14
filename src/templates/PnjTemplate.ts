import { GDTInvoice } from '../types';
import { RenderTemplateOptions } from './types';
import { renderDefaultTemplate } from './DefaultTemplate';

/**
 * Hóa đơn Trang sức PNJ (sử dụng giải pháp phần mềm 4SI / L.C.S):
 * Theo chỉ đạo của người dùng, các hóa đơn chưa nhận diện hoặc chưa có mẫu
 * (như 4si của PNJ, viễn thông, điện lực, phí ngân hàng...) sẽ sử dụng theo mẫu chuẩn Tổng cục Thuế (GDT).
 */
export function renderPnjTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  return renderDefaultTemplate(invoice, rawXml, options);
}
