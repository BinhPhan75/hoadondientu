import { getInvoiceItemListFromPayload, getLookupCodeFromPayload, getLookupUrlFromPayload, getSellerFromPayload, normalizeInvoiceItem } from './xmlParser';

type GdtInvoiceKey = {
  nbmst?: string;
  khhdon?: string;
  shdon?: string | number;
  khmshdon?: string;
  isPos?: boolean;
};

const value = (source: any, keys: string[]): string => {
  if (!source || typeof source !== 'object') return '';
  for (const key of keys) {
    const found = Object.keys(source).find(k => k.toLowerCase() === key.toLowerCase());
    const raw = found ? source[found] : undefined;
    if (raw !== undefined && raw !== null && String(raw).trim()) return String(raw).trim();
  }
  return '';
};

const isXml = (source: string) => /^\s*(?:<\?xml|<[^>]+>)/i.test(source);

/**
 * The list endpoint is intentionally small. The GDT web UI makes a second
 * request for each invoice before it displays line items and the reference
 * code, so keep that operation in one server-side helper.
 */
export async function fetchGdtInvoiceDetail(
  invoice: GdtInvoiceKey,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<any | null> {
  if (!invoice.nbmst || !invoice.khhdon || !invoice.shdon) return null;

  const params = new URLSearchParams({
    nbmst: invoice.nbmst,
    khhdon: invoice.khhdon,
    shdon: String(invoice.shdon).replace(/^0+(?=\d)/, ''),
    khmshdon: invoice.khmshdon || '1'
  });
  const path = invoice.isPos ? '/api/sco-query/invoices/detail' : '/api/query/invoices/detail';
  const response = await fetch(`https://hoadondientu.gdt.gov.vn${path}?${params.toString()}`, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'End-Point': '/tra-cuu/tra-cuu-hoa-don',
      ...headers
    },
    signal: signal || AbortSignal.timeout(20000)
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data && typeof data === 'object' ? data : null;
}

export function mergeGdtInvoiceDetail(invoice: any, detail: any): any {
  if (!detail) {
    return { ...invoice, sourceCompleteness: 'summary' };
  }

  const seller = getSellerFromPayload(detail);
  const detailItems = getInvoiceItemListFromPayload(detail);
  const detailXml = [detail.xml, detail.xmlData, detail.dataXml, detail.invoiceXml]
    .find(v => typeof v === 'string' && isXml(v));
  const detailLookup = getLookupCodeFromPayload(detail);
  const detailUrl = getLookupUrlFromPayload(detail);

  return {
    ...invoice,
    nbmst: seller.taxCode || value(detail, ['nbmst']) || invoice.nbmst,
    nbten: seller.name || value(detail, ['nbten', 'nbtnnt', 'nbtlhdon']) || invoice.nbten,
    nbdchi: seller.address || value(detail, ['nbdchi']) || invoice.nbdchi,
    nmmst: value(detail, ['nmmst', 'nmtnnt']) || invoice.nmmst,
    nmten: value(detail, ['nmten', 'nmtnnt', 'nmtlhdon']) || invoice.nmten,
    nmdchi: value(detail, ['nmdchi']) || invoice.nmdchi,
    mhdon: value(detail, ['mhdon', 'mccqt', 'MCCQT']) || invoice.mhdon,
    lookupCode: detailLookup || invoice.lookupCode || undefined,
    lookupUrl: detailUrl || invoice.lookupUrl || undefined,
    items: detailItems.length
      ? detailItems.map((item: any, index: number) => normalizeInvoiceItem(item, index))
      : invoice.items,
    ...(detailXml ? { rawXml: detailXml } : {}),
    sourceCompleteness: detailItems.length || detailXml ? 'detail' : 'summary-detail'
  };
}
