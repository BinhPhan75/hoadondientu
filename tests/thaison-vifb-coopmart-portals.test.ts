import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLookupDetailsFromXml } from '../src/utils/xmlParser';
import { normalizeThaiSonPortalUrl, isSaigonCoopPortalUrl } from '../src/utils/providerIdentity';
import { resolveInvoiceProvider } from '../src/utils/providerRouting';

const invoice = (seller: string, series: string, number: string, code: string, url: string) =>
  '<HDon><DLHDon><TTChung><KHHDon>' + series + '</KHHDon><SHDon>' + number + '</SHDon>' +
  '<MSTTCGP>0101300842</MSTTCGP><TTKhac>' +
  '<TTin><TTruong>Mã TC</TTruong><DLieu>' + code + '</DLieu></TTin>' +
  '<TTin><TTruong>ĐCTC</TTruong><DLieu>' + url + '</DLieu></TTin>' +
  '</TTKhac></TTChung><NDHDon><NBan><MST>' + seller + '</MST></NBan>' +
  '</NDHDon></DLHDon></HDon>';

test('VIFB Thai Son lookup uses the issuer portal and exact Mã TC', () => {
  const xml = invoice('0312065210-011','C26MDG','52361','DNCJQFBWCMC','https://einvoice.vifb.vn');
  assert.deepEqual(extractLookupDetailsFromXml(xml), {
    lookupCode:'DNCJQFBWCMC',lookupUrl:'https://einvoice.vifb.vn/'
  });
  assert.equal(resolveInvoiceProvider({rawXml:xml,nbmst:'0312065210-011'}),'THAISON');
});

test('Co.opmart Quảng Bình Thai Son lookup retains its distinct portal and code', () => {
  const xml = invoice('0301175691-021','C26MCM','452474','4CS98LDWS1K',
    'https://saigoncoop.einvoice.com.vn/');
  assert.deepEqual(extractLookupDetailsFromXml(xml),{
    lookupCode:'4CS98LDWS1K',lookupUrl:'https://saigoncoop.einvoice.com.vn/'
  });
  assert.equal(isSaigonCoopPortalUrl(extractLookupDetailsFromXml(xml).lookupUrl),true);
});

test('VIFB normalization only enables the explicit HTTPS host, not related lookalikes', () => {
  assert.equal(normalizeThaiSonPortalUrl('https://einvoice.vifb.vn'),'https://einvoice.vifb.vn/');
  assert.equal(normalizeThaiSonPortalUrl('https://fake.einvoice.vifb.vn'),'');
});
