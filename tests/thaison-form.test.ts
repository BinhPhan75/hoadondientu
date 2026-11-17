import test from 'node:test';
import assert from 'node:assert/strict';
import { parseThaiSonForm, extractThaiSonDownloadTargets, isThaiSonHelpDocumentLink, isThaiSonHelpPdf } from '../src/services/thaiSonInvoiceService';
import { normalizeThaiSonPortalUrl } from '../src/utils/providerIdentity';
import { getLookupUrlFromPayload } from '../src/utils/xmlParser';

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

test('Historical HTTP tenant lookup links upgrade to HTTPS without seller-specific hardcoding', () => {
  assert.equal(normalizeThaiSonPortalUrl('http://uniqlo.einvoice.com.vn/'),
    'https://uniqlo.einvoice.com.vn/');
  assert.equal(normalizeThaiSonPortalUrl('saigoncoop.einvoice.com.vn'),
    'https://saigoncoop.einvoice.com.vn/');
  assert.equal(normalizeThaiSonPortalUrl('https://vat.ggg.com.vn/'),
    'https://vat.ggg.com.vn/');
  assert.equal(normalizeThaiSonPortalUrl('http://127.0.0.1:8000/'), '');
  assert.equal(normalizeThaiSonPortalUrl('http://example.com'), '');
  const source = { nbmst: '0315304731', msttcgp: '0101300842',
    lookupUrl: 'http://uniqlo.einvoice.com.vn/' };
  assert.equal(getLookupUrlFromPayload(source), 'https://uniqlo.einvoice.com.vn/');
});

test('Never accept generic Thai Son user-guide PDF as an invoice original', () => {
  assert.equal(isThaiSonHelpDocumentLink('/public/HuongDanSuDung.pdf'), true);
  assert.equal(isThaiSonHelpDocumentLink('/assets/help/user-guide.pdf'), true);
  assert.equal(isThaiSonHelpDocumentLink('/xem-hoa-don/tai-ve?file=123'), false);
  const html = '<a href="/help/HuongDanSuDung.pdf">Hướng dẫn sử dụng</a>' +
    '<iframe src="/assets/huong-dan.pdf"></iframe>' +
    '<a href="/xem-hoa-don/tai-ve?file=123">Tải về</a>';
  const targets = extractThaiSonDownloadTargets(html);
  assert.equal(targets.some(x => /huong|guide/i.test(x.path)), false);
  assert.equal(targets.some(x => x.path.includes('/xem-hoa-don/tai-ve')), true);
  const guidePdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Title (huong dan su dung) >>\nendobj\n');
  assert.equal(isThaiSonHelpPdf(guidePdf), true);
  const invoicePdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Title (Hoa Don 323797) >>\nendobj\n');
  assert.equal(isThaiSonHelpPdf(invoicePdf), false);
});
