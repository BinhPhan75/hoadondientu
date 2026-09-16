const { app, BrowserWindow, dialog } = require('electron');
const dotenv = require('dotenv');
const path = require('path');

process.env.NODE_ENV = 'production';
// Use a desktop-only port so an older app instance cannot serve this UI.
process.env.PORT = process.env.PORT || '3217';
process.env.AUTH_WEBAPP_URL = process.env.AUTH_WEBAPP_URL || 'https://pmhoadondientu.vercel.app';

let serverStarted = false;

function loadDesktopEnvironment() {
  const candidates = [
    path.join(path.dirname(process.execPath), '.env'),
    path.join(process.cwd(), '.env')
  ];
  const envPath = candidates.find((candidate) => require('fs').existsSync(candidate));

  if (envPath) {
    const result = dotenv.config({ path: envPath, override: false });
    if (result.error) {
      dialog.showErrorBox(
        'Không thể đọc cấu hình ứng dụng',
        `Không đọc được file cấu hình ${envPath}.\n\n${result.error.message}`
      );
    }
  } else {
    console.warn(`[Desktop] Không tìm thấy file .env. Đã kiểm tra: ${candidates.join(', ')}`);
  }

  return envPath || candidates[0];
}

function startLocalApi() {
  try {
    const envPath = loadDesktopEnvironment();
    require(path.join(__dirname, '..', 'dist', 'server.cjs'));
    serverStarted = true;

    if (!process.env.AUTH_WEBAPP_URL &&
        !process.env.POSTGRES_URL &&
        !process.env.POSTGRES_PRISMA_URL &&
        !process.env.DATABASE_URL &&
        !process.env.NEON_DATABASE_URL &&
        !process.env.POSTGRES_URL_NON_POOLING &&
        !process.env.DATABASE_URL_UNPOOLED) {
      console.warn(`[Desktop] Chưa cấu hình xác thực. Đặt AUTH_WEBAPP_URL hoặc DATABASE_URL trong ${envPath}`);
    }
  } catch (error) {
    dialog.showErrorBox('Không thể khởi động máy chủ cục bộ', error.message);
    app.quit();
  }
}

async function createWindow() {
  startLocalApi();
  if (!serverStarted) return;

  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    await window.loadURL(`http://127.0.0.1:${process.env.PORT}`);
  } catch (error) {
    dialog.showErrorBox('Không thể mở giao diện ứng dụng', error.message);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
