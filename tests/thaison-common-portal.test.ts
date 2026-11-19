import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ThaiSonDriver } from '../src/services/invoice-engine/drivers/ThaiSonDriver';
import { detectProvider } from '../src/services/invoice-engine/providerDetector';
import { extractLookupDetailsFromXml, getLookupUrlFromPayload } from '../src/utils/xmlParser';
import { lookupPortalForSeller, rememberThaiSonPortalForSeller } from '../src/utils/providerIdentity';
import { OriginalInvoiceError } from '../src/services/invoice-engine/OriginalInvoiceError';

const sample = '<HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>C26MMR</KHHDon>' +
  '<SHDon>603</SHDon><NLap>2026-10-06</NLap><MSTTCGP>0101300842</MSTTCGP><TTKhac>' +
  '<TTin><TTruong>DC TC</TTruong><DLieu>http://einvoice.vn/tra-cuu</DLieu></TTin>' +
  '<TTin><TTruong>Mã TC</TTruong><DLieu>A46EKFYXHKM</DLieu></TTin></TTKhac></TTChung>' +
  '<NDHDon><NBan><Ten>CÔNG TY CỔ PHẦN MARU</Ten><MST>0401515239</MST></NBan></NDHDon>' +
  '</DLHDon><MCCQT>M1-26-TLSUZ-00000000603</MCCQT></HDon>';

test('Thai Son XML from MARU resolves shared official lookup with its own code', () => {
  assert.equal(detectProvider(sample),'THAISON');
  const parsed=extractLookupDetailsFromXml(sample);
  assert.equal(parsed.lookupCode,'A46EKFYXHKM');
  assert.equal(parsed.lookupUrl,'https://einvoice.vn/tra-cuu');
  const info=new ThaiSonDriver().extractInfo(sample);
  assert.equal(info.sellerTaxCode,'0401515239');
  assert.equal(info.invoiceNo,'0000603');
  assert.equal(info.invoiceSeries,'C26MMR');
  assert.equal(info.lookupUrl,'https://einvoice.vn/tra-cuu');
  assert.equal(info.lookupCode,'A46EKFYXHKM');
});

test('Shared Thai Son portal is retained from structured payload, not learned as a seller tenant', () => {
  const source={msttcgp:'0101300842',nbmst:'0401515239',lookupUrl:'http://einvoice.vn/tra-cuu'};
  assert.equal(getLookupUrlFromPayload(source),'https://einvoice.vn/tra-cuu');
  assert.equal(rememberThaiSonPortalForSeller('0401515239','https://einvoice.vn/tra-cuu'),false);
  assert.equal(lookupPortalForSeller('0401515239'),undefined);
});

test('Thai Son shared lookup reaches the service rather than rejecting as an unknown portal', async () => {
  const previous=globalThis.fetch;
  let calls=0;
  globalThis.fetch=(async (url:string|URL|Request)=>{
    calls++;
    assert.equal(new URL(String(url)).hostname,'einvoice.vn');
    return new Response('<html><body>no invoice search form</body></html>',{
      headers:{'content-type':'text/html'}
    });
  }) as typeof fetch;
  try {
    const driver=new ThaiSonDriver();
    await assert.rejects(driver.fetchPdf(driver.extractInfo(sample)),(err:unknown)=>
      err instanceof OriginalInvoiceError && err.code === 'LOOKUP_FORM_NOT_FOUND');
    assert.equal(calls,1);
  } finally {globalThis.fetch=previous;}
});
