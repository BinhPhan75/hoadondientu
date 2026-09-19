import axios from 'axios';
import * as cheerio from 'cheerio';
import { CaptchaSolver } from './invoice-engine/captcha/CaptchaSolver';
import { VNPT_CAPTCHA_PROMPT } from './invoice-engine/captcha/geminiCaptchaSolver';

export interface VnptOriginalInvoiceParams {
  lookupCode: string;
  sellerTaxCode?: string;
  lookupUrl?: string;
}

export interface VnptLookupResult {
  success: boolean;
  htmlContent: string;
  checkCode?: string;
  pdfDownloadUrl?: string;
  portalUrl: string;
  invoiceInfo?: {
    name?: string;
    template?: string;
    series?: string;
    number?: string;
    totalAmount?: string;
    issueDate?: string;
    status?: string;
    cqtStatus?: string;
  };
}

export async function lookupOriginalVnptInvoice(params: VnptOriginalInvoiceParams): Promise<VnptLookupResult> {
  const lookupCode = params.lookupCode.trim();
  if (!lookupCode) throw new Error('Mã tra cứu VNPT không được để trống');

  const portal = (params.lookupUrl || (params.sellerTaxCode
    ? `https://${params.sellerTaxCode}-tt78.vnpt-invoice.com.vn`
    : 'https://4000344946-tt78.vnpt-invoice.com.vn')).replace(/\/+$/, '');
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
  };

  const maxAttempts = 3;
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[VNPT] Tra cứu lần ${attempt}/${maxAttempts} (Mã tra cứu: ${lookupCode}, Cổng: ${portal})...`);

      const page = await axios.get(`${portal}/HomeNoLogin/SearchByFkey/`, {
        headers,
        timeout: 20000,
        validateStatus: status => status >= 200 && status < 400
      });
      const cookies = (page.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]).join('; ');
      const $ = cheerio.load(page.data);
      const token = $('input[name="__RequestVerificationToken"]').attr('value') || '';

      const captcha = await axios.get(`${portal}/Captcha/Show?t=${Date.now()}`, {
        headers: { ...headers, Referer: `${portal}/HomeNoLogin/SearchByFkey/`, Cookie: cookies },
        responseType: 'arraybuffer',
        timeout: 15000
      });
      const captchaCookies = (captcha.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]);
      const sessionCookie = [...cookies.split('; ').filter(Boolean), ...captchaCookies]
        .filter((cookie, index, all) => all.findIndex(item => item.split('=')[0] === cookie.split('=')[0]) === index)
        .join('; ');

      const captchaCode = (await CaptchaSolver.solveWithDetails(Buffer.from(captcha.data), {
        prompt: VNPT_CAPTCHA_PROMPT
      })).code;

      console.log(`[VNPT] Lần ${attempt}: Giải Captcha thành công = "${captchaCode}"`);

      const form = new URLSearchParams({
        __RequestVerificationToken: token,
        strFkey: lookupCode,
        captch: captchaCode,
        submit: ''
      });
      const result = await axios.post(`${portal}/HomeNoLogin/SearchByFkey`, form.toString(), {
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
          Cookie: sessionCookie
        },
        maxRedirects: 5,
        timeout: 30000,
        responseType: 'text',
        validateStatus: status => status >= 200 && status < 400
      });

      const html = String(result.data || '');
      const isCaptchaError = /captcha|mã xác thực không đúng|sai mã xác thực|không chính xác/i.test(html) && !/invoice|hóa đơn|hoadon/i.test(html);
      if (isCaptchaError) {
        lastError = 'VNPT báo sai mã xác thực Captcha.';
        console.warn(`[VNPT] Lần ${attempt} thất bại: ${lastError} Đang thử lại với ảnh Captcha mới...`);
        continue;
      }

      const postCookies = (result.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]);
      const finalCookies = [...sessionCookie.split('; ').filter(Boolean), ...postCookies]
        .filter((cookie, index, all) => all.findIndex(item => item.split('=')[0] === cookie.split('=')[0]) === index)
        .join('; ');

      const $search = cheerio.load(html);

      // Trích xuất checkCode từ nút "Thao tác" (onclick ajxCall4Portal) hoặc nút "Tải file" (href downloadPDF)
      let checkCode = '';
      const onclickAttr = $search('a[onclick*="ajxCall4Portal"]').attr('onclick') || '';
      const matchOnclick = onclickAttr.match(/ajxCall4Portal\(\s*['"]([^'"]+)['"]/);
      if (matchOnclick) {
        checkCode = matchOnclick[1];
      }

      if (!checkCode) {
        const downloadHref = $search('a[href*="downloadPDF"]').attr('href') || '';
        const matchHref = downloadHref.match(/checkCode=([^&"']+)/);
        if (matchHref) {
          checkCode = decodeURIComponent(matchHref[1]);
        }
      }

      // Trích xuất thông tin tóm tắt hóa đơn từ dòng kết quả
      let invoiceInfo: VnptLookupResult['invoiceInfo'] = undefined;
      const firstRow = $search('table tr').filter((_, tr) => $search(tr).find('td').length >= 5).first();
      if (firstRow.length > 0) {
        const tds = firstRow.find('td');
        invoiceInfo = {
          name: $search(tds[1]).text().trim(),
          template: $search(tds[2]).text().trim(),
          series: $search(tds[3]).text().trim(),
          number: $search(tds[4]).text().trim(),
          totalAmount: $search(tds[5]).text().trim(),
          issueDate: $search(tds[6]).text().trim(),
          status: $search(tds[7]).text().trim(),
          cqtStatus: $search(tds[8]).text().trim()
        };
      }

      // BƯỚC 2: Tự động gọi API xem hóa đơn gốc ajxPreview với checkCode vừa trích xuất
      if (checkCode) {
        console.log(`[VNPT] Lấy được checkCode = "${checkCode}". Đang gọi /HomeNoLogin/ajxPreview/ để tải bản thể hiện gốc...`);
        try {
          const previewPayload = new URLSearchParams({
            checkCode: checkCode,
            fkey: lookupCode,
            nameCus: ''
          });

          const previewRes = await axios.post(`${portal}/HomeNoLogin/ajxPreview/`, previewPayload.toString(), {
            headers: {
              ...headers,
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
              Cookie: finalCookies
            },
            timeout: 30000
          });

          if (previewRes.data && previewRes.data.str && previewRes.data.str.length > 500) {
            let fullInvoiceHtml = String(previewRes.data.str);
            // Đảm bảo thẻ <base> để tải đúng ảnh logo/tài nguyên tương đối nếu có
            if (!/<base /i.test(fullInvoiceHtml)) {
              if (/<head([^>]*)>/i.test(fullInvoiceHtml)) {
                fullInvoiceHtml = fullInvoiceHtml.replace(/<head([^>]*)>/i, `<head$1><base href="${portal}/">`);
              } else {
                fullInvoiceHtml = `<base href="${portal}/">\n` + fullInvoiceHtml;
              }
            }

            console.log(`[VNPT] Tải bản thể hiện gốc hóa đơn thành công! Độ dài HTML: ${fullInvoiceHtml.length}`);
            return {
              success: true,
              htmlContent: fullInvoiceHtml,
              checkCode,
              pdfDownloadUrl: `/api/vnpt/download-pdf?portal=${encodeURIComponent(portal)}&checkCode=${encodeURIComponent(checkCode)}&fkey=${encodeURIComponent(lookupCode)}`,
              portalUrl: portal,
              invoiceInfo
            };
          }
        } catch (previewErr: any) {
          console.warn('[VNPT] Lỗi khi gọi ajxPreview:', previewErr.message);
        }
      }

      // Nếu không trích xuất được checkCode hoặc ajxPreview không trả về chuỗi str, kiểm tra HTML trang tìm kiếm
      if (!html || (!/invoice|hóa đơn|hoadon/i.test(html) && html.length < 500)) {
        lastError = 'Cổng VNPT không trả về bản gốc hóa đơn hoặc mã tra cứu không tồn tại.';
        console.warn(`[VNPT] Lần ${attempt} không có nội dung HĐ: ${lastError}`);
        continue;
      }

      // Fallback: trả về trang tìm kiếm với base href đã được chèn
      return {
        success: true,
        htmlContent: html.replace(/<head([^>]*)>/i, `<head$1><base href="${portal}/">`),
        checkCode: checkCode || undefined,
        pdfDownloadUrl: checkCode
          ? `/api/vnpt/download-pdf?portal=${encodeURIComponent(portal)}&checkCode=${encodeURIComponent(checkCode)}&fkey=${encodeURIComponent(lookupCode)}`
          : undefined,
        portalUrl: portal,
        invoiceInfo
      };
    } catch (err: any) {
      lastError = err.message || String(err);
      console.warn(`[VNPT] Lỗi tra cứu lần ${attempt}:`, lastError);
    }
  }

  throw new Error(`Tra cứu hóa đơn gốc VNPT thất bại: ${lastError || 'VNPT từ chối mã Captcha hoặc không trả về bản gốc hóa đơn.'}`);
}

export async function downloadOriginalVnptPdf(params: {
  portalUrl?: string;
  checkCode?: string;
  lookupCode: string;
  sellerTaxCode?: string;
  invoiceNumber?: string;
}): Promise<{ data: Buffer; filename: string; contentType: string }> {
  let portal = params.portalUrl || (params.sellerTaxCode
    ? `https://${params.sellerTaxCode}-tt78.vnpt-invoice.com.vn`
    : 'https://4000344946-tt78.vnpt-invoice.com.vn');
  portal = portal.replace(/\/+$/, '');

  let checkCode = (params.checkCode && params.checkCode !== 'undefined' && params.checkCode !== 'null')
    ? params.checkCode.trim()
    : undefined;
  const lookupCode = params.lookupCode.trim();

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
    Referer: `${portal}/HomeNoLogin/SearchByFkey/`
  };

  let validPdfBuffer: Buffer | null = null;

  // 1. Nếu có checkCode sẵn (ví dụ vừa mở xem bản gốc), thử tải nhanh bằng checkCode này
  if (checkCode) {
    const pdfUrl = `${portal}/HomeNoLogin/downloadPDF?checkCode=${encodeURIComponent(checkCode)}&fkey=${encodeURIComponent(lookupCode)}`;
    console.log(`[VNPT] Đang thử tải file PDF gốc bằng checkCode có sẵn: ${pdfUrl}`);
    try {
      const res = await axios.get(pdfUrl, {
        headers,
        responseType: 'arraybuffer',
        timeout: 25000,
        validateStatus: (s) => s === 200
      });
      if (res.data && res.data.byteLength > 1000) {
        const tempBuf = Buffer.from(res.data);
        if (tempBuf.slice(0, 5).toString().startsWith('%PDF')) {
          validPdfBuffer = tempBuf;
          console.log(`[VNPT] Tải thành công PDF gốc bằng checkCode có sẵn (${validPdfBuffer.length} bytes)`);
        } else {
          console.warn(`[VNPT] Dữ liệu tải về từ checkCode có sẵn không phải định dạng PDF (bắt đầu bằng: "${tempBuf.slice(0, 20).toString()}"). Sẽ tra cứu lại.`);
        }
      } else {
        console.warn(`[VNPT] checkCode có sẵn trả về file rỗng (${res.data ? res.data.byteLength : 0} bytes). Sẽ tra cứu lại với Captcha mới.`);
      }
    } catch (err: any) {
      console.warn(`[VNPT] Không thể tải bằng checkCode có sẵn: ${err.message}. Đang chuẩn bị tra cứu lại.`);
    }
  }

  // 2. Nếu chưa có checkCode hoặc checkCode cũ đã hết hạn / trả về file rỗng:
  // Tự động giải Captcha và thực hiện tra cứu mới trên cổng VNPT để lấy checkCode mới
  if (!validPdfBuffer) {
    console.log(`[VNPT] Đang thực hiện tra cứu tự động trên cổng ${portal} (Mã tra cứu: ${lookupCode}) để lấy checkCode mới...`);
    const lookupRes = await lookupOriginalVnptInvoice({
      lookupCode,
      sellerTaxCode: params.sellerTaxCode,
      lookupUrl: portal
    });

    if (!lookupRes.checkCode) {
      throw new Error('Không thể tìm thấy mã kiểm tra hóa đơn (checkCode) trên cổng VNPT sau khi giải Captcha.');
    }

    const freshPdfUrl = `${portal}/HomeNoLogin/downloadPDF?checkCode=${encodeURIComponent(lookupRes.checkCode)}&fkey=${encodeURIComponent(lookupCode)}`;
    console.log(`[VNPT] Đang tải file PDF gốc bằng checkCode mới: ${freshPdfUrl}`);

    const res = await axios.get(freshPdfUrl, {
      headers,
      responseType: 'arraybuffer',
      timeout: 30000,
      validateStatus: (s) => s === 200
    });

    if (res.data && res.data.byteLength > 1000) {
      const tempBuf = Buffer.from(res.data);
      if (tempBuf.slice(0, 5).toString().startsWith('%PDF')) {
        validPdfBuffer = tempBuf;
        console.log(`[VNPT] Tải thành công PDF gốc bằng checkCode mới (${validPdfBuffer.length} bytes)`);
      }
    }
  }

  if (!validPdfBuffer || validPdfBuffer.length === 0 || !validPdfBuffer.slice(0, 5).toString().startsWith('%PDF')) {
    throw new Error('Cổng VNPT không trả về tệp PDF hợp lệ cho hóa đơn này (tệp bị rỗng hoặc lỗi phân quyền).');
  }

  const cleanShd = params.invoiceNumber 
    ? String(params.invoiceNumber).padStart(7, '0') 
    : lookupCode.slice(0, 16);

  return {
    data: validPdfBuffer,
    filename: `HoaDon_VNPT_${cleanShd}.pdf`,
    contentType: 'application/pdf'
  };
}
