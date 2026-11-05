import { resolveInvoiceProvider } from '../../utils/providerRouting';
import { providerFromXmlPortal } from '../../utils/providerIdentity';

export type DetectedInvoiceProvider = 
  | 'MISA' 
  | 'VIETTEL' 
  | 'VNPT' 
  | 'LCS'
  | '4SI' 
  | 'EASYINVOICE' 
  | 'MINVOICE'
  | 'BKAV' 
  | 'THAISON'
  | 'CYBERBILL'
  | 'VNPAY'
  | 'FPT'
  | 'UNKNOWN';

export interface DetectionResultDetails {
  provider: DetectedInvoiceProvider;
  priority: 1 | 1.5 | 1.8 | 2 | 0; // 1: Domain URL, 1.5: Solution Provider MSTTCGP, 1.8: Partner MISA, 2: Digital Signature CA, 0: Unknown Fallback
  matchedPattern: string;
  sourceDescription: string;
}

/** A signature CA or seller name alone does not identify the invoice service. */
export function detectProvider(xml: string | null | undefined): DetectedInvoiceProvider {
  return detectProviderWithDetails(xml).provider;
}

export function detectProviderWithDetails(xml: string | null | undefined): DetectionResultDetails {
  const provider = resolveInvoiceProvider({ rawXml: xml || '' }) as DetectedInvoiceProvider | undefined;
  return {
    provider: provider || 'UNKNOWN',
    priority: provider ? (providerFromXmlPortal(xml || '') ? 1 : 1.5) : 0,
    matchedPattern: provider || '',
    sourceDescription: provider ? 'Invoice portal / solution-provider metadata' : 'No invoice provider metadata',
  };
}
