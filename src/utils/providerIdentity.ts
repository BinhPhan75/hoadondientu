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

/**
 * Learned Thai Son lookup portals keyed by seller MST (not hardcoded domains).
 * Store the URL only after it comes from invoice XML, or a user verifies it.
 * Server-side requests receive the resolved URL from the authenticated client.
 */
const THAISON_PORTAL_CACHE_KEY = 'thai_son_portals_v1';
const learnedThaiSonPortals = new Map<string, string>();

export function isTrustedThaiSonPortalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    if (hostname === 'localhost' || hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') || hostname.endsWith('.internal') ||
        hostname === 'metadata.google.internal' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
        hostname.includes(':') || !hostname.includes('.')) return false;
    return true;
  } catch {
    return false;
  }
}

export function rememberThaiSonPortalForSeller(taxCode: string | undefined, url: string): boolean {
  const seller = String(taxCode || '').trim();
  if (!/^\d{10}(?:-\d{3})?$/.test(seller) || !isTrustedThaiSonPortalUrl(url)) return false;
  const clean = new URL(url).origin + '/';
  learnedThaiSonPortals.set(seller, clean);
  if (typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(window.localStorage.getItem(THAISON_PORTAL_CACHE_KEY) || '{}');
      window.localStorage.setItem(THAISON_PORTAL_CACHE_KEY,
        JSON.stringify({ ...existing, [seller]: clean }));
    } catch {
      // Storage quota or privacy mode must not block invoice lookup.
    }
  }
  return true;
}

export function lookupPortalForSeller(taxCode: string | undefined): string | undefined {
  const seller = String(taxCode || '').trim();
  if (!seller) return undefined;
  const inMemory = learnedThaiSonPortals.get(seller);
  if (inMemory) return inMemory;
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = JSON.parse(window.localStorage.getItem(THAISON_PORTAL_CACHE_KEY) || '{}');
    const url = stored?.[seller];
    if (typeof url === 'string' && isTrustedThaiSonPortalUrl(url)) {
      learnedThaiSonPortals.set(seller, url);
      return url;
    }
  } catch {}
  return undefined;
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
      // A marketing homepage is not an invoice lookup portal.
      const tenantHost = host.endsWith('.easyinvoice.vn') || host.endsWith('.easyinvoice.com.vn');
      if (url.protocol === 'https:' && tenantHost &&
          host !== 'www.easyinvoice.vn' && host !== 'www.easyinvoice.com.vn') {
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
