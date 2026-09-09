import { GDTInvoice } from '../types';
import { numberToVietnameseWords } from '../utils/xmlParser';

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
  let lookupCode = '';
  let lookupUrl = '';

  if (!rawXml) return { lookupCode, lookupUrl };

  const codePatterns = [
    /<(?:[a-zA-Z0-9_]+:)?(?:MaTraCuu|Matracuu|MTC|LookupCode|SecretCode)(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?(?:MaTraCuu|Matracuu|MTC|LookupCode|SecretCode)>/i,
    /Mã tra cứu\s*[:：]\s*([A-Za-z0-9_-]+)/i,
    /Mã nhận hóa đơn\s*[:：]\s*([A-Za-z0-9_-]+)/i,
    /tra-cuu[?\/=]([A-Za-z0-9_-]{6,30})/i
  ];

  for (const p of codePatterns) {
    const m = rawXml.match(p);
    if (m && m[1]) {
      const val = m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      if (val && val.length >= 4) {
        lookupCode = val;
        break;
      }
    }
  }

  const urlPatterns = [
    /https?:\/\/[a-zA-Z0-9\.\-]+\/tra-cuu[^\s<>"']*/i,
    /https?:\/\/[a-zA-Z0-9\.\-]+(?:meinvoice\.vn|sinvoice\.viettel\.vn|easyinvoice\.com\.vn|4si\.vn|vnpt-invoice)[^\s<>"']*/i,
    /<(?:[a-zA-Z0-9_]+:)?(?:LinkTraCuu|WebsiteTraCuu|PortalUrl)(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?(?:LinkTraCuu|WebsiteTraCuu|PortalUrl)>/i
  ];

  for (const p of urlPatterns) {
    const m = rawXml.match(p);
    if (m) {
      lookupUrl = (m[1] || m[0]).replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      break;
    }
  }

  return { lookupCode, lookupUrl };
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
