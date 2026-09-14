import { GDTInvoice } from '../types';
import { extractLookupDetailsFromXml, numberToVietnameseWords } from '../utils/xmlParser';

export { numberToVietnameseWords };

export function formatVND(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(num || 0));
}

export function formatNum(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  // Check if number has decimal part
  if (Number.isInteger(num)) {
    return new Intl.NumberFormat('vi-VN').format(num);
  }
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 3 }).format(num);
}

export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function extractDateParts(invoice: GDTInvoice) {
  const tdlap = invoice.tdlap || new Date().toISOString();
  const dateParts = tdlap.split('T')[0].split('-');
  const day = dateParts[2] ? String(dateParts[2]).padStart(2, '0') : '01';
  const month = dateParts[1] ? String(dateParts[1]).padStart(2, '0') : '01';
  const year = dateParts[0] || '2026';
  return { day, month, year, tdlap };
}

export function renderTaxCodeBoxes(taxCode: string): string {
  const digits = (taxCode || '').replace(/[^0-9A-Za-z]/g, '').split('');
  let html = '<div class="tax-code-boxes" style="display:inline-flex;align-items:center;gap:3px;vertical-align:middle;">';
  for (let i = 0; i < 14; i++) {
    const d = digits[i] || (i >= digits.length && i < 10 ? '' : '-');
    html += `<span style="display:inline-block;width:18px;height:20px;line-height:20px;text-align:center;border:1px solid #333;font-weight:bold;font-size:12px;background:#fff;">${escapeHtml(d)}</span>`;
    if (i === 9 && digits.length > 10) {
      html += `<span style="font-weight:bold;margin:0 2px;">-</span>`;
    }
  }
  html += '</div>';
  return html;
}

export function renderSpacedTaxCode(taxCode: string): string {
  const raw = (taxCode || '').replace(/[^0-9A-Za-z]/g, '');
  if (!raw) return '';
  return raw.split('').join(' ');
}

export function extractLookupDetails(rawXml?: string): { lookupCode: string; lookupUrl: string } {
  return extractLookupDetailsFromXml(rawXml);
}

/**
 * Tạo URL tra cứu trực tiếp đến hóa đơn dựa trên nhà cung cấp và mã tra cứu.
 *
 * Quy tắc tự động điền theo từng nhà cung cấp:
 * 1. MISA meInvoice (không cần captcha):
 *    - Cổng: https://www.meinvoice.vn/tra-cuu
 *    - Tham số: ?sc=[MÃ_TRA_CỨU]&code=[MÃ_TRA_CỨU]
 *    - Cơ chế hoạt động của MISA meInvoice:
 *      Khi nhận được query string có tham số ?sc=..., frontend của meinvoice.vn (hàm CheckParamQuery) sẽ:
 *      1. Tự động gán mã tra cứu vào khung nhập liệu (#txtCode): $("#txtCode").val(n.sc)
 *      2. Tự động gọi API ValidateTransactionID và kích hoạt tính năng tự mở hóa đơn (DoSearch() -> ShowSearchResultPopup)
 *      3. MISA hoàn toàn không yêu cầu nhập captcha khi tra cứu qua link trực tiếp có mã hợp lệ.
 *    - Luôn chuẩn hóa về domain https://www.meinvoice.vn/tra-cuu, tuyệt đối không lấy website người bán (như daidoanket.vn).
 *
 * 2. VNPT Invoice (yêu cầu captcha):
 *    - Cổng: https://[MST]-tt78.vnpt-invoice.com.vn
 *    - Tham số: ?strFkey=[MÃ_TRA_CỨU]
 *    - Tự động điền mã tra cứu vào ô "Mã tra cứu HĐ" (name="strFkey"), người dùng chỉ cần gõ captcha.
 *
 * 3. Softdreams EasyInvoice (yêu cầu captcha):
 *    - Cổng: http://[MST]hd.easyinvoice.com.vn/Search/Index hoặc https://tracuu.easyinvoice.vn/Search/Index
 *    - Tham số: ?fkey=[MÃ_TRA_CỨU]
 *    - Tự động điền mã tra cứu vào ô "Mã tra cứu" (id="iFkey" name="FKey"), người dùng chỉ cần gõ captcha.
 *
 * 4. 4Si / LCS (PNJ):
 *    - Cổng: https://inv.4si.vn/tra-cuu-hoa-don
 *    - Chưa lấy được mã tra cứu từ Cổng Thuế -> để trống mã tra cứu.
 */
export function buildDirectLookupUrl(
  portalUrl?: string,
  lookupCode?: string,
  providerOrTemplateId?: string,
  sellerTaxCode?: string
): string {
  let url = (portalUrl || '').trim();
  const rawCode = (lookupCode || '').trim();
  const provider = (providerOrTemplateId || '').toUpperCase();

  // Làm sạch mã tra cứu: loại bỏ tiền tố như "Mã tra cứu:", "MTC:", "Fkey:" nếu có
  let code = rawCode.replace(/^(mã\s*tra\s*cứu|mtc|mtcuu|mã\s*tc|code|fkey)[\s:=-]*/i, '').trim();

  // Nếu mã truyền vào dạng URL thì trích xuất giá trị tham số mã tra cứu
  if (/^https?:\/\//i.test(code)) {
    try {
      const u = new URL(code);
      const extracted = u.searchParams.get('sc') || u.searchParams.get('code') || u.searchParams.get('c') || u.searchParams.get('fkey');
      if (extracted) {
        code = extracted.trim();
      }
    } catch {
      // Giữ nguyên mã
    }
  }

  // 1. MISA meInvoice
  // Nếu thuộc MISA (hoặc các mẫu đối tác dùng MISA: Tài Trâm Anh, Xuân Vinh, Tân Thanh Danh),
  // hoặc URL chứa meinvoice.vn, hoặc URL bị gán nhầm domain người bán (như daidoanket.vn)
  const isMisa = provider.includes('MISA') ||
    provider.includes('TAI_TRAM_ANH') ||
    provider.includes('XUAN_VINH') ||
    provider.includes('TAN_THANH_DANH') ||
    sellerTaxCode === '0317978711' || // Tân Thanh Danh
    sellerTaxCode === '0312105174' || // Tài Trâm Anh
    sellerTaxCode === '0400557356' || // Xuân Vinh
    sellerTaxCode === '0101243150' || // MISA
    /meinvoice\.vn/i.test(url) ||
    /daidoanket\.vn/i.test(url);

  if (isMisa) {
    const baseMisaUrl = 'https://www.meinvoice.vn/tra-cuu';
    if (code) {
      // Cổng MISA meInvoice đọc tham số `sc` (Search Code / Transaction ID) trong URL.
      // Khi có `sc=...`, script của meinvoice.vn sẽ:
      // - Gán mã vào khung input #txtCode: $("#txtCode").val(n.sc)
      // - Tự động kích hoạt tìm kiếm và mở cửa sổ popup xem hóa đơn (không cần gõ captcha).
      // Bổ sung đồng thời &code= để đảm bảo khả năng tương thích toàn diện.
      return `${baseMisaUrl}?sc=${encodeURIComponent(code)}&code=${encodeURIComponent(code)}`;
    }
    return baseMisaUrl;
  }

  // 2. VNPT Invoice
  // Điền mã nhận hóa đơn vào ô name="strFkey"
  const isVnpt = provider.includes('VNPT') ||
    provider.includes('NGHIA_SON') ||
    /vnpt-invoice\.com\.vn/i.test(url);

  if (isVnpt) {
    let vnptUrl = url;
    if (!vnptUrl || !/vnpt-invoice/i.test(vnptUrl)) {
      vnptUrl = `https://${sellerTaxCode || '4000344946'}-tt78.vnpt-invoice.com.vn`;
    }
    const cleanUrl = vnptUrl.split('?')[0].replace(/\/+$/, '');
    if (code) {
      return `${cleanUrl}/?strFkey=${encodeURIComponent(code)}`;
    }
    return cleanUrl;
  }

  // 3. Softdreams EasyInvoice
  // Điền mã tra cứu vào ô id="iFkey" name="FKey" qua endpoint /Search/Index?fkey=...
  const isEasyInvoice = provider.includes('EASY') ||
    provider.includes('SOFTDREAMS') ||
    provider.includes('BAO_DUY') ||
    provider.includes('KIM_LOAN') ||
    provider.includes('TKJ') ||
    /easyinvoice/i.test(url);

  if (isEasyInvoice) {
    let easyUrl = url;
    if (!easyUrl || !/easyinvoice/i.test(easyUrl)) {
      easyUrl = sellerTaxCode
        ? `http://${sellerTaxCode}hd.easyinvoice.com.vn`
        : 'https://tracuu.easyinvoice.vn';
    }
    let cleanUrl = easyUrl.split('?')[0].replace(/\/+$/, '');
    if (!/\/Search\/Index$/i.test(cleanUrl)) {
      cleanUrl = `${cleanUrl}/Search/Index`;
    }
    if (code) {
      return `${cleanUrl}?fkey=${encodeURIComponent(code)}`;
    }
    return cleanUrl;
  }

  // 4. 4Si / LCS (PNJ)
  // Đối với nhà cung cấp 4si và 1 số nhà cung cấp chưa lấy được mã tra cứu thì để trống mã tra cứu
  const is4Si = provider.includes('4SI') || provider.includes('PNJ') || /4si\.vn/i.test(url);
  if (is4Si) {
    return 'https://inv.4si.vn/tra-cuu-hoa-don';
  }

  // 5. Viettel S-Invoice
  // Tự động điền MST người bán và Mã số bí mật vào cổng tra cứu Viettel
  if (provider.includes('VIETTEL') || /sinvoice\.viettel/i.test(url)) {
    const baseUrl = 'https://sinvoice.viettel.vn/tra-cuu-hoa-don';
    const params = new URLSearchParams();
    const cleanSellerMst = (sellerTaxCode || '').trim();
    if (cleanSellerMst) {
      params.append('supplierTaxCode', cleanSellerMst);
      params.append('taxCode', cleanSellerMst);
      params.append('mst', cleanSellerMst);
    }
    if (code) {
      params.append('reservationCode', code);
      params.append('secretCode', code);
      params.append('code', code);
    }
    const q = params.toString();
    return q ? `${baseUrl}?${q}` : baseUrl;
  }

  // 6. Bkav eHoadon
  if (provider.includes('BKAV') || /bkav|ehoadon/i.test(url)) {
    return 'https://ehoadon.bkav.com/tra-cuu';
  }

  // Mặc định: Nếu có URL thì giữ nguyên, nếu chưa có thì trỏ về Cổng HĐĐT của Tổng cục Thuế
  if (!url) {
    url = 'https://hoadondientu.gdt.gov.vn';
  }
  return url;
}

export function generateDefaultQrSvg(dataText: string = 'HOADON'): string {
  // Return an inline SVG QR placeholder if no dataUrl is provided
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="white"/><rect x="8" y="8" width="28" height="28" fill="none" stroke="black" stroke-width="4"/><rect x="16" y="16" width="12" height="12" fill="black"/><rect x="64" y="8" width="28" height="28" fill="none" stroke="black" stroke-width="4"/><rect x="72" y="16" width="12" height="12" fill="black"/><rect x="8" y="64" width="28" height="28" fill="none" stroke="black" stroke-width="4"/><rect x="16" y="72" width="12" height="12" fill="black"/><rect x="42" y="10" width="14" height="8" fill="black"/><rect x="40" y="24" width="8" height="16" fill="black"/><rect x="10" y="44" width="24" height="8" fill="black"/><rect x="44" y="42" width="16" height="16" fill="black"/><rect x="68" y="44" width="22" height="8" fill="black"/><rect x="42" y="66" width="12" height="24" fill="black"/><rect x="64" y="60" width="14" height="12" fill="black"/><rect x="82" y="66" width="10" height="24" fill="black"/></svg>`;
}

export function getPrintControlsHtml(title: string): string {
  return `
  <div class="print-actions" style="max-width:820px;margin:0 auto 16px auto;display:flex;justify-content:space-between;align-items:center;background:#1e293b;color:#fff;padding:10px 16px;border-radius:8px;font-family:sans-serif;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
      <span style="font-weight:600;font-size:13px;">${escapeHtml(title)}</span>
    </div>
    <div style="display:flex;gap:10px;">
      <button onclick="window.print()" style="background:#2563eb;color:white;border:none;padding:6px 16px;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
        🖨️ In Hóa Đơn (Ctrl + P)
      </button>
    </div>
  </div>`;
}
