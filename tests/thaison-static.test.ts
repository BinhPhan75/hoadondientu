import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedThaiSonInvoiceHtml } from '../src/services/thaiSonInvoiceService';

test('Thai Son HTML XSLT preview un-hides invoice without running original onload scripts', () => {
  const html = `<!doctype html><html><head><style>
    #invoice-data { display:none }
    .page { background:white }
  </style><script>function loadData(){ throw Error('should not run') }</script></head>
  <body onload="loadData()"><div class="container">
    <div id="multi-page"></div>
    <div id="invoice-data">
      <div id="headerTemp"><table><tr><td>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</td></tr>
        <tr><td>Seller MST 0301175691-021</td></tr><tr><td>C26MCM - 323797</td></tr></table></div>
      <div id="invoiceItems"><table><tr><th>Mặt hàng</th></tr><tr class="item"><td>Co.opmart item A</td></tr></table></div>
      <div id="footerTemp"><div>400837 VNĐ</div></div>
    </div>
  </div></body></html>`;
  const output = verifiedThaiSonInvoiceHtml(html, '0301175691-021', '0323797');
  assert.ok(output);
  assert.match(output!, /thai-son-static-page/);
  assert.match(output!, /Co\.opmart item A/);
  assert.match(output!, /400837 VNĐ/);
  assert.doesNotMatch(output!, /<script/i);
  assert.doesNotMatch(output!, /onload=/i);
  assert.doesNotMatch(output!, /id="invoice-data"/i);
});

test('Thai Son search shell with invoice-like metadata but no item table is rejected', () => {
  const html = '<html><body><p>Hóa đơn</p><p>0301175691-021</p><p>323797</p><form><input name="MA_NHAN_HOA_DON"></form></body></html>';
  assert.equal(verifiedThaiSonInvoiceHtml(html, '0301175691-021', '323797'), undefined);
});
