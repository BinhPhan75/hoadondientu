import { getInvoiceOriginalCacheKey, writeCachedOriginalPdf } from '../utils/invoiceOriginalCache';
import type { GDTInvoice } from '../types';

const NORMALIZE = (value: string) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[Đđ]/g, 'D').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export const minvoicePdfCacheKey = (invoice: GDTInvoice): string =>
  getInvoiceOriginalCacheKey(invoice) + '|verified-original-v5';

export async function importMinvoiceIssuerPdf(file: File, invoice: GDTInvoice): Promise<Blob> {
  if (!file || file.size < 100 || file.size > 25_000_000) {
    throw new Error('Vui lòng chọn PDF M-Invoice hợp lệ (tối đa 25 MB).');
  }
  const raw = new Uint8Array(await file.arrayBuffer());
  const magic = String.fromCharCode(...raw.subarray(0, 5));
  if (magic !== '%PDF-') throw new Error('Tệp đã chọn không phải PDF hợp lệ.');

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (typeof window !== 'undefined') {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }

    let document: any;
    try {
      const task = pdfjs.getDocument({
        data: raw,
        disableFontFace: true,
        useSystemFonts: true,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/cmaps/',
        cMapPacked: true,
      });
      document = await task.promise;
      if (!document || document.numPages < 1) {
        throw new Error('Tệp PDF không có trang nào.');
      }

      let content = '';
      for (let i = 1; i <= Math.min(document.numPages, 3); i++) {
        const page = await document.getPage(i);
        const text = await page.getTextContent();
        content += ' ' + text.items.map((item: any) => 'str' in item ? item.str : '').join(' ');
      }

      const normalized = NORMALIZE(content);
      const seller = String(invoice.nbmst || '').replace(/\D/g, '').slice(0, 10);
      const series = NORMALIZE(invoice.khhdon || '');
      const number = String(invoice.shdon || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');

      // Nếu trích xuất được chữ thì kiểm tra thông tin để tránh người dùng chọn nhầm hóa đơn khác
      if (normalized.length > 50 && seller && seller.length >= 10) {
        const hasSeller = normalized.includes(seller);
        const hasSeries = !series || normalized.includes(series);
        const hasNumber = !number || normalized.includes(number) || normalized.includes(String(invoice.shdon || '').padStart(7, '0'));

        if (!hasSeller && !hasNumber && !hasSeries) {
          throw new Error(`PDF không khớp với hóa đơn đang xem (MST: ${invoice.nbmst}, Số: ${invoice.shdon}).`);
        }
      }
    } catch (parseErr: any) {
      if (parseErr?.message?.includes('PDF không khớp')) {
        throw parseErr;
      }
      console.warn('[Minvoice PDF Import] Text extraction check notice:', parseErr?.message);
    } finally {
      await document?.destroy();
    }
  } catch (error: any) {
    if (error?.message?.includes('PDF không khớp') || error?.message?.includes('không phải PDF')) {
      throw error;
    }
  }

  const verified = new Blob([raw], { type: 'application/pdf' });
  await writeCachedOriginalPdf(minvoicePdfCacheKey(invoice), verified);
  return verified;
}
