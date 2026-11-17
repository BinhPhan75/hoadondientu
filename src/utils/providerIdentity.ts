const PORTALS: Record<string, string[]> = {
  MISA: ['meinvoice.vn', 'misa.vn'],
  THAISON: ['einvoice.vn', 'einvoice.com.vn', 'thaison.vn'],
  IHOADON: ['ihoadon.vn'],
  MINVOICE: ['minvoice.vn', 'minvoice.com.vn'],
  VIETTEL: ['sinvoice.viettel.vn', 'vinvoice.viettel.vn', 'sinvoice.vn'],
  VNPT: ['vnpt-invoice.com.vn', 'vnpt-invoice.vn', 'invoice.vnpt.vn'],
  EASYINVOICE: ['easyinvoice.vn', 'easyinvoice.com.vn', 'softdreams.vn'],
  BKAV: ['ehoadon.vn', 'ehoadon.bkav.com'],
  LCS: ['lcssoft.com.vn'], '4SI': ['4si.vn'], VNPAY: ['vnpayinvoice.vn', 'einvoice.vietcombank.com.vn'],
  CYBERBILL: ['cyberbill.vn'], FPT: ['hoadon.ftg.vn', 'hoadondientu.fpt.com.vn'],
};

export const SELLER_LOOKUP_PORTALS: Record<string, string> = {
  // Only this Co.opmart branch has a verified, tenant-specific lookup portal.
  // Never reuse it for every Thai Son/einvoice tenant.
  '0301175691-021': 'https://saigoncoop.einvoice.com.vn/',
};

export function lookupPortalForSeller(taxCode: string | undefined): string | undefined {
  return SELLER_LOOKUP_PORTALS[String(taxCode || '').trim()];
}

/**
 * EasyInvoice supports a common lookup portal and seller-specific portals.
 * Retain an explicit EasyInvoice URL from XML. A missing URL can be resolved
 * from the seller MST without relying on an unverified per-seller registry.
 */
export function easyInvoiceLookupPortals(sellerMst?: string, explicitUrl?: string): {
  primary: string;
  common: string;
  seller?: string;
} {
  const common = 'https://tracuu.easyinvoice.vn/Search/Index';
  const cleanMst = String(sellerMst || '').trim();
  const seller = /^\d{10}(?:-?\d{3})?$/.test(cleanMst)
    ? `https://${cleanMst.replace(/\D/g, '')}hd.easyinvoice.com.vn/Search/Index`
    : undefined;

  let explicit: string | undefined;
  if (explicitUrl) {
    try {
      const url = new URL(explicitUrl);
      const host = url.hostname.toLowerCase();
      if (url.protocol === 'https:' &&
          (host === 'easyinvoice.vn' || host.endsWith('.easyinvoice.vn') ||
           host === 'easyinvoice.com.vn' || host.endsWith('.easyinvoice.com.vn'))) {
        const cleanPath = url.pathname.replace(/\/+$/, '');
        url.pathname = /\/Search\/Index$/i.test(cleanPath)
          ? cleanPath
          : cleanPath === '' || cleanPath === '/' ? '/Search/Index' : cleanPath;
        explicit = url.toString();
      }
    } catch {}
  }
  return { primary: explicit || seller || common, common, seller };
}

export function easyInvoiceLookupUrl(sellerMst?: string, code?: string, explicitUrl?: string): string {
  const portal = easyInvoiceLookupPortals(sellerMst, explicitUrl).primary;
  const url = new URL(portal);
  if (code?.trim()) url.searchParams.set('fkey', code.trim());
  return url.toString();
}

export const SOLUTION_PROVIDERS: Record<string, string> = {
  '0101243150': 'MISA', '0101300842': 'THAISON', '0106026495': 'MINVOICE',
  '0100684378': 'VNPT', '0100686209': 'VNPT', '0100109106': 'VIETTEL',
  '0105987432': 'EASYINVOICE', '0315744883': '4SI', '0302999571': 'LCS',
  '0101360697': 'BKAV', '0102182292': 'VNPAY', '0104128565': 'FPT', '0107871301': 'CYBERBILL',
};

export function providerFromPortal(value: string): string | undefined {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    const host = url.hostname.toLowerCase();
    return Object.entries(PORTALS).find(([, domains]) =>
      domains.some(domain => host === domain || host.endsWith(`.${domain}`)))?.[0];
  } catch { return undefined; }
}

export function providerFromXmlPortal(xml: string): string | undefined {
  // Certificate issuers and contact email addresses are not invoice portals.
  const content = xml.replace(/<(?:\w+:)?(?:Signature|X509Certificate|X509IssuerName|X509SubjectName)\b[^>]*>[\s\S]*?<\/(?:\w+:)?(?:Signature|X509Certificate|X509IssuerName|X509SubjectName)>/gi, '');
  for (const url of content.match(/https?:\/\/[^\s<>"']+/gi) || []) {
    const provider = providerFromPortal(url.replace(/\]\]>.*$/, ''));
    if (provider) return provider;
  }
  return undefined;
}
