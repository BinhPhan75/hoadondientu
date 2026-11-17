import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { verifyIssuerInvoiceBytes } from '../src/services/invoiceIdentityVerifier';

const identity = { sellerTaxCode: '0301175691-021', invoiceSeries: 'C26MCM', invoiceNo: '0323797' };

test('Correct provider PDF must match seller, invoice number and series', async () => {
  const pdf = new jsPDF();
  pdf.text('HOA DON GIA TRI GIA TANG', 20, 20);
  pdf.text('MST: 0301175691-021', 20, 32);
  pdf.text('Ky hieu: C26MCM', 20, 44);
  pdf.text('So: 323797', 20, 56);
  const bytes = Buffer.from(pdf.output('arraybuffer'));
  assert.equal((await verifyIssuerInvoiceBytes(bytes, 'application/pdf', identity)).ok, true);
  assert.equal((await verifyIssuerInvoiceBytes(bytes, 'application/pdf', {
    ...identity, invoiceNo: '2996339'
  })).ok, false);
});

test('User guide PDF must not be cached as an original', async () => {
  const pdf = new jsPDF();
  pdf.text('HUONG DAN SU DUNG PHAN MEM', 20, 20);
  const bytes = Buffer.from(pdf.output('arraybuffer'));
  assert.equal((await verifyIssuerInvoiceBytes(bytes, 'application/pdf', identity)).ok, false);
});

test('ZIP with original signed invoice XML needs matching invoice metadata', async () => {
  const zip = new JSZip();
  const xml = '<HDon><DLHDon><TTChung><KHHDon>C26MCM</KHHDon><SHDon>323797</SHDon></TTChung>' +
    '<NDHDon><NBan><MST>0301175691-021</MST></NBan></NDHDon></DLHDon></HDon>';
  zip.file('invoice.xml', xml);
  const bytes = await zip.generateAsync({ type: 'nodebuffer' });
  assert.equal((await verifyIssuerInvoiceBytes(bytes, 'application/zip', identity)).ok, true);
  assert.equal((await verifyIssuerInvoiceBytes(bytes, 'application/zip', {
    ...identity, sellerTaxCode: '0102721191-001'
  })).ok, false);
});

