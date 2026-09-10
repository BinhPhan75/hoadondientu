import JSZip from 'jszip';
import { getInvoiceItemListFromPayload, getLookupCodeFromPayload, getLookupUrlFromPayload, getSellerFromPayload, isPlaceholderItemName, normalizeInvoiceItem, parseGDTInvoiceXml } from './xmlParser';

type GdtInvoiceKey = {
  nbmst?: string;
  khhdon?: string;
  shdon?: string | number;
  khmshdon?: string;
  isPos?: boolean;
  loaiHdon?: 'purchase' | 'sold';
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

const GDT_REQUEST_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://hoadondientu.gdt.gov.vn/',
  'Origin': 'https://hoadondientu.gdt.gov.vn',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin'
};

const getInvoiceParams = (invoice: GdtInvoiceKey) => new URLSearchParams({
  nbmst: invoice.nbmst || '',
  khhdon: invoice.khhdon || '',
  // GDT identifies an invoice by the displayed serial number, including
  // leading zeroes (for example 0000237). Do not convert it to 237.
  shdon: String(invoice.shdon || ''),
  khmshdon: invoice.khmshdon || '1'
});

const getInvoiceEndpoint = (invoice: GdtInvoiceKey, action: string) =>
  `https://hoadondientu.gdt.gov.vn${invoice.isPos ? '/api/sco-query' : '/api/query'}/invoices/${action}`;

const getInvoiceAction = (invoice: GdtInvoiceKey, exportAction = false) => {
  const prefix = exportAction ? 'Xu%E1%BA%A5t' : 'Xem';
  if (invoice.isPos) return `${prefix}%20h%C3%B3a%20%C4%91%C6%A1n%20(h%C3%B3a%20%C4%91%C6%A1n%20m%C3%A1y%20t%C3%ADnh%20ti%E1%BB%81n%20mua%20v%C3%A0o)`;
  return invoice.loaiHdon === 'sold'
    ? `${prefix}%20h%C3%B3a%20%C4%91%C6%A1n%20(h%C3%B3a%20%C4%91%C6%A1n%20b%C3%A1n%20ra)`
    : `${prefix}%20h%C3%B3a%20%C4%91%C6%A1n%20(h%C3%B3a%20%C4%91%C6%A1n%20mua%20v%C3%A0o)`;
};

async function readXmlFromExport(bytes: Uint8Array, contentType: string): Promise<string> {
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '').trim();
  if (isXml(text) && /(?:HDon|DLHDon|HHDVu|Invoice|Factura)/i.test(text)) return text;
  if (!contentType.toLowerCase().includes('zip') && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) return '';
  const zip = await JSZip.loadAsync(bytes);
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const entryText = (await entry.async('text')).replace(/^\uFEFF/, '').trim();
    if (isXml(entryText) && /(?:HDon|DLHDon|HHDVu|Invoice|Factura)/i.test(entryText)) return entryText;
  }
  return '';
}

function findInvoiceDocument(source: any, seen = new Set<any>(), depth = 0): string {
  if (!source || depth > 5 || seen.has(source)) return '';
  if (typeof source === 'string') {
    const value = source.trim();
    if (isXml(value) && /(?:HDon|DLHDon|HHDVu|Invoice|Factura)/i.test(value)) return value;
    // Some responses carry the XML as base64 in a document/content field.
    if (value.length > 200 && /^[A-Za-z0-9+/=\r\n]+$/.test(value)) {
      try {
        const decoded = Buffer.from(value, 'base64').toString('utf8').trim();
        if (isXml(decoded) && /(?:HDon|DLHDon|HHDVu|Invoice|Factura)/i.test(decoded)) return decoded;
      } catch { /* not a base64 document */ }
    }
    return '';
  }
  if (typeof source !== 'object') return '';
  seen.add(source);
  const preferredKeys = ['xml', 'xmlData', 'dataXml', 'invoiceXml', 'document', 'documentXml', 'content', 'fileContent', 'html'];
  for (const key of preferredKeys) {
    const actual = Object.keys(source).find(k => k.toLowerCase() === key.toLowerCase());
    const found = actual ? findInvoiceDocument(source[actual], seen, depth + 1) : '';
    if (found) return found;
  }
  for (const value of Object.values(source)) {
    const found = findInvoiceDocument(value, seen, depth + 1);
    if (found) return found;
  }
  return '';
}

export type GdtXmlExportResult = {
  xml: string;
  status: number;
  contentType: string;
  bytes: number;
  url: string;
};

export async function fetchGdtInvoiceXml(
  invoice: GdtInvoiceKey,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<GdtXmlExportResult> {
  const url = `${getInvoiceEndpoint(invoice, 'export-xml')}?${getInvoiceParams(invoice).toString()}`;
  if (!invoice.nbmst || !invoice.khhdon || !invoice.shdon) return { xml: '', status: 0, contentType: '', bytes: 0, url };
  const response = await fetch(url, {
    headers: {
      ...GDT_REQUEST_HEADERS,
      Accept: 'application/zip, application/xml, text/xml, application/octet-stream, */*',
      'End-Point': '/tra-cuu/tra-cuu-hoa-don',
      Action: getInvoiceAction(invoice, true),
      ...headers
    },
    signal: signal || AbortSignal.timeout(30000)
  });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    console.warn(`[GDT XML export] HTTP ${response.status} for ${invoice.khhdon}/${invoice.shdon}`);
    return { xml: '', status: response.status, contentType, bytes: 0, url };
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const xml = await readXmlFromExport(bytes, contentType);
  console.info(`[GDT XML export] ${invoice.khhdon}/${invoice.shdon}: HTTP ${response.status}, ${bytes.byteLength} bytes, ${contentType || 'unknown'}, XML=${xml ? 'yes' : 'no'}`);
  return { xml, status: response.status, contentType, bytes: bytes.byteLength, url };
}

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

  const params = getInvoiceParams(invoice);
  const path = invoice.isPos ? '/api/sco-query/invoices/detail' : '/api/query/invoices/detail';
  const response = await fetch(`https://hoadondientu.gdt.gov.vn${path}?${params.toString()}`, {
    headers: {
      ...GDT_REQUEST_HEADERS,
      Accept: 'application/json, text/plain, */*',
      'End-Point': '/tra-cuu/tra-cuu-hoa-don',
      Action: getInvoiceAction(invoice),
      ...headers
    },
    signal: signal || AbortSignal.timeout(20000)
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data && typeof data === 'object' ? data : null;
}

export function mergeGdtInvoiceDetail(invoice: any, detail: any, exportedXml = ''): any {
  if (!detail && !exportedXml) {
    return { ...invoice, sourceCompleteness: 'summary' };
  }
  detail = detail || {};

  // Depending on the portal version, detail is returned directly or wrapped
  // under data/result/invoice. Always parse the object that owns hdhhdvu.
  const candidates: any[] = [];
  const visit = (candidate: any, depth: number) => {
    if (!candidate || typeof candidate !== 'object' || candidates.includes(candidate) || depth > 3) return;
    candidates.push(candidate);
    visit(candidate.data, depth + 1);
    visit(candidate.result, depth + 1);
    visit(candidate.invoice, depth + 1);
  };
  visit(detail, 0);
  const hasNamedItems = (candidate: any) => getInvoiceItemListFromPayload(candidate)
    .some((item: any, index: number) => !isPlaceholderItemName(normalizeInvoiceItem(item, index).itemName));
  // Prefer the object that actually owns named hdhhdvu rows. The outer
  // response often has mhdon but only the nested data object has item names.
  const detailSource = candidates.find(hasNamedItems)
    || candidates.find(candidate => {
      const xml = [candidate.xml, candidate.xmlData, candidate.dataXml, candidate.invoiceXml];
      return xml.some(v => typeof v === 'string' && isXml(v));
    })
    || candidates.find(candidate => getLookupCodeFromPayload(candidate) || value(candidate, ['mtdtchieu', 'mhdon', 'nbmst']))
    || detail;
  const seller = getSellerFromPayload(detailSource);
  const detailItems = getInvoiceItemListFromPayload(detailSource)
    .map((item: any, index: number) => normalizeInvoiceItem(item, index))
    .filter(item => !isPlaceholderItemName(item.itemName));
  const detailXml = exportedXml || findInvoiceDocument(detail);
  let xmlItems: any[] = [];
  if (detailXml) {
    try {
      xmlItems = parseGDTInvoiceXml(detailXml).items
        .filter(item => !isPlaceholderItemName(item.itemName));
    } catch { /* keep JSON detail if XML is not a supported invoice document */ }
  }
  const authoritativeItems = xmlItems.length ? xmlItems : detailItems;
  const detailLookup = getLookupCodeFromPayload(detailSource);
  const detailUrl = getLookupUrlFromPayload(detailSource);

  return {
    ...invoice,
    nbmst: seller.taxCode || value(detailSource, ['nbmst']) || invoice.nbmst,
    nbten: seller.name || value(detailSource, ['nbten', 'nbtnnt', 'nbtlhdon']) || invoice.nbten,
    nbdchi: seller.address || value(detailSource, ['nbdchi']) || invoice.nbdchi,
    nmmst: value(detailSource, ['nmmst', 'nmtnnt']) || invoice.nmmst,
    nmten: value(detailSource, ['nmten', 'nmtnnt', 'nmtlhdon']) || invoice.nmten,
    nmdchi: value(detailSource, ['nmdchi']) || invoice.nmdchi,
    mhdon: value(detailSource, ['mhdon', 'mccqt', 'MCCQT']) || invoice.mhdon,
    lookupCode: detailLookup || invoice.lookupCode || undefined,
    lookupUrl: detailUrl || invoice.lookupUrl || undefined,
    items: authoritativeItems,
    ...(detailXml ? { rawXml: detailXml } : {}),
    sourceCompleteness: authoritativeItems.length || detailXml ? 'detail' : 'summary-detail'
  };
}
