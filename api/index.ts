import express from 'express';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enable permissive CORS for Vercel and cross-origin deployments
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Memory store for active sessions and logs
interface SessionData {
  taxCode: string;
  taxpayerName: string;
  address: string;
  token: string;
  cookieHeader?: string;
  isRealGDT: boolean;
  createdAt: number;
}

let currentSession: SessionData | null = null;

// Store cookies and content corresponding to captcha keys
const captchaCookieJar = new Map<string, string>();
const captchaContentMap = new Map<string, string>();

let seleniumLogs: Array<{
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'step';
  message: string;
  stepName?: string;
  progress?: number;
}> = [];

// Helper headers for GDT Portal
const GDT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://hoadondientu.gdt.gov.vn/',
  'Origin': 'https://hoadondientu.gdt.gov.vn'
};

// Gemini AI OCR Client Lazy Initializer
import { GoogleGenAI } from '@google/genai';

let geminiAiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiAiClient && process.env.GEMINI_API_KEY) {
    geminiAiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  }
  return geminiAiClient;
}

// AI Captcha OCR Engine for GDT Portal
async function solveCaptchaOCR(svgOrDataUri: string): Promise<string> {
  if (!svgOrDataUri) return '';

  let rawSvg = svgOrDataUri;
  if (rawSvg.startsWith('data:image/svg+xml;utf8,')) {
    rawSvg = decodeURIComponent(rawSvg.replace('data:image/svg+xml;utf8,', ''));
  } else if (rawSvg.startsWith('data:image/svg+xml;base64,')) {
    rawSvg = Buffer.from(rawSvg.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf-8');
  }

  // 1. Check if SVG contains plain text element (Instant fallback)
  const textMatch = rawSvg.match(/<text[^>]*>([^<]+)<\/text>/i);
  if (textMatch && textMatch[1]) {
    return textMatch[1].replace(/\s+/g, '').toUpperCase();
  }

  // 2. High accuracy OCR using Gemini 3.7 Flash
  const ai = getGeminiClient();
  if (ai) {
    try {
      const base64Data = Buffer.from(rawSvg).toString('base64');
      const aiResp = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'image/svg+xml',
              data: base64Data
            }
          },
          {
            text: 'This is a captcha image from the Vietnam General Department of Taxation (Tổng cục Thuế). Extract and return ONLY the 4 to 6 uppercase alphanumeric characters with no spaces, punctuation, or comments.'
          }
        ]
      });

      const extracted = (aiResp.text || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (extracted && extracted.length >= 3 && extracted.length <= 8) {
        return extracted;
      }
    } catch (err: any) {
      console.warn('[Gemini OCR Error]:', err.message);
    }
  }

  return '';
}

// SVG Captcha Generator helper
function generateLocalSvgCaptcha(): { captchaKey: string; captchaCode: string; captchaImage: string } {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let captchaText = '';
  for (let i = 0; i < 4; i++) {
    captchaText += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const captchaKey = 'ckey_local_' + Math.random().toString(36).substring(2, 10);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="130" height="42" viewBox="0 0 130 42">
      <rect width="100%" height="100%" fill="#f1f5f9"/>
      <line x1="10" y1="12" x2="120" y2="30" stroke="#cbd5e1" stroke-width="2"/>
      <line x1="15" y1="35" x2="115" y2="8" stroke="#cbd5e1" stroke-width="1.5"/>
      <text x="18" y="29" font-family="monospace, sans-serif" font-size="24" font-weight="bold" fill="#1e293b" letter-spacing="8">${captchaText}</text>
    </svg>
  `.trim();

  captchaContentMap.set(captchaKey, svg);

  return {
    captchaKey,
    captchaCode: captchaText,
    captchaImage: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  };
}

// Split date range into sub-ranges <= 1 calendar month to comply with GDT's 31-day search limit
function splitDateRangeIntoMonthlyChunks(fromDateStr: string, toDateStr: string): Array<{ from: string; to: string }> {
  const start = new Date(fromDateStr);
  const end = new Date(toDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [{ from: fromDateStr, to: toDateStr }];
  }

  const chunks: Array<{ from: string; to: string }> = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const finalEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cur <= finalEnd) {
    const endOfMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const chunkEnd = endOfMonth < finalEnd ? endOfMonth : finalEnd;

    const pad = (n: number) => String(n).padStart(2, '0');
    const fromStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
    const toStr = `${chunkEnd.getFullYear()}-${pad(chunkEnd.getMonth() + 1)}-${pad(chunkEnd.getDate())}`;

    chunks.push({ from: fromStr, to: toStr });

    cur = new Date(chunkEnd.getFullYear(), chunkEnd.getMonth(), chunkEnd.getDate() + 1);
  }

  return chunks;
}

// API Router to handle both `/api/*` and direct routes
const apiRouter = express.Router();

// 1. Health check
apiRouter.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    platform: 'vercel-serverless',
    serverTime: new Date().toISOString(),
    gdtConnected: currentSession?.isRealGDT ?? false,
    sessionMst: currentSession?.taxCode || null
  });
});

// 2. Get Real Captcha from official GDT Portal & Auto-run OCR
apiRouter.get('/gdt/captcha', async (req, res) => {
  try {
    const gdtRes = await fetch('https://hoadondientu.gdt.gov.vn/api/captcha', {
      headers: GDT_HEADERS,
      signal: AbortSignal.timeout(6000)
    });

    if (gdtRes.ok) {
      const rawCookies = (gdtRes.headers as any).getSetCookie 
        ? (gdtRes.headers as any).getSetCookie() 
        : [gdtRes.headers.get('set-cookie')];
      const cookieStr = (rawCookies || []).filter(Boolean).map((c: string) => c.split(';')[0]).join('; ');

      const data = await gdtRes.json() as { key: string; content: string };
      if (data.key) {
        if (cookieStr) captchaCookieJar.set(data.key, cookieStr);
        if (data.content) captchaContentMap.set(data.key, data.content);
      }

      let autoSolvedCode = '';
      try {
        autoSolvedCode = await solveCaptchaOCR(data.content);
      } catch (ocrErr) {
        console.warn('[OCR on Fetch Failed]:', ocrErr);
      }

      return res.json({
        success: true,
        isRealGDT: true,
        captchaKey: data.key,
        captchaCode: autoSolvedCode,
        captchaImage: `data:image/svg+xml;utf8,${encodeURIComponent(data.content)}`,
        source: 'hoadondientu.gdt.gov.vn',
        autoOcr: Boolean(autoSolvedCode)
      });
    }
  } catch (error: any) {
    console.warn('[GDT Proxy] Live GDT captcha fetch error, fallback to local SVG:', error.message);
  }

  // Fallback local SVG captcha if GDT portal is unreachable
  const local = generateLocalSvgCaptcha();
  return res.json({
    success: true,
    isRealGDT: false,
    captchaKey: local.captchaKey,
    captchaCode: local.captchaCode,
    captchaImage: local.captchaImage,
    source: 'local_fallback',
    autoOcr: true
  });
});

// 2.1 Dedicated OCR Auto-solve Endpoint
apiRouter.post('/gdt/ocr-captcha', async (req, res) => {
  try {
    const { captchaKey, captchaImage } = req.body;
    let contentToSolve = captchaImage;

    if (!contentToSolve && captchaKey && captchaContentMap.has(captchaKey)) {
      contentToSolve = captchaContentMap.get(captchaKey);
    }

    if (!contentToSolve) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu ảnh Captcha.' });
    }

    const code = await solveCaptchaOCR(contentToSolve);
    return res.json({
      success: true,
      captchaCode: code,
      isRealGDT: Boolean(captchaKey && !captchaKey.startsWith('ckey_local_'))
    });
  } catch (err: any) {
    console.error('[OCR Endpoint Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể quét mã Captcha: ' + err.message });
  }
});

// 3. Login directly to GDT Portal / Authenticate Session
apiRouter.post('/gdt/login', async (req, res) => {
  let { taxCode, password, captchaKey, captchaCode } = req.body;

  if (!taxCode) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã số thuế (MST).' });
  }

  if (!password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Mật khẩu tài khoản Tổng cục Thuế cấp.' });
  }

  // If captchaCode is not provided, try to auto-solve using OCR
  if (!captchaCode && captchaKey && captchaContentMap.has(captchaKey)) {
    const rawSvg = captchaContentMap.get(captchaKey)!;
    captchaCode = await solveCaptchaOCR(rawSvg);
  }

  if (!captchaCode) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập mã Captcha hoặc bấm nút quét tự động.' });
  }

  const cookieHeader = captchaKey ? captchaCookieJar.get(captchaKey) || '' : '';

  try {
    const authRes = await fetch('https://hoadondientu.gdt.gov.vn/api/security-taxpayer/authenticate', {
      method: 'POST',
      headers: {
        ...GDT_HEADERS,
        'Content-Type': 'application/json',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
      },
      body: JSON.stringify({
        username: taxCode.trim(),
        password: password.trim(),
        ckey: captchaKey || '',
        cvalue: captchaCode.trim()
      }),
      signal: AbortSignal.timeout(15000)
    });

    const authRawCookies = (authRes.headers as any).getSetCookie 
      ? (authRes.headers as any).getSetCookie() 
      : [authRes.headers.get('set-cookie')];
    const newCookieStr = (authRawCookies || []).filter(Boolean).map((c: string) => c.split(';')[0]).join('; ');
    const combinedCookies = [cookieHeader, newCookieStr].filter(Boolean).join('; ');

    const rawText = await authRes.text();
    let authData: any = {};
    try {
      authData = JSON.parse(rawText);
    } catch {
      console.warn('[GDT Auth Raw Response]:', rawText.substring(0, 300));
      return res.status(502).json({
        success: false,
        message: 'Cổng Tổng cục Thuế phản hồi dạng văn bản hoặc đang quá tải. Vui lòng thử lại sau.'
      });
    }

    if (authRes.ok && (authData.token || authData.jwt || authData.access_token)) {
      const realToken = authData.token || authData.jwt || authData.access_token;
      const cleanToken = realToken.startsWith('Bearer ') ? realToken : `Bearer ${realToken}`;

      currentSession = {
        taxCode: taxCode.trim(),
        taxpayerName: authData.user?.fullName || authData.user?.tenNnt || authData.user?.name || `DOANH NGHIỆP NỘP THUẾ (MST: ${taxCode.trim()})`,
        address: authData.user?.address || authData.user?.dchi || 'Đăng ký tại Tổng cục Thuế Việt Nam',
        token: cleanToken,
        cookieHeader: combinedCookies,
        isRealGDT: true,
        createdAt: Date.now()
      };

      return res.json({
        success: true,
        isRealGDT: true,
        message: 'Đăng nhập Cổng Hóa đơn điện tử Tổng cục Thuế thành công!',
        session: currentSession
      });
    } else {
      const errorMsg = authData.message || authData.details || 'Xác thực thất bại từ Cổng Tổng cục Thuế. Vui lòng kiểm tra lại MST, Mật khẩu hoặc mã Captcha.';
      return res.status(authRes.status || 400).json({
        success: false,
        isRealGDT: true,
        message: errorMsg,
        rawGdtResponse: authData
      });
    }
  } catch (err: any) {
    console.error('[GDT Auth Error]:', err);
    return res.status(503).json({
      success: false,
      isRealGDT: true,
      isNetworkBlocked: true,
      message: `Không thể kết nối đến máy chủ Cổng Thuế (${err.message}). Vui lòng thử lại hoặc sử dụng công cụ Python trên máy tính để kết nối trực tiếp.`
    });
  }
});

// 4. Query Real Invoices from GDT API
apiRouter.post('/gdt/query-invoices', async (req, res) => {
  const { fromDate, toDate, invoiceType = 'both', size = 50 } = req.body;

  if (!currentSession) {
    return res.status(401).json({
      success: false,
      message: 'Chưa có phiên làm việc với Tổng cục Thuế. Vui lòng nhập mã Captcha để kết nối.'
    });
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

  const rawFrom = fromDate || '2025-01-01';
  const rawTo = toDate || '2025-12-31';

  const dateChunks = splitDateRangeIntoMonthlyChunks(rawFrom, rawTo);
  const tokenHeader = currentSession.token.startsWith('Bearer ') ? currentSession.token : `Bearer ${currentSession.token}`;

  const fetchChunk = async (type: 'purchase' | 'sold', chunkFrom: string, chunkTo: string) => {
    const gdtFrom = formatDateForGdt(chunkFrom, false);
    const gdtTo = formatDateForGdt(chunkTo, true);
    const searchParam = `tdlap=ge=${gdtFrom};tdlap=le=${gdtTo}`;

    const url = `https://hoadondientu.gdt.gov.vn/api/query/invoices/${type}?sort=tdlap:desc,khhdon:asc,shdon:desc&size=${size}&search=${encodeURIComponent(searchParam)}`;
    try {
      const resp = await fetch(url, {
        headers: {
          ...GDT_HEADERS,
          'Authorization': tokenHeader,
          ...(currentSession?.cookieHeader ? { 'Cookie': currentSession.cookieHeader } : {})
        },
        signal: AbortSignal.timeout(20000)
      });
      
      if (resp.status === 401 || resp.status === 403) {
        return { error: 'AUTH_EXPIRED' };
      }

      if (!resp.ok) {
        return [];
      }

      const rawText = await resp.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        return [];
      }

      const list = data.datas || data.data || data.rows || data.content || data.items || data.results || data.dshdon || (Array.isArray(data) ? data : []);
      
      return list.map((item: any) => ({
        id: item.id || `GDT_${item.khhdon}_${item.shdon}_${item.nbmst || item.nmmst}`,
        khmshdon: item.khmshdon || item.khmhd || '1',
        khhdon: item.khhdon || '',
        shdon: String(item.shdon || item.shd || '').padStart(7, '0'),
        tdlap: item.tdlap ? item.tdlap.replace(' ', 'T') : new Date().toISOString(),
        nbmst: item.nbmst || '',
        nbten: item.nbten || item.nbtnnt || item.nbtlhdon || 'Người bán',
        nbdchi: item.nbdchi || '',
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
        items: (item.hdhhdvus || item.items || item.hdhhdvu || []).map((it: any, idx: number) => ({
          id: `item_${idx + 1}`,
          lineNo: idx + 1,
          itemName: it.thhdvu || it.itemName || it.tenhh || 'Hàng hóa dịch vụ',
          unit: it.dvtinh || it.unit || 'Lô',
          quantity: Number(it.sluong || it.quantity || 1),
          unitPrice: Number(it.dgia || it.unitPrice || 0),
          amount: Number(it.thtien || it.amount || 0),
          taxRate: it.tsuat || it.taxRate || '10%',
          taxRatePercent: parseInt(it.tsuat || '10', 10) || 10,
          taxAmount: Number(it.tthue || it.taxAmount || 0),
          totalAmount: Number((it.thtien || 0) + (it.tthue || 0))
        }))
      }));
    } catch (e) {
      return [];
    }
  };

  const fetchAllChunksForType = async (type: 'purchase' | 'sold') => {
    let allInvoices: any[] = [];
    const chunkPromises = dateChunks.map(chunk => fetchChunk(type, chunk.from, chunk.to));
    const chunkResults = await Promise.all(chunkPromises);

    for (const chunkResult of chunkResults) {
      if ((chunkResult as any)?.error === 'AUTH_EXPIRED') {
        return { error: 'AUTH_EXPIRED' };
      }
      if (Array.isArray(chunkResult)) {
        allInvoices = allInvoices.concat(chunkResult);
      }
    }
    return allInvoices;
  };

  try {
    let results: any[] = [];
    const queryPurchase = invoiceType === 'purchase' || invoiceType === 'both' || invoiceType === 'all';
    const querySold = invoiceType === 'sold' || invoiceType === 'both' || invoiceType === 'all';

    if (queryPurchase) {
      const purchaseList = await fetchAllChunksForType('purchase');
      if ((purchaseList as any)?.error === 'AUTH_EXPIRED') {
        currentSession = null;
        return res.status(401).json({
          success: false,
          isExpired: true,
          message: 'Phiên làm việc Cổng Tổng cục Thuế đã hết hạn (Token Expired). Vui lòng nhập mã Captcha để kết nối lại.'
        });
      }
      if (Array.isArray(purchaseList)) {
        results = results.concat(purchaseList);
      }
    }

    if (querySold) {
      const soldList = await fetchAllChunksForType('sold');
      if ((soldList as any)?.error === 'AUTH_EXPIRED') {
        currentSession = null;
        return res.status(401).json({
          success: false,
          isExpired: true,
          message: 'Phiên làm việc Cổng Tổng cục Thuế đã hết hạn (Token Expired). Vui lòng nhập mã Captcha để kết nối lại.'
        });
      }
      if (Array.isArray(soldList)) {
        results = results.concat(soldList);
      }
    }

    const seenMap = new Map<string, any>();
    for (const inv of results) {
      const key = `${inv.khhdon}_${inv.shdon}_${inv.nbmst}_${inv.loaiHdon}`;
      if (!seenMap.has(key)) {
        seenMap.set(key, inv);
      }
    }
    const dedupedResults = Array.from(seenMap.values());
    dedupedResults.sort((a, b) => new Date(b.tdlap).getTime() - new Date(a.tdlap).getTime());

    return res.json({
      success: true,
      isRealGDT: true,
      invoices: dedupedResults,
      count: dedupedResults.length,
      chunksQueried: dateChunks.length,
      message: `Đã truy xuất thành công ${dedupedResults.length} hóa đơn thực tế từ Cổng Tổng cục Thuế.`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Lỗi khi truy vấn hóa đơn: ${err.message}`
    });
  }
});

// 5. Logout
apiRouter.post('/gdt/logout', (req, res) => {
  currentSession = null;
  res.json({ success: true, message: 'Đã ngắt kết nối phiên làm việc.' });
});

// 6. Status
apiRouter.get('/gdt/status', (req, res) => {
  res.json({
    isConnected: !!currentSession,
    isRealGDT: currentSession?.isRealGDT ?? false,
    session: currentSession
  });
});

// 7. Selenium Logs & package download
apiRouter.get('/gdt/selenium-logs', (req, res) => {
  res.json({ logs: seleniumLogs });
});

apiRouter.get('/gdt/download-python-package', async (req, res) => {
  try {
    const zip = new JSZip();
    const pythonDir = path.join(process.cwd(), 'python');
    const files = ['gdt_selenium_crawler.py', 'requirements.txt', 'README_GDT.md'];

    for (const file of files) {
      const fullPath = path.join(pythonDir, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        zip.file(file, content);
      }
    }

    const runBat = `@echo off\npython -m pip install -r requirements.txt\npython gdt_selenium_crawler.py --mst 0316892345 --type purchase\npause\n`;
    zip.file('run_windows.bat', runBat);

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="GDT_Selenium_Crawler_Python.zip"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Register router on both `/api` and `/` so all paths match whether Vercel rewrites or strips prefix
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
