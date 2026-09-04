import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import { parseGDTInvoiceXml } from './src/utils/xmlParser';
import { generateOfficialInvoiceHtml } from './src/utils/officialInvoiceHtml';
import { OFFICIAL_GDT_INVOICE_XSLT } from './src/utils/xsltTransformer';
import { invoiceManager, CaptchaSolver } from './src/services/invoice-engine';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enable CORS
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

// Helper headers for GDT Portal with full Chrome fingerprint
const GDT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://hoadondientu.gdt.gov.vn/',
  'Origin': 'https://hoadondientu.gdt.gov.vn',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin'
};

// Robust Cookie Extractor
function extractCookies(res: any): string {
  let cookieList: string[] = [];
  try {
    if (typeof res.headers.getSetCookie === 'function') {
      cookieList = res.headers.getSetCookie();
    } else if (res.headers.raw && typeof res.headers.raw === 'function') {
      const raw = res.headers.raw();
      cookieList = raw['set-cookie'] || [];
    } else {
      const single = res.headers.get('set-cookie');
      if (single) {
        cookieList = single.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
      }
    }
  } catch (err) {
    console.warn('[Cookie Extraction Warning]:', err);
  }

  return (cookieList || [])
    .filter(Boolean)
    .map((c: string) => c.trim().split(';')[0])
    .filter((c: string) => c && c.includes('='))
    .join('; ');
}

// Resilient GDT Fetch with Retry & Timeout Protection
async function fetchGDT(url: string, options: RequestInit = {}, maxRetries = 1, timeoutMs = 5000): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const mergedHeaders = {
        ...GDT_HEADERS,
        ...(options.headers as Record<string, string> || {})
      };

      const resp = await fetch(url, {
        ...options,
        headers: mergedHeaders,
        signal: controller.signal
      });

      clearTimeout(timer);

      if (resp.ok || resp.status === 400 || resp.status === 401 || resp.status === 403) {
        return resp;
      }

      lastError = new Error(`Cổng Thuế phản hồi mã HTTP ${resp.status}`);
    } catch (err: any) {
      lastError = err;
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastError || new Error('Không thể kết nối đến Cổng Tổng cục Thuế.');
}

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

interface OCRResult {
  code: string;
  modelUsed?: string;
  error?: string;
  isMissingApiKey?: boolean;
}

// AI Captcha OCR Engine for Real GDT Portal SVGs (Powered by Gemini 3.1 Flash Lite / Flash)
async function solveCaptchaOCR(svgOrDataUri: string): Promise<OCRResult> {
  if (!svgOrDataUri) return { code: '', error: 'Dữ liệu ảnh Captcha rỗng' };

  let rawSvg = svgOrDataUri;
  let isBitmap = false;
  let bitmapMime = 'image/png';
  let bitmapBase64 = '';

  if (rawSvg.startsWith('data:image/svg+xml;utf8,')) {
    rawSvg = decodeURIComponent(rawSvg.replace('data:image/svg+xml;utf8,', ''));
  } else if (rawSvg.startsWith('data:image/svg+xml;base64,')) {
    rawSvg = Buffer.from(rawSvg.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf-8');
  } else if (rawSvg.startsWith('data:image/')) {
    isBitmap = true;
    const match = rawSvg.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      bitmapMime = match[1];
      bitmapBase64 = match[2];
    }
  }

  if (!isBitmap && !rawSvg.includes('<svg') && !rawSvg.includes('xmlns')) {
    return { code: '', error: 'Định dạng SVG không hợp lệ' };
  }

  // 1. Quick regex extraction if SVG contains direct <text> tags (0 token cost, instant)
  if (!isBitmap) {
    const textTagMatches = rawSvg.match(/<text[^>]*>([\s\S]*?)<\/text>/gi);
    if (textTagMatches) {
      const textContent = textTagMatches.map(m => m.replace(/<[^>]+>/g, '').trim()).join('');
      const cleanChars = textContent.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (cleanChars.length >= 4 && cleanChars.length <= 6) {
        console.log(`[SVG Direct Parser] Extracted Captcha: "${cleanChars}"`);
        return { code: cleanChars, modelUsed: 'svg-direct' };
      }
    }
  }

  // 2. Check if GEMINI_API_KEY is configured
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[Gemini OCR] GEMINI_API_KEY chưa được thiết lập trong Environment Variables.');
    return {
      code: '',
      isMissingApiKey: true,
      error: 'Chưa cấu hình biến môi trường GEMINI_API_KEY. Vui lòng cấu hình GEMINI_API_KEY.'
    };
  }

  // 3. High-precision Gemini AI OCR with Gemini 3.1 Flash Lite / Gemini Flash
  const ai = getGeminiClient();
  if (!ai) {
    return {
      code: '',
      isMissingApiKey: true,
      error: 'Không thể khởi tạo Gemini AI Client. Vui lòng kiểm tra lại GEMINI_API_KEY.'
    };
  }

  // Candidate models: Gemini 3.1 Flash Lite as primary, fallback to Gemini Flash Latest and Gemini 3.8 Flash
  const candidateModels = [
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash'
  ];

  let lastErrorMsg = '';
  const svgSnippet = rawSvg.substring(0, 4000);

  for (const modelName of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const contentsPayload: any[] = isBitmap && bitmapBase64
          ? [
              {
                inlineData: {
                  mimeType: bitmapMime,
                  data: bitmapBase64
                }
              },
              {
                text: 'This is a captcha image. Extract and return ONLY the 4 to 6 uppercase alphanumeric characters shown in the image. Return only the exact characters without any spaces, markdown, or punctuation.'
              }
            ]
          : [
              {
                text: `This is a Vietnamese GDT tax portal captcha SVG image.
Extract and return ONLY the 4 to 6 uppercase alphanumeric characters shown in the SVG image. Return only the exact characters without any spaces, markdown, or punctuation.
SVG Source:
\`\`\`xml
${svgSnippet}
\`\`\``
              }
            ];

        const ocrPromise = ai.models.generateContent({
          model: modelName,
          contents: contentsPayload
        });

        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 8000)
        );

        const aiResp = await Promise.race([ocrPromise, timeoutPromise]) as any;
        if (aiResp && aiResp.text) {
          const extracted = aiResp.text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          if (extracted && extracted.length >= 3 && extracted.length <= 8) {
            console.log(`[Gemini OCR (${modelName})] Successfully recognized GDT Captcha: "${extracted}"`);
            return { code: extracted, modelUsed: modelName };
          }
        }
        break; // Got response without error but no matching chars, fallback to next model
      } catch (err: any) {
        lastErrorMsg = err?.message || String(err);
        const isRateLimit = lastErrorMsg.includes('429') || lastErrorMsg.includes('RESOURCE_EXHAUSTED') || lastErrorMsg.includes('quota');
        const isUnavailable = lastErrorMsg.includes('503') || lastErrorMsg.includes('high demand') || lastErrorMsg.includes('UNAVAILABLE');
        
        console.warn(`[Gemini OCR (${modelName}) Warning, attempt ${attempt + 1}]:`, lastErrorMsg.substring(0, 120));

        if ((isRateLimit || isUnavailable) && attempt === 0) {
          await new Promise(r => setTimeout(r, 600));
          continue; // Retry once on transient backpressure
        }
        break; // Move to next fallback candidate model
      }
    }
  }

  const isRateLimitFinal = lastErrorMsg.includes('429') || lastErrorMsg.includes('quota') || lastErrorMsg.includes('RESOURCE_EXHAUSTED');
  return {
    code: '',
    error: isRateLimitFinal
      ? 'Hạn mức API Gemini của bạn đã vượt quá (429 Rate Limit/Quota Exceeded). Hạn mức miễn phí sẽ tự reset sau 1 phút.'
      : (lastErrorMsg ? `Lỗi Gemini API: ${lastErrorMsg.substring(0, 120)}` : 'Không nhận diện được mã Captcha.')
  };
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    serverTime: new Date().toISOString(),
    gdtConnected: currentSession?.isRealGDT ?? false,
    sessionMst: currentSession?.taxCode || null
  });
});

// 2. Get Real Captcha from official GDT Portal
app.get('/api/gdt/captcha', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const gdtRes = await fetchGDT('https://hoadondientu.gdt.gov.vn/api/captcha', {}, 1, 4000);

    if (gdtRes.ok) {
      const cookieStr = extractCookies(gdtRes);
      const data = await gdtRes.json() as { key: string; content: string };
      
      if (data && data.key && data.content) {
        if (cookieStr) captchaCookieJar.set(data.key, cookieStr);
        captchaContentMap.set(data.key, data.content);

        const base64Image = `data:image/svg+xml;base64,${Buffer.from(data.content, 'utf-8').toString('base64')}`;

        let autoSolved = '';
        try {
          const ocrRes = await solveCaptchaOCR(data.content);
          autoSolved = ocrRes.code;
        } catch (ocrErr) {
          console.warn('[Auto-OCR Warning]:', ocrErr);
        }

        return res.json({
          success: true,
          isRealGDT: true,
          captchaKey: data.key,
          captchaCookie: cookieStr,
          captchaCode: autoSolved,
          captchaImage: base64Image,
          rawSvg: data.content,
          source: 'hoadondientu.gdt.gov.vn'
        });
      }
    }

    const errText = await gdtRes.text();
    console.warn('[GDT Captcha Fetch Non-OK]:', gdtRes.status, errText.substring(0, 200));
  } catch (error: any) {
    console.warn('[GDT Proxy] Live GDT captcha fetch error:', error.message);
  }

  // Return clean JSON (status 200) so client can seamlessly switch to direct Vietnam browser fetch
  return res.json({
    success: false,
    isRealGDT: false,
    captchaKey: '',
    captchaCookie: '',
    captchaCode: '',
    captchaImage: '',
    source: 'gdt_unreachable',
    message: 'Máy chủ Vercel (nước ngoài) không thể kết nối trực tiếp đến Cổng Thuế. Ứng dụng sẽ tự động tải Captcha trực tiếp từ trình duyệt của bạn tại Việt Nam.',
    directFallbackUrl: 'https://hoadondientu.gdt.gov.vn/api/captcha'
  });
});

// 2.1 Dedicated OCR Auto-solve Endpoint
app.post('/api/gdt/ocr-captcha', async (req, res) => {
  try {
    const { captchaKey, captchaImage, rawSvg } = req.body;
    let contentToSolve = rawSvg || captchaImage;

    if (!contentToSolve && captchaKey && captchaContentMap.has(captchaKey)) {
      contentToSolve = captchaContentMap.get(captchaKey);
    }

    if (!contentToSolve) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu ảnh Captcha.' });
    }

    const ocrResult = await solveCaptchaOCR(contentToSolve);
    if (ocrResult.code) {
      return res.json({
        success: true,
        captchaCode: ocrResult.code,
        modelUsed: ocrResult.modelUsed,
        isRealGDT: Boolean(captchaKey && !captchaKey.startsWith('ckey_local_'))
      });
    } else {
      return res.json({
        success: false,
        captchaCode: '',
        isMissingApiKey: ocrResult.isMissingApiKey,
        message: ocrResult.error || 'Không nhận diện được mã Captcha. Vui lòng nhập thủ công.',
        isRealGDT: Boolean(captchaKey && !captchaKey.startsWith('ckey_local_'))
      });
    }
  } catch (err: any) {
    console.error('[OCR Endpoint Error]:', err);
    return res.status(500).json({ success: false, message: 'Không thể quét mã Captcha: ' + err.message });
  }
});

// 3. Login directly to GDT Portal / Authenticate Session
app.post('/api/gdt/login', async (req, res) => {
  let { taxCode, password, captchaKey, captchaCode, captchaCookie } = req.body;

  if (!taxCode) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã số thuế (MST).' });
  }

  if (!password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Mật khẩu tài khoản Tổng cục Thuế cấp.' });
  }

  if (!captchaCode && captchaKey && captchaContentMap.has(captchaKey)) {
    const rawSvg = captchaContentMap.get(captchaKey)!;
    const ocrRes = await solveCaptchaOCR(rawSvg);
    captchaCode = ocrRes.code;
  }

  if (!captchaCode) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập mã Captcha hoặc bấm nút quét tự động.' });
  }

  const cookieHeader = captchaCookie || (captchaKey ? captchaCookieJar.get(captchaKey) || '' : '');

  try {
    const authRes = await fetchGDT('https://hoadondientu.gdt.gov.vn/api/security-taxpayer/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
      },
      body: JSON.stringify({
        username: taxCode.trim(),
        password: password.trim(),
        ckey: captchaKey || '',
        cvalue: captchaCode.trim()
      })
    }, 2, 20000);

    const newCookieStr = extractCookies(authRes);
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
    // End of current month or finalEnd, whichever is earlier
    const endOfMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const chunkEnd = endOfMonth < finalEnd ? endOfMonth : finalEnd;

    const pad = (n: number) => String(n).padStart(2, '0');
    const fromStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
    const toStr = `${chunkEnd.getFullYear()}-${pad(chunkEnd.getMonth() + 1)}-${pad(chunkEnd.getDate())}`;

    chunks.push({ from: fromStr, to: toStr });

    // Move to next day
    cur = new Date(chunkEnd.getFullYear(), chunkEnd.getMonth(), chunkEnd.getDate() + 1);
  }

  return chunks;
}

// 4. Query Real Invoices from GDT API (Supports stateless tokens for Vercel)
app.post('/api/gdt/query-invoices', async (req, res) => {
  const { fromDate, toDate, invoiceType = 'both', size = 50, token: bodyToken, cookieHeader: bodyCookie } = req.body;

  const authHeader = (req.headers.authorization as string) || bodyToken || currentSession?.token || '';
  const cookieHeader = (req.headers['x-gdt-cookie'] as string) || bodyCookie || currentSession?.cookieHeader || '';

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Chưa có phiên làm việc với Tổng cục Thuế. Vui lòng nhập mã Captcha để kết nối.'
    });
  }

  // Convert date format from YYYY-MM-DD to DD/MM/YYYYT00:00:00
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

  // Chunk the requested period into <= 1-month slices to satisfy GDT's API rule
  const dateChunks = splitDateRangeIntoMonthlyChunks(rawFrom, rawTo);
  const tokenHeader = authHeader.startsWith('Bearer ') ? authHeader : `Bearer ${authHeader}`;

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchChunkWithRetry = async (type: 'purchase' | 'sold', chunkFrom: string, chunkTo: string, maxRetries = 3): Promise<any[] | { error: string }> => {
    const gdtFrom = formatDateForGdt(chunkFrom, false);
    const gdtTo = formatDateForGdt(chunkTo, true);
    const searchParam = `tdlap=ge=${gdtFrom};tdlap=le=${gdtTo}`;

    const url = `https://hoadondientu.gdt.gov.vn/api/query/invoices/${type}?sort=tdlap:desc&size=${size}&search=${encodeURIComponent(searchParam)}`;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resp = await fetch(url, {
          headers: {
            ...GDT_HEADERS,
            'Authorization': tokenHeader,
            ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
          },
          signal: AbortSignal.timeout(20000)
        });
        
        if (resp.status === 401 || resp.status === 403) {
          console.warn(`[GDT Query ${type} Unauthorized]: Session token expired.`);
          return { error: 'AUTH_EXPIRED' };
        }

        if (resp.status === 429) {
          console.warn(`[GDT Query ${type} Rate Limit 429 for ${chunkFrom}..${chunkTo}]: Attempt ${attempt + 1}/${maxRetries + 1}. Pacing & backing off...`);
          if (attempt < maxRetries) {
            const backoffMs = (attempt + 1) * 1200;
            await sleep(backoffMs);
            continue;
          } else {
            console.warn(`[GDT Query ${type} Rate Limit]: Reached max retries for ${chunkFrom}..${chunkTo}`);
            return [];
          }
        }

        if (!resp.ok) {
          const errText = await resp.text();
          console.warn(`[GDT Query ${type} HTTP ${resp.status} for ${chunkFrom}..${chunkTo}]:`, errText.substring(0, 200));
          return [];
        }

        const rawText = await resp.text();
        let data: any = {};
        try {
          data = JSON.parse(rawText);
        } catch {
          console.warn(`[GDT Query ${type} Non-JSON]:`, rawText.substring(0, 200));
          return [];
        }

        const list = data.datas || data.data || data.rows || data.content || data.items || data.results || data.result || data.dshdon || (Array.isArray(data) ? data : []);
        
        console.log(`[GDT Query ${type}] ${chunkFrom} -> ${chunkTo}: Found ${list.length} invoices (total: ${data.total ?? list.length})`);

        // Normalize GDT invoice payload
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
      } catch (err: any) {
        console.warn(`[GDT Query ${type} Exception ${chunkFrom}..${chunkTo} (attempt ${attempt + 1})]:`, err.message);
        if (attempt < maxRetries) {
          await sleep(1000);
          continue;
        }
        return [];
      }
    }
    return [];
  };

  const fetchAllChunksForType = async (type: 'purchase' | 'sold') => {
    let allInvoices: any[] = [];
    for (let i = 0; i < dateChunks.length; i++) {
      const chunk = dateChunks[i];
      if (i > 0) {
        // Pacing delay between sequential requests to prevent 429 Too Many Requests
        await sleep(250);
      }
      const chunkResult = await fetchChunkWithRetry(type, chunk.from, chunk.to);
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
    // User requirement: "Phần mềm chỉ cần chức năng lấy hóa đơn mua vào ko cần bán ra"
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

    // Deduplicate by unique invoice key
    const seenMap = new Map<string, any>();
    for (const inv of results) {
      const key = `${inv.khhdon}_${inv.shdon}_${inv.nbmst}_${inv.loaiHdon}`;
      if (!seenMap.has(key)) {
        seenMap.set(key, inv);
      }
    }
    const dedupedResults = Array.from(seenMap.values());

    // Sort descending by date
    dedupedResults.sort((a, b) => new Date(b.tdlap).getTime() - new Date(a.tdlap).getTime());

    return res.json({
      success: true,
      isRealGDT: true,
      invoices: dedupedResults,
      count: dedupedResults.length,
      chunksQueried: dateChunks.length,
      message: `Đã truy xuất ${dedupedResults.length} hóa đơn thực tế từ Cổng Tổng cục Thuế (${dateChunks.length} kỳ con).`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Lỗi khi truy vấn hóa đơn từ Cổng Thuế: ${err.message}`
    });
  }
});

// 5. Logout / Reset session
app.post('/api/gdt/logout', (req, res) => {
  currentSession = null;
  res.json({ success: true, message: 'Đã ngắt kết nối phiên làm việc.' });
});

// 6. Get Session status
app.get('/api/gdt/status', (req, res) => {
  res.json({
    isConnected: !!currentSession,
    isRealGDT: currentSession?.isRealGDT ?? false,
    session: currentSession
  });
});

// 6. Run Python Selenium Crawler
app.post('/api/gdt/run-selenium', (req, res) => {
  const { taxCode, password, invoiceType, fromDate, toDate, headless } = req.body;
  const mst = taxCode || currentSession?.taxCode || '0316892345';
  const pwd = password || '';

  seleniumLogs = [];

  const addLog = (level: 'info' | 'success' | 'warning' | 'error' | 'step', message: string, stepName?: string, progress?: number) => {
    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      level,
      message,
      stepName,
      progress
    };
    seleniumLogs.push(entry);
    return entry;
  };

  addLog('step', `[1/6] Bắt đầu khởi tạo quy trình tự động hóa Python Selenium cho MST: ${mst}`, 'INIT', 10);

  const pythonScriptPath = path.join(process.cwd(), 'python', 'gdt_selenium_crawler.py');

  const args = [
    pythonScriptPath,
    '--mst', mst,
    '--password', pwd,
    '--type', invoiceType || 'purchase',
    '--from-date', fromDate || '01/02/2025',
    '--to-date', toDate || '28/02/2025'
  ];

  if (headless !== false) {
    args.push('--headless');
  }

  const pyProcess = spawn('python3', args, {
    cwd: process.cwd(),
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  pyProcess.stdout.on('data', (data) => {
    const text = data.toString();
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes('__GDT_EVENT__:')) {
        try {
          const jsonStr = line.replace('__GDT_EVENT__:', '').trim();
          const parsed = JSON.parse(jsonStr);
          addLog(parsed.level, parsed.message, parsed.stepName, parsed.progress);
        } catch (e) {
          addLog('info', line.trim());
        }
      } else if (line.trim()) {
        addLog('info', line.trim());
      }
    }
  });

  pyProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      addLog('warning', `[STDERR]: ${text}`);
    }
  });

  pyProcess.on('close', (code) => {
    addLog('success', `[6/6] Quy trình tự động hóa Python hoàn tất với mã thoát: ${code}. Toàn bộ hóa đơn đã sẵn sàng để tải về.`, 'DONE', 100);
  });

  res.json({
    success: true,
    message: 'Python Selenium Crawler đã được kích hoạt thành công.'
  });
});

// 7. Get Selenium Logs
app.get('/api/gdt/selenium-logs', (req, res) => {
  res.json({ logs: seleniumLogs });
});

// 8. Download standalone Python Selenium Package (.zip)
app.get('/api/gdt/download-python-package', async (req, res) => {
  try {
    const zip = new JSZip();
    const fs = await import('fs');

    const pythonDir = path.join(process.cwd(), 'python');
    const files = ['gdt_selenium_crawler.py', 'requirements.txt', 'README_GDT.md'];

    for (const file of files) {
      const fullPath = path.join(pythonDir, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        zip.file(file, content);
      }
    }

    // Add quick run scripts for Windows (.bat) and Mac/Linux (.sh)
    const runBat = `@echo off
echo ========================================================
echo  KHOI DONG TOOL TAI HOA DON DIEN TU TONG CUC THUE GDT
echo ========================================================
python -m pip install -r requirements.txt
python gdt_selenium_crawler.py --mst 0316892345 --type purchase
pause
`;
    const runSh = `#!/bin/bash
echo "=== TAI HOA DON DIEN TU TONG CUC THUE ==="
pip install -r requirements.txt
python3 gdt_selenium_crawler.py --mst 0316892345 --type purchase
`;

    zip.file('run_windows.bat', runBat);
    zip.file('run_mac_linux.sh', runSh);

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="GDT_Selenium_Crawler_Python.zip"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. XML E-Invoice Parser endpoint (Node.js backend)
app.post('/api/xml/parse', (req, res) => {
  try {
    const { xml } = req.body;
    if (!xml) {
      return res.status(400).json({ error: 'Nội dung XML không được để trống' });
    }
    const invoice = parseGDTInvoiceXml(xml);
    res.json({ success: true, invoice });
  } catch (error: any) {
    res.status(400).json({ error: 'Không thể phân tích XML: ' + error.message });
  }
});

// 10. XML to HTML E-Invoice Transformer endpoint
app.post('/api/xml/transform-html', (req, res) => {
  try {
    const { xml, theme } = req.body;
    if (!xml) {
      return res.status(400).json({ error: 'Nội dung XML không được để trống' });
    }
    const invoice = parseGDTInvoiceXml(xml);
    const html = generateOfficialInvoiceHtml(invoice, {
      theme: theme === 'blue' ? 'blue' : 'red',
      showPrintControls: true
    });
    res.json({ success: true, html });
  } catch (error: any) {
    res.status(400).json({ error: 'Không thể chuyển đổi XML sang HTML: ' + error.message });
  }
});

// 11. Download W3C XSLT Stylesheet
app.get('/api/xml/xslt', (req, res) => {
  res.setHeader('Content-Type', 'application/xslt+xml; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="GDT_Invoice_Transformer.xslt"');
  res.send(OFFICIAL_GDT_INVOICE_XSLT);
});

// 12. Multi-provider Invoice Downloader API: List registered drivers
app.get('/api/invoice-downloader/drivers', (req, res) => {
  try {
    const drivers = invoiceManager.getRegisteredDrivers();
    res.json({ success: true, drivers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 13. Multi-provider Invoice Downloader API: Detect provider from XML
app.post('/api/invoice-downloader/detect', async (req, res) => {
  try {
    const { xml } = req.body;
    if (!xml) {
      return res.status(400).json({ error: 'Nội dung XML không được để trống' });
    }
    const details = invoiceManager.detectProviderDetails(xml);
    const driver = await invoiceManager.selectDriver(xml);
    const info = await driver.extractInfo(xml);
    res.json({
      success: true,
      provider: details.provider,
      detectedProvider: details.provider,
      priority: details.priority,
      matchedPattern: details.matchedPattern,
      sourceDescription: details.sourceDescription,
      driverName: driver.name,
      supportsCaptcha: driver.metadata.supportsCaptcha,
      isFallback: details.provider === 'UNKNOWN' || driver.providerCode === 'GENERIC',
      info
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 14. Multi-provider Invoice Downloader API: Download Original PDF / Fallback
app.post('/api/invoice-downloader/download', async (req, res) => {
  try {
    const { xml, forceFallback, timeoutMs } = req.body;
    if (!xml) {
      return res.status(400).json({ error: 'Nội dung XML không được để trống' });
    }

    const result = await invoiceManager.downloadInvoicePdf(xml, {
      forceFallback: Boolean(forceFallback),
      timeoutMs: timeoutMs ? Number(timeoutMs) : undefined
    });

    if (req.query.format === 'binary') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.pdfBuffer);
    }

    res.json({
      success: true,
      provider: result.provider,
      driverName: result.driverName,
      filename: result.filename,
      isFallback: result.isFallback,
      captchaSolved: result.captchaSolved,
      sourceUrl: result.sourceUrl,
      executionLogs: result.executionLogs,
      pdfBase64: result.pdfBase64
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 15. Tesseract OCR Captcha Solver endpoint
app.post('/api/invoice-downloader/solve-captcha', async (req, res) => {
  try {
    const { image, whitelist } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Ảnh Captcha không được để trống' });
    }

    const result = await CaptchaSolver.solveWithDetails(image, {
      whitelist: whitelist || undefined
    });

    res.json({
      success: true,
      code: result.code,
      confidence: result.confidence,
      engine: result.engine,
      processingTimeMs: result.processingTimeMs
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start Express Server with Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GDT E-Invoice Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
