import axios, { AxiosResponse } from 'axios';

export interface VnpayLookupParams {
  lookupCode: string;
  taxCode: string;
  captchaToken?: string;
  invoiceNo?: string;
  invoiceSeries?: string;
}

export interface VnpayInvoiceData {
  stringId?: string;
  id?: string | number;
  invoiceNo?: string;
  invoiceSeries?: string;
  templateCode?: string;
  issueDate?: string;
  sellerTaxCode?: string;
  sellerName?: string;
  buyerTaxCode?: string;
  buyerName?: string;
  totalAmount?: number;
  totalTaxAmount?: number;
  currency?: string;
  status?: string;
  raw?: any;
}

export interface VnpayLookupResult {
  success: boolean;
  invoices?: VnpayInvoiceData[];
  firstInvoice?: VnpayInvoiceData;
  stringId?: string;
  error?: string;
  errorCode?: string;
  requiresCaptcha?: boolean;
  directUrl?: string;
}

export interface VnpayDownloadParams {
  stringId?: string;
  sellerTaxCode: string;
  lookupCode?: string;
  captchaToken?: string;
  invoiceNo?: string;
  invoiceSeries?: string;
}

export interface VnpayDownloadResult {
  success: boolean;
  pdfBuffer?: Buffer;
  pdfBase64?: string;
  xmlContent?: string;
  filename: string;
  contentType: string;
  sourceUrl: string;
  error?: string;
  requiresCaptcha?: boolean;
}

const COMMON_VNPAY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://portal.vnpayinvoice.vn',
  'Referer': 'https://portal.vnpayinvoice.vn/',
  'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
};

/**
 * Sinh X-Request-ID theo định dạng chuẩn của VNPAY Portal (RequestService.makeRequestId)
 * Định dạng: YYYYMMDDHHmmss-XXXXXX (6 chữ số ngẫu nhiên)
 */
export function generateVnpayRequestId(length: number = 6): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const rand = Math.floor(min + Math.random() * (max - min + 1));

  return `${timestamp}-${rand}`;
}

/**
 * Tạo URL tra cứu trực tiếp trên VNPAY Portal kèm tự động điền form
 */
export function buildVnpayPortalUrl(lookupCode?: string, taxCode?: string): string {
  const base = 'https://portal.vnpayinvoice.vn/';
  const params = new URLSearchParams();
  if (lookupCode) params.set('lookupCode', lookupCode.trim());
  if (taxCode) params.set('taxCode', taxCode.trim());
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Tra cứu danh sách hóa đơn từ máy chủ VNPAY Invoice
 * Endpoint: GET https://portal.vnpayinvoice.vn/api/v6/invoices
 */
export async function lookupVnpayInvoice(params: VnpayLookupParams): Promise<VnpayLookupResult> {
  const lookupCode = (params.lookupCode || '').trim();
  const taxCode = (params.taxCode || '').trim();

  if (!lookupCode || !taxCode) {
    return {
      success: false,
      error: 'Vui lòng cung cấp đầy đủ Mã tra cứu và Mã số thuế bên bán để tra cứu hóa đơn VNPAY.'
    };
  }

  const reqId = generateVnpayRequestId();
  const queryParams = new URLSearchParams({
    lookupCode,
    taxCode
  });
  if (params.captchaToken) {
    queryParams.set('captchaToken', params.captchaToken);
  }

  const directUrl = buildVnpayPortalUrl(lookupCode, taxCode);
  const url = `https://portal.vnpayinvoice.vn/api/v6/invoices?${queryParams.toString()}`;

  try {
    console.log(`[VNPAY] Đang gửi yêu cầu tra cứu: MST=${taxCode}, Mã tra cứu=${lookupCode}, RequestId=${reqId}...`);

    const response = await axios.get(url, {
      headers: {
        ...COMMON_VNPAY_HEADERS,
        'X-Request-ID': reqId
      },
      timeout: 15000,
      validateStatus: () => true
    });

    if (response.status === 200 && response.data) {
      const data = response.data;
      const list = Array.isArray(data) ? data : (data.data || data.items || (data.stringId ? [data] : []));
      
      const invoices: VnpayInvoiceData[] = list.map((item: any) => ({
        stringId: item.stringId || item.id || item.invoiceId,
        id: item.id,
        invoiceNo: item.invoiceNo || item.shdon,
        invoiceSeries: item.invoiceSeries || item.khhdon,
        templateCode: item.templateCode || item.khmshdon,
        issueDate: item.issueDate || item.nlap,
        sellerTaxCode: item.sellerTaxCode || item.taxCode || taxCode,
        sellerName: item.sellerName || item.supplierName,
        buyerTaxCode: item.buyerTaxCode,
        buyerName: item.buyerName,
        totalAmount: item.totalAmount || item.tgtttbso,
        totalTaxAmount: item.totalTaxAmount || item.tgtthue,
        currency: item.currency || item.dvtte || 'VND',
        status: item.status,
        raw: item
      }));

      const first = invoices[0];
      return {
        success: true,
        invoices,
        firstInvoice: first,
        stringId: first?.stringId,
        directUrl
      };
    }

    if (response.status === 400 && response.data?.code === 'PORTAL_101') {
      return {
        success: false,
        errorCode: 'PORTAL_101',
        requiresCaptcha: true,
        directUrl,
        error: 'Cổng VNPAY Invoice yêu cầu xác thực Google reCAPTCHA. Bạn có thể mở trực tiếp cổng tra cứu VNPAY (đã được tự động điền sẵn thông tin).'
      };
    }

    const errMsg = response.data?.message || response.data?.error || `Lỗi phản hồi từ VNPAY (Mã lỗi ${response.status})`;
    return {
      success: false,
      directUrl,
      error: errMsg
    };
  } catch (err: any) {
    return {
      success: false,
      directUrl,
      error: `Không thể kết nối đến Cổng VNPAY Invoice: ${err.message}`
    };
  }
}

/**
 * Tải trực tiếp file PDF hóa đơn gốc từ máy chủ VNPAY Invoice
 * Endpoint: GET https://portal.vnpayinvoice.vn/api/v6/download-pdf/{stringId}?taxCode={taxCode}
 */
export async function downloadOriginalVnpayPdf(params: VnpayDownloadParams): Promise<VnpayDownloadResult> {
  let stringId = params.stringId;
  const sellerTaxCode = (params.sellerTaxCode || '').trim();

  if (!sellerTaxCode) {
    throw new Error('Mã số thuế bên bán (sellerTaxCode) là bắt buộc khi tải hóa đơn VNPAY.');
  }

  // Nếu chưa có stringId nhưng có mã tra cứu, thử tra cứu để lấy stringId
  if (!stringId && params.lookupCode) {
    const lookupRes = await lookupVnpayInvoice({
      lookupCode: params.lookupCode,
      taxCode: sellerTaxCode,
      captchaToken: params.captchaToken
    });

    if (lookupRes.success && lookupRes.stringId) {
      stringId = lookupRes.stringId;
    } else if (lookupRes.requiresCaptcha) {
      return {
        success: false,
        filename: '',
        contentType: 'application/pdf',
        sourceUrl: lookupRes.directUrl || 'https://portal.vnpayinvoice.vn/',
        requiresCaptcha: true,
        error: lookupRes.error
      };
    } else {
      throw new Error(lookupRes.error || 'Không tìm thấy hóa đơn trên hệ thống VNPAY Invoice.');
    }
  }

  if (!stringId) {
    throw new Error('Cần có ID hóa đơn (stringId) hoặc Mã tra cứu hợp lệ để tải PDF từ VNPAY.');
  }

  const reqId = generateVnpayRequestId();
  const downloadUrl = `https://portal.vnpayinvoice.vn/api/v6/download-pdf/${encodeURIComponent(stringId)}?taxCode=${encodeURIComponent(sellerTaxCode)}`;

  console.log(`[VNPAY] Đang tải PDF gốc: stringId=${stringId}, taxCode=${sellerTaxCode}...`);

  const response: AxiosResponse<ArrayBuffer> = await axios.get(downloadUrl, {
    headers: {
      ...COMMON_VNPAY_HEADERS,
      'Accept': 'application/pdf, application/octet-stream, */*',
      'X-Request-ID': reqId
    },
    responseType: 'arraybuffer',
    timeout: 25000,
    validateStatus: (status) => status >= 200 && status < 400
  });

  if (response.data && response.data.byteLength > 100) {
    const buffer = Buffer.from(response.data);
    const headerSlice = buffer.toString('utf-8', 0, 10);
    if (headerSlice.startsWith('%PDF') || buffer.includes(Buffer.from('%PDF'))) {
      const shd = (params.invoiceNo || '0000000').padStart(7, '0');
      const khh = (params.invoiceSeries || '').replace(/[^a-zA-Z0-9]/g, '');
      const filename = `HoaDon_VNPAY_${sellerTaxCode}_${khh ? khh + '_' : ''}${shd}_${stringId}.pdf`;

      console.log(`[VNPAY] Tải PDF thành công (${(buffer.length / 1024).toFixed(1)} KB)`);

      return {
        success: true,
        pdfBuffer: buffer,
        pdfBase64: buffer.toString('base64'),
        filename,
        contentType: 'application/pdf',
        sourceUrl: downloadUrl
      };
    } else {
      const text = buffer.toString('utf-8');
      console.warn('[VNPAY] Download trả về nội dung không phải PDF:', text.substring(0, 200));
      throw new Error(`Máy chủ VNPAY phản hồi lỗi: ${text}`);
    }
  }

  throw new Error('Dữ liệu trả về từ máy chủ VNPAY rỗng hoặc không hợp lệ.');
}

/**
 * Tải trực tiếp file XML hóa đơn gốc từ máy chủ VNPAY Invoice
 * Endpoint: GET https://portal.vnpayinvoice.vn/api/v6/private/download-xml/{stringId}?taxCode={taxCode}
 */
export async function downloadOriginalVnpayXml(params: VnpayDownloadParams): Promise<VnpayDownloadResult> {
  let stringId = params.stringId;
  const sellerTaxCode = (params.sellerTaxCode || '').trim();

  if (!sellerTaxCode) {
    throw new Error('Mã số thuế bên bán là bắt buộc khi tải XML từ VNPAY.');
  }

  if (!stringId && params.lookupCode) {
    const lookupRes = await lookupVnpayInvoice({
      lookupCode: params.lookupCode,
      taxCode: sellerTaxCode,
      captchaToken: params.captchaToken
    });

    if (lookupRes.success && lookupRes.stringId) {
      stringId = lookupRes.stringId;
    } else {
      throw new Error(lookupRes.error || 'Không tìm thấy hóa đơn trên VNPAY.');
    }
  }

  if (!stringId) {
    throw new Error('Cần có ID hóa đơn (stringId) để tải XML từ VNPAY.');
  }

  const reqId = generateVnpayRequestId();
  const downloadUrl = `https://portal.vnpayinvoice.vn/api/v6/private/download-xml/${encodeURIComponent(stringId)}?taxCode=${encodeURIComponent(sellerTaxCode)}`;

  console.log(`[VNPAY] Đang tải XML gốc: stringId=${stringId}, taxCode=${sellerTaxCode}...`);

  const response: AxiosResponse<ArrayBuffer> = await axios.get(downloadUrl, {
    headers: {
      ...COMMON_VNPAY_HEADERS,
      'Accept': 'application/xml, text/xml, */*',
      'X-Request-ID': reqId
    },
    responseType: 'arraybuffer',
    timeout: 25000,
    validateStatus: (status) => status >= 200 && status < 400
  });

  if (response.data && response.data.byteLength > 50) {
    const buffer = Buffer.from(response.data);
    const content = buffer.toString('utf-8');
    const shd = (params.invoiceNo || '0000000').padStart(7, '0');
    const khh = (params.invoiceSeries || '').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `HoaDon_VNPAY_${sellerTaxCode}_${khh ? khh + '_' : ''}${shd}_${stringId}.xml`;

    return {
      success: true,
      xmlContent: content,
      filename,
      contentType: 'application/xml',
      sourceUrl: downloadUrl
    };
  }

  throw new Error('Không nhận được nội dung XML hợp lệ từ VNPAY.');
}
