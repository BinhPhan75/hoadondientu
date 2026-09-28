import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';
import { CaptchaSolver } from './invoice-engine/captcha/CaptchaSolver';
import { VNPT_CAPTCHA_PROMPT } from './invoice-engine/captcha/geminiCaptchaSolver';

export interface VnptOriginalInvoiceParams {
  lookupCode: string;
  sellerTaxCode?: string;
  lookupUrl?: string;
  forceRefresh?: boolean;
}

export interface VnptLookupResult {
  success: boolean;
  htmlContent: string;
  checkCode?: string;
  pdfDownloadUrl?: string;
  portalUrl: string;
  isCached?: boolean;
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

export interface VnptCacheEntry {
  htmlContent: string;
  checkCode: string;
  portalUrl: string;
  pdfBuffer?: Buffer;
  cookies: string;
  invoiceInfo?: VnptLookupResult['invoiceInfo'];
  cachedAt: number;
}

// 1. Connection pooling HTTP Agent để tái sử dụng socket và giảm thời gian TLS handshake
const vnptHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 30,
  keepAliveMsecs: 30000,
});

const vnptClient = axios.create({
  httpsAgent: vnptHttpsAgent,
  timeout: 25000,
});

// 2. Bộ nhớ đệm toàn cục cho hóa đơn VNPT (tránh gọi lại AI và VNPT nhiều lần)
const vnptInvoiceCache = new Map<string, VnptCacheEntry>();
const inFlightLookups = new Map<string, Promise<VnptLookupResult>>();

export function getVnptCacheKey(sellerTaxCode?: string, lookupCode?: string, portalUrl?: string): string {
  const cleanMst = (sellerTaxCode || '').trim().replace(/[^0-9\-]/g, '');
  const cleanCode = (lookupCode || '').trim().replace(/^(mã\s*tra\s*cứu|mtc|mtcuu|mã\s*tc|code|fkey)[\s:=-]*/i, '').trim();
  let portalBase = (portalUrl || '').trim().replace(/\/+$/, '').replace(/\/HomeNoLogin\/SearchByFkey\/?$/i, '');
  if (!portalBase) {
    portalBase = cleanMst ? `https://${cleanMst}-tt78.vnpt-invoice.com.vn` : 'https://4000344946-tt78.vnpt-invoice.com.vn';
  }
  return `${portalBase}|${cleanCode}`;
}

export function getCachedVnptInvoice(sellerTaxCode?: string, lookupCode?: string, portalUrl?: string): VnptCacheEntry | null {
  const key = getVnptCacheKey(sellerTaxCode, lookupCode, portalUrl);
  const entry = vnptInvoiceCache.get(key);
  if (!entry) return null;
  // TTL 2 giờ (hóa đơn đã ký số là bất biến)
  if (Date.now() - entry.cachedAt > 2 * 60 * 60 * 1000) {
    vnptInvoiceCache.delete(key);
    return null;
  }
  return entry;
}

export function setCachedVnptInvoice(sellerTaxCode: string | undefined, lookupCode: string | undefined, portalUrl: string | undefined, entry: VnptCacheEntry): void {
  const key = getVnptCacheKey(sellerTaxCode, lookupCode, portalUrl);
  vnptInvoiceCache.set(key, entry);
}

/**
 * Tra cứu và tải bản thể hiện gốc VNPT tốc độ cao
 */
export async function lookupOriginalVnptInvoice(params: VnptOriginalInvoiceParams): Promise<VnptLookupResult> {
  const lookupCode = params.lookupCode.trim().replace(/^(mã\s*tra\s*cứu|mtc|mtcuu|mã\s*tc|code|fkey)[\s:=-]*/i, '').trim();
  if (!lookupCode) throw new Error('Mã tra cứu VNPT không được để trống');

  const portal = (params.lookupUrl || (params.sellerTaxCode
    ? `https://${params.sellerTaxCode}-tt78.vnpt-invoice.com.vn`
    : 'https://4000344946-tt78.vnpt-invoice.com.vn')).replace(/\/+$/, '');

  const cacheKey = getVnptCacheKey(params.sellerTaxCode, lookupCode, portal);

  // 1. Kiểm tra cache trước: Trả về ngay trong 0ms nếu đã có
  if (!params.forceRefresh) {
    const cached = getCachedVnptInvoice(params.sellerTaxCode, lookupCode, portal);
    if (cached && cached.htmlContent) {
      console.log(`[VNPT Speed] Trả về từ Cache tức thì cho mã: ${lookupCode}`);
      return {
        success: true,
        htmlContent: cached.htmlContent,
        checkCode: cached.checkCode,
        pdfDownloadUrl: `/api/vnpt/download-pdf?portal=${encodeURIComponent(portal)}&checkCode=${encodeURIComponent(cached.checkCode)}&fkey=${encodeURIComponent(lookupCode)}`,
        portalUrl: portal,
        isCached: true,
        invoiceInfo: cached.invoiceInfo
      };
    }
  }

  // 2. Chống lặp tác vụ (in-flight de-duplication): nếu đang có request cùng mã đang chạy, dùng chung Promise
  if (inFlightLookups.has(cacheKey)) {
    console.log(`[VNPT Speed] Tái sử dụng tiến trình tra cứu đang chạy cho mã: ${lookupCode}`);
    return inFlightLookups.get(cacheKey)!;
  }

  const lookupPromise = (async () => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    };

    const maxAttempts = 2;
    let lastError = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const t0 = Date.now();
        console.log(`[VNPT] Bắt đầu tra cứu tối ưu lần ${attempt}/${maxAttempts} (Mã: ${lookupCode}, Cổng: ${portal})...`);

        // Bước 1: Tải trang tìm kiếm để lấy token xác thực & cookie ban đầu
        const page = await vnptClient.get(`${portal}/HomeNoLogin/SearchByFkey/`, {
          headers,
          timeout: 10000,
          validateStatus: status => status >= 200 && status < 400
        });
        const cookies = (page.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]).join('; ');
        const $ = cheerio.load(page.data);
        const token = $('input[name="__RequestVerificationToken"]').attr('value') || '';

        // Bước 2: Lấy ảnh Captcha với cookie phiên
        const captcha = await vnptClient.get(`${portal}/Captcha/Show?t=${Date.now()}`, {
          headers: { ...headers, Referer: `${portal}/HomeNoLogin/SearchByFkey/`, Cookie: cookies },
          responseType: 'arraybuffer',
          timeout: 10000
        });
        const captchaCookies = (captcha.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]);
        const sessionCookie = [...cookies.split('; ').filter(Boolean), ...captchaCookies]
          .filter((cookie, index, all) => all.findIndex(item => item.split('=')[0] === cookie.split('=')[0]) === index)
          .join('; ');

        // Bước 3: Giải mã Captcha bằng model AI tốc độ cao
        const tAiStart = Date.now();
        const captchaCode = (await CaptchaSolver.solveWithDetails(Buffer.from(captcha.data), {
          prompt: VNPT_CAPTCHA_PROMPT
        })).code;
        console.log(`[VNPT Speed] Giải Captcha trong ${Date.now() - tAiStart}ms: "${captchaCode}"`);

        // Bước 4: POST tìm kiếm
        const form = new URLSearchParams({
          __RequestVerificationToken: token,
          strFkey: lookupCode,
          captch: captchaCode,
          submit: ''
        });

        const result = await vnptClient.post(`${portal}/HomeNoLogin/SearchByFkey`, form.toString(), {
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
            Cookie: sessionCookie
          },
          maxRedirects: 5,
          timeout: 20000,
          responseType: 'text',
          validateStatus: status => status >= 200 && status < 400
        });

        const html = String(result.data || '');
        const isCaptchaError = /captcha|mã xác thực không đúng|sai mã xác thực|không chính xác/i.test(html) && !/invoice|hóa đơn|hoadon/i.test(html);
        if (isCaptchaError) {
          lastError = 'VNPT báo sai mã xác thực Captcha.';
          console.warn(`[VNPT] Lần ${attempt} sai Captcha, đang thử lại với ảnh mới...`);
          continue;
        }

        const postCookies = (result.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]);
        const finalCookies = [...sessionCookie.split('; ').filter(Boolean), ...postCookies]
          .filter((cookie, index, all) => all.findIndex(item => item.split('=')[0] === cookie.split('=')[0]) === index)
          .join('; ');

        const $search = cheerio.load(html);

        // Trích xuất checkCode
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

        // Bước 5: Chạy SONG SONG cả ajxPreview (xem HTML) VÀ downloadPDF (tải PDF) bằng Promise.all
        let fullInvoiceHtml = '';
        let prefetchedPdfBuffer: Buffer | undefined = undefined;

        if (checkCode) {
          const previewPayload = new URLSearchParams({
            checkCode: checkCode,
            fkey: lookupCode,
            nameCus: ''
          });

          const previewPromise = vnptClient.post(`${portal}/HomeNoLogin/ajxPreview/`, previewPayload.toString(), {
            headers: {
              ...headers,
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
              Cookie: finalCookies
            },
            timeout: 20000
          });

          const pdfDownloadUrl = `${portal}/HomeNoLogin/downloadPDF?checkCode=${encodeURIComponent(checkCode)}&fkey=${encodeURIComponent(lookupCode)}`;
          const pdfPromise = vnptClient.get(pdfDownloadUrl, {
            headers: {
              ...headers,
              Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
              Cookie: finalCookies
            },
            responseType: 'arraybuffer',
            timeout: 20000
          });

          const [previewRes, pdfRes] = await Promise.allSettled([previewPromise, pdfPromise]);

          if (previewRes.status === 'fulfilled' && previewRes.value.data?.str) {
            fullInvoiceHtml = String(previewRes.value.data.str);
            if (!/<base /i.test(fullInvoiceHtml)) {
              if (/<head([^>]*)>/i.test(fullInvoiceHtml)) {
                fullInvoiceHtml = fullInvoiceHtml.replace(/<head([^>]*)>/i, `<head$1><base href="${portal}/">`);
              } else {
                fullInvoiceHtml = `<base href="${portal}/">\n` + fullInvoiceHtml;
              }
            }
          }

          if (pdfRes.status === 'fulfilled' && pdfRes.value.data) {
            const buf = Buffer.from(pdfRes.value.data);
            if (buf.length > 1000 && buf.slice(0, 5).toString().startsWith('%PDF')) {
              prefetchedPdfBuffer = buf;
              console.log(`[VNPT Speed] Đã nạp sẵn file PDF gốc (${buf.length} bytes) vào cache song song với HTML!`);
            }
          }
        }

        if (!fullInvoiceHtml) {
          fullInvoiceHtml = html.replace(/<head([^>]*)>/i, `<head$1><base href="${portal}/">`);
        }

        // Lưu vào Cache bộ nhớ
        const cacheEntry: VnptCacheEntry = {
          htmlContent: fullInvoiceHtml,
          checkCode: checkCode || '',
          portalUrl: portal,
          pdfBuffer: prefetchedPdfBuffer,
          cookies: finalCookies,
          invoiceInfo,
          cachedAt: Date.now()
        };
        setCachedVnptInvoice(params.sellerTaxCode, lookupCode, portal, cacheEntry);

        console.log(`[VNPT Speed] Hoàn tất tra cứu tổng cộng trong ${Date.now() - t0}ms!`);

        return {
          success: true,
          htmlContent: fullInvoiceHtml,
          checkCode: checkCode || undefined,
          pdfDownloadUrl: checkCode
            ? `/api/vnpt/download-pdf?portal=${encodeURIComponent(portal)}&checkCode=${encodeURIComponent(checkCode)}&fkey=${encodeURIComponent(lookupCode)}`
            : undefined,
          portalUrl: portal,
          isCached: false,
          invoiceInfo
        };
      } catch (err: any) {
        lastError = err.message || String(err);
        console.warn(`[VNPT] Lỗi tra cứu lần ${attempt}:`, lastError);
      }
    }

    throw new Error(`Tra cứu hóa đơn gốc VNPT thất bại: ${lastError || 'VNPT từ chối mã Captcha hoặc không trả về bản gốc hóa đơn.'}`);
  })();

  inFlightLookups.set(cacheKey, lookupPromise);
  try {
    return await lookupPromise;
  } finally {
    inFlightLookups.delete(cacheKey);
  }
}

/**
 * Tải file PDF hóa đơn gốc VNPT với tốc độ siêu nhanh (phục vụ từ bộ nhớ đệm hoặc phiên cookie có sẵn)
 */
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

  const lookupCode = params.lookupCode.trim().replace(/^(mã\s*tra\s*cứu|mtc|mtcuu|mã\s*tc|code|fkey)[\s:=-]*/i, '').trim();
  const cleanShd = params.invoiceNumber 
    ? String(params.invoiceNumber).padStart(7, '0') 
    : lookupCode.slice(0, 16);

  // 1. Kiểm tra cache: Nếu PDF đã được nạp sẵn khi xem bản gốc -> trả về ngay lập tức (0ms)
  const cached = getCachedVnptInvoice(params.sellerTaxCode, lookupCode, portal);
  if (cached?.pdfBuffer && cached.pdfBuffer.length > 1000) {
    console.log(`[VNPT Speed] Trả về PDF gốc từ bộ nhớ đệm (0ms delay)!`);
    return {
      data: cached.pdfBuffer,
      filename: `HoaDon_VNPT_${cleanShd}.pdf`,
      contentType: 'application/pdf'
    };
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
    Referer: `${portal}/HomeNoLogin/SearchByFkey/`
  };

  let validPdfBuffer: Buffer | null = null;

  // 2. Nếu đã có checkCode và cookies trong session cached -> tải trực tiếp siêu nhanh (khoảng 200ms)
  const checkCode = (params.checkCode && params.checkCode !== 'undefined' && params.checkCode !== 'null')
    ? params.checkCode.trim()
    : cached?.checkCode;

  const cookies = cached?.cookies || '';

  if (checkCode && cookies) {
    const pdfUrl = `${portal}/HomeNoLogin/downloadPDF?checkCode=${encodeURIComponent(checkCode)}&fkey=${encodeURIComponent(lookupCode)}`;
    console.log(`[VNPT Speed] Tải PDF trực tiếp bằng checkCode và cookies có sẵn: ${pdfUrl}`);
    try {
      const res = await vnptClient.get(pdfUrl, {
        headers: { ...headers, Cookie: cookies },
        responseType: 'arraybuffer',
        timeout: 15000,
        validateStatus: (s) => s === 200
      });
      if (res.data && res.data.byteLength > 1000) {
        const tempBuf = Buffer.from(res.data);
        if (tempBuf.slice(0, 5).toString().startsWith('%PDF')) {
          validPdfBuffer = tempBuf;
          // Lưu vào cache cho các lần tải tiếp theo
          if (cached) cached.pdfBuffer = tempBuf;
          console.log(`[VNPT Speed] Tải nhanh PDF thành công (${validPdfBuffer.length} bytes)!`);
        }
      }
    } catch (err: any) {
      console.warn(`[VNPT] Không thể tải bằng cookies có sẵn: ${err.message}.`);
    }
  }

  // 3. Nếu chưa có PDF trong cache -> thực hiện quy trình tra cứu tự động và nạp cache song song
  if (!validPdfBuffer) {
    console.log(`[VNPT Speed] Chưa có PDF trong cache, kích hoạt tra cứu nhanh để lấy PDF...`);
    const lookupRes = await lookupOriginalVnptInvoice({
      lookupCode,
      sellerTaxCode: params.sellerTaxCode,
      lookupUrl: portal
    });

    const refreshedCache = getCachedVnptInvoice(params.sellerTaxCode, lookupCode, portal);
    if (refreshedCache?.pdfBuffer && refreshedCache.pdfBuffer.length > 1000) {
      validPdfBuffer = refreshedCache.pdfBuffer;
    } else if (lookupRes.checkCode) {
      // Tải lại với checkCode và cookies vừa thu được
      const finalCookies = refreshedCache?.cookies || '';
      const freshPdfUrl = `${portal}/HomeNoLogin/downloadPDF?checkCode=${encodeURIComponent(lookupRes.checkCode)}&fkey=${encodeURIComponent(lookupCode)}`;
      const res = await vnptClient.get(freshPdfUrl, {
        headers: { ...headers, Cookie: finalCookies },
        responseType: 'arraybuffer',
        timeout: 20000,
        validateStatus: (s) => s === 200
      });
      if (res.data && res.data.byteLength > 1000) {
        const tempBuf = Buffer.from(res.data);
        if (tempBuf.slice(0, 5).toString().startsWith('%PDF')) {
          validPdfBuffer = tempBuf;
          if (refreshedCache) refreshedCache.pdfBuffer = tempBuf;
        }
      }
    }
  }

  if (!validPdfBuffer || validPdfBuffer.length === 0 || !validPdfBuffer.slice(0, 5).toString().startsWith('%PDF')) {
    throw new Error('Cổng VNPT không trả về tệp PDF hợp lệ cho hóa đơn này.');
  }

  return {
    data: validPdfBuffer,
    filename: `HoaDon_VNPT_${cleanShd}.pdf`,
    contentType: 'application/pdf'
  };
}
