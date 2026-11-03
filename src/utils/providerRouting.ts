import { GDTInvoice } from '../types';

const KNOWN_PROVIDERS = new Set([
  'MISA', 'VIETTEL', 'VNPT', 'EASYINVOICE', '4SI', 'LCS', 'MINVOICE',
  'BKAV', 'THAISON', 'CYBERBILL', 'VNPAY', 'FPT', 'LCS_SOFT'
]);

/** Resolve the provider from the strongest identifiers available on the invoice. */
export function resolveInvoiceProvider(invoice: Partial<GDTInvoice> | null | undefined): string | undefined {
  if (!invoice) return undefined;
  const provider = String(invoice.provider || '').trim().toUpperCase();
  if (KNOWN_PROVIDERS.has(provider)) return provider === 'LCS_SOFT' ? 'LCS' : provider;
  if (provider.includes('VNPT')) return 'VNPT';
  if (provider.includes('MISA')) return 'MISA';
  if (provider.includes('EASY') || provider.includes('SOFTDREAMS')) return 'EASYINVOICE';
  if (provider.includes('VIETTEL')) return 'VIETTEL';

  const msttcgp = String(invoice.msttcgp || '').replace(/\D/g, '');
  if (msttcgp === '0101243150') return 'MISA';
  if (msttcgp === '0100684378' || msttcgp === '0100686209') return 'VNPT';
  if (msttcgp === '0100109106') return 'VIETTEL';
  if (msttcgp === '0105987432') return 'EASYINVOICE';
  if (msttcgp === '0315744883' || msttcgp === '0302999571') return '4SI';

  const sellerTaxCode = String(invoice.nbmst || '').replace(/\D/g, '');
  if (['0317978711', '0312105174', '0400557356', '0101243150'].includes(sellerTaxCode)) return 'MISA';

  const lookupUrl = String(invoice.lookupUrl || '').toLowerCase();
  if (lookupUrl.includes('vnpt')) return 'VNPT';
  if (lookupUrl.includes('easyinvoice') || lookupUrl.includes('softdreams')) return 'EASYINVOICE';
  if (lookupUrl.includes('meinvoice') || lookupUrl.includes('misa')) return 'MISA';
  if (lookupUrl.includes('viettel')) return 'VIETTEL';
  const providerText = `${String(invoice.tentcgp || '')} ${String(invoice.caProvider || '')}`.toLowerCase();
  if (providerText.includes('vnpt')) return 'VNPT';
  if (providerText.includes('misa')) return 'MISA';
  if (providerText.includes('easy') || providerText.includes('softdreams')) return 'EASYINVOICE';
  if (providerText.includes('viettel')) return 'VIETTEL';
  return undefined;
}
