import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveInvoiceProvider } from '../src/utils/providerRouting';
import { providerFromPortal } from '../src/utils/providerIdentity';
import { detectProvider } from '../src/services/invoice-engine/providerDetector';
import { isThaiSonSource, isMisaSource, extractLookupDetailsFromXml } from '../src/utils/xmlParser';
import { buildDirectLookupUrl } from '../src/templates/templateUtils';
import { MinvoiceDriver } from '../src/services/invoice-engine/drivers/MinvoiceDriver';
import { ThaiSonDriver } from '../src/services/invoice-engine/drivers/ThaiSonDriver';
import { OriginalInvoiceError } from '../src/services/invoice-engine/OriginalInvoiceError';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test('MISA and Thai Son domain boundaries do not overlap', () => {
  assert.equal(providerFromPortal('https://www.meinvoice.vn/tra-cuu'), 'MISA');
  assert.equal(providerFromPortal('https://einvoice.vn/tra-cuu'), 'THAISON');
  assert.equal(providerFromPortal('https://einvoice.vn.example.org'), undefined);
  assert.equal(providerFromPortal('https://example.org/?next=einvoice.vn'), undefined);
  assert.equal(isThaiSonSource({ lookupUrl: 'https://www.meinvoice.vn/tra-cuu' }), false);
});

test('MISA portal metadata overrides a stale GENERIC provider label', () => {
  assert.equal(resolveInvoiceProvider({
    provider: 'GENERIC',
    rawXml: '<HDon><MSTTCGP>0101243150</MSTTCGP></HDon>',
  }), 'MISA');
});

test('XML solution evidence overrides stale MISA label and seller-based guesses', () => {
  const rawXml = '<HDon><MSTTCGP>0101300842</MSTTCGP><MST>0400557356</MST><Ten>XUAN VINH</Ten><MaNhanHoaDon>TS123456</MaNhanHoaDon></HDon>';
  const invoice = { rawXml, provider: 'MISA', lookupUrl: 'https://meinvoice.vn/tra-cuu' };
  assert.equal(resolveInvoiceProvider(invoice), 'THAISON');
  assert.equal(detectProvider(rawXml), 'THAISON');
  assert.equal(extractLookupDetailsFromXml(rawXml).lookupUrl, 'https://einvoice.vn/tra-cuu');
  assert.equal(buildDirectLookupUrl('https://einvoice.vn/tra-cuu', 'TS123456', 'THAISON', '0400557356'), 'https://einvoice.vn/tra-cuu');
  assert.equal(isMisaSource({ nbmst: '0400557356', lookupUrl: 'https://einvoice.vn' }), false);
  assert.equal(resolveInvoiceProvider({ msttcgp: '0101300842', lookupUrl: 'https://meinvoice.vn', provider: 'MISA' }), 'THAISON');
  assert.equal(resolveInvoiceProvider({ rawXml: '<HDon><Website>www.meinvoice.vn/tra-cuu</Website></HDon>' }), 'MISA');
});

test('certificate issuer and seller alone do not identify invoice provider', () => {
  assert.equal(resolveInvoiceProvider({ rawXml: '<HDon><MST>0400557356</MST><Ten>XUAN VINH</Ten><Signature><X509IssuerName>MISA https://misa.vn</X509IssuerName></Signature></HDon>' }), undefined);
  assert.equal(resolveInvoiceProvider({ provider: 'GENERIC', lookupUrl: 'https://www.meinvoice.vn/tra-cuu' }), 'MISA');
  for (const [tax, provider] of [['0101243150', 'MISA'], ['0106026495', 'MINVOICE'], ['0100684378', 'VNPT'], ['0100109106', 'VIETTEL'], ['0105987432', 'EASYINVOICE'], ['0302999571', 'LCS'], ['0315744883', '4SI'], ['0102182292', 'VNPAY'], ['0104128565', 'FPT'], ['0107871301', 'CYBERBILL'], ['0101360697', 'BKAV']]) {
    assert.equal(resolveInvoiceProvider({ rawXml: `<HDon><MSTTCGP>${tax}</MSTTCGP></HDon>` }), provider);
  }
});

const minvoice = new MinvoiceDriver();
const minfo = minvoice.extractInfo('<HDon><MSTTCGP>0106026495</MSTTCGP><MST>0123456789</MST><SoBaoMat>TEST1234</SoBaoMat><MCCQT>CQT1234</MCCQT></HDon>');

test('MINVOICE distinguishes missing secret and reCAPTCHA; neither triggers paid OCR or network', async () => {
  globalThis.fetch = async () => { throw Error('Unexpected network request'); };
  await assert.rejects(minvoice.fetchPdf({ ...minfo, lookupCode: '' }), { code: 'LOOKUP_DATA_MISSING', status: 422 });
  await assert.rejects(minvoice.fetchPdf({ ...minfo, lookupCode: minfo.cqtCode }), { code: 'LOOKUP_DATA_MISSING' });
  await assert.rejects(minvoice.fetchPdf(minfo), { code: 'RECAPTCHA_REQUIRED', status: 428, provider: 'MINVOICE' });
});

test('MINVOICE uses current captcha endpoint and validates PDF signature', async () => {
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.pathname, '/api/Search/SearchInvoiceCaptcha');
    assert.equal(url.searchParams.get('masothue'), '0123456789');
    assert.equal(url.searchParams.get('sobaomat'), 'TEST1234');
    assert.equal(new Headers(init?.headers).get('X-Recaptcha-Token'), 'test-token');
    return new Response('%PDF-1.7\nfixture', { headers: { 'content-type': 'application/pdf' } });
  };
  const result = await minvoice.fetchPdf(minfo, { recaptchaToken: 'test-token' });
  assert.equal(calls, 1);
  assert.equal(result.isFallback, false);
  assert.equal(result.provider, 'MINVOICE');
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Invalid recaptcha' }), { status: 403 });
  await assert.rejects(minvoice.fetchPdf(minfo, { recaptchaToken: 'test-token' }), { code: 'RECAPTCHA_REQUIRED' });
  globalThis.fetch = async () => new Response('<html>error</html>');
  await assert.rejects(minvoice.fetchPdf(minfo, { recaptchaToken: 'test-token' }), OriginalInvoiceError);
});

test('Thai Son extracts MaNhanHoaDon and does not submit a CQT code as lookup code', async () => {
  const driver = new ThaiSonDriver();
  const info = driver.extractInfo('<HDon><MSTTCGP>0101300842</MSTTCGP><MaNhanHoaDon>TS123456</MaNhanHoaDon><MCCQT>CQT1234</MCCQT></HDon>');
  assert.equal(info.lookupCode, 'TS123456');
  globalThis.fetch = async () => { throw Error('Unexpected network request'); };
  await assert.rejects(driver.fetchPdf({ ...info, lookupCode: 'CQT1234' }), { code: 'LOOKUP_DATA_MISSING', provider: 'THAISON' });
});
