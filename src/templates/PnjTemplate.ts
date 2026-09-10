import { GDTInvoice } from '../types';
import { ensureInvoiceItems } from '../utils/xmlParser';
import { 
  escapeHtml, 
  formatVND, 
  formatNum, 
  extractDateParts, 
  renderTaxCodeBoxes,
  extractLookupDetails, 
  generateDefaultQrSvg, 
  getPrintControlsHtml,
  numberToVietnameseWords
} from './templateUtils';
import { RenderTemplateOptions } from './types';

export function renderPnjTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  
  const mCode = lookupCode || invoice.lookupCode || '';
  const pUrl = lookupUrl || invoice.lookupUrl || 'https://inv.4si.vn/tra-cuu-hoa-don';
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:0315018466;KH:${invoice.khhdon};SHD:${invoice.shdon};MTC:${mCode}`);

  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const maCqt = invoice.mhdon || '0071C08F3715C041CCA502B8F1EE3DCFE6';
  const showControls = options?.showPrintControls !== false;

  const buyerName = invoice.nmten || 'CÔNG TY TNHH MTV VÀNG BẠC NGHĨA TÍN';
  const buyerTaxCode = invoice.nmmst || '4000926165';
  const buyerAddress = invoice.nmdchi || '446 - 448 Phan Chu Trinh, Phường Tam Kỳ, Thành phố Đà Nẵng, Việt Nam';
  const paymentMethod = invoice.htttoan || 'TM/CK/CT';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN BÁN HÀNG - TRANG SỨC PNJ - Số: ${escapeHtml(invoice.shdon)}</title>
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
      .invoice-outer { box-shadow: none !important; border: 1.5px solid #000 !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 1.5px solid #000;
      padding: 16px 20px 14px 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      position: relative;
    }
    .top-provider-notice {
      text-align: center;
      font-size: 10px;
      color: #333;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .header-flex {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 8px;
      border-bottom: 1px solid #000;
      padding-bottom: 8px;
    }
    .pnj-logo-block {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 140px;
      flex-shrink: 0;
    }
    .pnj-diamond-svg {
      width: 48px;
      height: 48px;
    }
    .pnj-text-brand {
      font-family: 'Times New Roman', serif;
      font-size: 26px;
      font-weight: bold;
      color: #0c4a6e;
      letter-spacing: 0.5px;
      line-height: 1;
    }
    .pnj-sub-brand {
      font-size: 8px;
      letter-spacing: 1.5px;
      color: #475569;
      font-weight: bold;
    }
    .seller-text-block {
      flex: 1;
      font-size: 12px;
      line-height: 1.35;
    }
    .seller-company-name {
      font-size: 13.5px;
      font-weight: bold;
      color: #000;
    }
    .title-banner {
      text-align: center;
      margin: 6px 0 10px 0;
    }
    .main-title {
      font-size: 23px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .invoice-date {
      font-size: 13px;
      margin: 3px 0;
    }
    .cqt-code {
      font-size: 13px;
      font-weight: bold;
      font-family: monospace;
      margin-top: 2px;
    }
    .meta-tags-right {
      display: flex;
      justify-content: flex-end;
      gap: 24px;
      font-size: 13px;
      font-weight: 500;
      margin-top: -30px;
      margin-bottom: 12px;
    }
    /* QR code & Barcode block */
    .barcode-qr-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .qr-sub-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 90px;
    }
    .qr-img {
      width: 80px;
      height: 80px;
      display: block;
      border: 1px solid #ddd;
    }
    .qr-subtext {
      font-size: 10px;
      font-weight: bold;
      font-family: monospace;
      margin-top: 2px;
    }
    .batch-code {
      font-size: 11px;
      font-family: monospace;
      color: #333;
    }
    /* Buyer box */
    .buyer-panel {
      border: 1px solid #000;
      padding: 8px 10px;
      margin-bottom: 8px;
      font-size: 12px;
      line-height: 1.45;
    }
    .buyer-line {
      display: flex;
      align-items: baseline;
      margin-bottom: 2px;
    }
    .buyer-label {
      font-weight: 500;
      flex-shrink: 0;
      margin-right: 4px;
    }
    /* 7-column PNJ table */
    table.pnj-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-bottom: 8px;
    }
    table.pnj-table th, table.pnj-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 11.5px;
    }
    table.pnj-table th {
      text-align: center;
      font-weight: bold;
      background: #fafafa;
    }
    .col-stt { width: 34px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 50px; text-align: center; }
    .col-type { width: 55px; text-align: center; }
    .col-qty { width: 85px; text-align: center; }
    .col-price { width: 85px; text-align: right; }
    .col-amount { width: 105px; text-align: right; }
    .qty-number {
      font-weight: bold;
    }
    .qty-weight {
      font-size: 11px;
      color: #333;
    }
    .total-section {
      border: 1px solid #000;
      padding: 6px 10px;
      margin-bottom: 12px;
      font-size: 12.5px;
      line-height: 1.4;
    }
    .total-row-flex {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      margin-bottom: 4px;
    }
    /* Signature */
    .sign-row {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      margin-bottom: 14px;
      text-align: center;
    }
    .sign-col {
      width: 45%;
    }
    .sign-title {
      font-weight: bold;
      font-size: 13px;
    }
    .sign-sub {
      font-style: italic;
      font-size: 11px;
      color: #555;
    }
    .pnj-signature-box {
      margin-top: 10px;
      border: 1px solid #64748b;
      padding: 6px 10px;
      font-size: 11px;
      text-align: center;
      display: inline-block;
      min-width: 250px;
      background: #fafafa;
    }
    .pnj-signature-valid {
      color: #15803d;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 2px;
    }
    /* Footer lookup */
    .footer-lookup {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 11.5px;
      text-align: center;
    }
    .footer-lookup-flex {
      display: flex;
      justify-content: space-between;
      margin-top: 2px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml('Hóa đơn bán hàng điện tử - CÔNG TY TNHH MTV CHẾ TÁC VÀ KINH DOANH TRANG SỨC PNJ') : ''}

  <div class="invoice-outer">
    <div class="top-provider-notice">
      Khởi tạo từ phần mềm hóa đơn điện tử được cung cấp bởi Công ty TNHH L.C.S – Mã số thuế: 0302999571 – Tel: 19001837
    </div>

    <!-- HEADER SELLER & LOGO -->
    <div class="header-flex">
      <div class="pnj-logo-block">
        <svg class="pnj-diamond-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 8 L63 36 L92 36 L69 54 L78 82 L50 65 L22 82 L31 54 L8 36 L37 36 Z" fill="#d97706" stroke="#b45309" stroke-width="2"/>
          <path d="M50 20 L58 38 L76 38 L62 50 L68 68 L50 56 L32 68 L38 50 L24 38 L42 38 Z" fill="#fbbf24"/>
        </svg>
        <div>
          <div class="pnj-text-brand">PNJ</div>
          <div class="pnj-sub-brand">PRODUCTION</div>
        </div>
      </div>

      <div class="seller-text-block">
        <div class="seller-company-name">${escapeHtml(invoice.nbten || 'Đơn vị bán hàng')}</div>
        <div>Địa chỉ : ${escapeHtml(invoice.nbdchi || '')}</div>
        <div>Mã số thuế : <strong>${escapeHtml(invoice.nbmst || '')}</strong></div>
        <div style="margin-top:2px;">Đơn vị bán hàng : <strong>${escapeHtml(invoice.nbten || 'Đơn vị bán hàng')}</strong></div>
        <div>Địa chỉ : ${escapeHtml(invoice.nbdchi || '')}</div>
        <div>Mã số thuế : <strong>${escapeHtml(invoice.nbmst || '')}</strong> &nbsp;&nbsp;&nbsp;&nbsp; SĐT : <strong>${escapeHtml(invoice.nbsdt || '')}</strong></div>
      </div>
    </div>

    <!-- BARCODE & QR ROW -->
    <div class="barcode-qr-row">
      <div class="qr-sub-block">
        <img src="${qrImg}" alt="QR PNJ" class="qr-img">
        <div class="qr-subtext">${escapeHtml(mCode.slice(0, 12))}</div>
      </div>
      <div class="batch-code">
        500020269014483156-5005
      </div>
    </div>

    <!-- TITLE BANNER -->
    <div class="title-banner">
      <div class="main-title">HÓA ĐƠN BÁN HÀNG</div>
      <div class="invoice-date">Ngày ${escapeHtml(day)} tháng ${escapeHtml(month)} năm ${escapeHtml(year)}</div>
      <div class="cqt-code">MÃ CQT : ${escapeHtml(maCqt)}</div>
    </div>

    <div class="meta-tags-right">
      <div>Ký hiệu : <strong>${escapeHtml(invoice.khhdon || '2C26TBG')}</strong></div>
      <div>Số : <strong>${escapeHtml(invoice.shdon || '862')}</strong></div>
    </div>

    <!-- BUYER PANEL -->
    <div class="buyer-panel">
      <div style="display:flex;justify-content:space-between;">
        <div class="buyer-line" style="flex:1;">
          <span class="buyer-label">Họ tên người mua hàng :</span>
          <span>${escapeHtml(invoice.nmten && invoice.nmtendv ? invoice.nmten : '(0200001000)')}</span>
        </div>
        <div class="buyer-line" style="width:240px;">
          <span class="buyer-label">Số tài khoản :</span>
          <span style="font-family:monospace;">${escapeHtml(invoice.nmstk || '........................')}</span>
        </div>
      </div>

      <div class="buyer-line">
        <span class="buyer-label">Tên đơn vị :</span>
        <strong style="text-transform:uppercase;">${escapeHtml(buyerName)}</strong>
      </div>

      <div class="buyer-line">
        <span class="buyer-label">Địa chỉ :</span>
        <span>${escapeHtml(buyerAddress)}</span>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
        <div class="buyer-line">
          <span class="buyer-label">Hình thức thanh toán :</span>
          <strong>${escapeHtml(paymentMethod)}</strong>
        </div>
        <div class="buyer-line">
          <span class="buyer-label" style="margin-right:6px;">Mã số thuế :</span>
          ${renderTaxCodeBoxes(buyerTaxCode)}
        </div>
      </div>

      <div class="buyer-line" style="font-size:11px;color:#444;margin-top:2px;">
        <span>CCCD : ...............................</span>
        <span style="margin-left:14px;">Số hộ chiếu : ...............................</span>
        <span style="margin-left:14px;">MDVQHNSACH : ...............................</span>
      </div>
    </div>

    <!-- 7-COLUMN PNJ GOODS TABLE -->
    <table class="pnj-table">
      <thead>
        <tr>
          <th class="col-stt">1<br>STT</th>
          <th class="col-name">2<br>Tên hàng hóa, dịch vụ</th>
          <th class="col-unit">3<br>Đơn vị tính</th>
          <th class="col-type">4<br>Loại SP</th>
          <th class="col-qty">5<br>Số lượng<br>(Trọng lượng)</th>
          <th class="col-price">6<br>Đơn giá</th>
          <th class="col-amount">7 = 5x6<br>Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => {
          const qty = item.quantity || item.sluong || 0;
          const price = item.unitPrice || item.dgia || 0;
          const amt = item.amount || item.thtien || (qty * price);
          const unit = item.unit || item.dvt || 'Món';
          const name = item.itemName || item.ten || `Sản phẩm trang sức PNJ #${idx + 1}`;
          
          // Trích xuất trọng lượng nếu có trong tên
          const weightMatch = name.match(/Trọng lượng\s*(?:đá)?\s*([0-9\.,]+)\s*(?:phân|chỉ|gram|g)?/i);
          const weightStr = weightMatch ? `(${weightMatch[1]})` : `(${formatNum(qty * 3.75)})`;

          return `
            <tr>
              <td class="col-stt">${idx + 1}</td>
              <td class="col-name">${escapeHtml(name)}</td>
              <td class="col-unit">${escapeHtml(unit)}</td>
              <td class="col-type"></td>
              <td class="col-qty">
                <div class="qty-number">${formatNum(qty)}</div>
                <div class="qty-weight">${escapeHtml(weightStr)}</div>
              </td>
              <td class="col-price">${formatVND(price)}</td>
              <td class="col-amount">${formatVND(amt)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- TOTAL AMOUNT SECTION -->
    <div class="total-section">
      <div class="total-row-flex">
        <span>Cộng tiền hàng :</span>
        <span style="font-size:14px;font-weight:bold;">${formatVND(totalAmount)}</span>
      </div>
      <div>
        <strong>Số tiền viết bằng chữ :</strong> <em>${escapeHtml(wordsAmount)}</em>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div class="sign-row">
      <div class="sign-col">
        <div class="sign-title">Người mua hàng</div>
        <div class="sign-sub">(Ký, ghi rõ họ tên)</div>
      </div>

      <div class="sign-col">
        <div class="sign-title">Người bán hàng</div>
        <div class="sign-sub">(Ký, ghi rõ họ tên)</div>
        <div class="pnj-signature-box">
          <div class="pnj-signature-valid">Đã ký ✔</div>
          <div><strong>Ký bởi:</strong> Công ty TNHH MTV Chế Tác và Kinh Doanh Trang sức PNJ</div>
          <div><strong>Ký ngày:</strong> ${escapeHtml(day)}/${escapeHtml(month)}/${escapeHtml(year)}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-lookup">
      <div style="font-style:italic;color:#475569;">(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)</div>
      <div class="footer-lookup-flex">
        <div>Tra cứu thông tin hóa đơn điện tử tại: <a href="${escapeHtml(pUrl)}" target="_blank" style="color:#0284c7;">${escapeHtml(pUrl)}</a></div>
        <div>Mã tra cứu: <strong style="font-family:monospace;font-size:12px;">${escapeHtml(mCode)}</strong></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
