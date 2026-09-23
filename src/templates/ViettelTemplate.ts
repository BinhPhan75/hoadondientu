import { GDTInvoice } from '../types';
import { RenderTemplateOptions } from './types';
import {
  escapeHtml,
  extractDateParts,
  extractLookupDetails,
  formatNum,
  formatVND,
  numberToVietnameseWords,
  buildDirectLookupUrl
} from './templateUtils';
import { ensureInvoiceItems } from '../utils/xmlParser';

export function renderViettelTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  const mCode = lookupCode || invoice.lookupCode || '';
  const pUrl = lookupUrl || invoice.lookupUrl || 'https://vinvoice.viettel.vn/utilities/invoice-search';
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, 'VIETTEL', invoice.nbmst);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const maCqt = invoice.mhdon || '0024A998811234F9004B2C89';
  const items = ensureInvoiceItems(invoice);
  const showControls = options?.showPrintControls !== false;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN ĐIỆN TỬ - VIETTEL S-INVOICE - ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f1f5f9;
      margin: 0;
      padding: 16px;
      color: #111;
      font-size: 12.5px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #991b1b;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
    }
    .print-btn {
      background: #dc2626;
      color: white;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .viettel-wrapper {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 1.5px solid #ee0033;
      padding: 24px 28px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      position: relative;
    }
    .viettel-top-bar {
      height: 4px;
      background: #ee0033;
      margin: -24px -28px 16px -28px;
    }
    .viettel-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #ee0033;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .v-seller-col { width: 58%; }
    .v-title-col { width: 40%; text-align: right; }
    .v-title {
      color: #ee0033;
      font-size: 18px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .viettel-lookup-box {
      background: #fef2f2;
      border: 1px dashed #f87171;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
    }
    table.viettel-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #ee0033;
      margin-bottom: 12px;
    }
    table.viettel-table th, table.viettel-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      font-size: 12px;
    }
    table.viettel-table th {
      background: #fff1f2;
      color: #9f1239;
      font-weight: bold;
      text-align: center;
      border: 1px solid #fda4af;
    }
    .viettel-stamp {
      border: 1.5px solid #ee0033;
      background: #fff5f5;
      padding: 8px 12px;
      display: inline-block;
      text-align: left;
      border-radius: 4px;
      font-size: 11px;
    }
    .viettel-footer {
      border-top: 1px solid #ee0033;
      padding-top: 8px;
      font-size: 11px;
      text-align: center;
      color: #475569;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .viettel-wrapper { border: 1px solid #ee0033; box-shadow: none; width: 100%; max-width: 100%; padding: 12px 16px; }
    }
  </style>
</head>
<body>
  ${showControls ? `
  <div class="print-actions">
    <div>
      <span style="font-weight: bold; color: #fca5a5;">[Giao diện Viettel S-Invoice]</span>
      <span style="font-size: 12px; color: #fecaca; margin-left: 8px;">Mã số bí mật: ${escapeHtml(mCode)}</span>
    </div>
    <button class="print-btn" onclick="window.print()">In Hóa Đơn (A4)</button>
  </div>
  ` : ''}

  <div class="viettel-wrapper">
    <div class="viettel-top-bar"></div>

    <div class="viettel-header">
      <div class="v-seller-col">
        <div style="font-size: 16px; font-weight: bold; color: #ee0033;">${escapeHtml(invoice.nbten)}</div>
        <div>Mã số thuế: <b>${escapeHtml(invoice.nbmst)}</b></div>
        <div>Địa chỉ: ${escapeHtml(invoice.nbdchi)}</div>
        ${invoice.stknh ? `<div>Tài khoản: <b>${escapeHtml(invoice.stknh)}</b> tại ${escapeHtml(invoice.tnhanh || '')}</div>` : ''}
      </div>
      <div class="v-title-col">
        <div class="v-title">${escapeHtml(invoice.thdon || 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG')}</div>
        <div style="font-style: italic; margin-bottom: 4px;">Ngày ${day} tháng ${month} năm ${year}</div>
        <div>Mã CQT: <b style="font-family: monospace;">${escapeHtml(maCqt)}</b></div>
        <div>Ký hiệu: <b>${escapeHtml(invoice.khhdon)}</b></div>
        <div>Số: <b style="color: #ee0033; font-size: 15px;">${escapeHtml(invoice.shdon)}</b></div>
      </div>
    </div>

    <div class="viettel-lookup-box">
      <div>
        <span>MST Bên bán: <b>${escapeHtml(invoice.nbmst)}</b></span>
        <span style="margin: 0 8px;">|</span>
        <span>Tra cứu tại: <a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color: #ee0033; font-weight: bold; text-decoration: underline;">${escapeHtml(pUrl)}</a></span>
      </div>
      <div>
        Mã số bí mật: <b style="font-family: monospace; color: #991b1b; font-size: 13px;">${escapeHtml(mCode || '—')}</b>
      </div>
    </div>

    <!-- THÔNG TIN NGƯỜI MUA -->
    <div style="margin-bottom: 12px; font-size: 12px; line-height: 1.6;">
      <div>Tên đơn vị: <b>${escapeHtml(invoice.nmtendv || invoice.nmten || 'Khách hàng không lấy hóa đơn')}</b></div>
      ${invoice.nmten && invoice.nmtendv ? `<div>Người mua: ${escapeHtml(invoice.nmten)}</div>` : ''}
      <div>Mã số thuế: <b>${escapeHtml(invoice.nmmst || '—')}</b></div>
      <div>Địa chỉ: ${escapeHtml(invoice.nmdchi || '—')}</div>
      <div>Hình thức thanh toán: <b>${escapeHtml(invoice.htttoan || 'TM/CK')}</b></div>
    </div>

    <!-- BẢNG HÀNG HÓA -->
    <table class="viettel-table">
      <thead>
        <tr>
          <th style="width: 5%;">STT</th>
          <th style="width: 40%;">Tên hàng hóa, dịch vụ</th>
          <th style="width: 10%;">ĐVT</th>
          <th style="width: 10%;">Số lượng</th>
          <th style="width: 12%;">Đơn giá</th>
          <th style="width: 8%;">Thuế</th>
          <th style="width: 15%;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => {
          const name = it.itemName || it.ten || (it as any).name || '';
          const unit = it.unit || it.dvt || '';
          const qty = it.quantity ?? it.sluong ?? 0;
          const price = it.unitPrice ?? it.dgia ?? 0;
          const rate = it.taxRate ?? it.tsuat ?? '8%';
          const total = it.amount ?? it.thtien ?? (it as any).total ?? (qty * price);
          return `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td>${escapeHtml(name)}</td>
            <td style="text-align: center;">${escapeHtml(unit)}</td>
            <td style="text-align: right; font-family: monospace;">${formatNum(qty)}</td>
            <td style="text-align: right; font-family: monospace;">${formatVND(price)}</td>
            <td style="text-align: center;">${escapeHtml(rate)}</td>
            <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatVND(total)}</td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- TỔNG CỘNG -->
    <div style="border-top: 1px solid #ee0033; padding-top: 6px; margin-bottom: 14px; font-size: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <span>Cộng tiền hàng:</span>
        <span style="font-family: monospace; font-weight: bold;">${formatVND(invoice.tgtcthue)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <span>Tiền thuế GTGT:</span>
        <span style="font-family: monospace; font-weight: bold;">${formatVND(invoice.tgtthue)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: bold; color: #ee0033; font-size: 13.5px; border-top: 1px dashed #ee0033; padding-top: 4px;">
        <span>Tổng cộng tiền thanh toán:</span>
        <span style="font-family: monospace;">${formatVND(invoice.tgtttbso)}</span>
      </div>
      <div style="margin-top: 4px;">
        Số tiền bằng chữ: <i>${escapeHtml(wordsAmount)}</i>
      </div>
    </div>

    <!-- CHỮ KÝ -->
    <div style="display: flex; justify-content: space-between; margin-top: 20px; margin-bottom: 20px;">
      <div style="width: 45%; text-align: center;">
        <div style="font-weight: bold;">Người mua hàng</div>
        <div style="font-size: 11px; color: #64748b;">(Ký, ghi rõ họ tên nếu có)</div>
      </div>
      <div style="width: 45%; text-align: center;">
        <div style="font-weight: bold;">Người bán hàng</div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">(Chữ ký điện tử, Chữ ký số)</div>
        <div class="viettel-stamp">
          <div style="color: #ee0033; font-weight: bold;">✔ Chữ ký số Viettel-CA hợp lệ</div>
          <div>Ký bởi: <b>${escapeHtml(invoice.nbten)}</b></div>
          <div>Ký ngày: ${day}/${month}/${year}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="viettel-footer">
      <div>(Cần kiểm tra đối chiếu khi lập, nhận hóa đơn)</div>
      <div>Khởi tạo và phát hành bởi giải pháp Hóa đơn điện tử Viettel S-Invoice - Tập đoàn Công nghiệp - Viễn thông Quân đội</div>
    </div>
  </div>
</body>
</html>`;
}
