import { GDTInvoice } from '../types';
import { ensureInvoiceItems } from '../utils/xmlParser';
import { 
  escapeHtml, 
  formatVND, 
  extractDateParts, 
  extractLookupDetails, 
  generateDefaultQrSvg, 
  getPrintControlsHtml,
  numberToVietnameseWords
} from './templateUtils';
import { RenderTemplateOptions } from './types';

export function renderTaiTramAnhTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  
  const mCode = lookupCode || invoice.lookupCode || '';
  const pUrl = lookupUrl || invoice.lookupUrl || '';
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:0312105174;KH:${invoice.khhdon};SHD:${invoice.shdon};MTC:${mCode}`);

  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const maCqt = invoice.mhdon || '00AD728CC709B04346844E43D3CBDC5C57';
  const showControls = options?.showPrintControls !== false;

  const buyerName = invoice.nmten || 'CÔNG TY TNHH MỘT THÀNH VIÊN VÀNG BẠC NGHĨA TÍN';
  const buyerTaxCode = invoice.nmmst || '4000926165';
  const buyerAddress = invoice.nmdchi || '448 Phan Chu Trinh, Phường Tam Kỳ, TP Đà Nẵng, Việt Nam.';
  const paymentMethod = invoice.htttoan || 'TM/CK';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN BÁN HÀNG - GIA CÔNG TRANG SỨC TÀI TRÂM ANH - Số: ${escapeHtml(invoice.shdon)}</title>
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
      .invoice-outer { box-shadow: none !important; border: 3px double #1e40af !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #1e40af;
      border-radius: 4px;
      padding: 20px 24px 16px 24px;
      box-shadow: 0 4px 20px rgba(30, 64, 175, 0.12);
      position: relative;
    }
    /* TTJ Big Watermark */
    .watermark-ttj {
      position: absolute;
      top: 52%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 380px;
      height: 380px;
      opacity: 0.08;
      pointer-events: none;
      z-index: 0;
    }
    .relative-content {
      position: relative;
      z-index: 1;
    }
    /* Header */
    .seller-header {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .ttj-logo {
      width: 100px;
      height: 80px;
      flex-shrink: 0;
    }
    .seller-details {
      flex: 1;
      font-size: 12.5px;
      line-height: 1.4;
    }
    .company-title {
      color: #0f172a;
      font-weight: bold;
      font-size: 14.5px;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      margin-bottom: 2px;
    }
    /* Invoice title block */
    .title-row {
      text-align: center;
      margin: 10px 0 12px 0;
      position: relative;
    }
    .main-title {
      font-size: 23px;
      font-weight: bold;
      color: #000;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .sub-date {
      font-style: italic;
      font-size: 13px;
      margin-top: 3px;
    }
    .cqt-code {
      font-style: italic;
      font-size: 12.5px;
      margin-top: 2px;
    }
    .meta-box-right {
      position: absolute;
      right: 0;
      top: 0;
      text-align: right;
      font-size: 12.5px;
    }
    .qr-corner {
      position: absolute;
      right: 0;
      top: 50px;
      width: 90px;
      height: 90px;
      border: 1px solid #ddd;
      padding: 2px;
      background: #fff;
    }
    .qr-corner img {
      width: 100%;
      height: 100%;
      display: block;
    }
    /* Buyer box */
    .buyer-section {
      margin-top: 6px;
      margin-bottom: 12px;
      font-size: 12.5px;
      padding-right: 100px;
      line-height: 1.45;
    }
    .buyer-line {
      margin-bottom: 2px;
    }
    /* Table */
    table.ttj-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 6px;
      margin-bottom: 8px;
    }
    table.ttj-table th, table.ttj-table td {
      border: 1px solid #000;
      padding: 4.5px 6px;
      font-size: 12px;
    }
    table.ttj-table th {
      text-align: center;
      font-weight: bold;
      background: #fff;
    }
    .col-stt { width: 40px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 70px; text-align: center; }
    .col-qty { width: 75px; text-align: right; }
    .col-price { width: 100px; text-align: right; }
    .col-amount { width: 115px; text-align: right; }
    .total-line {
      border: 1px solid #000;
      border-top: none;
      padding: 6px 10px;
      font-size: 12.5px;
      background: #fff;
      display: flex;
      justify-content: space-between;
      font-weight: bold;
    }
    .words-amount {
      border: 1px solid #000;
      border-top: none;
      padding: 6px 10px;
      font-size: 12.5px;
      font-style: italic;
      margin-bottom: 14px;
    }
    /* Signature */
    .sign-container {
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
    .misa-sig-box {
      margin-top: 8px;
      border: 1.5px solid #15803d;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: left;
      font-size: 11px;
      color: #b91c1c;
      background: rgba(34, 197, 94, 0.04);
      position: relative;
    }
    .sig-valid-header {
      color: #dc2626;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    /* Footer */
    .footer-area {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 11.5px;
      text-align: center;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml('Hóa đơn bán hàng điện tử - DNTN GIA CÔNG TRANG SỨC TÀI TRÂM ANH') : ''}

  <div class="invoice-outer">
    <!-- SVG Watermark TTJ -->
    <svg class="watermark-ttj" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="100" rx="90" ry="60" stroke="#1e40af" stroke-width="16" fill="none" transform="rotate(-30 100 100)"/>
      <path d="M70 65 H130 M100 65 V135" stroke="#0284c7" stroke-width="14" stroke-linecap="round"/>
      <path d="M125 90 H155 M140 90 V140 Q140 155 125 155" stroke="#1e40af" stroke-width="12" stroke-linecap="round" fill="none"/>
    </svg>

    <div class="relative-content">
      <!-- SELLER HEADER -->
      <div class="seller-header">
        <svg class="ttj-logo" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="60" cy="45" rx="52" ry="34" stroke="#0284c7" stroke-width="9" fill="none" transform="rotate(-25 60 45)"/>
          <path d="M42 28 H78 M60 28 V66" stroke="#1e40af" stroke-width="8" stroke-linecap="round"/>
          <path d="M75 42 H96 M86 42 V68 Q86 78 76 78" stroke="#0284c7" stroke-width="7" stroke-linecap="round" fill="none"/>
        </svg>

        <div class="seller-details">
          <div class="company-title">${escapeHtml(invoice.nbten || 'Đơn vị bán hàng')}</div>
          <div>Mã số thuế: <strong>${escapeHtml(invoice.nbmst || '')}</strong></div>
          <div>Địa chỉ: ${escapeHtml(invoice.nbdchi || '')}</div>
          <div>Điện thoại: ${escapeHtml(invoice.nbsdt || '(028) 3820 5096')}</div>
          <div>Số tài khoản: <strong>${escapeHtml(invoice.nbstk ? `${invoice.nbstk} - ${invoice.nbnhang || ''}` : '199228689 - NGÂN HÀNG TMCP Á CHÂU - PGD BÌNH ĐĂNG')}</strong></div>
        </div>
      </div>

      <!-- TITLE & META -->
      <div class="title-row">
        <div class="main-title">HÓA ĐƠN BÁN HÀNG</div>
        <div class="sub-date">Ngày ${escapeHtml(day)} tháng ${escapeHtml(month)} năm ${escapeHtml(year)}</div>
        <div class="cqt-code">Mã CQT: <strong>${escapeHtml(maCqt)}</strong></div>

        <div class="meta-box-right">
          <div>Ký hiệu: <strong>${escapeHtml(invoice.khhdon || '2C26TTA')}</strong></div>
          <div>Số: <strong style="font-size:15px;color:#000;">${escapeHtml(invoice.shdon || '00000273')}</strong></div>
        </div>

        <div class="qr-corner">
          <img src="${qrImg}" alt="QR Tra cứu TTJ">
        </div>
      </div>

      <!-- BUYER SECTION -->
      <div class="buyer-section">
        <div class="buyer-line">Họ tên người mua hàng: <span>${escapeHtml(invoice.nmten && invoice.nmtendv ? invoice.nmten : '')}</span></div>
        <div class="buyer-line">Tên đơn vị: <strong style="text-transform:uppercase;">${escapeHtml(buyerName)}</strong></div>
        <div class="buyer-line">Mã số thuế: <strong>${escapeHtml(buyerTaxCode)}</strong></div>
        <div class="buyer-line">Địa chỉ: ${escapeHtml(buyerAddress)}</div>
        <div class="buyer-line" style="display:flex;justify-content:space-between;">
          <div>Hình thức thanh toán: <strong>${escapeHtml(paymentMethod)}</strong></div>
          <div>Số tài khoản: <span>${escapeHtml(invoice.nmstk || '')}</span></div>
        </div>
      </div>

      <!-- GOODS TABLE -->
      <table class="ttj-table">
        <thead>
          <tr>
            <th class="col-stt">STT</th>
            <th class="col-name">Tên hàng hóa, dịch vụ</th>
            <th class="col-unit">Đơn vị tính</th>
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
            const unit = item.unit || item.dvt || 'món';
            const name = item.itemName || item.ten || `Gia công lắc HLV610-KLV #${idx + 1}`;
            
            // Format 1,00
            const qtyFormatted = Number.isInteger(qty) ? `${qty},00` : new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(qty);

            return `
              <tr>
                <td class="col-stt">${idx + 1}</td>
                <td class="col-name">${escapeHtml(name)}</td>
                <td class="col-unit">${escapeHtml(unit)}</td>
                <td class="col-qty">${qtyFormatted}</td>
                <td class="col-price">${formatVND(price)}</td>
                <td class="col-amount">${formatVND(amt)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="total-line">
        <span>Cộng tiền bán hàng hóa, dịch vụ:</span>
        <span style="font-size:13.5px;">${formatVND(totalAmount)}</span>
      </div>

      <div class="words-amount">
        Số tiền viết bằng chữ: <strong>${escapeHtml(wordsAmount)}</strong>
      </div>

      <!-- SIGNATURES -->
      <div class="sign-container">
        <div class="sign-col">
          <div class="sign-title">Người mua hàng</div>
          <div class="sign-desc">(Ký, ghi rõ họ, tên)</div>
        </div>

        <div class="sign-col">
          <div class="sign-title">Người bán hàng</div>
          <div class="sign-desc">(Ký, ghi rõ họ, tên)</div>
          
          <div class="misa-sig-box">
            <div class="sig-valid-header">
              <span style="color:#15803d;font-size:14px;">✔</span>
              <span>Signature Valid</span>
            </div>
            <div><strong>Ký bởi:</strong> ${escapeHtml(invoice.nbten || 'Người bán hàng')}</div>
            <div><strong>Ký ngày:</strong> ${escapeHtml(day)}/${escapeHtml(month)}/${escapeHtml(year)}</div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer-area">
        <div>Tra cứu tại Website: <a href="${escapeHtml(pUrl)}" target="_blank" style="color:#2563eb;text-decoration:none;">${escapeHtml(pUrl)}</a> - Mã tra cứu hóa đơn: <strong style="font-family:monospace;font-size:12px;">${escapeHtml(mCode)}</strong></div>
        <div style="font-style:italic;color:#64748b;margin-top:2px;">(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)</div>
        <div style="font-size:10.5px;color:#475569;margin-top:3px;">Phát hành bởi phần mềm MISA meInvoice - Công ty Cổ phần MISA (www.misa.vn) - MST 0101243150</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
