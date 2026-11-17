import test from 'node:test';
import assert from 'node:assert/strict';
import { MinvoiceDriver } from '../src/services/invoice-engine/drivers/MinvoiceDriver';
import { resolveInvoiceProvider } from '../src/utils/providerRouting';
import { verifyIssuerInvoiceBytes } from '../src/services/invoiceIdentityVerifier';

const publicSample = '<HDon><DLHDon><TTChung><MSTTCGP>0106026495-001</MSTTCGP>' +
  '<KHHDon>C26TEST</KHHDon><SHDon>3777</SHDon><NLap>2026-10-28</NLap>' +
  '<TTKhac><TTin><TTruong>Mã tra cứu</TTruong>' +
  '<DLieu>TESTCODE01234567890</DLieu></TTin></TTKhac></TTChung>' +
  '<NDHDon><NBan><Ten>Test supplier</Ten><MST>3300412634</MST></NBan>' +
  '<NMua><MST>4001323868</MST></NMua></NDHDon></DLHDon></HDon>';

const identity = { sellerTaxCode: '3300412634', invoiceNo: '0003777', invoiceSeries: 'C26TEST' };

test('M-invoice branch-suffixed solution MSTTCGP and XML lookup code are recognized', () => {
  assert.equal(resolveInvoiceProvider({ rawXml: publicSample }), 'MINVOICE');
  const info = new MinvoiceDriver().extractInfo(publicSample);
  assert.equal(info.sellerTaxCode, identity.sellerTaxCode);
  assert.equal(info.invoiceNo, identity.invoiceNo);
  assert.equal(info.invoiceSeries, identity.invoiceSeries);
  assert.equal(info.lookupCode, 'TESTCODE01234567890');
});

test('Original XML from M-invoice is verified by exact seller, series and invoice number', async () => {
  const bytes = Buffer.from(publicSample, 'utf8');
  assert.equal((await verifyIssuerInvoiceBytes(bytes, 'application/xml', identity)).ok, true);
  assert.equal((await verifyIssuerInvoiceBytes(bytes, 'application/xml', {
    ...identity, sellerTaxCode: '0106026495'
  })).ok, false);
  assert.equal((await verifyIssuerInvoiceBytes(bytes, 'application/xml', {
    ...identity, invoiceNo: '9999'
  })).ok, false);
});

test('M-invoice downloads public XML with seller MST and Số bảo mật, no fake reCAPTCHA', async () => {
  const saved = globalThis.fetch;
  let visits = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    visits++;
    const requested = new URL(String(input));
    assert.equal(requested.hostname, 'tracuuhoadon.minvoice.com.vn');
    assert.equal(requested.pathname, '/api/Search/DownloadXml');
    assert.equal(requested.searchParams.get('masothue'), identity.sellerTaxCode);
    assert.equal(requested.searchParams.get('sobaomat'), 'TESTCODE01234567890');
    return new Response(publicSample, {
      status: 200, headers: { 'Content-Type': 'application/xml' }
    });
  }) as typeof fetch;
  try {
    const driver = new MinvoiceDriver();
    const downloaded = await driver.fetchPdf(driver.extractInfo(publicSample));
    assert.equal(downloaded.contentType, 'application/xml');
    assert.equal(downloaded.isFallback, false);
    assert.equal(downloaded.pdfBuffer.toString('utf8'), publicSample);
    assert.ok(downloaded.filename.endsWith('.xml'));
    assert.equal(visits, 1);
  } finally {
    globalThis.fetch = saved;
  }
});

test('M-invoice never caches a HTML error page returned by XML endpoint', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = (async () => new Response('<html><body>Request denied</body></html>', {
    status: 200, headers: { 'Content-Type': 'text/html' }
  })) as typeof fetch;
  try {
    const driver = new MinvoiceDriver();
    await assert.rejects(() => driver.fetchPdf(driver.extractInfo(publicSample)), /chưa trả về XML gốc/);
  } finally {
    globalThis.fetch = saved;
  }
});
