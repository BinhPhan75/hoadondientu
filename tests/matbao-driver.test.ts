import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatbaoDriver } from '../src/services/invoice-engine/drivers/MatbaoDriver';
import { OriginalInvoiceError } from '../src/services/invoice-engine/OriginalInvoiceError';
import { detectProvider } from '../src/services/invoice-engine/providerDetector';
import { resolveInvoiceProvider } from '../src/utils/providerRouting';
import { extractLookupDetailsFromXml } from '../src/utils/xmlParser';
import { InvoiceDownloaderManager } from '../src/services/invoice-engine/InvoiceDownloaderManager';

const rawXml = [
  '<HDon><DLHDon><TTChung><KHMSHDon>2</KHMSHDon><KHHDon>C26MLS</KHHDon>',
  '<SHDon>3622</SHDon><NLap>2026-08-10</NLap><MSTTCGP>0302712571</MSTTCGP></TTChung>',
  '<NDHDon><NBan><Ten>Seller</Ten><MST>027098005024</MST></NBan></NDHDon>',
  '</DLHDon><MCCQT>M2-26-TEST</MCCQT></HDon>',
].join('');

test('Matbao XML identifies solution provider and uses XML upload, not fkey', async () => {
  const driver = new MatbaoDriver();
  assert.equal(detectProvider(rawXml), 'MATBAO');
  assert.equal(resolveInvoiceProvider({rawXml}), 'MATBAO');
  assert.equal(driver.canHandle(rawXml), true);
  assert.equal(driver.canHandle({provider:'MATBAO',rawXml} as any), true);
  assert.equal(driver.canHandle('https://portal-group1.mifi.vn/'), true);
  assert.equal(extractLookupDetailsFromXml(rawXml).lookupCode, '');
  const info = driver.extractInfo(rawXml);
  assert.equal(info.provider, 'MATBAO');
  assert.equal(info.sellerTaxCode, '027098005024');
  assert.equal(info.invoiceNo, '3622');
  assert.equal(info.invoiceSeries, 'C26MLS');
  assert.equal(info.lookupCode, '');
  assert.equal(info.rawXml, rawXml);
  assert.equal(info.lookupUrl, 'https://matbao.in/tra-cuu-hoa-don');
  assert.equal((await new InvoiceDownloaderManager().selectDriver(rawXml)).providerCode, 'MATBAO');
});

test('Matbao: missing verified upload endpoint provides official manual XML-upload fallback', async () => {
  const previous = process.env.MATBAO_XML_UPLOAD_URL;
  delete process.env.MATBAO_XML_UPLOAD_URL;
  try {
    const driver = new MatbaoDriver();
    await assert.rejects(driver.fetchPdf(driver.extractInfo(rawXml)),
      (error: unknown) => {
        assert.ok(error instanceof OriginalInvoiceError);
        assert.equal(error.provider, 'MATBAO');
        assert.equal(error.code, 'MATBAO_XML_UPLOAD_REQUIRED');
        assert.equal(error.lookupUrl, 'https://matbao.in/tra-cuu-hoa-don');
        assert.match(error.message, /Tra cứu dùng file XML/);
        return true;
      });
  } finally {
    if (previous === undefined) delete process.env.MATBAO_XML_UPLOAD_URL;
    else process.env.MATBAO_XML_UPLOAD_URL = previous;
  }
});

test('Matbao: upload target must be HTTPS and belong to official Matbao/Mifi host', async () => {
  const previous = process.env.MATBAO_XML_UPLOAD_URL;
  process.env.MATBAO_XML_UPLOAD_URL = 'https://attacker.example/upload';
  try {
    const driver = new MatbaoDriver();
    await assert.rejects(driver.fetchPdf(driver.extractInfo(rawXml)),
      (error: unknown) => error instanceof OriginalInvoiceError &&
        error.code === 'MATBAO_XML_UPLOAD_REQUIRED');
  } finally {
    if (previous === undefined) delete process.env.MATBAO_XML_UPLOAD_URL;
    else process.env.MATBAO_XML_UPLOAD_URL = previous;
  }
});
