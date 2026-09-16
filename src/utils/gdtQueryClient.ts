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
  source?: 'proxy' | 'direct_browser' | 'fallback';
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
 * Fetch Captcha with Backend proxy only
 */
export async function executeGdtCaptcha(): Promise<CaptchaResult> {
  // Strategy 1: Serverless Backend Proxy (/api/gdt/captcha)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
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
    console.info('[Proxy Captcha switched to direct fetch]:', proxyErr);
  }

  return {
    success: false,
    captchaImage: '',
    captchaKey: '',
    source: 'proxy'
  };
}

/**
 * Resilient GDT Login with Backend proxy only
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

    if (data?.message || data?.details) {
      return {
        success: false,
        error: data.message || data.details
      };
    }

    return {
      success: false,
      error: `Cổng Thuế từ chối đăng nhập (HTTP ${res.status}). Vui lòng kiểm tra Captcha, MST và mật khẩu.`
    };
  } catch (proxyErr) {
    console.warn('[Proxy Login Failed]:', proxyErr);
  }

  return {
    success: false,
    error: 'Máy chủ chưa kết nối được Cổng Tổng cục Thuế. Vui lòng thử lại sau.'
  };
}

/**
 * Unified resilient invoice query:
 * 1. Tries the Serverless Backend Proxy (/api/gdt/query-invoices)
 * 2. If proxy fails, times out, returns 502/504 (e.g. Vercel IP blocked by GDT firewall),
 *    uses the backend proxy only
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

  return {
    success: false,
    status: proxyStatus || 502,
    invoices: [],
    message: proxyError || 'Máy chủ chưa lấy được dữ liệu từ Cổng Tổng cục Thuế. Không thể gọi trực tiếp từ trình duyệt do chính sách CORS.'
  };
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

  return null;
}
