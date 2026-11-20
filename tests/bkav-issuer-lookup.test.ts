import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLookupDetailsFromXml } from '../src/utils/xmlParser';
import { detectProvider } from '../src/services/invoice-engine/providerDetector';
import { BkavDriver } from '../src/services/invoice-engine/drivers/BkavDriver';

const invoice = '<HDon><DLHDon><TTChung><KHHDon>C26TMB</KHHDon>' +
  '<SHDon>00001163</SHDon><MSTTCGP>0101360697</MSTTCGP>' +
  '<TTKhac><TTin><TTruong>StoreID</TTruong><DLieu>14601</DLieu></TTin>' +
  '<TTin><TTruong>OrderNumber</TTruong><DLieu>30154559669</DLieu></TTin></TTKhac>' +
  '<TTHDLQuan><TCHDon>2</TCHDon><SHDCLQuan>00000920</SHDCLQuan></TTHDLQuan>' +
  '</TTChung><NDHDon><NBan><Ten>CÔNG TY TNHH MITRAMODE DUTA FASHINDO VIỆT NAM</Ten>' +
  '<MST>0314222123</MST></NBan></NDHDon></DLHDon>' +
  '<MCCQT>002B06705B7C9D4CCA92EFCF95901434B3</MCCQT></HDon>';

test('Bkav adjustment invoice does not fabricate a lookup token', () => {
  const value = extractLookupDetailsFromXml(invoice);
  assert.equal(detectProvider(invoice), 'BKAV');
  assert.equal(value.lookupCode, '');
  assert.equal(value.lookupUrl, 'https://tchd.ehoadon.vn/TCHD');
  const info = new BkavDriver().extractInfo(invoice);
  assert.equal(info.lookupCode, '');
  assert.equal(info.lookupUrl, 'https://tchd.ehoadon.vn/TCHD');
  assert.equal(info.invoiceSeries, 'C26TMB');
  assert.equal(info.invoiceNo, '00001163');
});

test('Bkav reads an explicitly provided issuer lookup code', () => {
  const withCode=invoice.replace('</TTKhac>', '<TTin><TTruong>Mã tra cứu</TTruong>' +
    '<DLieu>BKAVTEST123</DLieu></TTin></TTKhac>');
  assert.equal(extractLookupDetailsFromXml(withCode).lookupCode, 'BKAVTEST123');
});
