import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyIssuerInvoiceBytes } from '../src/services/invoiceIdentityVerifier';

const invoiceXml = '<HDon><DLHDon><TTChung><KHHDon>C26MMR</KHHDon>' +
  '<SHDon>603</SHDon></TTChung><NDHDon><NBan><MST>0401515239</MST>' +
  '</NBan></NDHDon></DLHDon></HDon>';

test('Thai Son original import confirms the full XML invoice identity', async () => {
  const original = Buffer.from(invoiceXml);
  const identity = { sellerTaxCode:'0401515239', invoiceSeries:'C26MMR', invoiceNo:'0000603' };
  assert.equal((await verifyIssuerInvoiceBytes(original, 'application/xml', identity)).ok,true);
  assert.equal((await verifyIssuerInvoiceBytes(original, 'application/xml',
    {...identity, invoiceSeries:'C26XYZ'})).ok,false);
  assert.equal((await verifyIssuerInvoiceBytes(original, 'application/xml',
    {...identity, invoiceNo:'604'})).ok,false);
  assert.equal((await verifyIssuerInvoiceBytes(original, 'application/xml',
    {...identity, sellerTaxCode:'0312303803'})).ok,false);
});

test('Thai Son import rejects an HTML marketing page regardless of content type', async () => {
  const bytes=Buffer.from('<html><body>Tra cứu hóa đơn 603 MST 0401515239' +
    '<span>C26MMR</span></body></html>');
  const verified = await verifyIssuerInvoiceBytes(bytes,'text/html',{
    sellerTaxCode:'0401515239',invoiceSeries:'C26MMR',invoiceNo:'603'
  });
  assert.equal(verified.ok,false);
});
