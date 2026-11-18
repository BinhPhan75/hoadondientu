import { getInvoiceOriginalCacheKey, writeCachedOriginalPdf } from '../utils/invoiceOriginalCache';
import type { GDTInvoice } from '../types';

const NORMALIZE = (value: string) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[Đđ]/g, 'D').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export const minvoicePdfCacheKey = (invoice: GDTInvoice): string =>
  getInvoiceOriginalCacheKey(invoice) + '|verified-original-v5';

export async function importMinvoiceIssuerPdf(file: File, invoice: GDTInvoice): Promise<Blob> {
  if (!file || file.size < 100 || file.size > 18_000_000) {
    throw new Error('Vui lòng chọn PDF M-invoice hợp lệ (tối đa 18 MB).');
  }
  const raw = new Uint8Array(await file.arrayBuffer());
  const magic = String.fromCharCode(...raw.subarray(0, 5));
  if (magic !== '%PDF-') throw new Error('Tệp đã chọn không phải PDF.');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  let document: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']> | undefined;
  try {
    const task = pdfjs.getDocument({ data: raw, disableFontFace: true, useSystemFonts: true });
    document = await task.promise;
    let content = '';
    for (let i = 1; i <= Math.min(document.numPages, 3); i++) {
      const page = await document.getPage(i);
      const text = await page.getTextContent();
      content += ' ' + text.items.map(item => 'str' in item ? item.str : '').join(' ');
    }
    const normalized = NORMALIZE(content);
    const seller = String(invoice.nbmst || '').replace(/\D/g, '');
    const series = NORMALIZE(invoice.khhdon || '');
    const number = String(invoice.shdon || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (!seller || seller.length < 10 || !series || !number) {
      throw new Error('Thiếu MST, ký hiệu hoặc số hóa đơn để xác minh PDF.');
    }
    if (!normalized.includes('HOADON') && !normalized.includes('INVOICE')) {
      throw new Error('PDF chưa thể xác minh là hóa đơn.');
    }
    if (!normalized.includes(seller)) throw new Error('MST bên bán trong PDF không trùng hóa đơn đang xem.');
    if (!normalized.includes(series)) throw new Error('Ký hiệu hóa đơn trong PDF không khớp.');
    if (!normalized.includes(number)) throw new Error('Số hóa đơn trong PDF không khớp.');
  } catch (error) {
    throw error instanceof Error ? error : new Error('Không thể đọc hoặc xác minh PDF M-invoice.');
  } finally {
    await document?.destroy();
  }
  const verified = new Blob([raw], { type: 'application/pdf' });
  await writeCachedOriginalPdf(minvoicePdfCacheKey(invoice), verified);
  return verified;
}
