import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { MinvoiceDriver } from '../src/services/invoice-engine/drivers/MinvoiceDriver';
import { resolveInvoiceProvider } from '../src/utils/providerRouting';
import { verifyIssuerInvoiceBytes } from '../src/services/invoiceIdentityVerifier';

const xml = '<HDon><DLHDon><TTChung><MSTTCGP>0106026495-001</MSTTCGP>' +
  '<KHHDon>C26TEST</KHHDon><SHDon>3777</SHDon><NLap>2026-10-28</NLap>' +
  '<TTKhac><TTin><TTruong>Mã tra cứu</TTruong>' +
  '<DLieu>TESTCODE01234567890</DLieu></TTin></TTKhac></TTChung>' +
  '<NDHDon><NBan><Ten>Test supplier</Ten><MST>3300412634</MST></NBan>' +
  '<NMua><MST>4001323868</MST></NMua></NDHDon></DLHDon></HDon>';

const identity = { sellerTaxCode: '3300412634', invoiceNo: '0003777', invoiceSeries: 'C26TEST' };
const makePdf = () => {
  const pdf = new jsPDF();
  pdf.text('HOA DON GIA TRI GIA TANG', 20, 20);
  pdf.text('MST: 3300412634', 20, 32);
  pdf.text('Ky hieu: C26TEST', 20, 44);
  pdf.text('So: 3777', 20, 56);
  return pdf.output('arraybuffer');
};

test('M-invoice MSTTCGP suffix and XML seller + lookup code are recognized', () => {
  assert.equal(resolveInvoiceProvider({ rawXml: xml }), 'MINVOICE');
  const info = new MinvoiceDriver().extractInfo(xml);
  assert.equal(info.sellerTaxCode, identity.sellerTaxCode);
  assert.equal(info.invoiceNo, identity.invoiceNo);
  assert.equal(info.invoiceSeries, identity.invoiceSeries);
  assert.equal(info.lookupCode, 'TESTCODE01234567890');
});

test('Only original issuer PDFs matching the invoice identity are acceptable', async () => {
  const source = Buffer.from(makePdf());
  assert.equal((await verifyIssuerInvoiceBytes(source, 'application/pdf', identity)).ok, true);
  assert.equal((await verifyIssuerInvoiceBytes(source, 'application/pdf', {
    ...identity, invoiceNo: '10000',
  })).ok, false);
});

test('M-invoice requires a legitimate CAPTCHA token instead of calling legacy API', async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw new Error('Unexpected network call');
  }) as typeof fetch;
  try {
    const driver = new MinvoiceDriver();
    await assert.rejects(() => driver.fetchPdf(driver.extractInfo(xml)), /reCAPTCHA/);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = saved;
  }
});

test('M-invoice sends its observed PDF endpoint and verified token', async () => {
  const saved = globalThis.fetch;
  const endpoints: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    endpoints.push(url.pathname);
    assert.equal(url.hostname, 'tracuuhoadon.minvoice.com.vn');
    assert.equal(url.pathname, '/api/Search/SearchInvoiceCaptcha');
    assert.equal(url.searchParams.get('masothue'), identity.sellerTaxCode);
    assert.equal(url.searchParams.get('sobaomat'), 'TESTCODE01234567890');
    assert.equal(url.searchParams.get('type'), 'PDF');
    assert.equal(url.searchParams.get('inchuyendoi'), 'false');
    assert.equal(new Headers(init?.headers).get('X-Recaptcha-Token'), 'test-legitimate-token');
    return new Response(makePdf(), {
      status: 200, headers: { 'Content-Type': 'application/pdf' },
    });
  }) as typeof fetch;
  try {
    const driver = new MinvoiceDriver();
    const actual = await driver.fetchPdf(driver.extractInfo(xml), {
      recaptchaToken: 'test-legitimate-token',
    });
    assert.equal(actual.contentType, 'application/pdf');
    assert.equal(actual.isFallback, false);
    assert.ok(actual.filename.endsWith('.pdf'));
    assert.equal(actual.pdfBuffer.subarray(0, 5).toString(), '%PDF-');
    assert.deepEqual(endpoints, ['/api/Search/SearchInvoiceCaptcha']);
  } finally {
    globalThis.fetch = saved;
  }
});

test('HTML, XML or ZIP response is never treated as PDF', async () => {
  const saved = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    seen.push(new URL(String(input)).pathname);
    return new Response('<?xml version="1.0"?><HDon/>', {
      status: 200, headers: { 'Content-Type': 'application/xml' },
    });
  }) as typeof fetch;
  try {
    await assert.rejects(() => new MinvoiceDriver().fetchPdf(
      new MinvoiceDriver().extractInfo(xml), { recaptchaToken: 'test-legitimate-token' }
    ), /SearchInvoiceCaptcha/);
    assert.deepEqual(seen, ['/api/Search/SearchInvoiceCaptcha']);
  } finally {
    globalThis.fetch = saved;
  }
});

test('M-invoice does not retry with legacy SearchInvoice when CAPTCHA request fails', async () => {
  const saved = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    seen.push(new URL(String(input)).pathname);
    return new Response('Invalid token', { status: 403 });
  }) as typeof fetch;
  try {
    const driver = new MinvoiceDriver();
    await assert.rejects(() => driver.fetchPdf(driver.extractInfo(xml), {
      recaptchaToken: 'test-legitimate-token',
    }), /HTTP 403/);
    assert.deepEqual(seen, ['/api/Search/SearchInvoiceCaptcha']);
  } finally {
    globalThis.fetch = saved;
  }
});

