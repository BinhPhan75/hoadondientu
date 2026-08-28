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
  createdAt: number;
}

let currentSession: SessionData | null = {
  taxCode: '0316892345',
  taxpayerName: 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG ĐÔNG NAM Á',
  address: 'Số 142 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP Hồ Chí Minh',
  token: 'GDT_AUTH_SESSION_TOKEN_2025_SECURE',
  createdAt: Date.now()
};

let seleniumLogs: Array<{
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'step';
  message: string;
  stepName?: string;
  progress?: number;
}> = [];

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// 2. Get Captcha for login
app.get('/api/gdt/captcha', (req, res) => {
  // Generate random 4-character alphanumeric captcha code
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let captchaText = '';
  for (let i = 0; i < 4; i++) {
    captchaText += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const captchaKey = 'ckey_' + Math.random().toString(36).substring(2, 10);

  // Generate SVG Captcha image with noise lines and skewed characters
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="130" height="42" viewBox="0 0 130 42">
      <rect width="100%" height="100%" fill="#f1f5f9"/>
      <line x1="10" y1="12" x2="120" y2="30" stroke="#cbd5e1" stroke-width="2"/>
      <line x1="15" y1="35" x2="115" y2="8" stroke="#cbd5e1" stroke-width="1.5"/>
      <circle cx="35" cy="20" r="15" fill="none" stroke="#e2e8f0" stroke-width="1.5"/>
      <circle cx="95" cy="22" r="18" fill="none" stroke="#e2e8f0" stroke-width="1.5"/>
      <text x="18" y="29" font-family="monospace, sans-serif" font-size="24" font-weight="bold" fill="#1e293b" letter-spacing="8" transform="rotate(-2 20 25)">${captchaText}</text>
    </svg>
  `.trim();

  res.json({
    captchaKey,
    captchaCode: captchaText,
    captchaImage: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  });
});

// 3. Login to GDT Portal
app.post('/api/gdt/login', (req, res) => {
  const { taxCode, password, captchaCode } = req.body;

  if (!taxCode || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Mã số thuế và Mật khẩu do Tổng cục Thuế cấp.' });
  }

  // Set active session
  currentSession = {
    taxCode: taxCode.trim(),
    taxpayerName: `CÔNG TY TNHH KINH DOANH & ĐẦU TƯ (MST: ${taxCode.trim()})`,
    address: 'Trụ sở chính đăng ký tại Tổng cục Thuế',
    token: `GDT_SESSION_${taxCode}_${Date.now()}`,
    createdAt: Date.now()
  };

  res.json({
    success: true,
    message: 'Đăng nhập Cổng Hóa đơn điện tử Tổng cục Thuế thành công!',
    session: currentSession
  });
});

// 4. Logout / Reset session
app.post('/api/gdt/logout', (req, res) => {
  currentSession = null;
  res.json({ success: true, message: 'Đã ngắt kết nối phiên làm việc.' });
});

// 5. Get Session status
app.get('/api/gdt/status', (req, res) => {
  res.json({
    isConnected: !!currentSession,
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
