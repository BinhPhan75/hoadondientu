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

test('Visnam: createVisnamBinarizedBmp removes red and green noise lines and keeps dark/blue digits', async () => {
  const { createVisnamBinarizedBmp } = await import('../src/services/invoice-engine/captcha/tesseractCaptchaSolver');
  // Synthetic 10x4 image:
  // Pixel (0,0): Pure Red noise (255, 0, 0, 255)
  // Pixel (1,0): Pure Green noise (0, 255, 0, 255)
  // Pixel (2,0): Black digit (0, 0, 0, 255)
  // Pixel (3,0): Blue digit (0, 0, 240, 255)
  // Pixel (4,0): White background (255, 255, 255, 255)
  const width = 10;
  const height = 4;
  const data = Buffer.alloc(width * height * 4, 255); // all white

  // (0,0) Red line
  data[0] = 255; data[1] = 0; data[2] = 0; data[3] = 255;
  // (1,0) Green line
  data[4] = 0; data[5] = 255; data[6] = 0; data[7] = 255;
  // (2,0) Black digit
  data[8] = 0; data[9] = 0; data[10] = 0; data[11] = 255;
  // (3,0) Blue digit
  data[12] = 0; data[13] = 0; data[14] = 240; data[15] = 255;

  const bmp = createVisnamBinarizedBmp({ width, height, data }, 200, 5);
  assert.ok(bmp.length > 54);
  assert.equal(bmp.slice(0, 2).toString(), 'BM');
});

