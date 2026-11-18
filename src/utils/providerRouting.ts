import type { GDTInvoice } from '../types';
import { extractTagValue } from './xmlParser';
import { providerFromPortal, providerFromXmlPortal, SOLUTION_PROVIDERS, lookupPortalForSeller } from './providerIdentity';

const KNOWN_PROVIDERS = new Set([
  'MISA', 'VIETTEL', 'VNPT', 'EASYINVOICE', '4SI', 'LCS', 'MINVOICE', 'THAISON',
  'BKAV', 'CYBERBILL', 'VNPAY', 'FPT', 'IHOADON', 'VISNAM',
]);

/** Use invoice portal/solution metadata before older inferred provider labels. */
export function resolveInvoiceProvider(invoice: Partial<GDTInvoice> | null | undefined): string | undefined {
  if (!invoice) return undefined;
  const xml = String(invoice.rawXml || '');
  // Explicit issuer portal wins: one e-invoice solution can serve many tenant domains.
  const xmlPortal = providerFromXmlPortal(xml);
  if (xmlPortal) return xmlPortal;
  for (const tag of ['Website', 'Wsite', 'DLTCuu', 'URLTraCuu', 'LinkTraCuu', 'lookupUrl']) {
    const provider = providerFromPortal(extractTagValue(xml, tag));
    if (provider) return provider;
  }
  const sellerMst = String(invoice.nbmst || '').trim();
  const sellerPortal = lookupPortalForSeller(sellerMst);
  if (sellerPortal && providerFromPortal(sellerPortal)) return providerFromPortal(sellerPortal);
  const xmlTax = extractTagValue(xml, 'MSTTCGP').replace(/\D/g, '');
  if (SOLUTION_PROVIDERS[xmlTax]) return SOLUTION_PROVIDERS[xmlTax];
  if (xmlTax.length > 10 && SOLUTION_PROVIDERS[xmlTax.slice(0, 10)]) return SOLUTION_PROVIDERS[xmlTax.slice(0, 10)];
  const tax = String(invoice.msttcgp || '').replace(/\D/g, '');
  if (SOLUTION_PROVIDERS[tax]) return SOLUTION_PROVIDERS[tax];
  if (tax.length > 10 && SOLUTION_PROVIDERS[tax.slice(0, 10)]) return SOLUTION_PROVIDERS[tax.slice(0, 10)];
  if (/minvoice\.vn|minvoice\.com\.vn|tracuuhoadon\.minvoice/i.test(xml)) return 'MINVOICE';
  const portal = providerFromPortal(String(invoice.lookupUrl || ''));
  if (portal) return portal;
  const name = ([extractTagValue(xml, 'TenTCGP'), extractTagValue(xml, 'TCGP'), extractTagValue(xml, 'ToChucGiaiPhap'), invoice.tentcgp || ''].join(' '))
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  for (const [pattern, provider] of [
    [/THAI\s*SON/, 'THAISON'], [/M-?INVOICE/, 'MINVOICE'], [/MISA/, 'MISA'],
    [/VNPT/, 'VNPT'], [/VIETTEL/, 'VIETTEL'], [/SOFTDREAMS|EASYINVOICE/, 'EASYINVOICE'],
    [/BKAV/, 'BKAV'],
    [/L\.?C\.?S\b|LCSSOFT/, 'LCS'], [/VNPAY|THANH TOAN VIET NAM/, 'VNPAY'],
    [/FPT/, 'FPT'], [/4SI/, '4SI'], [/CYBERLOTUS|CYBERBILL/, 'CYBERBILL'],
  ] as const) {
    if (pattern.test(name)) return provider;
  }
  const provider = String(invoice.provider || '').trim().toUpperCase().replace('LCS_SOFT', 'LCS');
  return KNOWN_PROVIDERS.has(provider) ? provider : undefined;
}
