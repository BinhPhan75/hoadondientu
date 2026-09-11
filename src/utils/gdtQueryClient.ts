import { GDTInvoice } from '../types';
import { getInvoiceItemListFromPayload, getLookupCodeFromPayload, getLookupUrlFromPayload, getSellerFromPayload, normalizeInvoiceItem } from './xmlParser';

export interface QueryInvoicesOptions {
  fromDate: string;
  toDate: string;
  invoiceType?: 'purchase' | 'sold' | 'both';
  size?: number;
  token: string;
  cookieHeader?: string;
}

export interface QueryInvoicesResult {
  success: boolean;
  invoices: GDTInvoice[];
  status?: number;
  message?: string;
  source?: 'proxy' | 'direct_browser';
}

function extractGdtInvoiceList(data: any): any[] {
  if (Array.isArray(data)) return data;
  const candidates = [
    data?.datas, data?.rows, data?.content, data?.items, data?.results, data?.result, data?.dshdon,
    data?.data?.datas, data?.data?.rows, data?.data?.content, data?.data?.items,
    data?.data?.results, data?.data?.result, data?.data?.dshdon, data?.data
  ];
  return candidates.find(Array.isArray) || [];
}

const formatDateForGdt = (dateStr: string, isEnd = false) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}${isEnd ? 'T23:59:59' : 'T00:00:00'}`;
  }
  return dateStr;
};

export function normalizeGdtInvoiceItem(item: any, type: 'purchase' | 'sold', isPos = false): GDTInvoice {
  return {
    id: item.id || `GDT_${item.khhdon}_${item.shdon}_${item.nbmst || item.nmmst}`,
    khmshdon: item.khmshdon || item.khmhd || '1',
    khhdon: item.khhdon || '',
    shdon: String(item.shdon || item.shd || '').padStart(7, '0'),
    tdlap: item.tdlap ? item.tdlap.replace(' ', 'T') : new Date().toISOString(),
    nbmst: String(item.nbmst || item.nbMst || getSellerFromPayload(item).taxCode || ''),
    nbten: String(item.nbten || item.nbtnnt || item.nbtlhdon || getSellerFromPayload(item).name || 'Người bán'),
    nbdchi: String(item.nbdchi || item.nbDchi || getSellerFromPayload(item).address || ''),
    nmmst: item.nmmst || '',
    nmten: item.nmten || item.nmtnnt || item.nmtlhdon || 'Người mua',
    nmdchi: item.nmdchi || '',
    tgtcthue: Number(item.tgtcthue ?? item.thtien ?? item.tgtphi ?? 0),
    tgtthue: Number(item.tgtthue ?? item.tthue ?? 0),
    tgtttbso: Number(item.tgtttbso ?? item.tgtttoan ?? item.tongtien ?? ((Number(item.tgtcthue ?? item.thtien ?? 0)) + (Number(item.tgtthue ?? item.tthue ?? 0)))),
    tgtttbchu: item.tgtttbchu || '',
    htttoan: item.htttoan || 'TM/CK',
    tthdon: Number(item.tthdon || 1),
    tthdonLabel: item.tthdon === 1 ? 'Hóa đơn gốc' : item.tthdon === 2 ? 'Hóa đơn thay thế' : item.tthdon === 3 ? 'Hóa đơn điều chỉnh' : 'Hóa đơn hủy',
    ttxly: Number(item.ttxly || 1),
    ttxlyLabel: item.ttxly === 1 ? 'CQT đã cấp mã' : item.ttxly === 2 ? 'CQT chưa cấp mã' : 'Đã tiếp nhận',
    mhdon: item.mhdon || '',
    hsgcma: Boolean(item.mhdon || item.hsgcma),
    loaiHdon: type,
    hasDigitalSignature: true,
    signerName: item.nbten || item.nbtnnt || item.nbtlhdon || 'Người nộp thuế',
    signedDate: item.tdlap,
    caProvider: 'Tổng cục Thuế CQT',
    msttcgp: item.msttcgp || item.mst_tcgp || '',
    tentcgp: item.tentcgp || item.ten_tcgp || item.tctchuc || '',
    lookupCode: getLookupCodeFromPayload(item),
    lookupUrl: getLookupUrlFromPayload(item),
    items: getInvoiceItemListFromPayload(item).map((it: any, idx: number) => normalizeInvoiceItem(it, idx)),
    sourceCompleteness: 'summary',
    isPos
  };
}

/**
 * Direct browser query to official GDT endpoints from the client in Vietnam
 */
async function queryDirectFromBrowser(
  type: 'purchase' | 'sold',
  source: 'query' | 'sco-query',
  fromDate: string,
  toDate: string,
  token: string,
  cookieHeader: string = '',
  size = 50
): Promise<{ list: GDTInvoice[]; isExpired?: boolean }> {
  const gdtFrom = formatDateForGdt(fromDate, false);
  const gdtTo = formatDateForGdt(toDate, true);
  const searchParam = `tdlap=ge=${gdtFrom};tdlap=le=${gdtTo}`;
  const apiBase = source === 'sco-query' ? 'sco-query' : 'query';
  const url = `https://hoadondientu.gdt.gov.vn/api/${apiBase}/invoices/${type}?sort=tdlap:desc&size=${size}&page=0&search=${encodeURIComponent(searchParam)}`;

  const tokenHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Authorization': tokenHeader,
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
      }
    });

    if (res.status === 401 || res.status === 403) {
      return { list: [], isExpired: true };
    }

    if (!res.ok) {
      return { list: [] };
    }

    const raw = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return { list: [] };
    }

    const rawList = extractGdtInvoiceList(data);
    const normalized = rawList.map((item: any) => normalizeGdtInvoiceItem(item, type, source === 'sco-query'));
    return { list: normalized };
  } catch {
    return { list: [] };
  }
}

/**
 * Unified resilient invoice query:
 * 1. Tries the Serverless Backend Proxy (/api/gdt/query-invoices)
 * 2. If proxy fails, times out, returns 502/504 (e.g. Vercel IP blocked by GDT firewall),
 *    automatically falls back to direct browser fetch to hoadondientu.gdt.gov.vn
 */
export async function executeGdtInvoiceQuery(options: QueryInvoicesOptions): Promise<QueryInvoicesResult> {
  const { fromDate, toDate, invoiceType = 'purchase', size = 50, token, cookieHeader = '' } = options;

  let proxyError: string | null = null;
  let proxyStatus: number | null = null;

  // Step 1: Attempt Serverless Proxy
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for Vercel

    const res = await fetch('/api/gdt/query-invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        ...(cookieHeader ? { 'x-gdt-cookie': cookieHeader } : {})
      },
      body: JSON.stringify({
        fromDate,
        toDate,
        invoiceType,
        size,
        token,
        cookieHeader
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    proxyStatus = res.status;

    if (res.status === 401) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        status: 401,
        invoices: [],
        message: errData.message || 'Phiên Cổng Thuế đã hết hạn. Vui lòng nhập Captcha để đăng nhập lại.'
      };
    }

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.invoices) && data.invoices.length > 0) {
        return {
          success: true,
          invoices: data.invoices,
          source: 'proxy'
        };
      }
      // If proxy returned 0 invoices, let's verify with direct browser fetch just in case
      // Vercel server was throttled or blocked by GDT
    } else {
      proxyError = `Proxy HTTP ${res.status}`;
    }
  } catch (err: any) {
    proxyError = err?.message || 'Proxy connection error';
  }

  // Step 2: Fallback to Direct Browser Query (Runs directly from the user's browser in Vietnam)
  try {
    const typesToFetch: ('purchase' | 'sold')[] = invoiceType === 'both' ? ['purchase', 'sold'] : [invoiceType as 'purchase' | 'sold'];
    let directInvoices: GDTInvoice[] = [];

    for (const t of typesToFetch) {
      // Regular invoices
      const regRes = await queryDirectFromBrowser(t, 'query', fromDate, toDate, token, cookieHeader, size);
      if (regRes.isExpired) {
        return {
          success: false,
          status: 401,
          invoices: [],
          message: 'Phiên Cổng Thuế đã hết hạn. Vui lòng nhập Captcha để đăng nhập lại.'
        };
      }
      directInvoices = directInvoices.concat(regRes.list);

      // POS / Computer Invoices (Máy tính tiền)
      const posRes = await queryDirectFromBrowser(t, 'sco-query', fromDate, toDate, token, cookieHeader, size);
      if (posRes.list.length > 0) {
        directInvoices = directInvoices.concat(posRes.list);
      }
    }

    // Deduplicate by ID
    const uniqueMap = new Map<string, GDTInvoice>();
    directInvoices.forEach(inv => uniqueMap.set(inv.id, inv));
    const finalInvoices = Array.from(uniqueMap.values());

    return {
      success: true,
      invoices: finalInvoices,
      source: 'direct_browser'
    };
  } catch (directErr: any) {
    return {
      success: false,
      status: proxyStatus || 500,
      invoices: [],
      message: proxyError || directErr?.message || 'Không thể lấy hóa đơn từ Cổng Thuế.'
    };
  }
}
