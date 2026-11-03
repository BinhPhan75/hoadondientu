import axios, { AxiosResponse } from 'axios';

export interface ViettelDownloadParams {
  supplierTaxCode: string;
  reservationCode: string;
  invoiceNo?: string;
  invoiceSeries?: string;
}

export interface ViettelDownloadResult {
  success: boolean;
  pdfBuffer?: Buffer;
  pdfBase64?: string;
  filename: string;
  contentType: string;
  sourceUrl: string;
  error?: string;
}

export interface ViettelZipDownloadResult {
  success: boolean;
  zipBuffer?: Buffer;
  zipBase64?: string;
  filename: string;
  contentType: string;
  sourceUrl: string;
  error?: string;
}

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://vinvoice.viettel.vn',
  'Referer': 'https://vinvoice.viettel.vn/utilities/invoice-search',
  'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
};

/**
 * Tải trực tiếp tệp PDF hóa đơn gốc từ máy chủ Viettel (vInvoice / S-Invoice)
 * Sử dụng API nội bộ portal Viettel không qua Captcha
 */
export async function downloadOriginalViettelPdf(params: ViettelDownloadParams): Promise<ViettelDownloadResult> {
  const supplierTaxCode = (params.supplierTaxCode || '').trim();
  const reservationCode = (params.reservationCode || '').trim();

  if (!supplierTaxCode) {
    throw new Error('Mã số thuế bên bán (supplierTaxCode) không được để trống khi tra cứu hóa đơn Viettel.');
  }
  if (!reservationCode) {
    throw new Error('Mã bí mật (reservationCode / Mã số bí mật) không được để trống khi tra cứu hóa đơn Viettel.');
  }

  const cleanShd = (params.invoiceNo || '0000000').padStart(7, '0');
  const cleanKhhdon = (params.invoiceSeries || '').replace(/[^a-zA-Z0-9]/g, '');
  const defaultFilename = `HoaDon_Viettel_${supplierTaxCode}_${cleanKhhdon ? cleanKhhdon + '_' : ''}${cleanShd}_${reservationCode}.pdf`;

  console.log(`[Viettel] Bắt đầu tải PDF gốc: MST=${supplierTaxCode}, Mã bí mật=${reservationCode}...`);

  // Danh sách các endpoints dự phòng của Viettel vInvoice Portal
  const endpoints = [
    // 1. Endpoint chính thức hiện tại (Angular portal utility)
    {
      url: `https://vinvoice.viettel.vn/api/services/einvoicequery/sync/utility/downloadPDF?taxCode=${encodeURIComponent(supplierTaxCode)}`,
      method: 'POST' as const,
      data: {
        supplierTaxCode,
        reservationCode
      }
    },
    // 2. Endpoint phụ sinh PDF trực tiếp bằng GET
    {
      url: `https://vinvoice.viettel.vn/api/services/einvoicequery/sync/utility/generatePDF?reservationCode=${encodeURIComponent(reservationCode)}&supplierTaxCode=${encodeURIComponent(supplierTaxCode)}&taxCode=${encodeURIComponent(supplierTaxCode)}`,
      method: 'GET' as const,
      data: undefined
    },
    // 3. Endpoint phiên bản V1 không cần xác thực
    {
      url: `https://vinvoice.viettel.vn/api/services/einvoiceadminapplication/no-auth/invoice-v1/downloadPDF?taxCode=${encodeURIComponent(supplierTaxCode)}`,
      method: 'POST' as const,
      data: {
        supplierTaxCode,
        reservationCode
      }
    },
    // 4. Endpoint phiên bản V1 GET
    {
      url: `https://vinvoice.viettel.vn/api/services/einvoiceadminapplication/no-auth/invoice-v1/generatePDF?reservationCode=${encodeURIComponent(reservationCode)}&supplierTaxCode=${encodeURIComponent(supplierTaxCode)}&taxCode=${encodeURIComponent(supplierTaxCode)}`,
      method: 'GET' as const,
      data: undefined
    }
  ];

  let lastError = '';

  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    try {
      console.log(`[Viettel] Thử endpoint ${i + 1}/${endpoints.length}: ${ep.method} ${ep.url}`);

      const response: AxiosResponse<ArrayBuffer> = await axios({
        url: ep.url,
        method: ep.method,
        data: ep.data,
        headers: {
          ...COMMON_HEADERS,
          ...(ep.method === 'POST' ? { 'Content-Type': 'application/json' } : {})
        },
        responseType: 'arraybuffer',
        timeout: 25000,
        validateStatus: (status) => status >= 200 && status < 400
      });

      if (response.data && response.data.byteLength > 100) {
        const buffer = Buffer.from(response.data);
        const headerSlice = buffer.toString('utf-8', 0, 10);

        // Kiểm tra chữ ký %PDF chuẩn
        if (headerSlice.startsWith('%PDF') || buffer.includes(Buffer.from('%PDF'))) {
          console.log(`[Viettel] Tải thành công file PDF gốc (${(buffer.length / 1024).toFixed(1)} KB) từ endpoint ${i + 1}`);
          return {
            success: true,
            pdfBuffer: buffer,
            pdfBase64: buffer.toString('base64'),
            filename: defaultFilename,
            contentType: 'application/pdf',
            sourceUrl: ep.url
          };
        } else {
          // Có thể là JSON báo lỗi được trả về dưới dạng arraybuffer
          const textError = buffer.toString('utf-8');
          console.warn(`[Viettel] Endpoint ${i + 1} trả về text/JSON thay vì PDF:`, textError.substring(0, 200));
          try {
            const parsed = JSON.parse(textError);
            lastError = parsed.message || parsed.error || parsed.error_description || textError;
          } catch {
            lastError = textError;
          }
        }
      } else {
        lastError = `Endpoint ${i + 1} trả về dữ liệu rỗng (${response.data ? response.data.byteLength : 0} bytes)`;
      }
    } catch (err: any) {
      const errMsg = err.response?.data
        ? Buffer.from(err.response.data).toString('utf-8')
        : err.message;
      console.warn(`[Viettel] Lỗi khi gọi endpoint ${i + 1}:`, errMsg);
      lastError = errMsg;
    }
  }

  throw new Error(
    `Không thể tải hóa đơn PDF gốc từ hệ thống Viettel S-Invoice/vInvoice: ${lastError || 'Không tìm thấy hóa đơn hoặc mã bí mật/MST không chính xác.'}`
  );
}

/**
 * Tải trực tiếp tệp ZIP (chứa XML gốc và chữ ký điện tử) từ máy chủ Viettel
 */
export async function downloadOriginalViettelZip(params: ViettelDownloadParams): Promise<ViettelZipDownloadResult> {
  const supplierTaxCode = (params.supplierTaxCode || '').trim();
  const reservationCode = (params.reservationCode || '').trim();

  if (!supplierTaxCode || !reservationCode) {
    throw new Error('Cần có Mã số thuế bên bán và Mã bí mật để tải file ZIP từ Viettel.');
  }

  const cleanShd = (params.invoiceNo || '0000000').padStart(7, '0');
  const defaultFilename = `HoaDon_Viettel_${supplierTaxCode}_${cleanShd}_${reservationCode}.zip`;

  const endpoints = [
    {
      url: `https://vinvoice.viettel.vn/api/services/einvoicequery/sync/utility/downloadFileZip?taxCode=${encodeURIComponent(supplierTaxCode)}`,
      method: 'POST' as const,
      data: {
        supplierTaxCode,
        reservationCode
      }
    },
    {
      url: `https://vinvoice.viettel.vn/api/services/einvoiceadminapplication/no-auth/invoice-v1/downloadFileZip?taxCode=${encodeURIComponent(supplierTaxCode)}`,
      method: 'POST' as const,
      data: {
        supplierTaxCode,
        reservationCode
      }
    }
  ];

  let lastError = '';

  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    try {
      const response: AxiosResponse<ArrayBuffer> = await axios({
        url: ep.url,
        method: ep.method,
        data: ep.data,
        headers: {
          ...COMMON_HEADERS,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 25000,
        validateStatus: (status) => status >= 200 && status < 400
      });

      if (response.data && response.data.byteLength > 100) {
        const buffer = Buffer.from(response.data);
        // Header ZIP: 'PK' (0x50, 0x4B)
        if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
          console.log(`[Viettel] Tải thành công file ZIP gốc (${(buffer.length / 1024).toFixed(1)} KB)`);
          return {
            success: true,
            zipBuffer: buffer,
            zipBase64: buffer.toString('base64'),
            filename: defaultFilename,
            contentType: 'application/zip',
            sourceUrl: ep.url
          };
        }
      }
    } catch (err: any) {
      lastError = err.message;
    }
  }

  throw new Error(`Không thể tải tệp ZIP từ Viettel: ${lastError || 'Lỗi kết nối'}`);
}
