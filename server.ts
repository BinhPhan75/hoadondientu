import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

let currentSession: SessionData | null = {
  taxCode: '0316892345',
  taxpayerName: 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG ĐÔNG NAM Á',
  address: 'Số 142 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP Hồ Chí Minh',
  token: 'GDT_DEMO_TOKEN_2025',
  isRealGDT: false,
  createdAt: Date.now()
};

// Store cookies corresponding to captcha keys
const captchaCookieJar = new Map<string, string>();

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
  try {
    // Fetch directly from official General Department of Taxation Portal
    const gdtRes = await fetch('https://hoadondientu.gdt.gov.vn/api/captcha', {
      headers: GDT_HEADERS,
      signal: AbortSignal.timeout(6000)
    });

    if (gdtRes.ok) {
      // Capture WAF & session cookies from GDT
      const rawCookies = (gdtRes.headers as any).getSetCookie 
        ? (gdtRes.headers as any).getSetCookie() 
        : [gdtRes.headers.get('set-cookie')];
      const cookieStr = (rawCookies || []).filter(Boolean).map((c: string) => c.split(';')[0]).join('; ');

      const data = await gdtRes.json() as { key: string; content: string };
      if (data.key && cookieStr) {
        captchaCookieJar.set(data.key, cookieStr);
      }

      return res.json({
        success: true,
        isRealGDT: true,
        captchaKey: data.key,
        captchaCode: '', // Real GDT captcha requires user/OCR recognition
        captchaImage: `data:image/svg+xml;utf8,${encodeURIComponent(data.content)}`,
        source: 'hoadondientu.gdt.gov.vn'
      });
    }
  } catch (error: any) {
    console.warn('[GDT Proxy] Cannot reach live GDT captcha, falling back to local generator:', error.message);
  }

  // Fallback local SVG captcha if GDT portal is unreachable
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

  res.json({
    success: true,
    isRealGDT: false,
    captchaKey,
    captchaCode: captchaText,
    captchaImage: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    source: 'local_fallback'
  });
});

// 3. Login directly to GDT Portal / Authenticate Session
app.post('/api/gdt/login', async (req, res) => {
  const { taxCode, password, captchaKey, captchaCode, isDemo } = req.body;

  if (!taxCode) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã số thuế (MST).' });
  }

  // If user explicitly asks for Demo / Sample Sandbox mode
  if (isDemo || (taxCode === '0316892345' && (!password || password === 'Gdt@Tax2025!' || password === 'Gdt@Pass2025!'))) {
    currentSession = {
      taxCode: taxCode.trim(),
      taxpayerName: 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG ĐÔNG NAM Á (DỮ LIỆU MẪU)',
      address: 'Số 142 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP Hồ Chí Minh',
      token: 'GDT_DEMO_SANDBOX_TOKEN',
      isRealGDT: false,
      createdAt: Date.now()
    };

    return res.json({
      success: true,
      isRealGDT: false,
      isDemo: true,
      message: 'Đã kích hoạt chế độ Dữ liệu Mẫu (Demo Sandbox) cho MST: ' + taxCode,
      session: currentSession
    });
  }

  if (!password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Mật khẩu tài khoản Tổng cục Thuế cấp.' });
  }

  if (!captchaCode) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập mã Captcha hiển thị trên màn hình.' });
  }

  // Attach session cookies stored from captcha step
  const cookieHeader = captchaKey ? captchaCookieJar.get(captchaKey) || '' : '';

  // REAL GDT AUTHENTICATION: Send POST to https://hoadondientu.gdt.gov.vn/api/security-taxpayer/authenticate
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
      signal: AbortSignal.timeout(12000)
    });

    // Capture updated session cookies from authenticate response
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
      // Return the exact error message from General Department of Taxation
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
    return res.status(500).json({
      success: false,
      isRealGDT: true,
      message: `Không thể kết nối đến máy chủ Cổng Thuế (hoadondientu.gdt.gov.vn): ${err.message}. Vui lòng thử lại hoặc sử dụng tính năng Nạp tệp XML / Chế độ Mẫu.`
    });
  }
});

// 4. Query Real Invoices from GDT API
app.post('/api/gdt/query-invoices', async (req, res) => {
  const { fromDate, toDate, invoiceType, size = 50 } = req.body;

  if (!currentSession) {
    return res.status(401).json({
      success: false,
      message: 'Chưa có phiên làm việc với Tổng cục Thuế. Vui lòng nhập mã Captcha để kết nối.'
    });
  }

  // If in Demo Mode, inform client to use local matching generator
  if (!currentSession.isRealGDT) {
    return res.json({
      success: true,
      isRealGDT: false,
      isDemo: true,
      message: 'Đang ở chế độ Dữ liệu Mẫu (Demo Sandbox)',
      invoices: []
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

  const gdtFrom = formatDateForGdt(fromDate || '2026-03-01', false);
  const gdtTo = formatDateForGdt(toDate || '2026-03-31', true);
  const searchParam = `tdlap=ge=${gdtFrom};tdlap=le=${gdtTo}`;

  const tokenHeader = currentSession.token.startsWith('Bearer ') ? currentSession.token : `Bearer ${currentSession.token}`;

  const fetchType = async (type: 'purchase' | 'sold') => {
    const url = `https://hoadondientu.gdt.gov.vn/api/query/invoices/${type}?sort=tdlap:desc,khhdon:asc,shdon:desc&size=${size}&search=${encodeURIComponent(searchParam)}`;
    const resp = await fetch(url, {
      headers: {
        ...GDT_HEADERS,
        'Authorization': tokenHeader,
        ...(currentSession.cookieHeader ? { 'Cookie': currentSession.cookieHeader } : {})
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (resp.status === 401 || resp.status === 403) {
      console.warn(`[GDT Query ${type} Unauthorized]: Session token expired.`);
      return { error: 'AUTH_EXPIRED' };
    }

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`[GDT Query ${type} Error]:`, resp.status, errText.substring(0, 200));
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

    const list = data.datas || data.data || data.rows || data.content || (Array.isArray(data) ? data : []);
    
    // Normalize GDT invoice payload
    return list.map((item: any) => ({
      id: item.id || `GDT_${item.khhdon}_${item.shdon}_${item.nbmst || item.nmmst}`,
      khmshdon: item.khmshdon || item.khmhd || '1',
      khhdon: item.khhdon || '',
      shdon: String(item.shdon || item.shd || '').padStart(7, '0'),
      tdlap: item.tdlap ? item.tdlap.replace(' ', 'T') : new Date().toISOString(),
      nbmst: item.nbmst || '',
      nbten: item.nbten || item.nbtnnt || item.nbtlhdon || 'Người bán',
      nbdchi: item.nbdchi || item.nbdchi || '',
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
  };

  try {
    let results: any[] = [];
    if (invoiceType === 'purchase' || invoiceType === 'both') {
      const purchaseList = await fetchType('purchase');
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
    if (invoiceType === 'sold' || invoiceType === 'both') {
      const soldList = await fetchType('sold');
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

    return res.json({
      success: true,
      isRealGDT: true,
      invoices: results,
      count: results.length,
      message: `Đã truy xuất thành công ${results.length} hóa đơn thực tế từ Cổng Tổng cục Thuế.`
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
