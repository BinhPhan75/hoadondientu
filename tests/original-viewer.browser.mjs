import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { jsPDF } from 'jspdf';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.env.TEST_APP_URL || 'http://localhost:3010';
const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => { errors.push(error.message); console.error('PAGE:', error.message); });
page.on('console', message => { if (message.type() === 'error') console.error('BROWSER:', message.text()); });
const pdf = new jsPDF();
pdf.text('Synthetic original invoice for regression testing', 20, 20);
const bytes = Buffer.from(pdf.output('arraybuffer'));
let calls = 0;
const release = [];
await context.route('**/api/invoice-downloader/download?*', async route => {
  calls++;
  const data = route.request().postDataJSON();
  if (data.overrideProvider === 'MINVOICE') {
    return route.fulfill({ status: 428, contentType: 'application/json', body: JSON.stringify({ error: 'MINVOICE yêu cầu xác thực Google reCAPTCHA trên cổng tra cứu.', code: 'RECAPTCHA_REQUIRED' }) });
  }
  await new Promise(resolve => release.push(resolve));
  await route.fulfill({ contentType: 'application/pdf', body: bytes });
});
await context.route('**/__original-test', async route => route.fulfill({
  contentType: 'text/html',
  body: `<!doctype html><html><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import('/tests/fixtures/original-viewer.jsx');
  </script></body></html>`,
}));

try {
  await mkdir('tmp/verification', { recursive: true });
  await page.goto(base + '/__original-test');
  await page.waitForFunction(() => window.ready === true);
  // Mimic background App prefetch before opening the modal.
  await page.evaluate(() => { window.prefetch('101'); window.showInvoice('101'); });
  await page.getByText('Hóa đơn gốc đang được tải về máy...', { exact: true }).waitFor();
  await page.waitForTimeout(200);
  assert.equal(calls, 1, 'viewer must share the background request');
  await page.screenshot({ path: 'tmp/verification/original-loading-desktop.png' });
  release.shift()();
  await page.locator('iframe[title="Bản PDF gốc từ nhà cung cấp"]').waitFor();
  await page.screenshot({ path: 'tmp/verification/original-loaded-desktop.png' });
  const savedDownload = page.waitForEvent('download');
  await page.getByText('Tải PDF gốc đã lưu', { exact: true }).click();
  await savedDownload;
  assert.equal(calls, 1, 'downloading saved PDF must not start another provider request');
  await page.getByTitle('Đóng cửa sổ').click();
  await page.evaluate(() => window.showInvoice('101'));
  await page.locator('iframe[title="Bản PDF gốc từ nhà cung cấp"]').waitFor();
  assert.equal(calls, 1, 'reopening must read IndexedDB');
  await page.reload();
  await page.waitForFunction(() => window.ready === true);
  await page.evaluate(() => window.showInvoice('101'));
  await page.locator('iframe[title="Bản PDF gốc từ nhà cung cấp"]').waitFor();
  assert.equal(calls, 1, 'page reload must retain saved PDF');

  await page.evaluate(() => window.showInvoice('102'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.showInvoice('103', 'MINVOICE'));
  await page.getByRole('alert').waitFor();
  await page.getByText('NCC: MINVOICE', { exact: true }).waitFor();
  assert.match(await page.getByRole('alert').innerText(), /MINVOICE.*reCAPTCHA/);
  const failedCalls = calls;
  release.shift()();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('iframe[title="Bản PDF gốc từ nhà cung cấp"]').count(), 0, 'old invoice result must not replace current one');
  await page.getByTitle('Đóng cửa sổ').click();
  await page.evaluate(() => window.showInvoice('103', 'MINVOICE'));
  await page.getByRole('alert').waitFor();
  assert.equal(calls, failedCalls, 'reopening a failed download must respect cooldown');
  assert.ok(await page.getByText(/Tải bản thể hiện dự phòng GDT/).isVisible());
  await page.screenshot({ path: 'tmp/verification/minvoice-fallback-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'tmp/verification/minvoice-fallback-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const panel = await page.locator('.max-w-6xl').boundingBox();
  assert.ok(panel.y >= 0 && panel.y + panel.height <= 844, 'modal must fit mobile viewport');
  assert.deepEqual(errors, []);
  console.log('PASS: shared download, loading UI, IndexedDB reopen/reload, stale-result guard, failure cooldown, MINVOICE/GDT fallback, mobile overflow.');
} finally {
  release.forEach(resolve => resolve());
  await browser.close();
}
