import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractVerifiedVisnamFiles } from '../src/services/visnamResponse';

const identity = { sellerTaxCode: '0401926013', invoiceSeries: 'C26TAA', invoiceNo: '5235' };
const xml = '<HDon><DLHDon><TTChung><KHHDon>C26TAA</KHHDon><SHDon>5235</SHDon></TTChung><NDHDon><NBan><MST>0401926013</MST></NBan></NDHDon></DLHDon></HDon>';
const pdf = Buffer.from('%PDF-1.4\n' + 'x'.repeat(200));

function response(xmlText: string, pdfBytes = pdf) {
  return {
    success: true,
    result: {
      status: 1,
      filePdf: { fileName: '0401926013-1C26TAA-0005235.pdf', fileData: pdfBytes.toString('base64') },
      fileData: { fileName: '0005235.xml', fileData: Buffer.from(xmlText).toString('base64') },
    },
  };
}

test('Visnam: valid successful response includes issuer PDF and matching XML', async () => {
  const files = await extractVerifiedVisnamFiles(response(xml), identity);
  assert.deepEqual(files.pdf, pdf);
  assert.equal(files.xml.toString(), xml);
  assert.equal(files.pdfFilename, '0401926013-1C26TAA-0005235.pdf');
});

test('Visnam: reject mismatched invoice XML even if PDF magic is valid', async () => {
  await assert.rejects(
    extractVerifiedVisnamFiles(response(xml.replace('5235', '8888')), identity),
    /không khớp/
  );
});

test('Visnam: reject server failure or missing PDF bytes', async () => {
  await assert.rejects(extractVerifiedVisnamFiles({ success: false }, identity));
  await assert.rejects(extractVerifiedVisnamFiles(response(xml, Buffer.from('not a PDF')), identity), /PDF/);
});
