import axios from 'axios';
import https from 'https';
import { GDTInvoice } from '../types';
import { generateGDTInvoiceXml } from '../utils/xmlGenerator';

export const FOUR_SI_LCS_READER_URL = 'https://dochoadon.lcssoft.com.vn/';
export const FOUR_SI_PORTAL_URL = 'https://inv.4si.vn/tra-cuu-hoa-don';

export interface FourSiRenderResult {
  success: boolean;
  pdfBuffer?: Buffer;
  pdfBase64?: string;
  filename: string;
  contentType: string;
  sourceUrl: string;
  portalUrl: string;
  filePdfName?: string;
  error?: string;
  isDisplayOnly?: boolean;
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Máy chủ LCS Soft dochoadon hiện có chứng chỉ SSL quá hạn
  keepAlive: true
});

interface CachedPdf {
  buffer: Buffer;
  base64: string;
  filename: string;
  sourceUrl: string;
  timestamp: number;
}

// Bộ nhớ đệm lưu tệp PDF đã kết xuất từ LCS Soft
const fourSiPdfCache = new Map<string, CachedPdf>();

function getFourSiCacheKey(xml: string, invoice?: Partial<GDTInvoice>): string {
  if (invoice?.id) return `id_${invoice.id}`;
  if (invoice?.nbmst && invoice?.khhdon && invoice?.shdon) {
    const cleanShd = String(invoice.shdon).replace(/\D/g, '').padStart(7, '0');
    return `inv_${invoice.nbmst}_${invoice.khhdon}_${cleanShd}`;
  }
  return `xml_${xml.length}_${xml.slice(0, 80)}`;
}

/**
 * Kiểm tra xem hóa đơn có thuộc hệ thống 4Si / LCS Soft hay không
 */
export function isFourSiInvoice(invoice?: Partial<GDTInvoice> | null, xmlContent?: string): boolean {
  if (!invoice && !xmlContent) return false;

  const provider = (invoice?.provider || '').toUpperCase();
  const msttcgp = invoice?.msttcgp || '';
  const nbmst = invoice?.nbmst || '';
  const caProvider = (invoice?.caProvider || '').toUpperCase();
  const lookupUrl = (invoice?.lookupUrl || '').toLowerCase();
  const nbten = (invoice?.nbten || '').toUpperCase();

  if (
    provider === '4SI' ||
    provider === 'LCS_SOFT' ||
    msttcgp === '0315744883' ||
    msttcgp === '0302999571' ||
    nbmst === '0315018466' || // PNJ
    caProvider.includes('4SI') ||
    caProvider.includes('LCS') ||
    lookupUrl.includes('4si.vn') ||
    lookupUrl.includes('lcssoft.com.vn') ||
    nbten.includes('LCS SOFT') ||
    nbten.includes('4SI')
  ) {
    return true;
  }

  if (xmlContent) {
    const upperXml = xmlContent.toUpperCase();
    if (
      upperXml.includes('4SI.VN') ||
      upperXml.includes('LCSSOFT.COM.VN') ||
      upperXml.includes('0315744883') ||
      upperXml.includes('0302999571') ||
      upperXml.includes('CN=4SI') ||
      upperXml.includes('O=4SI') ||
      upperXml.includes('4SI-CA')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Gửi file XML hóa đơn sang dịch vụ Đọc hóa đơn của LCS Soft (dochoadon.lcssoft.com.vn/detect)
 * để chuyển đổi thành bản thể hiện PDF 4Si gần giống bản gốc.
 */
export async function renderFourSiPdfViaLcs(
  xmlInput?: string,
  invoice?: Partial<GDTInvoice>
): Promise<FourSiRenderResult> {
  try {
    let xml = (xmlInput || '').trim();
    if (!xml && invoice) {
      xml = generateGDTInvoiceXml(invoice as GDTInvoice);
    }

    if (!xml) {
      throw new Error('Dữ liệu XML hóa đơn không được để trống.');
    }

    const khhdon = invoice?.khhdon || '4SI';
    const shdon = invoice?.shdon ? String(invoice.shdon).padStart(7, '0') : '0000000';
    const sellerMst = invoice?.nbmst || 'LCS';
    const exportFilename = `HD_4SI_${khhdon}_${shdon}_${sellerMst}.pdf`;

    // 1. Kiểm tra bộ nhớ đệm (Cache)
    const cacheKey = getFourSiCacheKey(xml, invoice);
    const cached = fourSiPdfCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      console.log(`[FourSiService] Lấy PDF 4Si từ bộ nhớ đệm (Cache HIT: ${cacheKey})...`);
      return {
        success: true,
        pdfBuffer: cached.buffer,
        pdfBase64: cached.base64,
        filename: cached.filename || exportFilename,
        contentType: 'application/pdf',
        sourceUrl: cached.sourceUrl || FOUR_SI_LCS_READER_URL,
        portalUrl: FOUR_SI_LCS_READER_URL,
        isDisplayOnly: true
      };
    }

    // Chuẩn bị XML tối ưu cho LCS Soft (loại bỏ signature lỗi thời nếu có dấu ba chấm)
    let xmlForLcs = xml;
    if (xmlForLcs.includes('...') || xmlForLcs.includes('MIIFuzCCA')) {
      xmlForLcs = xmlForLcs.replace(/<DSCKS>[\s\S]*?<\/DSCKS>/gi, '');
    }

    const uploadFilename = `invoice_${sellerMst}_${khhdon}_${shdon}_${Date.now()}.xml`;

    // Chuẩn bị FormData với file XML
    const form = new FormData();
    const blob = new Blob([xmlForLcs], { type: 'text/xml' });
    form.append('file', blob, uploadFilename);

    console.log(`[FourSiService] Gửi XML (${xmlForLcs.length} bytes) lên ${FOUR_SI_LCS_READER_URL}detect...`);

    const detectResponse = await axios.post('https://dochoadon.lcssoft.com.vn/detect', form, {
      httpsAgent,
      timeout: 25000
    });

    const resData = detectResponse.data;
    if (!resData || resData.status !== 0 || !resData.data) {
      const errMsg = resData?.data?.errorCode || 'Máy chủ LCS Soft từ chối xử lý XML.';
      throw new Error(`Cổng LCS Soft phản hồi: ${errMsg}`);
    }

    // Tên file PDF do LCS Soft sinh ra
    const filePdfName =
      resData.data.filePdfName ||
      resData.data.fileName?.replace(/\.xml$/i, '.pdf') ||
      uploadFilename.replace(/\.xml$/i, '.pdf');

    if (!filePdfName) {
      throw new Error('Cổng LCS Soft không tạo được tệp PDF từ XML này.');
    }

    const downloadPdfUrl = `https://dochoadon.lcssoft.com.vn/download/pdf/${filePdfName}`;
    console.log(`[FourSiService] Tải tệp PDF kết quả từ ${downloadPdfUrl}...`);

    let pdfBuffer: Buffer | null = null;
    let lastErr: any = null;

    // Server LCS Soft tạo file PDF bất đồng bộ sau khi /detect thành công.
    // Cần chờ tối thiểu 1.5s trước lần thử đầu tiên để server kịp ghi file xuống đĩa.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Thử tải PDF với tối đa 6 lần thử
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        const pdfResponse = await axios.get(downloadPdfUrl, {
          httpsAgent,
          responseType: 'arraybuffer',
          timeout: 25000
        });

        const buf = Buffer.from(pdfResponse.data);
        if (buf.length >= 100 && buf.toString('utf-8', 0, 5).startsWith('%PDF')) {
          pdfBuffer = buf;
          console.log(`[FourSiService] Tải PDF 4Si thành công ở lần thử ${attempt} (${buf.length} bytes)!`);
          break;
        }
      } catch (e: any) {
        lastErr = e;
        // Nếu server báo 500 (ERROR_FILE_NOT_FOUND) hoặc 404, server vẫn đang trong tiến trình sinh file
        console.log(`[FourSiService] Lần thử ${attempt}/6 chưa có file (${e.response?.status || e.message}), tiếp tục đợi...`);
      }
    }

    if (!pdfBuffer) {
      throw new Error(
        lastErr?.message
          ? `Không tải được tệp PDF từ LCS Soft: ${lastErr.message}`
          : 'Tệp tải về từ LCS Soft không hợp lệ hoặc bị lỗi.'
      );
    }

    const pdfBase64 = pdfBuffer.toString('base64');

    // Lưu vào bộ nhớ đệm
    fourSiPdfCache.set(cacheKey, {
      buffer: pdfBuffer,
      base64: pdfBase64,
      filename: exportFilename,
      sourceUrl: downloadPdfUrl,
      timestamp: Date.now()
    });

    return {
      success: true,
      pdfBuffer,
      pdfBase64,
      filename: exportFilename,
      contentType: 'application/pdf',
      sourceUrl: downloadPdfUrl,
      portalUrl: FOUR_SI_LCS_READER_URL,
      filePdfName,
      isDisplayOnly: true
    };
  } catch (err: any) {
    console.error('[FourSiService] Lỗi khi tạo bản thể hiện 4Si qua LCS Soft:', err.message);
    return {
      success: false,
      filename: `HD_4SI_${invoice?.khhdon || ''}_${invoice?.shdon || ''}.pdf`,
      contentType: 'application/pdf',
      sourceUrl: FOUR_SI_LCS_READER_URL,
      portalUrl: FOUR_SI_LCS_READER_URL,
      error: err.message || 'Không thể tạo bản thể hiện 4Si qua LCS Soft'
    };
  }
}
