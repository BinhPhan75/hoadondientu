const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

let serverStarted = false;

function startLocalApi() {
  try {
    require(path.join(__dirname, '..', 'dist', 'server.cjs'));
    serverStarted = true;
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
    await window.loadURL('http://127.0.0.1:3000');
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
