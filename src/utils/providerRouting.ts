import { GDTInvoice } from '../types';

const KNOWN_PROVIDERS = new Set([
  'MISA', 'VIETTEL', 'VNPT', 'EASYINVOICE', '4SI', 'LCS', 'MINVOICE', 'THAISON',
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
  if (provider.includes('MINVOICE') || provider.includes('M-INVOICE')) return 'MINVOICE';
  if (provider.includes('THAISON') || provider.includes('THÁI SƠN')) return 'THAISON';

  const msttcgp = String(invoice.msttcgp || '').replace(/\D/g, '');
  if (msttcgp === '0101243150') return 'MISA';
  if (msttcgp === '0100684378' || msttcgp === '0100686209') return 'VNPT';
  if (msttcgp === '0100109106') return 'VIETTEL';
  if (msttcgp === '0105987432') return 'EASYINVOICE';
  if (msttcgp === '0315744883' || msttcgp === '0302999571') return '4SI';
  if (msttcgp === '0106026495') return 'MINVOICE';
  if (msttcgp === '0101300842') return 'THAISON';
  if (msttcgp === '0101360697') return 'BKAV';

  const sellerTaxCode = String(invoice.nbmst || '').replace(/\D/g, '');
  if (['0317978711', '0312105174', '0400557356', '0101243150'].includes(sellerTaxCode)) return 'MISA';

  const lookupUrl = String(invoice.lookupUrl || '').toLowerCase();
  if (lookupUrl.includes('vnpt')) return 'VNPT';
  if (lookupUrl.includes('easyinvoice') || lookupUrl.includes('softdreams')) return 'EASYINVOICE';
  if (lookupUrl.includes('meinvoice') || lookupUrl.includes('misa')) return 'MISA';
  if (lookupUrl.includes('viettel')) return 'VIETTEL';
  if (lookupUrl.includes('minvoice')) return 'MINVOICE';
  if (lookupUrl.includes('einvoice.vn') || lookupUrl.includes('thaison')) return 'THAISON';
  if (lookupUrl.includes('ehoadon') || lookupUrl.includes('bkav')) return 'BKAV';
  const providerText = `${String(invoice.tentcgp || '')} ${String(invoice.caProvider || '')}`.toLowerCase();
  if (providerText.includes('vnpt')) return 'VNPT';
  if (providerText.includes('misa')) return 'MISA';
  if (providerText.includes('easy') || providerText.includes('softdreams')) return 'EASYINVOICE';
  if (providerText.includes('viettel')) return 'VIETTEL';
  const rawXml = String((invoice as any).rawXml || '').toLowerCase();
  if (rawXml.includes('meinvoice') || rawXml.includes('0101243150') || rawXml.includes('misa-ca')) return 'MISA';
  if (rawXml.includes('minvoice') || rawXml.includes('0106026495')) return 'MINVOICE';
  if (rawXml.includes('einvoice.vn') || rawXml.includes('0101300842')) return 'THAISON';
  if (rawXml.includes('ehoadon.vn') || rawXml.includes('0101360697')) return 'BKAV';
  return undefined;
}
