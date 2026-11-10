import { GDTInvoice } from '../types';
import { getInvoiceItemListFromPayload, getLookupCodeFromPayload, getLookupUrlFromPayload, getSellerFromPayload, isMisaSource, isViettelSource, isVnptSource, normalizeInvoiceItem } from './xmlParser';
import { fetchGdtInvoiceDetail, fetchGdtInvoiceXml, mergeGdtInvoiceDetail } from './gdtDetail';
import { convertSvgToSharpPng } from './captchaOcrHelper';
import { solveCaptchaWithClientTemplateMatching } from './clientTemplateCaptchaSolver';

export interface QueryInvoicesOptions {
  fromDate: string;
  toDate: string;
  invoiceType?: 'purchase' | 'sold' | 'both';
  size?: number;
  token: string;
  cookieHeader?: string;
  includePos?: boolean;
  posOnly?: boolean;
  customApiKey?: string;
  posCaptcha?: {
    key: string;
    code: string;
    cookie?: string;
  };
}

export interface QueryInvoicesResult {
  success: boolean;
  invoices: GDTInvoice[];
  status?: number;
  message?: string;
  error?: string;
  source?: 'proxy' | 'direct_browser';
  posDiagnostics?: Array<{ from: string; to: string; status: string; count?: number; attempts?: number }>;
}

export interface LoginOptions {
  taxCode: string;
  password?: string;
  captchaKey?: string;
  captchaCode?: string;
  captchaCookie?: string;
  vietnamProxy?: string;
  customApiKey?: string;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  taxpayerName?: string;
  address?: string;
  cookieHeader?: string;
  error?: string;
  source?: 'proxy' | 'direct_browser';
  isWafBlocked?: boolean;
  needManualCaptcha?: boolean;
  attemptsUsed?: number;
}

export interface AutoLoginOptions {
  taxCode: string;
  password: string;
  vietnamProxy?: string;
  customApiKey?: string;
}

export interface CaptchaResult {
  success: boolean;
  captchaImage: string;
  captchaKey: string;
  captchaCookie?: string;
  rawSvg?: string;
  source?: 'proxy' | 'direct_browser' | 'fallback';
  error?: string;
}

export interface PosCaptchaResult extends CaptchaResult {}

export interface PosCaptchaSolveResult {
  success: boolean;
  code?: string;
  engine?: 'gemini' | 'gemini-ai' | 'tesseract-local' | string;
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
  const isViettel = isViettelSource(item);
  const isVnpt = isVnptSource(item);
  const isMisa = isMisaSource(item);
  const resolvedProvider = isViettel ? 'VIETTEL' : isVnpt ? 'VNPT' : isMisa ? 'MISA' : (item.provider || undefined);
  const resolvedMsttcgp = item.msttcgp || item.mst_tcgp || item.tvandnkntt || (isViettel ? '0100109106' : isVnpt ? '0100684378' : isMisa ? '0101243150' : '');
  const resolvedTentcgp = item.tentcgp || item.ten_tcgp || item.tctchuc || (isViettel ? 'Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel)' : isVnpt ? 'Tập đoàn Bưu chính Viễn thông Việt Nam (VNPT)' : isMisa ? 'Công ty Cổ phần MISA' : '');
  const resolvedCaProvider = isViettel ? 'VIETTEL-CA' : isVnpt ? 'VNPT-CA' : isMisa ? 'MISA-CA' : 'Tổng cục Thuế CQT';
  const defaultLookupUrl = isViettel
    ? 'https://vinvoice.viettel.vn/utilities/invoice-search'
    : isMisa
      ? 'https://www.meinvoice.vn/tra-cuu'
      : undefined;

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
    caProvider: resolvedCaProvider,
    provider: resolvedProvider,
    msttcgp: resolvedMsttcgp,
    tentcgp: resolvedTentcgp,
    lookupCode: getLookupCodeFromPayload(item),
    lookupUrl: getLookupUrlFromPayload(item) || defaultLookupUrl,
    items: getInvoiceItemListFromPayload(item).map((it: any, idx: number) => normalizeInvoiceItem(it, idx)),
    sourceCompleteness: 'summary',
    isPos
  };
}

export async function executeGdtCaptcha(): Promise<CaptchaResult> {
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

export async function executeGdtPosCaptcha(options: {
  token: string;
  cookieHeader?: string;
  vietnamProxy?: string;
}): Promise<PosCaptchaResult> {
  try {
    const response = await fetch('/api/gdt/pos-captcha', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: options.token,
        ...(options.cookieHeader ? { 'x-gdt-cookie': options.cookieHeader } : {}),
      },
      body: JSON.stringify(options),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.success && data.captchaImage && data.captchaKey) {
      return {
        success: true,
        captchaImage: data.captchaImage,
        captchaKey: data.captchaKey,
        captchaCookie: data.captchaCookie || '',
        rawSvg: data.rawSvg || '',
        source: 'proxy',
      };
    }
    return { success: false, captchaImage: '', captchaKey: '', error: data?.message || 'Không tải được CAPTCHA hóa đơn máy tính tiền.' };
  } catch (error: any) {
    return { success: false, captchaImage: '', captchaKey: '', error: error?.message || 'Lỗi kết nối khi tải CAPTCHA hóa đơn máy tính tiền.' };
  }
}

export async function executeGdtPosCaptchaSolve(options: {
  captchaImage: string;
  captchaKey?: string;
  rawSvg?: string;
  customApiKey?: string;
  forceGemini?: boolean;
}): Promise<PosCaptchaSolveResult> {
  try {
    if (!options.captchaImage && !options.rawSvg) {
      return { success: false, error: 'Hình ảnh CAPTCHA rỗng.' };
    }

    const source = options.rawSvg || options.captchaImage;

    // 1. Thử giải trực tiếp bằng Vector Zonal Solver (100% Cục bộ)
    try {
      const { solveCaptchaFromSvg } = await import('./vectorCaptchaSolver');
      let svgToSolve = options.rawSvg || '';
      if (!svgToSolve && options.captchaImage && options.captchaImage.includes('<svg')) {
        svgToSolve = options.captchaImage;
      } else if (!svgToSolve && options.captchaImage && options.captchaImage.startsWith('data:image/svg+xml;base64,')) {
        try {
          svgToSolve = atob(options.captchaImage.replace('data:image/svg+xml;base64,', ''));
        } catch {}
      }

      if (svgToSolve) {
        const vRes = await solveCaptchaFromSvg(svgToSolve);
        if (vRes && vRes.success && vRes.code && vRes.code.length >= 4) {
          return {
            success: true,
            code: vRes.code,
            engine: 'comismsh-vector-zonal',
          };
        }
      }
    } catch (vErr) {
      console.warn('[executeGdtPosCaptchaSolve] Direct vector solver notice:', vErr);
    }

    // 2. Thử gọi endpoint OCR vector cục bộ trên server
    try {
      const ocrResp = await fetch('/api/gdt/ocr-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawSvg: options.rawSvg,
          captchaImage: options.captchaImage,
          captchaKey: options.captchaKey,
        }),
      });
      if (ocrResp.ok) {
        const ocrData = await ocrResp.json().catch(() => ({}));
        if (ocrData?.success && ocrData.captchaCode) {
          const clean = String(ocrData.captchaCode).trim().toUpperCase();
          if (clean.length >= 4) {
            return {
              success: true,
              code: clean,
              engine: 'server-vector-zonal',
            };
          }
        }
      }
    } catch (ocrErr) {
      console.warn('[executeGdtPosCaptchaSolve] Server OCR notice:', ocrErr);
    }

    // 3. Thử qua Template Matching Client
    try {
      const tmRes = await solveCaptchaWithClientTemplateMatching(source, {
        minConfidenceThreshold: 35,
        expectedLength: 6,
      });

      if (tmRes && tmRes.code && tmRes.code.length >= 4 && !tmRes.code.includes('?')) {
        if (tmRes.confidence >= 35 || tmRes.segmentedCount === 6) {
          return {
            success: true,
            code: tmRes.code,
            engine: 'template-matching-local',
          };
        }
      }
    } catch (tmErr) {
      console.warn('[executeGdtPosCaptchaSolve] Client template matching notice:', tmErr);
    }

    // 2. Dự phòng: Chạy Tesseract OCR Local trên máy chủ Node.js (100% Cục bộ, không dùng Gemini)
    try {
      let rasterPng = options.captchaImage;
      if (typeof window !== 'undefined' && options.captchaImage) {
        rasterPng = await convertSvgToSharpPng(options.captchaImage);
      }

      const tessResp = await fetch('/api/invoice-downloader/solve-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: rasterPng,
          alphanumeric: true,
          localOnly: true,
          preprocess: false,
          timeoutMs: 8000,
        }),
      });

      if (tessResp.ok) {
        const tessData = await tessResp.json().catch(() => ({}));
        if (tessData?.success && tessData.code) {
          const cleanCode = String(tessData.code).trim().toUpperCase();
          if (cleanCode.length >= 4) {
            return {
              success: true,
              code: cleanCode,
              engine: 'tesseract-local',
            };
          }
        }
      }
    } catch (serverErr) {
      console.warn('[executeGdtPosCaptchaSolve] Local Tesseract error:', serverErr);
    }

    return { success: false, error: 'OCR cục bộ chưa nhận diện được mã CAPTCHA POS.' };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Lỗi khi nhận diện CAPTCHA POS.' };
  }
}

export async function executeGdtAutoLogin(options: AutoLoginOptions): Promise<LoginResult> {
  const { taxCode, password, vietnamProxy } = options;

  // Tự động tải CAPTCHA mới, giải mã OCR cục bộ và gửi đăng nhập
  const maxAttempts = 5;
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const capRes = await executeGdtCaptcha();
      if (!capRes.success || !capRes.captchaImage) {
        continue;
      }

      let solvedCode = '';

      // Thử đọc qua Client Template Matching
      try {
        const tmRes = await solveCaptchaWithClientTemplateMatching(capRes.captchaImage, {
          minConfidenceThreshold: 35,
          expectedLength: 6,
        });
        if (tmRes?.code && tmRes.code.length >= 4 && !tmRes.code.includes('?')) {
          solvedCode = tmRes.code;
        }
      } catch {}

      // Dự phòng Tesseract Local nếu Template Matching chưa ra
      if (!solvedCode || solvedCode.length < 4) {
        try {
          const sharpPng = await convertSvgToSharpPng(capRes.captchaImage);
          const tessResp = await fetch('/api/invoice-downloader/solve-captcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: sharpPng,
              alphanumeric: true,
              localOnly: true,
              preprocess: false,
              timeoutMs: 8000,
            }),
          });
          const tessData = await tessResp.json().catch(() => ({}));
          if (tessData?.success && tessData.code) {
            solvedCode = String(tessData.code).trim().toUpperCase();
          }
        } catch {}
      }

      if (!solvedCode || solvedCode.length < 4) {
        continue;
      }

      // Gửi đăng nhập tới Cổng Thuế
      const loginRes = await fetch('/api/gdt/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxCode: taxCode.trim(),
          password: password.trim(),
          captchaKey: capRes.captchaKey,
          captchaCode: solvedCode,
          captchaCookie: capRes.captchaCookie,
          vietnamProxy,
        }),
      });

      const raw = await loginRes.text();
      let data: any = null;
      try { data = JSON.parse(raw); } catch {}

      if (loginRes.ok && data?.success && data.session?.token) {
        return {
          success: true,
          token: data.session.token,
          taxpayerName: data.session.taxpayerName,
          address: data.session.address,
          cookieHeader: data.session.cookieHeader,
          attemptsUsed: attempt,
          source: 'proxy',
        };
      }

      if (data?.message?.toLowerCase().includes('mật khẩu') || data?.message?.toLowerCase().includes('tên đăng nhập')) {
        return {
          success: false,
          error: data.message || 'Mã số thuế hoặc Mật khẩu không chính xác.',
        };
      }

      lastError = data?.message || 'Mã CAPTCHA chưa chính xác';
      await new Promise(r => setTimeout(r, 400));
    } catch (e: any) {
      lastError = e?.message || 'Lỗi kết nối';
    }
  }

  return {
    success: false,
    needManualCaptcha: true,
    error: `Tự động đăng nhập chưa thành công sau ${maxAttempts} lần thử (${lastError}). Vui lòng nhập mã thủ công.`,
  };
}

export async function executeGdtLogin(options: LoginOptions): Promise<LoginResult> {
  const { taxCode, password, captchaKey, captchaCode, captchaCookie, vietnamProxy, customApiKey } = options;

  if (!captchaCode || !captchaCode.trim()) {
    return executeGdtAutoLogin({
      taxCode,
      password: password || '',
      vietnamProxy,
      customApiKey
    });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const res = await fetch('/api/gdt/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taxCode: taxCode.trim(),
        password: (password || '').trim(),
        captchaKey,
        captchaCode: (captchaCode || '').trim(),
        captchaCookie,
        vietnamProxy
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

    return {
      success: false,
      isWafBlocked: res.status === 403,
      error: data?.message || `Cổng Thuế từ chối đăng nhập (HTTP ${res.status}).`
    };
  } catch (proxyErr: any) {
    return {
      success: false,
      error: 'Máy chủ chưa kết nối được Cổng Tổng cục Thuế. Vui lòng thử lại sau.'
    };
  }
}

export async function executeGdtInvoiceQuery(options: QueryInvoicesOptions): Promise<QueryInvoicesResult> {
  const { fromDate, toDate, invoiceType = 'purchase', size = 50, token, cookieHeader = '', includePos = true, posOnly = false, customApiKey, posCaptcha } = options;

  let proxyError: string | null = null;
  let proxyStatus: number | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

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
        cookieHeader,
        includePos,
        posOnly,
        customApiKey,
        posCaptcha
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
        message: errData.message || 'Phiên Cổng Thuế cần xác thực lại.'
      };
    }

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.invoices)) {
        return {
          success: true,
          invoices: data.invoices,
          source: 'proxy',
          posDiagnostics: data.posDiagnostics
        };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      proxyError = errData.message || `Proxy HTTP ${res.status}`;
    }
  } catch (err: any) {
    proxyError = err?.message || 'Proxy connection error';
  }

  return {
    success: false,
    status: proxyStatus || 502,
    invoices: [],
    message: proxyError || 'Máy chủ chưa lấy được dữ liệu từ Cổng Tổng cục Thuế.'
  };
}

export async function executeGdtInvoiceDetail(
  invoice: GDTInvoice,
  token: string,
  cookie: string = ''
): Promise<GDTInvoice | null> {
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
  } catch {}

  return null;
}
