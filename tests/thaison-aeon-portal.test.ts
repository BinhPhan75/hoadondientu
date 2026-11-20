import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLookupDetailsFromXml } from '../src/utils/xmlParser';
import { resolveInvoiceProvider } from '../src/utils/providerRouting';

const invoice = '<HDon><DLHDon><TTChung><KHHDon>C26MAB</KHHDon>' +
  '<SHDon>2525675</SHDon><MSTTCGP>0101300842</MSTTCGP><TTKhac>' +
  '<TTin><TTruong>Mã TC</TTruong><DLieu>ecda1014d5e4</DLieu></TTin>' +
  '</TTKhac></TTChung><NDHDon><NBan><Ten>CÔNG TY TNHH AEON VIỆT NAM - CHI NHÁNH THỪA THIÊN HUẾ</Ten>' +
  '<MST>0311241512-012</MST></NBan></NDHDon></DLHDon></HDon>';

test('AEON Thai Son receipt code maps to the official AEON tenant lookup', () => {
  const result = extractLookupDetailsFromXml(invoice);
  assert.deepEqual(result, {
    lookupCode: 'ecda1014d5e4',
    lookupUrl: 'https://hddt.aeon.com.vn/',
  });
  assert.equal(resolveInvoiceProvider({rawXml:invoice, nbmst:'0311241512-012'}), 'THAISON');
});

test('AEON tenant mapping must not apply to a different Thai Son seller', () => {
  const other = invoice.replace('0311241512-012','0314635071');
  assert.notEqual(extractLookupDetailsFromXml(other).lookupUrl,'https://hddt.aeon.com.vn/');
});

test('AEON tenant mapping requires an explicit lookup code', () => {
  const missingCode = invoice.replace('ecda1014d5e4','');
  assert.notEqual(extractLookupDetailsFromXml(missingCode).lookupUrl,'https://hddt.aeon.com.vn/');
});
