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
    const uploadFilename = `invoice_${Date.now()}_${Math.floor(Math.random() * 1000)}.xml`;

    // Chuẩn bị FormData với file XML
    const form = new FormData();
    const blob = new Blob([xml], { type: 'text/xml' });
    form.append('file', blob, uploadFilename);

    console.log(`[FourSiService] Gửi XML (${xml.length} bytes) lên ${FOUR_SI_LCS_READER_URL}detect...`);

    const detectResponse = await axios.post('https://dochoadon.lcssoft.com.vn/detect', form, {
      httpsAgent,
      timeout: 25000
    });

    const resData = detectResponse.data;
    if (!resData || resData.status !== 0 || !resData.data) {
      const errMsg = resData?.data?.errorCode || 'Máy chủ LCS Soft từ chối xử lý XML.';
      throw new Error(`Cổng LCS Soft phản hồi: ${errMsg}`);
    }

    const filePdfName = resData.data.filePdfName;
    if (!filePdfName) {
      throw new Error('Cổng LCS Soft không tạo được tệp PDF từ XML này.');
    }

    const downloadPdfUrl = `https://dochoadon.lcssoft.com.vn/download/pdf/${filePdfName}`;
    console.log(`[FourSiService] Tải tệp PDF kết quả từ ${downloadPdfUrl}...`);

    let pdfBuffer: Buffer | null = null;
    let lastErr: any = null;

    // Thử tải PDF với tối đa 3 lần thử (đề phòng server vừa ghi đĩa)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        const pdfResponse = await axios.get(downloadPdfUrl, {
          httpsAgent,
          responseType: 'arraybuffer',
          timeout: 25000
        });

        const buf = Buffer.from(pdfResponse.data);
        if (buf.length >= 100 && buf.toString('utf-8', 0, 5).startsWith('%PDF')) {
          pdfBuffer = buf;
          break;
        }
      } catch (e: any) {
        lastErr = e;
      }
    }

    if (!pdfBuffer) {
      throw new Error(
        lastErr?.message
          ? `Không tải được tệp PDF từ LCS Soft: ${lastErr.message}`
          : 'Tệp tải về từ LCS Soft không hợp lệ hoặc bị lỗi.'
      );
    }

    const exportFilename = `HD_4SI_${khhdon}_${shdon}_${sellerMst}.pdf`;

    return {
      success: true,
      pdfBuffer,
      pdfBase64: pdfBuffer.toString('base64'),
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
