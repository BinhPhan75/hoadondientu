import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WinInvoiceDriver, winInvoiceFields } from '../src/services/invoice-engine/drivers/WinInvoiceDriver';
import { OriginalInvoiceError } from '../src/services/invoice-engine/OriginalInvoiceError';
import { detectProvider } from '../src/services/invoice-engine/providerDetector';
import { extractLookupDetailsFromXml } from '../src/utils/xmlParser';

const xml = '<HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>C26TTS</KHHDon>' +
  '<SHDon>14678</SHDon><MSTTCGP>0312303803</MSTTCGP></TTChung>' +
  '<NDHDon><NBan><MST>0312303803</MST></NBan></NDHDon>' +
  '<TTKhac><TTin Id="privateCode"><TTruong>Mã tra cứu hóa đơn</TTruong><DLieu>TESTCODE1234</DLieu></TTin>' +
  '<TTin Id="cmpnKey"><TTruong>Mã công ty</TTruong><DLieu>0312303803</DLieu></TTin></TTKhac>' +
  '</DLHDon></HDon>';

test('WINinvoice is detected by solution MST and uses correct TTin Id fields', () => {
  const driver = new WinInvoiceDriver();
  assert.equal(detectProvider(xml), 'WININVOICE');
  assert.equal(driver.canHandle(xml), true);
  assert.deepEqual(winInvoiceFields(xml), {lookupCode:'TESTCODE1234', companyCode:'0312303803'});
  assert.equal(extractLookupDetailsFromXml(xml).lookupCode, 'TESTCODE1234');
  const info = driver.extractInfo(xml);
  assert.equal(info.invoiceSeries,'C26TTS');
  assert.equal(info.invoiceNo,'14678');
  assert.equal(info.additionalData?.companyCode,'0312303803');
});

test('WINinvoice without a verified PDF endpoint fails safely without network', async () => {
  const old=process.env.WININVOICE_LOOKUP_API_URL;
  delete process.env.WININVOICE_LOOKUP_API_URL;
  const prev=globalThis.fetch;
  globalThis.fetch = (()=>{throw Error('Unexpected call');}) as typeof fetch;
  try {
    const d=new WinInvoiceDriver();
    await assert.rejects(d.fetchPdf(d.extractInfo(xml)),(e: unknown)=>
      e instanceof OriginalInvoiceError && e.provider==='WININVOICE' &&
      e.lookupUrl==='https://tracuu.wininvoice.vn/');
  } finally {
    globalThis.fetch=prev;
    if(old===undefined) delete process.env.WININVOICE_LOOKUP_API_URL;
    else process.env.WININVOICE_LOOKUP_API_URL=old;
  }
});
