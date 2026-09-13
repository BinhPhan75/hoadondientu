import { GDTInvoice } from '../types';
import { getInvoiceItemListFromPayload, getLookupCodeFromPayload, getLookupUrlFromPayload, getSellerFromPayload, normalizeInvoiceItem } from './xmlParser';
import { fetchGdtInvoiceDetail, fetchGdtInvoiceXml, mergeGdtInvoiceDetail } from './gdtDetail';

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

export interface LoginOptions {
  taxCode: string;
  password: string;
  captchaKey?: string;
  captchaCode?: string;
  captchaCookie?: string;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  taxpayerName?: string;
  address?: string;
  cookieHeader?: string;
  error?: string;
  source?: 'proxy' | 'direct_browser';
}

export interface CaptchaResult {
  success: boolean;
  captchaImage: string;
  captchaKey: string;
  captchaCookie?: string;
  source?: 'proxy' | 'direct_browser';
  error?: string;
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
 * Fetch Captcha with Dual-Strategy (Server Proxy + Direct GDT Portal Fallback)
 */
export async function executeGdtCaptcha(): Promise<CaptchaResult> {
  // Strategy 1: Serverless Backend Proxy (/api/gdt/captcha)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('/api/gdt/captcha', { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const rawText = await res.text();
      let data: any = null;
      try { data = JSON.parse(rawText); } catch {}
      if (data && data.success && data.captchaImage) {
        return {
          success: true,
          captchaImage: data.captchaImage,
          captchaKey: data.captchaKey || '',
          captchaCookie: data.captchaCookie || '',
          source: 'proxy'
        };
      }
    }
  } catch (proxyErr) {
    console.warn('[Proxy Captcha Failed, attempting direct fetch]:', proxyErr);
  }

  // Strategy 2: Direct browser fetch from official GDT Portal
  try {
    const directRes = await fetch('https://hoadondientu.gdt.gov.vn/api/captcha', {
      method: 'GET',
      headers: { 'Accept': 'application/json, text/plain, */*' },
      credentials: 'include'
    });

    if (directRes.ok) {
      const rawDirect = await directRes.text();
      let directData: any = null;
      try { directData = JSON.parse(rawDirect); } catch {}
      if (directData && directData.key && directData.content) {
        const imgUrl = directData.content.startsWith('data:')
          ? directData.content
          : `data:image/svg+xml;utf8,${encodeURIComponent(directData.content)}`;

        return {
          success: true,
          captchaImage: imgUrl,
          captchaKey: directData.key,
          source: 'direct_browser'
        };
      }
    }
  } catch (directErr) {
    console.warn('[Direct GDT Captcha Failed]:', directErr);
  }

  return {
    success: false,
    captchaImage: '',
    captchaKey: '',
    error: 'Không thể tải mã Captcha từ máy chủ Thuế. Vui lòng bấm làm mới để thử lại.'
  };
}

/**
 * Resilient GDT Login with Dual-Strategy (Server Proxy + Direct GDT Portal Fallback)
 */
export async function executeGdtLogin(options: LoginOptions): Promise<LoginResult> {
  const { taxCode, password, captchaKey, captchaCode, captchaCookie } = options;

  // Strategy 1: Serverless Proxy /api/gdt/login
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('/api/gdt/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taxCode: taxCode.trim(),
        password: password.trim(),
        captchaKey,
        captchaCode: (captchaCode || '').trim(),
        captchaCookie
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    const raw = await res.text();
    let data: any = null;
    try { data = JSON.parse(raw); } catch {}

    if (res.ok && data?.success && data.session?.token) {
      return {
        success: true,
        token: data.session.token,
        taxpayerName: data.session.taxpayerName,
        address: data.session.address,
        cookieHeader: data.session.cookieHeader,
        source: 'proxy'
      };
    }

    if (res.status === 400 && data?.message) {
      // Captcha or password error specifically reported by GDT via proxy
      // Let's attempt direct fallback anyway just in case the proxy had an issue
    }
  } catch (proxyErr) {
    console.warn('[Proxy Login Failed, attempting direct browser auth]:', proxyErr);
  }

  // Strategy 2: Direct browser authentication from Vietnam client
  try {
    const directRes = await fetch('https://hoadondientu.gdt.gov.vn/api/security-taxpayer/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      credentials: 'include',
      body: JSON.stringify({
        username: taxCode.trim(),
        password: password.trim(),
        ckey: captchaKey || '',
        cvalue: (captchaCode || '').trim()
      })
    });

    if (directRes.ok) {
      const data = await directRes.json();
      if (data && data.token) {
        const cleanToken = data.token.startsWith('Bearer ') ? data.token : `Bearer ${data.token}`;
        return {
          success: true,
          token: cleanToken,
          taxpayerName: data.user?.fullName || data.user?.name || data.name || data.taxpayerName || `DOANH NGHIỆP NỘP THUẾ (${taxCode.trim()})`,
          address: data.user?.address || data.address || 'Đăng ký tại Tổng cục Thuế',
          source: 'direct_browser'
        };
      }
    } else {
      let errText = '';
      try {
        const errJson = await directRes.json();
        errText = errJson.message || errJson.error || '';
      } catch {}
      return {
        success: false,
        error: errText || `Xác thực thất bại từ Cổng Tổng cục Thuế (HTTP ${directRes.status}). Vui lòng kiểm tra lại MST, Mật khẩu hoặc Captcha.`
      };
    }
  } catch (directErr: any) {
    console.warn('[Direct GDT Login Failed]:', directErr);
    return {
      success: false,
      error: directErr?.message || 'Không thể kết nối đến máy chủ Tổng cục Thuế.'
    };
  }

  return {
    success: false,
    error: 'Xác thực thất bại từ Cổng Tổng cục Thuế. Vui lòng kiểm tra lại MST, Mật khẩu hoặc Captcha.'
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
  size = 50
): Promise<{ list: GDTInvoice[]; isExpired?: boolean }> {
  const gdtFrom = formatDateForGdt(fromDate, false);
  const gdtTo = formatDateForGdt(toDate, true);
  const searchParam = `tdlap=ge=${gdtFrom};tdlap=le=${gdtTo}`;
  const apiBase = source === 'sco-query' ? 'sco-query' : 'query';
  const tokenHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

  let allInvoices: GDTInvoice[] = [];
  let page = 0;
  const maxPages = 20; // Support up to 1000 invoices per month chunk

  while (page < maxPages) {
    const url = `https://hoadondientu.gdt.gov.vn/api/${apiBase}/invoices/${type}?sort=tdlap:desc&size=${size}&page=${page}&search=${encodeURIComponent(searchParam)}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Authorization': tokenHeader
        },
        credentials: 'include'
      });

      if (res.status === 401 || res.status === 403) {
        return { list: allInvoices, isExpired: true };
      }

      if (!res.ok) {
        break;
      }

      const raw = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(raw);
      } catch {
        break;
      }

      const rawList = extractGdtInvoiceList(data);
      if (!Array.isArray(rawList) || rawList.length === 0) {
        break;
      }

      const normalized = rawList.map((item: any) => normalizeGdtInvoiceItem(item, type, source === 'sco-query'));
      allInvoices = allInvoices.concat(normalized);

      const total = Number(data.total ?? data.totalElements ?? data.totalCount ?? 0);
      if (total > 0 && allInvoices.length >= total) {
        break;
      }

      if (rawList.length < size) {
        break;
      }

      page++;
      await new Promise(r => setTimeout(r, 200));
    } catch {
      break;
    }
  }

  return { list: allInvoices };
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
      // If proxy returned 0 invoices, verify with direct browser fetch just in case
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
      const regRes = await queryDirectFromBrowser(t, 'query', fromDate, toDate, token, size);
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
      const posRes = await queryDirectFromBrowser(t, 'sco-query', fromDate, toDate, token, size);
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

/**
 * Resilient Invoice Detail & XML Enrichment
 * Tries server proxy first, then falls back to direct browser fetch
 */
export async function executeGdtInvoiceDetail(
  invoice: GDTInvoice,
  token: string,
  cookie: string = ''
): Promise<GDTInvoice | null> {
  // Strategy 1: Serverless Proxy
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch('/api/gdt/invoice-detail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': token } : {}),
        ...(cookie ? { 'x-gdt-cookie': cookie } : {})
      },
      body: JSON.stringify({ invoice, token, cookieHeader: cookie }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data && data.success && data.invoice) {
        return data.invoice as GDTInvoice;
      }
    }
  } catch {
    // Proxy failed or timed out on Vercel
  }

  // Strategy 2: Direct browser fetch from Vietnam client
  try {
    const tokenHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    const gdtHeaders: Record<string, string> = {
      Authorization: tokenHeader
    };
    const detail = await fetchGdtInvoiceDetail(invoice, gdtHeaders);
    let xmlExport = { xml: '', status: 0, contentType: '', bytes: 0, url: '' };
    try {
      xmlExport = await fetchGdtInvoiceXml(invoice, gdtHeaders);
    } catch {}

    const merged = mergeGdtInvoiceDetail(invoice, detail, xmlExport.xml);
    return merged;
  } catch (err) {
    console.warn('[Direct Invoice Detail Enrichment Error]:', err);
    return null;
  }
}
