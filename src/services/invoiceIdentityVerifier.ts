import JSZip from 'jszip';
import * as cheerio from 'cheerio';

export type InvoiceIdentity = {
  sellerTaxCode?: string;
  invoiceNo?: string;
  invoiceSeries?: string;
};

export type OriginalVerification = { ok: boolean; reason: string };

function digits(value: string | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

function compact(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D').replace(/đ/g, 'd')
    .replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function invoiceNumber(value: string | undefined): string {
  return digits(value).replace(/^0+(?=\d)/, '');
}

function matchesIdentity(text: string, identity: InvoiceIdentity): OriginalVerification {
  const seller = digits(identity.sellerTaxCode);
  const number = invoiceNumber(identity.invoiceNo);
  if (seller.length < 10 || !number) {
    return { ok: false, reason: 'Thiếu MST người bán hoặc số HĐ để xác thực bản gốc.' };
  }
  const flattened = compact(text);
  if (!flattened.includes(seller)) return { ok: false, reason: 'MST người bán trong file không khớp hóa đơn đang mở.' };
  if (!flattened.includes(number)) return { ok: false, reason: 'Số hóa đơn trong file không khớp hóa đơn đang mở.' };
  return { ok: true, reason: 'MST người bán và số hóa đơn khớp.' };
}

function matchXmlInvoice(xml: string, identity: InvoiceIdentity): OriginalVerification {
  if (xml.length > 5_000_000) return { ok: false, reason: 'XML vượt giới hạn xác minh 5 MB.' };
  try {
    const $ = cheerio.load(xml, { xmlMode: true });
    const invoice = $('HDon').first();
    const data = invoice.children('DLHDon').first();
    const seller = data.find('NDHDon > NBan > MST').first().text().trim();
    const number = data.find('TTChung > SHDon').first().text().trim();
    const series = data.find('TTChung > KHHDon').first().text().trim();
    if (!data.length || !seller || !number || !series) {
      return { ok: false, reason: 'Tệp XML không chứa đầy đủ dữ liệu định danh HDon/DLHDon.' };
    }
    if (digits(seller) !== digits(identity.sellerTaxCode) ||
        invoiceNumber(number) !== invoiceNumber(identity.invoiceNo) ||
        compact(series) !== compact(identity.invoiceSeries || '')) {
      return { ok: false, reason: 'XML không khớp MST, ký hiệu hoặc số hóa đơn đang mở.' };
    }
    return { ok: true, reason: 'XML khớp đúng MST bên bán, ký hiệu và số hóa đơn.' };
  } catch {
    return { ok: false, reason: 'XML bị lỗi cấu trúc, không thể xác minh.' };
  }
}

/** Read at most the first two PDF pages; never assume PDF magic bytes imply an invoice. */
async function extractPdfText(bytes: Buffer): Promise<string> {
  if (bytes.length > 18_000_000) throw new Error('PDF vượt giới hạn xác minh 18 MB.');
  const canvas = await import('@napi-rs/canvas');
  if (typeof globalThis.DOMMatrix === 'undefined') {
    Object.assign(globalThis, { DOMMatrix: canvas.DOMMatrix });
  }
  if (typeof globalThis.ImageData === 'undefined') {
    Object.assign(globalThis, { ImageData: canvas.ImageData });
  }
  if (typeof globalThis.Path2D === 'undefined') {
    Object.assign(globalThis, { Path2D: canvas.Path2D });
  }
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    disableFontFace: true,
    stopAtErrors: true,
  });
  const pdf = await loading.promise;
  try {
    let text = '';
    for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 2); pageNo++) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      text += ' ' + content.items.map(item => 'str' in item ? item.str : '').join(' ');
    }
    return text;
  } finally {
    await pdf.destroy();
  }
}

/** Validate seller/series/number before displaying or caching a provider file. */
export async function verifyIssuerInvoiceBytes(
  bytes: Buffer, contentType: string | undefined, identity: InvoiceIdentity
): Promise<OriginalVerification> {
  if (!bytes || bytes.length < 20) return { ok: false, reason: 'File trả về rỗng hoặc quá nhỏ.' };
  if (bytes.subarray(0, 5).toString('latin1') === '%PDF-') {
    try {
      const text = await extractPdfText(bytes);
      if (!text.trim()) return { ok: false, reason: 'Không trích xuất được thông tin định danh hóa đơn từ PDF.' };
      if (!compact(text).includes('HOADON') && !compact(text).includes('INVOICE')) {
        return { ok: false, reason: 'PDF không thể hiện là hóa đơn.' };
      }
      return matchesIdentity(text, identity);
    } catch (error: any) {
      return { ok: false, reason: 'Không kiểm tra được danh tính PDF: ' + (error?.message || 'lỗi đọc PDF') };
    }
  }

  const head = bytes.subarray(0, 150).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (/^(?:<\?xml\b|<HDon(?:\s|>))/i.test(head) ||
      /^(?:application|text)\/xml/i.test(contentType || '')) {
    return matchXmlInvoice(bytes.toString('utf8'), identity);
  }

  const isZip = bytes.subarray(0, 4).toString('latin1') === 'PK\x03\x04'
    || /^application\/zip/i.test(contentType || '');
  if (isZip) {
    if (bytes.length > 20_000_000) return { ok: false, reason: 'ZIP vượt giới hạn xác minh 20 MB.' };
    try {
      const zip = await JSZip.loadAsync(bytes);
      const xmls = Object.values(zip.files).filter(file => !file.dir && /\.xml$/i.test(file.name));
      for (const file of xmls.slice(0, 8)) {
        const xml = await file.async('string');
        if (xml.length > 5_000_000) continue;
        const match = matchXmlInvoice(xml, identity);
        if (match.ok) return { ok: true, reason: 'ZIP chứa XML đã đối chiếu MST, ký hiệu và số hóa đơn.' };
      }
      return { ok: false, reason: 'ZIP không chứa XML có thông tin khớp hóa đơn đang mở.' };
    } catch {
      return { ok: false, reason: 'Không thể đọc ZIP để đối chiếu thông tin hóa đơn.' };
    }
  }
  return { ok: false, reason: 'Không hỗ trợ xác minh bản gốc định dạng này.' };
}
