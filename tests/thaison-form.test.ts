import test from 'node:test';
import assert from 'node:assert/strict';
import { parseThaiSonForm } from '../src/services/thaiSonInvoiceService';

const publicPortalHtml = `<!doctype html><html><body>
  <form action="/xem-hoa-don" id="formgr" method="post">
    <input name="__RequestVerificationToken" type="hidden" value="EXAMPLE_TOKEN">
    <input id="idHiden" type="hidden">
    <label>Mã nhận HĐ (*)</label>
    <input type="text" name="MA_NHAN_HOA_DON" id="MA_NHAN_HOA_DON">
    <img id="CaptchaImage" src="/DefaultCaptcha/Generate?t=example">
    <input id="CaptchaDeText" name="CaptchaDeText" type="hidden" value="EXAMPLE_CAPTCHA_TOKEN">
    <input id="CaptchaInputText" name="CaptchaInputText" type="text">
    <button type="submit">Tìm hóa đơn</button>
  </form>
</body></html>`;

test('Public Thai Son Co.opmart and Golden Gate lookup fields are detected', () => {
  const form = parseThaiSonForm(publicPortalHtml);
  assert.equal(form.formFound, true);
  assert.equal(form.formAction, '/xem-hoa-don');
  assert.equal(form.method, 'POST');
  assert.equal(form.field, 'MA_NHAN_HOA_DON');
  assert.equal(form.captchaField, 'CaptchaInputText');
  assert.equal(form.imagePath, '/DefaultCaptcha/Generate?t=example');
  assert.equal(form.hiddenFields.__RequestVerificationToken, 'EXAMPLE_TOKEN');
  assert.equal(form.token, 'EXAMPLE_CAPTCHA_TOKEN');
});

test('Pre-existing generic Thai Son lookup field remains compatible', () => {
  const html = '<form method="POST" action="/tra-cuu"><input name="MaNhanHoaDon" type="text"><input name="CaptchaInputText" type="text"><img id="CaptchaImage" src="/captcha"></form>';
  assert.equal(parseThaiSonForm(html).field, 'MaNhanHoaDon');
});
