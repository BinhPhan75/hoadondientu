import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import JSZip from 'jszip';
import { ProxyAgent } from 'undici';
import Tesseract from 'tesseract.js';
import { getInvoiceItemListFromPayload, getLookupCodeFromPayload, getLookupUrlFromPayload, getSellerFromPayload, normalizeInvoiceItem, parseGDTInvoiceXml } from './src/utils/xmlParser';
import { generateOfficialInvoiceHtml } from './src/utils/officialInvoiceHtml';
import { OFFICIAL_GDT_INVOICE_XSLT } from './src/utils/xsltTransformer';
import { invoiceManager, CaptchaSolver } from './src/services/invoice-engine';
import { downloadOriginalEasyInvoice } from './src/services/easyInvoiceService';
import { fetchGdtInvoiceDetail, fetchGdtInvoiceXml, mergeGdtInvoiceDetail } from './src/utils/gdtDetail';
import {
  initDatabase,
  getDatabaseStatus,
  findUserByUsername,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  WebUserView
} from './src/db/neonDb';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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

// Chuẩn hóa path cho môi trường Vercel Serverless Functions
app.use((req, res, next) => {
  // Nếu req.url bị Vercel rewrite thành /api/index.js hoặc /api, phục hồi lại từ originalUrl hoặc x-matched-path
  if (req.url === '/api/index.js' || req.url === '/api' || req.url === '/api/') {
    const matched = (req.headers['x-matched-path'] as string) || req.originalUrl;
    if (matched && matched !== '/api/index.js' && matched !== '/api') {
      req.url = matched;
    }
  }

  if (!req.url.startsWith('/api')) {
    if (
      req.url.startsWith('/auth') ||
      req.url.startsWith('/admin') ||
      req.url.startsWith('/gdt') ||
      req.url.startsWith('/invoice-downloader') ||
      req.url.startsWith('/easyinvoice') ||
      req.url.startsWith('/health') ||
      req.url.startsWith('/selenium')
    ) {
      req.url = '/api' + req.url;
    }
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
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin': 'https://hoadondientu.gdt.gov.vn',
  'Referer': 'https://hoadondientu.gdt.gov.vn/',
  'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
};

function getGdtDispatcher(customProxy?: string) {
  const proxyUrl = (customProxy || process.env.VIETNAM_PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY || '').trim();
  if (proxyUrl) {
    try {
      return new ProxyAgent(proxyUrl);
    } catch (e) {
      console.warn('[Proxy Initialization Warning]:', e);
    }
  }
  return undefined;
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

let globalF5Cookie = '';
let lastF5CookieTime = 0;

async function ensureF5Session(customProxy?: string): Promise<string> {
  const now = Date.now();
  if (globalF5Cookie && (now - lastF5CookieTime < 10 * 60 * 1000)) {
    return globalF5Cookie;
  }
  try {
    const dispatcher = getGdtDispatcher(customProxy);
    const fetchOpt: any = {
      headers: {
        ...GDT_HEADERS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      },
      signal: AbortSignal.timeout(6000)
    };
    if (dispatcher) fetchOpt.dispatcher = dispatcher;
    const homeRes = await fetch('https://hoadondientu.gdt.gov.vn/', fetchOpt);
    const cookie = extractCookies(homeRes);
    if (cookie) {
      globalF5Cookie = cookie;
      lastF5CookieTime = now;
    }
  } catch (e) {
    // Ignore error
  }
  return globalF5Cookie;
}

// Resilient GDT Fetch with Retry, Proxy & Timeout Protection
async function fetchGDT(url: string, options: RequestInit = {}, maxRetries = 1, timeoutMs = 12000, customProxy?: string): Promise<Response> {
  let lastError: any = null;
  const dispatcher = getGdtDispatcher(customProxy);
  const f5Cookie = await ensureF5Session(customProxy);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let timer: NodeJS.Timeout | null = null;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);

      const callerHeaders = (options.headers as Record<string, string> || {});
      const existingCookie = callerHeaders['Cookie'] || callerHeaders['cookie'] || '';
      const mergedCookie = [f5Cookie, existingCookie].filter(Boolean).join('; ');

      const mergedHeaders: Record<string, string> = {
        ...GDT_HEADERS,
        'request-id': crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}`,
        'End-Point': '/',
        'Action': '',
        ...callerHeaders
      };

      if (mergedCookie) {
        mergedHeaders['Cookie'] = mergedCookie;
      }

      const fetchOptions: any = {
        ...options,
        headers: mergedHeaders,
        signal: controller.signal
      };
      if (dispatcher) {
        fetchOptions.dispatcher = dispatcher;
      }

      const resp = await fetch(url, fetchOptions);

      if (timer) clearTimeout(timer);

      // Cập nhật F5 cookie nếu server trả về cookie mới
      const newCookies = extractCookies(resp);
      if (newCookies) {
        const set1 = new Set((globalF5Cookie || '').split('; ').filter(Boolean));
        for (const c of newCookies.split('; ').filter(Boolean)) {
          const key = c.split('=')[0];
          for (const item of Array.from(set1)) {
            if (item.startsWith(`${key}=`)) set1.delete(item);
          }
          set1.add(c);
        }
        globalF5Cookie = Array.from(set1).join('; ');
        lastF5CookieTime = Date.now();
      }

      if (resp.ok || resp.status === 400 || resp.status === 401 || resp.status === 403) {
        return resp;
      }

      lastError = new Error(`Cổng Thuế phản hồi mã HTTP ${resp.status}`);
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      lastError = err;
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastError || new Error('Không thể kết nối đến Cổng Tổng cục Thuế.');
}

// Clean GDT SVG noise lines: removes wavy background interference lines (<path stroke="..." fill="none"/>)
function cleanGdtSvgNoise(svg: string): string {
  if (!svg || typeof svg !== 'string') return svg;
  return svg.replace(/<path[^>]*stroke=[^>]*fill="none"[^>]*\/>/gi, '');
}

// Gemini AI OCR Client Lazy Initializer
import { GoogleGenAI } from '@google/genai';

let geminiAiClient: GoogleGenAI | null = null;
let geminiSpendingCapBlockedUntil = 0;
let geminiRateLimitBlockedUntil = 0;

function getGeminiClient(customKey?: string): GoogleGenAI | null {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiAiClient || customKey) {
    const client = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    if (!customKey) geminiAiClient = client;
    return client;
  }
  return geminiAiClient;
}

interface OCRResult {
  code: string;
  modelUsed?: string;
  error?: string;
  isMissingApiKey?: boolean;
  isSpendingCap?: boolean;
}

// Multi-Tier Captcha OCR Engine for GDT Portal
// Tier 1: SVG direct extraction (if text present)
// Tier 2: Gemini Vision AI (if key available)
// Tier 3: Local Tesseract.js OCR (offline/free fallback)
async function solveCaptchaOCR(svgOrDataUri: string, customApiKey?: string): Promise<OCRResult> {
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

  // Clean SVG noise lines if it is SVG
  if (!isBitmap && (rawSvg.includes('<svg') || rawSvg.includes('xmlns'))) {
    rawSvg = cleanGdtSvgNoise(rawSvg);
  }

  // Tier 1: Direct text extraction if SVG contains <text> tags
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

  // Tier 2: Gemini Vision AI (if key provided or available)
  const activeAi = getGeminiClient(customApiKey);
  if (activeAi && (customApiKey || Date.now() > geminiSpendingCapBlockedUntil && Date.now() > geminiRateLimitBlockedUntil)) {
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-3.6-flash',
      'gemini-flash-latest'
    ];

    const svgSnippet = rawSvg.substring(0, 4000);
    const contentsPayload: any[] = isBitmap && bitmapBase64
      ? [
          {
            inlineData: {
              mimeType: bitmapMime,
              data: bitmapBase64
            }
          },
          {
            text: 'This is a captcha image from Vietnamese tax portal. Extract and return ONLY the 4 to 6 uppercase alphanumeric characters shown in the image. Return only the exact characters without spaces, markdown, or punctuation.'
          }
        ]
      : [
          {
            text: `This is a Vietnamese GDT tax portal captcha SVG image (noise lines removed).
Extract and return ONLY the 4 to 6 uppercase alphanumeric characters shown in the SVG image. Return only the exact characters without spaces, markdown, or punctuation.
SVG Source:
\`\`\`xml
${svgSnippet}
\`\`\``
          }
        ];

    for (const modelName of candidateModels) {
      try {
        const ocrPromise = activeAi.models.generateContent({
          model: modelName,
          contents: contentsPayload
        });

        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 7000)
        );

        const aiResp = await Promise.race([ocrPromise, timeoutPromise]) as any;
        if (aiResp && aiResp.text) {
          const extracted = aiResp.text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          if (extracted && extracted.length >= 4 && extracted.length <= 6) {
            console.log(`[Gemini OCR (${modelName})] Successfully recognized Captcha: "${extracted}"`);
            return { code: extracted, modelUsed: modelName };
          }
        }
        break;
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes('spending cap')) {
          if (!customApiKey) geminiSpendingCapBlockedUntil = Date.now() + 15 * 60 * 1000;
          break;
        }
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          if (!customApiKey) geminiRateLimitBlockedUntil = Date.now() + 60 * 1000;
          break;
        }
      }
    }
  }

  // Tier 3: Local Tesseract.js OCR (Works offline, 0 cost, reliable on clean bitmaps)
  if (isBitmap && bitmapBase64) {
    try {
      console.log('[Tesseract OCR] Running local fallback OCR on bitmap...');
      const imageBuffer = Buffer.from(bitmapBase64, 'base64');
      const { data } = await Tesseract.recognize(imageBuffer, 'eng');
      if (data && data.text) {
        const cleaned = data.text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (cleaned.length >= 4 && cleaned.length <= 6) {
          console.log(`[Tesseract OCR] Recognized Captcha: "${cleaned}"`);
          return { code: cleaned, modelUsed: 'tesseract-local' };
        }
      }
    } catch (tessErr: any) {
      console.warn('[Tesseract OCR] Recognition error:', tessErr?.message);
    }
  }

  return {
    code: '',
    error: 'Không tự động nhận diện được mã Captcha. Vui lòng nhìn hình và nhập mã thủ công.'
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
    const gdtRes = await fetchGDT('https://hoadondientu.gdt.gov.vn/api/captcha', {}, 1, 6500);

    if (gdtRes.ok) {
      const cookieStr = extractCookies(gdtRes);
      const data = await gdtRes.json() as { key: string; content: string };
      
      if (data && data.key && data.content) {
        if (cookieStr) captchaCookieJar.set(data.key, cookieStr);
        captchaContentMap.set(data.key, data.content);

        const base64Image = `data:image/svg+xml;base64,${Buffer.from(data.content, 'utf-8').toString('base64')}`;

        return res.json({
          success: true,
          isRealGDT: true,
          captchaKey: data.key,
          captchaCookie: cookieStr,
          captchaCode: '',
          captchaImage: base64Image,
          rawSvg: data.content,
          source: 'hoadondientu.gdt.gov.vn'
        });
      }
    }

    const errText = await gdtRes.text();
    console.info('[GDT Captcha Fetch Notice]: HTTP', gdtRes.status, errText.substring(0, 100));
  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
      console.info('[GDT Proxy] Live GDT captcha connection timed out from server; switching seamlessly to client fallback.');
    } else {
      console.info('[GDT Proxy] Live GDT captcha notice:', error?.message);
    }
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
    message: 'Máy chủ Cloud (ngoài nước) không thể kết nối trực tiếp đến Cổng Thuế. Ứng dụng sẽ tự động tải Captcha trực tiếp từ trình duyệt của bạn tại Việt Nam.',
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
        isSpendingCap: ocrResult.isSpendingCap,
        message: ocrResult.error || 'Không nhận diện được mã Captcha. Vui lòng nhập thủ công.',
        isRealGDT: Boolean(captchaKey && !captchaKey.startsWith('ckey_local_'))
      });
    }
  } catch (err: any) {
    return res.json({ 
      success: false, 
      captchaCode: '',
      isSpendingCap: true,
      message: 'Không thể quét mã Captcha tự động. Vui lòng nhập thủ công từ ảnh.' 
    });
  }
});

// 2.2 Auto-Login Endpoint (Zero-Click Captcha with Auto-Retry & Bypass)
app.post('/api/gdt/auto-login', async (req, res) => {
  const { taxCode, password, vietnamProxy, customApiKey } = req.body;
  if (!taxCode || !taxCode.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã số thuế (MST).' });
  }
  if (!password || !password.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Mật khẩu do CQT cấp.' });
  }

  const maxAttempts = 3;
  let lastGdtError = '';
  let isWafBlocked = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Auto-Login] Lần thử ${attempt}/${maxAttempts} cho MST ${taxCode.trim()}...`);

      // 1. Tải Captcha từ Cổng Tổng cục Thuế
      const gdtRes = await fetchGDT('https://hoadondientu.gdt.gov.vn/api/captcha', {}, 1, 8000, vietnamProxy);
      if (!gdtRes.ok) {
        if (gdtRes.status === 403) {
          isWafBlocked = true;
          lastGdtError = 'Hệ thống phát hiện hành vi không hợp lệ. Yêu cầu đã bị chặn.';
          break;
        }
        continue;
      }

      const cookieStr = extractCookies(gdtRes);
      const capData = await gdtRes.json() as { key: string; content: string };
      if (!capData?.key || !capData?.content) continue;

      captchaCookieJar.set(capData.key, cookieStr);
      captchaContentMap.set(capData.key, capData.content);

      // 2. Làm sạch nhiễu và giải Captcha
      const cleanedSvg = cleanGdtSvgNoise(capData.content);
      const ocrResult = await solveCaptchaOCR(cleanedSvg, customApiKey);
      const solvedCode = (ocrResult.code || '').trim().toUpperCase();

      if (!solvedCode || solvedCode.length < 4) {
        console.log(`[Auto-Login] Lần ${attempt}: OCR chưa ra mã ký tự, đổi Captcha mới...`);
        continue;
      }

      console.log(`[Auto-Login] Lần ${attempt}: Mã Captcha "${solvedCode}" (Model: ${ocrResult.modelUsed || 'default'}). Đang gửi xác thực...`);

      // 3. Gửi yêu cầu xác thực tới Cổng Thuế
      const authRes = await fetchGDT('https://hoadondientu.gdt.gov.vn/api/security-taxpayer/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookieStr ? { 'Cookie': cookieStr } : {})
        },
        body: JSON.stringify({
          username: taxCode.trim(),
          password: password.trim(),
          ckey: capData.key,
          cvalue: solvedCode
        })
      }, 1, 15000, vietnamProxy);

      const newCookieStr = extractCookies(authRes);
      const combinedCookies = [cookieStr, newCookieStr].filter(Boolean).join('; ');
      const rawAuthText = await authRes.text();

      let authData: any = {};
      try { authData = JSON.parse(rawAuthText); } catch {}

      if (authRes.status === 403 || authData?.message?.includes('bị chặn') || authData?.message?.includes('không hợp lệ')) {
        isWafBlocked = true;
        lastGdtError = authData?.message || 'Cổng Thuế chặn kết nối từ máy chủ (HTTP 403)';
        break;
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

        console.log(`[Auto-Login] ĐĂNG NHẬP THÀNH CÔNG cho MST ${taxCode.trim()} ở lần thử ${attempt}!`);
        return res.json({
          success: true,
          isRealGDT: true,
          message: `Đã tự động vượt Captcha thành công (lần thử ${attempt}) và đăng nhập Cổng Tổng cục Thuế!`,
          session: currentSession,
          attemptsUsed: attempt
        });
      }

      if (authData?.message?.toLowerCase().includes('mật khẩu') || authData?.message?.toLowerCase().includes('tên đăng nhập')) {
        return res.status(400).json({
          success: false,
          message: authData.message || 'Mã số thuế hoặc Mật khẩu không chính xác.'
        });
      }

      lastGdtError = authData?.message || 'Mã xác thực không chính xác';
      console.log(`[Auto-Login] Lần ${attempt} chưa đúng mã (${lastGdtError}). Tự động thử lại...`);
      await new Promise(r => setTimeout(r, 400));
    } catch (e: any) {
      console.warn(`[Auto-Login] Lỗi lần thử ${attempt}:`, e.message);
      lastGdtError = e.message;
    }
  }

  if (isWafBlocked) {
    return res.status(403).json({
      success: false,
      isWafBlocked: true,
      message: 'Cổng Tổng cục Thuế đã chặn IP của máy chủ Cloud nước ngoài (HTTP 403: Yêu cầu đã bị chặn). Vui lòng sử dụng bản Desktop (.exe) chạy trực tiếp tại Việt Nam hoặc cấu hình Proxy IP Việt Nam để truy cập ổn định.'
    });
  }

  return res.status(400).json({
    success: false,
    needManualCaptcha: true,
    message: `Tự động vượt Captcha chưa thành công sau ${maxAttempts} lần thử (${lastGdtError}). Bạn có thể chuyển sang nhập Captcha thủ công để tiếp tục.`
  });
});

// 3. Login directly to GDT Portal / Authenticate Session
app.post('/api/gdt/login', async (req, res) => {
  let { taxCode, password, captchaKey, captchaCode, captchaCookie, vietnamProxy } = req.body;

  if (!taxCode) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã số thuế (MST).' });
  }

  if (!password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Mật khẩu tài khoản Tổng cục Thuế cấp.' });
  }

  if (!captchaCode || !captchaCode.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhìn hình và nhập mã Captcha hiển thị trên ảnh.' });
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
    }, 1, 20000, vietnamProxy);

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
      const isWafBlocked = authRes.status === 403 || 
        (authData.message && authData.message.includes('bị chặn')) ||
        (authData.message && authData.message.includes('không hợp lệ'));

      const errorMsg = isWafBlocked
        ? 'Cổng Tổng cục Thuế chặn kết nối từ máy chủ đám mây nước ngoài (HTTP 403: Yêu cầu đã bị chặn). Vui lòng sử dụng bản Desktop (.exe) chạy trực tiếp tại Việt Nam hoặc cấu hình Proxy IP Việt Nam để không bị chặn.'
        : (authData.message || authData.details || 'Xác thực thất bại từ Cổng Tổng cục Thuế. Vui lòng kiểm tra lại MST, Mật khẩu hoặc mã Captcha.');

      return res.status(authRes.status || 400).json({
        success: false,
        isRealGDT: true,
        isWafBlocked,
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
      message: `Không thể kết nối đến máy chủ Cổng Thuế (${err.message}). Vui lòng thử lại hoặc sử dụng bản Desktop tại Việt Nam để kết nối trực tiếp.`
    });
  }
});

// Split date range into sub-ranges <= 1 calendar month to comply with GDT's 31-day search limit
function splitDateRangeIntoMonthlyChunks(fromDateStr: string, toDateStr: string): Array<{ from: string; to: string }> {
  if (!fromDateStr || !toDateStr) return [{ from: fromDateStr, to: toDateStr }];
  const startParts = fromDateStr.split('-').map(Number);
  const endParts = toDateStr.split('-').map(Number);
  if (startParts.length !== 3 || endParts.length !== 3 || startParts.some(isNaN) || endParts.some(isNaN)) {
    return [{ from: fromDateStr, to: toDateStr }];
  }

  const [startY, startM, startD] = startParts;
  const [endY, endM, endD] = endParts;

  if (startY > endY || (startY === endY && startM > endM) || (startY === endY && startM === endM && startD > endD)) {
    return [{ from: fromDateStr, to: toDateStr }];
  }

  const getDaysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');

  const chunks: Array<{ from: string; to: string }> = [];
  let curY = startY;
  let curM = startM;
  let curD = startD;

  while (curY < endY || (curY === endY && curM <= endM)) {
    const maxDays = getDaysInMonth(curY, curM);
    const chunkStartD = curD;
    let chunkEndD = maxDays;

    if (curY === endY && curM === endM) {
      chunkEndD = Math.min(maxDays, endD);
    }

    chunks.push({
      from: `${curY}-${pad(curM)}-${pad(chunkStartD)}`,
      to: `${curY}-${pad(curM)}-${pad(chunkEndD)}`
    });

    curD = 1;
    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }

  return chunks.length > 0 ? chunks : [{ from: fromDateStr, to: toDateStr }];
}

// Fetch one invoice detail without delaying the list endpoint.
app.post('/api/gdt/invoice-detail', async (req, res) => {
  const { invoice, token: bodyToken, cookieHeader: bodyCookie } = req.body || {};
  const rawAuth = (req.headers.authorization as string) || bodyToken || '';
  const authHeader = (rawAuth && rawAuth.trim() && rawAuth.trim() !== 'Bearer') ? rawAuth.trim() : (currentSession?.token || '');
  const rawCookie = (req.headers['x-gdt-cookie'] as string) || bodyCookie || '';
  const cookieHeader = (rawCookie && rawCookie.trim()) ? rawCookie.trim() : (currentSession?.cookieHeader || '');

  if (!authHeader || !invoice) {
    return res.status(400).json({ success: false, message: 'Thiếu phiên đăng nhập hoặc thông tin hóa đơn.' });
  }

  try {
    const tokenHeader = authHeader.startsWith('Bearer ') ? authHeader : `Bearer ${authHeader}`;
    const gdtHeaders = { Authorization: tokenHeader, ...(cookieHeader ? { Cookie: cookieHeader } : {}) };
    
    // Fetch both JSON detail and XML export in parallel to halve response time
    const [detailRes, xmlExportRes] = await Promise.allSettled([
      fetchGdtInvoiceDetail(invoice, gdtHeaders),
      fetchGdtInvoiceXml(invoice, gdtHeaders)
    ]);

    const detail = detailRes.status === 'fulfilled' ? detailRes.value : null;
    const xmlExport = xmlExportRes.status === 'fulfilled' ? xmlExportRes.value : { xml: '', status: 0, contentType: '', bytes: 0, url: '' };

    if (detailRes.status === 'rejected') {
      console.warn('[GDT detail rejected]', detailRes.reason?.message || detailRes.reason);
    }
    if (xmlExportRes.status === 'rejected') {
      console.warn('[GDT XML export rejected]', xmlExportRes.reason?.message || xmlExportRes.reason);
    }

    const mergedInvoice = mergeGdtInvoiceDetail(invoice, detail, xmlExport.xml);
    return res.json({ 
      success: true, 
      invoice: mergedInvoice, 
      xmlExport: { 
        status: xmlExport.status, 
        contentType: xmlExport.contentType, 
        bytes: xmlExport.bytes, 
        hasXml: !!xmlExport.xml 
      } 
    });
  } catch (error: any) {
    return res.status(502).json({ success: false, message: `Không lấy được chi tiết hóa đơn: ${error.message}` });
  }
});

// 4. Query Real Invoices from GDT API (Supports stateless tokens for Vercel)
app.post('/api/gdt/query-invoices', async (req, res) => {
  const { fromDate, toDate, invoiceType = 'both', size = 50, includeDetails = false, token: bodyToken, cookieHeader: bodyCookie, vietnamProxy } = req.body;

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
  const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const tokenHeader = rawToken ? `Bearer ${rawToken}` : '';

  // Clean and sanitize cookies (strip empty jwt= and append jwt=<token>)
  const cleanCookies = (cookieHeader || '')
    .split(';')
    .map(c => c.trim())
    .filter(c => {
      const parts = c.split('=');
      return parts.length >= 2 && parts[1].trim().length > 0 && parts[0].trim() !== 'jwt';
    });
  if (rawToken) {
    cleanCookies.push(`jwt=${rawToken}`);
  }
  const sanitizedCookie = cleanCookies.join('; ');

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchChunkWithRetry = async (
    type: 'purchase' | 'sold',
    chunkFrom: string,
    chunkTo: string,
    source: 'query' | 'sco-query' = 'query',
    maxRetries = 2
  ): Promise<any[] | { error: string }> => {
    const gdtFrom = formatDateForGdt(chunkFrom, false);
    const gdtTo = formatDateForGdt(chunkTo, true);
    const searchParam = `tdlap=ge=${gdtFrom};tdlap=le=${gdtTo}`;
    const apiBase = source === 'sco-query' ? 'sco-query' : 'query';

    let page = 0;
    let currentState: string | null = null;
    let accumulated: any[] = [];
    const seenInChunk = new Set<string>();
    let hasNextPage = true;

    while (hasNextPage && page < 100) {
      let url = `https://hoadondientu.gdt.gov.vn/api/${apiBase}/invoices/${type}?sort=tdlap:desc&size=${size}&search=${encodeURIComponent(searchParam)}`;
      if (currentState) {
        url += `&state=${encodeURIComponent(currentState)}`;
      } else if (page > 0) {
        url += `&page=${page}`;
      }

      let attemptSucceeded = false;
      let data: any = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const resp = await fetchGDT(url, {
            method: 'GET',
            headers: {
              'Authorization': tokenHeader,
              'Accept': 'application/json, text/plain, */*',
              'End-Point': '/tra-cuu/tra-cuu-hoa-don',
              'Action': '',
              ...(sanitizedCookie ? { 'Cookie': sanitizedCookie } : {})
            }
          }, 1, 15000, vietnamProxy);

          if (resp.status === 401) {
            console.warn(`[GDT Query ${source}/${type} 401 Unauthorized]: Token rejected by GDT.`);
            if (source === 'sco-query') {
              return accumulated; // DO NOT fail entire query for POS invoices
            }
            return { error: 'AUTH_EXPIRED' };
          }

          if (resp.status === 403) {
            console.warn(`[GDT Query ${source}/${type} 403 Forbidden]: Request blocked by GDT WAF/Cloud IP restriction.`);
            if (source === 'sco-query') {
              return accumulated;
            }
            return { error: 'WAF_BLOCKED' };
          }

          if (resp.status === 429) {
            console.warn(`[GDT Query ${source}/${type} Rate Limit 429 for ${chunkFrom}..${chunkTo}]: Attempt ${attempt + 1}/${maxRetries + 1}. Pacing & backing off...`);
            if (attempt < maxRetries) {
              const backoffMs = (attempt + 1) * 1200;
              await sleep(backoffMs);
              continue;
            } else {
              console.warn(`[GDT Query ${source}/${type} Rate Limit]: Reached max retries for ${chunkFrom}..${chunkTo}`);
              break;
            }
          }

          if (!resp.ok) {
            const errText = await resp.text();
            console.warn(`[GDT Query ${source}/${type} HTTP ${resp.status} for ${chunkFrom}..${chunkTo}]:`, errText.substring(0, 200));
            if (attempt < maxRetries) {
              await sleep(1000);
              continue;
            }
            break;
          }

          const rawText = await resp.text();
          try {
            data = JSON.parse(rawText);
            attemptSucceeded = true;
            break;
          } catch {
            console.warn(`[GDT Query ${source}/${type} Non-JSON]:`, rawText.substring(0, 200));
            if (attempt < maxRetries) {
              await sleep(1000);
              continue;
            }
            break;
          }
        } catch (err: any) {
          console.warn(`[GDT Query ${source}/${type} Exception ${chunkFrom}..${chunkTo} (attempt ${attempt + 1})]:`, err.message);
          if (attempt < maxRetries) {
            await sleep(1000);
            continue;
          }
          break;
        }
      }

      if (!attemptSucceeded || !data) {
        console.warn(`[GDT Query ${source}/${type}] Could not retrieve page ${page} for ${chunkFrom}..${chunkTo}`);
        break;
      }

      const list = extractGdtInvoiceList(data);
      const total = Number(data.total ?? data.totalElements ?? data.totalCount ?? data.data?.total ?? 0);
      const rawNextState = data.state ?? data.State ?? data.data?.state ?? data.data?.State;
      const nextState = (typeof rawNextState === 'string' && rawNextState.trim().length > 0) ? rawNextState.trim() : null;

      // Normalize GDT invoice payload
      const normalizedPage = list.map((item: any) => ({
        id: item.id || `GDT_${source === 'sco-query' ? 'POS_' : ''}${item.khhdon || ''}_${item.shdon || ''}_${item.nbmst || item.nmmst || ''}_${item.tdlap || ''}`,
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
        isPos: source === 'sco-query'
      }));

      // Deduplicate within this chunk
      let newCount = 0;
      for (const inv of normalizedPage) {
        const uniqueKey = `${inv.khhdon}_${inv.shdon}_${inv.nbmst}_${inv.isPos ? 'pos' : 'std'}`;
        if (!seenInChunk.has(uniqueKey)) {
          seenInChunk.add(uniqueKey);
          accumulated.push(inv);
          newCount++;
        }
      }

      console.log(`[GDT Query ${source}/${type}] ${chunkFrom} -> ${chunkTo} (page ${page + 1}): fetched ${list.length} raw, ${newCount} new (total: ${accumulated.length}/${total || 'unknown'}, nextState: ${Boolean(nextState)})`);

      // Termination checks:
      // 1. If 0 new unique invoices were added or empty list returned -> stop
      if (newCount === 0 || list.length === 0) {
        hasNextPage = false;
        break;
      }

      // 2. If total is known and accumulated has reached or exceeded total -> stop
      if (total > 0 && accumulated.length >= total) {
        hasNextPage = false;
        break;
      }

      // 3. If GDT returned a state cursor for the next batch
      if (nextState && nextState !== currentState) {
        currentState = nextState;
        page++;
        hasNextPage = true;
        await sleep(250);
        continue;
      }

      // 4. If no state cursor provided, but GDT returned a full page (list.length >= size) and total is unknown or greater
      if (list.length >= Number(size) && (!total || accumulated.length < total)) {
        currentState = null;
        page++;
        hasNextPage = true;
        await sleep(250);
        continue;
      }

      // Otherwise, no more pages
      hasNextPage = false;
    }

    return accumulated;
  };

  const fetchAllChunksForType = async (type: 'purchase' | 'sold', source: 'query' | 'sco-query' = 'query') => {
    let allInvoices: any[] = [];
    for (let i = 0; i < dateChunks.length; i++) {
      const chunk = dateChunks[i];
      if (i > 0) {
        // Pacing delay between sequential requests to prevent 429 Too Many Requests
        await sleep(250);
      }
      const chunkResult = await fetchChunkWithRetry(type, chunk.from, chunk.to, source);
      if ((chunkResult as any)?.error === 'AUTH_EXPIRED') {
        return { error: 'AUTH_EXPIRED' };
      }
      if ((chunkResult as any)?.error === 'WAF_BLOCKED') {
        return { error: 'WAF_BLOCKED' };
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
    const purchaseList = await fetchAllChunksForType('purchase', 'query');
    if ((purchaseList as any)?.error === 'AUTH_EXPIRED') {
      // Check if session was created recently (< 10 min). If recent, keep session intact.
      const isFresh = currentSession?.createdAt && (Date.now() - currentSession.createdAt < 10 * 60 * 1000);
      if (!isFresh) {
        currentSession = null;
      }
      return res.status(401).json({
        success: false,
        isExpired: true,
        sessionValid: Boolean(isFresh),
        message: 'Phiên làm việc Cổng Tổng cục Thuế cần xác thực lại. Vui lòng nhập mã Captcha để tiếp tục.'
      });
    }

    if ((purchaseList as any)?.error === 'WAF_BLOCKED') {
      // 403 Forbidden / WAF block: The session is VALID! Do NOT destroy session!
      return res.status(403).json({
        success: false,
        isWafBlocked: true,
        sessionValid: true,
        invoices: [],
        message: 'Cổng Tổng cục Thuế tạm thời từ chối truy vấn (HTTP 403: Yêu cầu bị hạn chế). Phiên đăng nhập của bạn vẫn còn hiệu lực. Vui lòng thử lại sau giây lát.'
      });
    }

    if (Array.isArray(purchaseList)) {
      results = results.concat(purchaseList);
    }

    // Hóa đơn khởi tạo từ máy tính tiền (POS) nằm ở một cổng dữ liệu riêng
    // của GDT (/api/sco-query). Thử lấy nhưng KHÔNG BAO GIỜ được làm hỏng phiên hoặc báo lỗi toàn cục.
    try {
      await sleep(250);
      const posPurchaseList = await fetchAllChunksForType('purchase', 'sco-query');
      if (Array.isArray(posPurchaseList)) {
        results = results.concat(posPurchaseList);
      }
    } catch (posErr: any) {
      console.info('[GDT sco-query POS notice]:', posErr?.message || posErr);
    }

    // Deduplicate by unique invoice key
    const seenMap = new Map<string, any>();
    for (const inv of results) {
      const key = `${inv.khhdon}_${inv.shdon}_${inv.nbmst}_${inv.loaiHdon}_${inv.isPos ? 'pos' : 'std'}`;
      if (!seenMap.has(key)) {
        seenMap.set(key, inv);
      }
    }
    const dedupedResults = Array.from(seenMap.values());

    // The list API does not contain reliable HHDVu/seller/reference fields.
    // Fetch the same detail record used by the GDT web portal before returning data.
    if (includeDetails) for (let i = 0; i < dedupedResults.length; i++) {
      const invoice = dedupedResults[i];
      try {
        const detailHeaders = {
          Authorization: tokenHeader,
          ...(sanitizedCookie ? { Cookie: sanitizedCookie } : (cookieHeader ? { Cookie: cookieHeader } : {}))
        };
        let detail = null;
        try { detail = await fetchGdtInvoiceDetail(invoice, detailHeaders); } catch (error: any) { console.warn('[GDT detail]', error?.message || error); }
        let xmlExport = { xml: '', status: 0, contentType: '', bytes: 0, url: '' };
        try { xmlExport = await fetchGdtInvoiceXml(invoice, detailHeaders); } catch (error: any) { console.warn('[GDT XML export]', error?.message || error); }
        dedupedResults[i] = mergeGdtInvoiceDetail(invoice, detail, xmlExport.xml);
        if (i < dedupedResults.length - 1) await sleep(300);
      } catch (detailError: any) {
        console.warn(`[GDT Detail] ${invoice.khhdon}/${invoice.shdon}: ${detailError.message}`);
        dedupedResults[i] = mergeGdtInvoiceDetail(invoice, null);
      }
    }

    // Sort descending by date
    dedupedResults.sort((a, b) => new Date(b.tdlap).getTime() - new Date(a.tdlap).getTime());

    return res.json({
      success: true,
      isRealGDT: true,
      invoices: dedupedResults,
      count: dedupedResults.length,
      chunksQueried: dateChunks.length,
      message: includeDetails
        ? `Đã truy xuất ${dedupedResults.length} hóa đơn và tải bổ sung dữ liệu chi tiết từ Cổng Tổng cục Thuế (${dateChunks.length} kỳ con).`
        : `Đã truy xuất ${dedupedResults.length} hóa đơn từ Cổng Tổng cục Thuế (${dateChunks.length} kỳ con).`
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

// 8. Download standalone Python & Native Desktop Package (.zip)
app.get('/api/gdt/download-python-package', async (req, res) => {
  try {
    const zip = new JSZip();
    const fs = await import('fs');

    const pythonDir = path.join(process.cwd(), 'python');
    const files = [
      'gdt_selenium_crawler.py',
      'requirements.txt',
      'README_GDT.md',
      'gdt_crawler.ps1',
      'run_powershell.bat',
      'run_windows.bat',
      'HUONG_DAN_SUA_LOI_PYTHON.txt'
    ];

    for (const file of files) {
      const fullPath = path.join(pythonDir, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        zip.file(file, content);
      }
    }

    // Smart run scripts for Windows (.bat) with auto-detection & fallback
    const runBat = `@echo off
chcp 65001 >nul
title TOOL TỰ ĐỘNG HÓA TẢI HÓA ĐƠN ĐIỆN TỬ TỔNG CỤC THUẾ (GDT)
echo ==============================================================================
echo  KHOI DONG TOOL TAI HOA DON DIEN TU TONG CUC THUE GDT
echo ==============================================================================
echo.

:: 1. Kiem tra lenh python trong PATH
set PYTHON_CMD=
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=python
    goto :FOUND_PYTHON
)

:: 2. Kiem tra py launcher tren Windows
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=py
    goto :FOUND_PYTHON
)

:: 3. Tim trong thu muc cai dat mac dinh cua Windows
for /d %%D in ("%LOCALAPPDATA%\\Programs\\Python\\Python3*") do (
    if exist "%%D\\python.exe" (
        set PYTHON_CMD="%%D\\python.exe"
        goto :FOUND_PYTHON
    )
)
for /d %%D in ("C:\\Program Files\\Python3*") do (
    if exist "%%D\\python.exe" (
        set PYTHON_CMD="%%D\\python.exe"
        goto :FOUND_PYTHON
    )
)
for /d %%D in ("C:\\Python3*") do (
    if exist "%%D\\python.exe" (
        set PYTHON_CMD="%%D\\python.exe"
        goto :FOUND_PYTHON
    )
)

:: 4. Neu khong tim thay Python: Hien thi menu lua chon thong minh
cls
echo ==============================================================================
echo  THONG BAO: MAY TINH CHUA CAI PYTHON HOAC CHUA TICK 'ADD PYTHON TO PATH'
echo ==============================================================================
echo.
echo He thong khong tim thay trinh thuc thi Python tren may tinh cua ban.
echo Ban co the chon 1 trong cac phuong an sau:
echo.
echo   [1] Chay ngay bang Windows PowerShell (KHONG CAN CAI PYTHON - KHUYEN DUNG)
echo   [2] Tu dong cai dat Python 3 qua Windows winget (Tu dong 100%%)
echo   [3] Mo trang chu python.org de tai bo cai thu cong
echo   [4] Xem huong dan chi tiet khac phuc loi
echo   [5] Thoat
echo.
set /p USER_CHOICE="Nhap lua chon cua ban (1/2/3/4/5) [Mac dinh: 1]: "
if "%USER_CHOICE%"=="" set USER_CHOICE=1

if "%USER_CHOICE%"=="1" (
    echo.
    echo Dang khoi dong tool truc tiep qua Windows PowerShell...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0gdt_crawler.ps1"
    pause
    exit /b
)

if "%USER_CHOICE%"=="2" (
    echo.
    echo Dang tu dong cai dat Python qua winget...
    winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    echo.
    echo Cai dat hoan tat! Vui long dong cua so nay va khoi dong lai run_windows.bat.
    pause
    exit /b
)

if "%USER_CHOICE%"=="3" (
    start https://www.python.org/downloads/
    echo.
    echo Luu y quan trong: Khi cai dat, nho TICK CHON vao o "Add python.exe to PATH" o man hinh dau tien!
    pause
    exit /b
)

if "%USER_CHOICE%"=="4" (
    notepad "%~dp0HUONG_DAN_SUA_LOI_PYTHON.txt"
    exit /b
)

pause
exit /b

:FOUND_PYTHON
echo [OK] Da tim thay trinh thuc thi Python: %PYTHON_CMD%
echo.
echo Khoi dong Tool tai hoa don...
%PYTHON_CMD% "%~dp0gdt_selenium_crawler.py"
echo.
pause
`;

    const runSh = `#!/bin/bash
echo "=== TAI HOA DON DIEN TU TONG CUC THUE ==="
pip install -r requirements.txt
python3 gdt_selenium_crawler.py --type purchase
`;

    if (fs.existsSync(path.join(pythonDir, 'run_windows.bat'))) {
      zip.file('run_windows.bat', fs.readFileSync(path.join(pythonDir, 'run_windows.bat'), 'utf-8'));
    } else {
      zip.file('run_windows.bat', runBat);
    }
    zip.file('run_mac_linux.sh', runSh);

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="GDT_Invoice_Crawler_Desktop.zip"');
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
    const { xml, forceFallback, timeoutMs, overrideProvider, customInfo } = req.body;
    if (!xml) {
      return res.status(400).json({ error: 'Nội dung XML không được để trống' });
    }

    const result = await invoiceManager.downloadInvoicePdf(xml, {
      forceFallback: Boolean(forceFallback),
      timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
      overrideProvider,
      customInfo
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

// 16. Softdreams EasyInvoice: Tự động giải Captcha bằng Tesseract.js & Tải hóa đơn gốc
app.post('/api/easyinvoice/download', async (req, res) => {
  try {
    const { lookupCode, sellerTaxCode, lookupUrl, khhdon, shdon, viewOnly } = req.body;
    if (!lookupCode) {
      return res.status(400).json({ success: false, error: 'Mã tra cứu EasyInvoice (FKey) không được để trống' });
    }

    const result = await downloadOriginalEasyInvoice({
      lookupCode: String(lookupCode).trim(),
      sellerTaxCode: sellerTaxCode ? String(sellerTaxCode).trim() : undefined,
      lookupUrl: lookupUrl ? String(lookupUrl).trim() : undefined,
      khhdon: khhdon ? String(khhdon).trim() : undefined,
      shdon: shdon ? String(shdon).trim() : undefined,
      viewOnly: Boolean(viewOnly)
    });

    if (req.query.format === 'binary') {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
      return res.send(result.buffer);
    }

    res.json({
      success: true,
      filename: result.filename,
      contentType: result.contentType,
      pdfBase64: result.pdfBase64 || result.buffer.toString('base64'),
      htmlContent: result.htmlContent || '',
      message: 'Đã tự động vượt Captcha và tải về hóa đơn gốc thành công.'
    });
  } catch (error: any) {
    console.error('[EasyInvoice] Lỗi tải hóa đơn gốc:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// WEB AUTHENTICATION & NEON DATABASE MANAGEMENT ROUTES
// ============================================================================

interface WebSessionInfo {
  token: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: number;
}
function getAuthTokenSecret(): string {
  const secret = process.env.AUTH_TOKEN_SECRET ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    'gdt_web_auth_token_default_secret_key_2026';
  return secret;
}

function getWebAppAuthUrl(req?: express.Request): string {
  // Khi chạy trên Vercel hoặc môi trường Web Server, không proxy sang webapp khác
  if (process.env.VERCEL) {
    return '';
  }
  // Chỉ kích hoạt proxy nếu có biến môi trường AUTH_WEBAPP_URL được cấu hình rõ ràng (dành cho app Desktop)
  const configuredUrl = (process.env.AUTH_WEBAPP_URL || '').trim();
  if (!configuredUrl) {
    return '';
  }
  const normalizedUrl = /^https?:\/\//i.test(configuredUrl) ? configuredUrl : `https://${configuredUrl}`;
  const trimmed = normalizedUrl.replace(/\/+$/, '');

  // Tránh tự proxy vào chính mình nếu domain trùng với host hiện tại
  if (req) {
    const host = req.get('host');
    if (host && (trimmed.includes(host) || host.includes('vercel.app'))) {
      return '';
    }
  }

  return trimmed;
}

function mapRemoteUser(user: any): WebUserView | null {
  if (!user || typeof user.username !== 'string') return null;
  return {
    id: user.id ?? user.username,
    username: user.username,
    password: '',
    full_name: user.fullName || user.full_name || '',
    role: user.role === 'admin' ? 'admin' : 'user',
    duration_months: Number(user.durationMonths ?? user.duration_months) || 1,
    created_at: user.createdAt || user.created_at || new Date().toISOString(),
    expires_at: user.expiresAt || user.expires_at || new Date(8640000000000000).toISOString(),
    is_active: user.isActive !== false && user.is_active !== false,
    notes: user.notes || '',
    days_remaining: Math.max(0, Number(user.daysRemaining ?? user.days_remaining) || 0),
    is_expired: user.isExpired === true || user.is_expired === true,
    status: user.status || 'active'
  };
}

async function getRemoteAuthUser(token: string): Promise<WebUserView | null> {
  const authUrl = getWebAppAuthUrl();
  if (!authUrl) return null;
  const response = await fetch(`${authUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  const payload = await response.json() as { user?: any };
  return mapRemoteUser(payload.user);
}

async function proxyWebAppRequest(
  req: express.Request,
  route: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
): Promise<{ status: number; payload: any }> {
  const authUrl = getWebAppAuthUrl();
  const headers: Record<string, string> = {
    Authorization: req.headers.authorization || ''
  };
  const options: RequestInit = { method, headers };
  if (method !== 'GET' && method !== 'DELETE') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(req.body || {});
  }
  const response = await fetch(`${authUrl}${route}`, options);
  const payload = await response.json().catch(() => ({
    success: false,
    message: `Webapp trả về HTTP ${response.status}.`
  }));
  return { status: response.status, payload };
}

function createWebToken(username: string): string {
  const payload = Buffer.from(JSON.stringify({ username, issuedAt: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', getAuthTokenSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function getUsernameFromToken(token: string): string | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = crypto.createHmac('sha256', getAuthTokenSecret()).update(payload).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof parsed.username === 'string' ? parsed.username : null;
  } catch {
    return null;
  }
}

function formatUserForClient(user: WebUserView) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name || '',
    role: user.role,
    durationMonths: user.duration_months,
    createdAt: user.created_at,
    expiresAt: user.expires_at,
    isActive: user.is_active,
    notes: user.notes || '',
    daysRemaining: user.days_remaining,
    isExpired: user.is_expired,
    status: user.status
  };
}

function formatUserForAdmin(user: WebUserView) {
  return {
    ...formatUserForClient(user),
    password: user.password // Cung cấp để Admin có thể xem/copy gửi cho khách hàng
  };
}

async function authenticateWebUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập hệ thống.' });
  }

  const token = authHeader.substring(7).trim();
  if (getWebAppAuthUrl(req)) {
    try {
      const remoteUser = await getRemoteAuthUser(token);
      if (!remoteUser || !remoteUser.is_active) {
        return res.status(401).json({ success: false, message: 'Phiên đăng nhập webapp đã hết hạn. Vui lòng đăng nhập lại.' });
      }
      if (remoteUser.is_expired && remoteUser.role !== 'admin') {
        return res.status(403).json({ success: false, expired: true, message: 'Tài khoản đã hết hạn sử dụng.' });
      }
      (req as any).webUser = remoteUser;
      return next();
    } catch (error: any) {
      console.error('[Desktop Remote Auth Error]:', error.message);
      return res.status(502).json({ success: false, message: 'Không kết nối được máy chủ xác thực webapp.' });
    }
  }

  const username = getUsernameFromToken(token);
  if (!username) {
    return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
  }

  const user = await findUserByUsername(username);
  if (!user || !user.is_active) {
    return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa.' });
  }

  if (user.is_expired && user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      expired: true,
      message: `Tài khoản của bạn đã hết hạn sử dụng (${new Date(user.expires_at).toLocaleDateString('vi-VN')}). Vui lòng liên hệ quản trị viên để gia hạn.`
    });
  }

  (req as any).webUser = user;
  next();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).webUser;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền quản trị viên.' });
  }
  next();
}

// 1. Đăng nhập hệ thống Web
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã số thuế và mật khẩu.' });
    }

    const authUrl = getWebAppAuthUrl(req);
    if (authUrl) {
      const remoteResponse = await fetch(`${authUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const remotePayload = await remoteResponse.json().catch(() => ({}));
      if (!remoteResponse.ok || remotePayload.success === false) {
        return res.status(remoteResponse.status || 502).json(remotePayload);
      }
      if (!remotePayload.token || !remotePayload.user) {
        return res.status(502).json({ success: false, message: 'Webapp trả về dữ liệu đăng nhập không hợp lệ.' });
      }
      return res.json(remotePayload);
    }

    const dbInit = await initDatabase();
    if (!dbInit.success) {
      return res.status(200).json({
        success: false,
        message: dbInit.message || 'Hệ thống chưa kết nối tới Neon Database. Vui lòng cấu hình DATABASE_URL hoặc POSTGRES_URL trên Vercel.'
      });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Tên đăng nhập (Mã số thuế) hoặc mật khẩu không đúng.' });
    }

    if (user.password !== password.trim()) {
      return res.status(401).json({ success: false, message: 'Mật khẩu không chính xác.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Tài khoản này đang bị tạm khóa. Vui lòng liên hệ quản trị viên.' });
    }

    if (user.is_expired && user.role !== 'admin') {
      const expiryFormatted = new Date(user.expires_at).toLocaleDateString('vi-VN');
      return res.status(403).json({
        success: false,
        expired: true,
        message: `Tài khoản của bạn đã hết hạn sử dụng vào ngày ${expiryFormatted}. Vui lòng liên hệ quản trị viên để gia hạn gói cước.`
      });
    }

    const token = createWebToken(user.username);

    res.json({
      success: true,
      token,
      user: formatUserForClient(user)
    });
  } catch (err: any) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ success: false, message: err.message || 'Lỗi xử lý đăng nhập' });
  }
});

// 2. Lấy thông tin phiên làm việc hiện tại
app.get('/api/auth/me', authenticateWebUser, async (req, res) => {
  res.json({
    success: true,
    user: formatUserForClient((req as any).webUser)
  });
});

// 3. Đăng xuất
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
  }
  res.json({ success: true });
});

// 4. Quản trị: Lấy danh sách tất cả tài khoản người dùng
app.get('/api/admin/users', authenticateWebUser, requireAdmin, async (req, res) => {
  try {
    if (getWebAppAuthUrl(req)) {
      const result = await proxyWebAppRequest(req, '/api/admin/users', 'GET');
      return res.status(result.status).json(result.payload);
    }
    const dbInit = await initDatabase();
    if (!dbInit.success) {
      return res.status(200).json({ success: false, message: dbInit.message });
    }
    const users = await getAllUsers();
    res.json({
      success: true,
      users: users.map(formatUserForAdmin)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Quản trị: Tạo tài khoản người dùng mới
app.post('/api/admin/users', authenticateWebUser, requireAdmin, async (req, res) => {
  try {
    if (getWebAppAuthUrl(req)) {
      const result = await proxyWebAppRequest(req, '/api/admin/users', 'POST');
      return res.status(result.status).json(result.payload);
    }
    const { username, password, fullName, durationMonths, notes, role } = req.body;
    const result = await createUser({
      username,
      password,
      fullName,
      durationMonths: Number(durationMonths) || 1,
      notes,
      role: role === 'admin' ? 'admin' : 'user'
    });

    if (!result.success || !result.user) {
      return res.status(400).json({ success: false, message: result.error || 'Không thể tạo người dùng' });
    }

    res.json({
      success: true,
      user: formatUserForAdmin(result.user)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Quản trị: Cập nhật thông tin / gia hạn / đổi mật khẩu
app.put('/api/admin/users/:id', authenticateWebUser, requireAdmin, async (req, res) => {
  try {
    if (getWebAppAuthUrl(req)) {
      const result = await proxyWebAppRequest(req, `/api/admin/users/${encodeURIComponent(req.params.id)}`, 'PUT');
      return res.status(result.status).json(result.payload);
    }
    const { password, fullName, extendMonths, newExpiresAt, isActive, notes } = req.body;
    const result = await updateUser(req.params.id, {
      password,
      fullName,
      extendMonths: extendMonths ? Number(extendMonths) : undefined,
      newExpiresAt,
      isActive,
      notes
    });

    if (!result.success || !result.user) {
      return res.status(400).json({ success: false, message: result.error || 'Cập nhật thất bại' });
    }

    res.json({
      success: true,
      user: formatUserForAdmin(result.user)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Quản trị: Xóa người dùng
app.delete('/api/admin/users/:id', authenticateWebUser, requireAdmin, async (req, res) => {
  try {
    if (getWebAppAuthUrl(req)) {
      const result = await proxyWebAppRequest(req, `/api/admin/users/${encodeURIComponent(req.params.id)}`, 'DELETE');
      return res.status(result.status).json(result.payload);
    }
    const result = await deleteUser(req.params.id);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Trạng thái kết nối Neon Database
app.get('/api/admin/db-status', async (req, res) => {
  try {
    if (getWebAppAuthUrl(req)) {
      return res.json({
        success: true,
        connected: true,
        type: 'remote_webapp',
        message: 'Xác thực Neon được thực hiện bởi webapp.'
      });
    }
    const status = await getDatabaseStatus();
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Global process safety handlers
process.on('uncaughtException', (err) => {
  console.error('[Process uncaughtException]:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process unhandledRejection]:', reason);
});

// Global JSON error handler cho các API endpoints (Áp dụng cho cả Vercel Serverless và Local Server)
app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API Error Handler]:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Lỗi máy chủ nội bộ. Vui lòng thử lại.'
  });
});

// Start Express Server with Vite integration
async function startServer() {
  // 1. Mở cổng lắng nghe 3000 NGAY LẬP TỨC để Nginx/Cloud Run không bao giờ trả về 502/Warmup
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GDT E-Invoice Server running on http://0.0.0.0:${PORT}`);
    // Khởi tạo Database Neon bất đồng bộ trong nền
    initDatabase().then(dbInitResult => {
      console.log(`[Database Init] ${dbInitResult.message}`);
    }).catch(dbErr => {
      console.warn('[Database Init] Warning:', dbErr.message);
    });
  });

  // 2. Tích hợp Vite middleware cho môi trường dev hoặc phục vụ static file khi production
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          allowedHosts: true,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[Vite] Vite middleware attached.');
    } catch (viteErr: any) {
      console.error('[Vite Init Error]:', viteErr.message);
    }
  } else {
    // In the packaged Electron app, server.cjs and the frontend assets are
    // both inside the app archive, so process.cwd() points to the wrong folder.
    const distPath = process.env.VERCEL
      ? path.join(process.cwd(), 'dist')
      : (typeof __filename !== 'undefined' ? path.dirname(__filename) : process.cwd());
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

export default app;

if (!process.env.VERCEL) {
  startServer();
}
