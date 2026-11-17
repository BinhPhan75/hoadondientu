import test from 'node:test';
import assert from 'node:assert/strict';
import { MisaDriver } from '../src/services/invoice-engine/drivers/MisaDriver';

test('MISA driver can extract lookup code from signed invoice XML before auto-fetch', () => {
  const xml = '<HDon><DLHDon><TTChung><MSTTCGP>0101243150</MSTTCGP><KHHDon>C26MTT</KHHDon><SHDon>12345</SHDon>' +
    '<TTKhac><TTin><TTruong>Mã tra cứu</TTruong><DLieu>MISA-LOOKUP-ABC</DLieu></TTin></TTKhac></TTChung>' +
    '<NDHDon><NBan><MST>0123456789</MST><Ten>Cong ty A</Ten></NBan></NDHDon></DLHDon></HDon>';
  const info = new MisaDriver().extractInfo(xml);
  assert.equal(info.provider, 'MISA');
  assert.equal(info.sellerTaxCode, '0123456789');
  assert.equal(info.invoiceNo, '0012345');
  assert.ok(info.lookupCode);
  assert.equal(info.lookupUrl?.startsWith('https://'), true);
});
