import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLookupDetailsFromXml } from '../src/utils/xmlParser';
import { resolveInvoiceProvider } from '../src/utils/providerRouting';

const central = '<HDon><DLHDon><TTChung><KHHDon>C26MAD</KHHDon><SHDon>6610</SHDon>' +
  '<MSTTCGP>0101300842</MSTTCGP><TTKhac><TTin><TTruong>ExtHoaDon</TTruong>' +
  '<DLieu>[MaCN]276316[/MaCN][DCTC]https://hddt.centralretail.com.vn/[/DCTC]</DLieu></TTin></TTKhac>' +
  '</TTChung><NDHDon><NBan><MST>0314635071</MST></NBan><NMua><TTKhac><TTin>' +
  '<TTruong>ExtNMua</TTruong><DLieu>[MaTC]10F5D491FB[/MaTC][Sbl]2763166102003784[/Sbl]</DLieu>' +
  '</TTin></TTKhac></NMua></NDHDon></DLHDon></HDon>';

test('Central Retail Thai Son XML extracts embedded buyer MaTC and customer-specific portal', () => {
  const parsed = extractLookupDetailsFromXml(central);
  assert.equal(parsed.lookupCode, '10F5D491FB');
  assert.equal(parsed.lookupUrl, 'https://hddt.centralretail.com.vn/vi-vn/tra-cuu-hoa-don-dien-tu');
  assert.equal(resolveInvoiceProvider({ rawXml: central, nbmst: '0314635071' }), 'THAISON');
});
test('Reject unrelated invoice or arbitrary Central Retail URL without explicit portal', () => {
  assert.notEqual(extractLookupDetailsFromXml(central.replace('0101300842','1234567890')).lookupCode, '10F5D491FB');
  assert.notEqual(extractLookupDetailsFromXml(central.replace('hddt.centralretail.com.vn','untrusted.invalid')).lookupCode, '10F5D491FB');
});
