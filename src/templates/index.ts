import { GDTInvoice } from '../types';
import { PartnerInvoiceTemplateId, RenderTemplateOptions } from './types';
import { detectPartnerTemplate, PARTNER_METAS, getPartnerMeta } from './partnerRegistry';
import { renderBaoDuyTemplate } from './BaoDuyTemplate';
import { renderPnjTemplate } from './PnjTemplate';
import { renderTaiTramAnhTemplate } from './TaiTramAnhTemplate';
import { renderXuanVinhTemplate } from './XuanVinhTemplate';
import { renderKimLoanTuanTemplate } from './KimLoanTuanTemplate';
import { renderTkjTemplate } from './TkjTemplate';
import { renderNghiaSonTemplate } from './NghiaSonTemplate';
import { renderDefaultTemplate } from './DefaultTemplate';

export * from './types';
export * from './partnerRegistry';
export * from './templateUtils';
export { renderBaoDuyTemplate } from './BaoDuyTemplate';
export { renderPnjTemplate } from './PnjTemplate';
export { renderTaiTramAnhTemplate } from './TaiTramAnhTemplate';
export { renderXuanVinhTemplate } from './XuanVinhTemplate';
export { renderKimLoanTuanTemplate } from './KimLoanTuanTemplate';
export { renderTkjTemplate } from './TkjTemplate';
export { renderNghiaSonTemplate } from './NghiaSonTemplate';
export { renderDefaultTemplate } from './DefaultTemplate';

/**
 * Main dispatcher: Renders the appropriate invoice HTML for any partner
 * or defaults to the standard template.
 */
export function renderPartnerInvoiceHtml(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  // Determine template ID: explicit option, or auto-detected partner
  const templateId: PartnerInvoiceTemplateId =
    options?.templateId || options?.provider || detectPartnerTemplate(invoice, rawXml);

  switch (templateId) {
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

    case 'DEFAULT':
    default:
      return renderDefaultTemplate(invoice, rawXml, options);
  }
}
