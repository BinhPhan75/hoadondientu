import { GDTInvoice } from '../types';
import { ensureInvoiceItems } from '../utils/xmlParser';
import { 
  escapeHtml, 
  formatVND, 
  formatNum, 
  extractDateParts, 
  extractLookupDetails, 
  generateDefaultQrSvg, 
  getPrintControlsHtml,
  numberToVietnameseWords,
  buildDirectLookupUrl
} from './templateUtils';
import { RenderTemplateOptions } from './types';

export function renderDefaultTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  
  const mCode = lookupCode || invoice.lookupCode || '';
  const pUrl = lookupUrl || invoice.lookupUrl || '';
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, 'DEFAULT', invoice.nbmst);
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:${invoice.nbmst};KH:${invoice.khhdon};SHD:${invoice.shdon};MTC:${mCode}`);

  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const subTotal = invoice.tgtcthue || totalAmount;
  const vatAmount = invoice.tgtthue || (totalAmount - subTotal > 0 ? totalAmount - subTotal : 0);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const showControls = options?.showPrintControls !== false;

  const invoiceTitle = invoice.thdon || (invoice.tgtthue || invoice.vatBreakdown?.length ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG' : 'HÓA ĐƠN BÁN HÀNG');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(invoiceTitle)} - Số: ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 13px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 16px auto;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .invoice-outer { box-shadow: none !important; border: 2px solid #334155 !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 2px solid #334155;
      border-radius: 4px;
      padding: 20px 24px 16px 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      position: relative;
    }
    .header-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 10px;
    }
    .seller-side {
      flex: 1;
      padding-right: 16px;
    }
    .seller-company {
      font-size: 14.5px;
      font-weight: bold;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .meta-side {
      width: 220px;
      text-align: right;
      font-size: 12.5px;
    }
    .title-banner {
      text-align: center;
      margin: 12px 0 14px 0;
    }
    .main-title {
      font-size: 22px;
      font-weight: bold;
      color: #dc2626;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .date-str {
      font-style: italic;
      font-size: 13px;
      margin-top: 3px;
    }
    .cqt-code {
      font-style: italic;
      font-size: 12px;
      margin-top: 2px;
    }
    .buyer-panel {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 12px;
      background: #f8fafc;
      font-size: 12.5px;
      line-height: 1.45;
    }
    table.standard-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-bottom: 8px;
    }
    table.standard-table th, table.standard-table td {
      border: 1px solid #000;
      padding: 4.5px 6px;
      font-size: 12px;
    }
    table.standard-table th {
      text-align: center;
      font-weight: bold;
      background: #f1f5f9;
    }
    .col-stt { width: 36px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 60px; text-align: center; }
    .col-qty { width: 68px; text-align: right; }
    .col-price { width: 95px; text-align: right; }
    .col-amount { width: 110px; text-align: right; }
    .total-box {
      border: 1px solid #000;
      padding: 6px 10px;
      margin-bottom: 12px;
      font-size: 12.5px;
      line-height: 1.45;
    }
    .sign-row {
      display: flex;
      justify-content: space-between;
      text-align: center;
      margin-top: 12px;
      margin-bottom: 16px;
    }
    .sign-col {
      width: 45%;
    }
    .sign-title {
      font-weight: bold;
      font-size: 13px;
    }
    .sign-desc {
      font-style: italic;
      font-size: 11px;
      color: #64748b;
    }
    .sig-seal {
      margin-top: 8px;
      border: 1.5px solid #16a34a;
      border-radius: 4px;
      padding: 6px 10px;
      text-align: left;
      font-size: 11px;
      background: #f0fdf4;
      display: inline-block;
      min-width: 200px;
    }
    .sig-seal-title {
      color: #16a34a;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 2px;
    }
    .footer-bar {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 11.5px;
      text-align: center;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml(`Hóa đơn điện tử - ${escapeHtml(invoice.nbten || 'Đơn vị bán hàng')}`) : ''}

  <div class="invoice-outer">
    <!-- HEADER -->
    <div class="header-grid">
      <div class="seller-side">
        <div class="seller-company">${escapeHtml(invoice.nbten || 'ĐƠN VỊ BÁN HÀNG')}</div>
        <div>Mã số thuế: <strong>${escapeHtml(invoice.nbmst || '—')}</strong></div>
        <div>Địa chỉ: ${escapeHtml(invoice.nbdchi || '—')}</div>
        ${invoice.nbsdt ? `<div>Điện thoại: ${escapeHtml(invoice.nbsdt)}</div>` : ''}
        ${invoice.nbstk ? `<div>Số tài khoản: <strong>${escapeHtml(invoice.nbstk)} ${escapeHtml(invoice.nbnhang || '')}</strong></div>` : ''}
      </div>

      <div class="meta-side">
        <div>Ký hiệu mẫu số: <strong>${escapeHtml(invoice.khmshdon || '1')}</strong></div>
        <div>Ký hiệu: <strong>${escapeHtml(invoice.khhdon || '—')}</strong></div>
        <div>Số: <strong style="font-size:15px;color:#dc2626;">${escapeHtml(invoice.shdon || '—')}</strong></div>
        <div style="margin-top:6px;">
          <img src="${qrImg}" alt="QR" style="width:70px;height:70px;border:1px solid #ddd;padding:2px;">
        </div>
      </div>
    </div>

    <!-- TITLE -->
    <div class="title-banner">
      <div class="main-title">${escapeHtml(invoiceTitle)}</div>
      <div class="date-str">Ngày ${escapeHtml(day)} tháng ${escapeHtml(month)} năm ${escapeHtml(year)}</div>
      ${invoice.mhdon ? `<div class="cqt-code">Mã CQT: <strong>${escapeHtml(invoice.mhdon)}</strong></div>` : ''}
    </div>

    <!-- BUYER -->
    <div class="buyer-panel">
      <div>Họ tên người mua: <strong>${escapeHtml(invoice.nmten || '')}</strong></div>
      <div>Tên đơn vị: <strong>${escapeHtml(invoice.nmtendv || invoice.nmten || '—')}</strong></div>
      <div>Mã số thuế: <strong>${escapeHtml(invoice.nmmst || '—')}</strong></div>
      <div>Địa chỉ: ${escapeHtml(invoice.nmdchi || '—')}</div>
      <div style="display:flex;justify-content:space-between;margin-top:2px;">
        <div>Hình thức thanh toán: <strong>${escapeHtml(invoice.htttoan || 'TM/CK')}</strong></div>
        ${invoice.nmstk ? `<div>Số tài khoản: ${escapeHtml(invoice.nmstk)}</div>` : ''}
      </div>
    </div>

    <!-- ITEMS -->
    <table class="standard-table">
      <thead>
        <tr>
          <th class="col-stt">STT</th>
          <th class="col-name">Tên hàng hóa, dịch vụ</th>
          <th class="col-unit">ĐVT</th>
          <th class="col-qty">Số lượng</th>
          <th class="col-price">Đơn giá</th>
          <th class="col-amount">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => {
          const qty = item.quantity || item.sluong || 0;
          const price = item.unitPrice || item.dgia || 0;
          const amt = item.amount || item.thtien || (qty * price);
          const unit = item.unit || item.dvt || 'Cái';
          const name = item.itemName || item.ten || `Hàng hóa #${idx + 1}`;

          return `
            <tr>
              <td class="col-stt">${idx + 1}</td>
              <td class="col-name">${escapeHtml(name)}</td>
              <td class="col-unit">${escapeHtml(unit)}</td>
              <td class="col-qty">${formatNum(qty)}</td>
              <td class="col-price">${formatVND(price)}</td>
              <td class="col-amount">${formatVND(amt)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- TOTAL -->
    <div class="total-box">
      ${vatAmount > 0 ? `
        <div style="display:flex;justify-content:space-between;">
          <span>Cộng tiền hàng:</span>
          <strong>${formatVND(subTotal)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin:2px 0;">
          <span>Tiền thuế GTGT:</span>
          <strong>${formatVND(vatAmount)}</strong>
        </div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;font-size:13.5px;border-top:1px dashed #94a3b8;padding-top:4px;">
        <strong>Tổng cộng tiền thanh toán:</strong>
        <strong style="color:#dc2626;">${formatVND(totalAmount)}</strong>
      </div>
      <div style="margin-top:4px;font-style:italic;">
        Số tiền viết bằng chữ: <strong>${escapeHtml(wordsAmount)}</strong>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div class="sign-row">
      <div class="sign-col">
        <div class="sign-title">Người mua hàng</div>
        <div class="sign-desc">(Ký, ghi rõ họ tên)</div>
      </div>

      <div class="sign-col">
        <div class="sign-title">Người bán hàng</div>
        <div class="sign-desc">(Ký, ghi rõ họ tên)</div>
        <div class="sig-seal">
          <div class="sig-seal-title">✔ Đã ký số hợp lệ</div>
          <div>Ký bởi: <strong>${escapeHtml(invoice.nbten || 'Người bán hàng')}</strong></div>
          <div>Ký ngày: ${escapeHtml(day)}/${escapeHtml(month)}/${escapeHtml(year)}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-bar">
      ${mCode || pUrl ? `
        <div>
          ${pUrl ? `Tra cứu tại: <a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;font-weight:600;">${escapeHtml(pUrl)}</a> ` : ''}
          ${mCode ? `- Mã tra cứu: <strong>${escapeHtml(mCode)}</strong>` : ''}
          ${directLookupUrl ? ` &nbsp;<a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:2px 8px;background:#2563eb;color:#fff;border-radius:4px;font-size:11px;text-decoration:none;font-weight:600;vertical-align:middle;">Mở trang tra cứu ↗</a>` : ''}
        </div>
      ` : ''}
      <div style="font-style:italic;color:#64748b;margin-top:2px;">(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)</div>
    </div>
  </div>
</body>
</html>`;
}
