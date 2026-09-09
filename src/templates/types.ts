import { GDTInvoice, InvoiceItem } from '../types';

export type PartnerInvoiceTemplateId =
  | 'BAO_DUY'
  | 'PNJ'
  | 'TAI_TRAM_ANH'
  | 'XUAN_VINH'
  | 'KIM_LOAN_TUAN'
  | 'TKJ'
  | 'NGHIA_SON'
  | 'DEFAULT'
  // Backward-compatibility aliases for existing provider IDs
  | 'MISA'
  | 'VIETTEL'
  | 'VNPT'
  | '4SI'
  | 'EASYINVOICE'
  | 'BKAV'
  | string;

export interface RenderTemplateOptions {
  theme?: 'red' | 'blue';
  qrCodeDataUrl?: string;
  showPrintControls?: boolean;
  watermarkText?: string;
  templateId?: PartnerInvoiceTemplateId;
  provider?: PartnerInvoiceTemplateId;
}

export interface PartnerMeta {
  id: PartnerInvoiceTemplateId;
  name: string;
  shortName: string;
  taxCode: string;
  defaultAddress?: string;
  portalUrl: string;
  providerBrand: string; // e.g., 'Softdreams EasyInvoice', '4Si / LCS', 'MISA meInvoice', 'VNPT Invoice'
  badge: string;
  color: string;
  description: string;
  isCustomPartner: boolean;
}
