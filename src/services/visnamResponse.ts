/**
 * Parse the successful VIN-HOADON TraCuu JSON response.
 * This does not request, solve, or bypass CAPTCHA. The caller must first
 * complete the provider's authorized lookup flow and provide its response.
 */
import { verifyIssuerInvoiceBytes, type InvoiceIdentity } from './invoiceIdentityVerifier';

export interface VerifiedVisnamFiles {
  pdf: Buffer;
  xml: Buffer;
  pdfFilename: string;
  xmlFilename: string;
}

function decodeBase64(data: unknown, limitBytes: number): Buffer {
  if (typeof data !== 'string' || !data || data.length > Math.ceil(limitBytes * 4 / 3) + 16 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 !== 0) {
    throw new Error('Dữ liệu tệp Visnam không phải base64 hợp lệ.');
  }
  const buf = Buffer.from(data, 'base64');
  if (!buf.length || buf.length > limitBytes) throw new Error('Tệp Visnam vượt giới hạn hoặc rỗng.');
  return buf;
}

function safeName(value: unknown, ext: '.pdf' | '.xml'): string {
  const raw = String(value || '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 110);
  return raw.toLowerCase().endsWith(ext) ? raw : 'visnam-original' + ext;
}

export async function extractVerifiedVisnamFiles(
  responseBody: unknown,
  identity: InvoiceIdentity
): Promise<VerifiedVisnamFiles> {
  if (!responseBody || typeof responseBody !== 'object') {
    throw new Error('Không nhận được kết quả tra cứu VIN-HOADON.');
  }
  const body = responseBody as Record<string, any>;
  const result = body.result;
  if (body.success !== true || !result || result.status !== 1 ||
      !result.filePdf?.fileData || !result.fileData?.fileData) {
    throw new Error('VIN-HOADON chưa xác nhận tra cứu thành công và trả về PDF/XML.');
  }
  const xml = decodeBase64(result.fileData.fileData, 5_000_000);
  const xmlCheck = await verifyIssuerInvoiceBytes(xml, 'application/xml', identity);
  if (!xmlCheck.ok) throw new Error('XML Visnam không khớp hóa đơn: ' + xmlCheck.reason);

  const pdf = decodeBase64(result.filePdf.fileData, 18_000_000);
  if (pdf.length < 100 || pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new Error('VIN-HOADON không trả về PDF hợp lệ.');
  }
  // The issuer's PDF can be a rasterized document with no selectable text.
  // Identity is validated against the signed XML paired in the same
  // successful lookup response; never replace the PDF with a synthetic one.
  return {
    pdf, xml,
    pdfFilename: safeName(result.filePdf.fileName, '.pdf'),
    xmlFilename: safeName(result.fileData.fileName, '.xml'),
  };
}
