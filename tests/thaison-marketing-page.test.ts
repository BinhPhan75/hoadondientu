import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isThaiSonMarketingPage, verifiedThaiSonInvoiceHtmlWithSeries } from '../src/services/thaiSonInvoiceService';
import { createThaiSonCommonManualCaptcha } from '../src/services/thaiSonCommonManualService';
import { OriginalInvoiceError } from '../src/services/invoice-engine/OriginalInvoiceError';

const marketing = '<html><head><title>E-Invoice - Chuyên gia hóa đơn điện tử</title></head>' +
  '<body><h1>Phần mềm hóa đơn điện tử E-Invoice được nhiều DN FDI tin dùng</h1>' +
  '<nav>Giới thiệu | Tin tức | Sản phẩm | Tra cứu hóa đơn</nav>' +
  '<p>Hóa đơn điện tử có mẫu 0401515239, C26MMR và số 603 trong ví dụ minh họa.</p>' +
  '<table><tr><td>a</td></tr><tr><td>b</td></tr><tr><td>c</td></tr></table></body></html>';

test('Thai Son marketing page is never accepted as an issuer invoice', () => {
  assert.equal(isThaiSonMarketingPage(marketing), true);
  assert.equal(verifiedThaiSonInvoiceHtmlWithSeries(marketing,'0401515239','603','C26MMR'),undefined);
});

test('Shared Thai Son CAPTCHA refuses marketing page before requesting image', async () => {
  const previous=globalThis.fetch;
  let count=0;
  globalThis.fetch=(async () => {
    count++;
    return new Response(marketing,{headers:{'Content-Type':'text/html'}});
  }) as typeof fetch;
  try {
    await assert.rejects(createThaiSonCommonManualCaptcha('A46EKFYXHKM'),(error:unknown) =>
      error instanceof OriginalInvoiceError && error.code === 'ISSUER_LOOKUP_PORTAL_REQUIRED');
    assert.equal(count,1);
  } finally {globalThis.fetch=previous;}
});

test('Thai Son verified HTML requires matching series and invoice number', () => {
  const html='<html><body><div id="invoice">' +
    '<h2>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</h2><p>MST bên bán: 0401515239</p>' +
    '<p>Ký hiệu: C26MMR</p><p>Số hóa đơn: 0000603</p>' +
    '<table><tr><td>Hàng hóa</td></tr><tr><td>Gạch ốp lát</td></tr><tr><td>Tổng tiền</td></tr></table>' +
    '</div></body></html>';
  assert.ok(verifiedThaiSonInvoiceHtmlWithSeries(html,'0401515239','603','C26MMR'));
  assert.equal(verifiedThaiSonInvoiceHtmlWithSeries(html,'0401515239','604','C26MMR'),undefined);
  assert.equal(verifiedThaiSonInvoiceHtmlWithSeries(html,'0401515239','603','C26XYZ'),undefined);
});


test('Real Thai Son shared lookup form is valid despite marketing navigation', () => {
  const realLanding = '<html><head><title>E-Invoice - Chuyên gia hóa đơn điện tử</title></head>' +
    '<body><h1>Phần mềm hóa đơn điện tử E-Invoice được nhiều DN FDI tin dùng</h1>' +
    '<nav>Giới thiệu Tin tức Sản phẩm Tra cứu hóa đơn</nav>' +
    '<form action="/tra-cuu" method="POST">' +
    '<label>Mã nhận hóa đơn</label><input name="MA_NHAN_HOA_DON">' +
    '<label>Mã kiểm tra</label><input name="CaptchaInputText">' +
    '<img src="/Captcha/Show"></form></body></html>';
  assert.equal(isThaiSonMarketingPage(realLanding), false);
});

test('Marketing-only page remains invalid even when it mentions invoice-related text', () => {
  assert.equal(isThaiSonMarketingPage(marketing), true);
});


test('Thai Son marketing with incidental invoice identifiers is not accepted as original', () => {
  const homepage = marketing.replace('</body>',
    '<p>MST 0401515239, ký hiệu C26MMR, Số hóa đơn: 0000603</p></body>');
  assert.equal(verifiedThaiSonInvoiceHtmlWithSeries(homepage,'0401515239','603','C26MMR'),undefined);
});


test('Thai Son shared marketing shell with embedded invoice only returns invoice fragment', () => {
  const webpage = '<html><head><title>E-Invoice</title></head><body>' +
    '<nav>Giới thiệu Tin tức Sản phẩm Tra cứu hóa đơn</nav>' +
    '<h1>Phần mềm hóa đơn điện tử E-Invoice được nhiều DN FDI tin dùng</h1>' +
    '<div id="invoice"><h2>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</h2>' +
    '<p>MST bên bán: 0401515239</p><p>Ký hiệu: C26MMR</p>' +
    '<p>Số hóa đơn: 0000603</p>' +
    '<table><tr><td>Hàng</td></tr><tr><td>Gạch</td></tr><tr><td>Tổng</td></tr></table>' +
    '</div></body></html>';
  const clean = verifiedThaiSonInvoiceHtmlWithSeries(webpage, '0401515239', '603', 'C26MMR');
  assert.ok(clean);
  assert.match(clean!,/Gạch/);
  assert.doesNotMatch(clean!,/nhiều DN FDI|Giới thiệu Tin tức/i);
});

test('Thai Son site shell without isolated invoice markup is never a valid original', () => {
  const webpage = '<html><body><nav>Giới thiệu Tin tức Sản phẩm</nav>' +
    '<p>MST:0401515239; Ký hiệu:C26MMR; Số hóa đơn:0000603</p>' +
    '<table><tr><td>a</td></tr><tr><td>b</td></tr><tr><td>c</td></tr></table>' +
    '<form><input name="MA_NHAN_HOA_DON"/></form></body></html>';
  assert.equal(verifiedThaiSonInvoiceHtmlWithSeries(webpage,'0401515239','603','C26MMR'),undefined);
});
