import { GDTInvoice } from '../types';
import { ensureInvoiceItems } from '../utils/xmlParser';
import { 
  escapeHtml, 
  formatVND, 
  formatNum, 
  extractDateParts, 
  renderSpacedTaxCode,
  extractLookupDetails, 
  generateDefaultQrSvg, 
  getPrintControlsHtml,
  numberToVietnameseWords
} from './templateUtils';
import { RenderTemplateOptions } from './types';

export function renderKimLoanTuanTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  
  const mCode = lookupCode || invoice.lookupCode || '';
  const pUrl = lookupUrl || invoice.lookupUrl || '';
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:0318391940;KH:${invoice.khhdon};SHD:${invoice.shdon};MTC:${mCode}`);

  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const taxAuthorityCode = invoice.mhdon || 'M2-26-896W-14282367803';
  const showControls = options?.showPrintControls !== false;

  const buyerName = invoice.nmten || 'CÔNG TY TNHH MỘT THÀNH VIÊN VÀNG BẠC NGHĨA TÍN';
  const buyerTaxCode = invoice.nmmst || '4000926165';
  const buyerAddress = invoice.nmdchi || '448 Phan Chu Trinh, Phường Tam Kỳ, TP Đà Nẵng, Việt Nam';
  const paymentMethod = invoice.htttoan || 'Chuyển khoản';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN BÁN HÀNG - VÀNG BẠC KIM LOAN TUẤN - Số: ${escapeHtml(invoice.shdon)}</title>
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
      .invoice-outer { box-shadow: none !important; border: 3px double #b45309 !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #b45309;
      border-radius: 4px;
      padding: 20px 24px 16px 24px;
      box-shadow: 0 4px 20px rgba(180, 83, 9, 0.12);
      position: relative;
    }
    /* Watermark */
    .watermark-klt {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-20deg);
      font-size: 52px;
      font-weight: 800;
      color: rgba(217, 119, 6, 0.05);
      text-transform: uppercase;
      letter-spacing: 4px;
      pointer-events: none;
      z-index: 0;
      text-align: center;
      line-height: 1.2;
    }
    .relative-content {
      position: relative;
      z-index: 1;
    }
    /* Header grid */
    .header-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #fef3c7;
    }
    .logo-area {
      width: 170px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .klt-flower-svg {
      width: 60px;
      height: 52px;
    }
    .logo-text {
      font-size: 15px;
      font-weight: bold;
      color: #b45309;
      letter-spacing: 0.5px;
      margin-top: 3px;
      text-align: center;
    }
    .title-area {
      flex: 1;
      text-align: center;
      padding: 0 8px;
    }
    .main-title {
      color: #dc2626;
      font-size: 21px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .sub-title {
      color: #dc2626;
      font-size: 13px;
      font-weight: bold;
      margin: 2px 0 1px 0;
    }
    .en-title {
      color: #dc2626;
      font-size: 12px;
      font-style: italic;
      margin: 0;
    }
    .date-str {
      font-style: italic;
      font-size: 12.5px;
      margin-top: 4px;
    }
    .meta-area {
      width: 190px;
      text-align: right;
      font-size: 12.5px;
    }
    .inv-num {
      color: #dc2626;
      font-size: 17px;
      font-weight: bold;
    }
    /* Seller & Buyer */
    .seller-box {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .seller-info {
      flex: 1;
    }
    .seller-name {
      color: #dc2626;
      font-weight: bold;
      font-size: 13.5px;
      text-transform: uppercase;
    }
    .qr-box {
      width: 96px;
      height: 96px;
      flex-shrink: 0;
      border: 1px solid #e2e8f0;
      padding: 2px;
      background: #fff;
    }
    .qr-box img {
      width: 100%;
      height: 100%;
      display: block;
    }
    .info-row {
      margin-bottom: 3px;
      display: flex;
      align-items: baseline;
    }
    .info-label {
      flex-shrink: 0;
      font-size: 12.5px;
    }
    .info-dots {
      flex: 1;
      border-bottom: 1px dotted #94a3b8;
      margin-left: 4px;
      min-height: 15px;
      padding-left: 2px;
    }
    .buyer-box {
      margin-bottom: 10px;
    }
    /* 7-column table */
    table.klt-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 6px;
      margin-bottom: 8px;
    }
    table.klt-table th, table.klt-table td {
      border: 1px solid #000;
      padding: 4.5px 5px;
      font-size: 12px;
    }
    table.klt-table th {
      text-align: center;
      font-weight: bold;
      background: #fff;
    }
    .th-sub {
      font-style: italic;
      font-size: 10px;
      font-weight: normal;
    }
    .col-stt { width: 34px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 50px; text-align: center; }
    .col-qty { width: 65px; text-align: right; }
    .col-weight { width: 68px; text-align: right; }
    .col-price { width: 90px; text-align: right; }
    .col-amount { width: 105px; text-align: right; }
    .total-row td {
      font-weight: bold;
    }
    .words-box {
      border: 1px dashed #94a3b8;
      padding: 6px 10px;
      margin-top: 6px;
      font-size: 12.5px;
      background: #fafafa;
    }
    /* Signature */
    .signature-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      margin-bottom: 14px;
      text-align: center;
    }
    .sig-col {
      width: 46%;
    }
    .sig-title {
      font-weight: bold;
      font-size: 13px;
    }
    .sig-box-softdreams {
      margin-top: 8px;
      border: 1.5px solid #16a34a;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: left;
      font-size: 11px;
      color: #dc2626;
      background: rgba(22, 163, 74, 0.03);
    }
    .sig-valid-tag {
      color: #16a34a;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 3px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    /* Footer */
    .footer-section {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 11.5px;
      line-height: 1.4;
    }
    .footer-provider {
      text-align: center;
      font-size: 11px;
      color: #475569;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px dashed #e2e8f0;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml('Hóa đơn bán hàng điện tử - CÔNG TY TNHH KD VÀNG BẠC KIM LOAN TUẤN') : ''}

  <div class="invoice-outer">
    <div class="watermark-klt">KIM LOAN TUẤN<br>JEWELRY</div>

    <div class="relative-content">
      <!-- HEADER -->
      <div class="header-grid">
        <div class="logo-area">
          <svg class="klt-flower-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" stroke="#d97706" stroke-width="2" fill="#fffbeb"/>
            <!-- 8 petals golden flower -->
            <path d="M50 16 C55 28 55 38 50 50 C45 38 45 28 50 16 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <path d="M50 84 C55 72 55 62 50 50 C45 62 45 72 50 84 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <path d="M16 50 C28 55 38 55 50 50 C38 45 28 45 16 50 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <path d="M84 50 C72 55 62 55 50 50 C62 45 72 45 84 50 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <path d="M26 26 C38 33 44 42 50 50 C42 44 33 38 26 26 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
            <path d="M74 74 C62 67 56 58 50 50 C58 56 67 62 74 74 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
            <path d="M74 26 C67 38 58 44 50 50 C56 42 62 33 74 26 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
            <path d="M26 74 C33 62 42 56 50 50 C44 58 38 67 26 74 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
            <circle cx="50" cy="50" r="10" fill="#b45309"/>
          </svg>
          <div class="logo-text">KIM LOAN TUẤN</div>
        </div>

        <div class="title-area">
          <div class="main-title">HÓA ĐƠN BÁN HÀNG</div>
          <div class="sub-title">(KHỞI TẠO TỪ MÁY TÍNH TIỀN)</div>
          <div class="en-title">(VAT INVOICE)</div>
          <div class="date-str">Ngày (Date) ${escapeHtml(day)} tháng (month) ${escapeHtml(month)} năm (year) ${escapeHtml(year)}</div>
        </div>

        <div class="meta-area">
          <div>Ký hiệu (Serial): <strong>${escapeHtml(invoice.khhdon || '2C26MKG')}</strong></div>
          <div>Số (No.): <span class="inv-num">${escapeHtml(invoice.shdon || '292')}</span></div>
        </div>
      </div>

      <!-- SELLER INFO -->
      <div class="seller-box">
        <div class="seller-info">
          <div class="info-row">
            <span class="info-label">Đơn vị bán hàng (Seller):</span>
            <span class="seller-name" style="margin-left:6px;">${escapeHtml(invoice.nbten || 'Đơn vị bán hàng')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Mã số thuế (Tax code):</span>
            <span style="font-weight:bold;margin-left:6px;letter-spacing:1px;">${escapeHtml(renderSpacedTaxCode(invoice.nbmst || ''))}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Địa chỉ (Address):</span>
            <span style="margin-left:6px;">${escapeHtml(invoice.nbdchi || '')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Tài khoản (A/C number):</span>
            <span style="margin-left:6px;">${escapeHtml(invoice.nbstk ? `${invoice.nbstk} - ${invoice.nbnhang || ''}` : '05049999 tại Ngân Hàng Eximbank')}</span>
          </div>
        </div>

        <div class="qr-box">
          <img src="${qrImg}" alt="QR Tra cứu Kim Loan Tuấn">
        </div>
      </div>

      <!-- BUYER INFO -->
      <div class="buyer-box">
        <div class="info-row">
          <span class="info-label">Họ tên người mua hàng (Buyer):</span>
          <span class="info-dots">${escapeHtml(invoice.nmten && invoice.nmtendv ? invoice.nmten : '')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tên đơn vị (Company's name):</span>
          <span class="info-dots" style="font-weight:bold;">${escapeHtml(buyerName)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Mã số thuế (Tax code):</span>
          <span class="info-dots" style="font-weight:bold;">${escapeHtml(buyerTaxCode)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Địa chỉ (Address):</span>
          <span class="info-dots">${escapeHtml(buyerAddress)}</span>
        </div>
        <div class="info-row" style="display:flex;justify-content:space-between;">
          <div style="width:48%;display:flex;align-items:baseline;">
            <span class="info-label">Hình thức thanh toán (Payment method):</span>
            <span class="info-dots">${escapeHtml(paymentMethod)}</span>
          </div>
          <div style="width:48%;display:flex;align-items:baseline;">
            <span class="info-label">Đơn vị tiền tệ (Currency):</span>
            <span class="info-dots" style="font-weight:bold;">${escapeHtml(invoice.dvtte || 'VND')}</span>
          </div>
        </div>
      </div>

      <!-- 7-COLUMN GOODS TABLE -->
      <table class="klt-table">
        <thead>
          <tr>
            <th class="col-stt">STT<br><span class="th-sub">(No.)</span></th>
            <th class="col-name">Tên hàng hóa, dịch vụ<br><span class="th-sub">(Name of goods, services)</span></th>
            <th class="col-unit">Đơn vị tính<br><span class="th-sub">(Unit)</span></th>
            <th class="col-qty">Số lượng<br><span class="th-sub">(Quantity)</span></th>
            <th class="col-weight">Trọng lượng<br><span class="th-sub">(Weight)</span></th>
            <th class="col-price">Đơn giá<br><span class="th-sub">(Unit price)</span></th>
            <th class="col-amount">Thành tiền<br><span class="th-sub">(Amount)</span></th>
          </tr>
          <tr style="font-size:10px;text-align:center;font-style:italic;">
            <td>(1)</td>
            <td>(2)</td>
            <td>(3)</td>
            <td>(4)</td>
            <td>(5)</td>
            <td>(6)</td>
            <td>(7)=(4)x(6)</td>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => {
            const qty = item.quantity || item.sluong || 0;
            const price = item.unitPrice || item.dgia || 0;
            const amt = item.amount || item.thtien || (qty * price);
            const unit = item.unit || item.dvt || (idx % 2 === 0 ? 'Chỉ' : 'Cái');
            const name = item.itemName || item.ten || `Sản phẩm vàng #${idx + 1}`;
            
            // Determine weight column
            const isLaborFee = name.toLowerCase().includes('tiền công') || name.toLowerCase().includes('tien cong');
            const weightVal = isLaborFee ? '' : formatNum(qty);

            return `
              <tr>
                <td class="col-stt">${idx + 1}</td>
                <td class="col-name">${escapeHtml(name)}</td>
                <td class="col-unit">${escapeHtml(unit)}</td>
                <td class="col-qty">${formatNum(qty)}</td>
                <td class="col-weight">${escapeHtml(weightVal)}</td>
                <td class="col-price">${formatVND(price)}</td>
                <td class="col-amount">${formatVND(amt)}</td>
              </tr>
            `;
          }).join('')}
          <tr class="total-row">
            <td colspan="6" style="text-align:right;font-weight:bold;">Tổng cộng tiền thanh toán (Total payment):</td>
            <td class="col-amount">${formatVND(totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <!-- WORDS AMOUNT -->
      <div class="words-box">
        <strong>Số tiền viết bằng chữ (Amount in words):</strong> <em>${escapeHtml(wordsAmount)}</em>
      </div>

      <!-- SIGNATURE SECTION -->
      <div class="signature-grid">
        <div class="sig-col">
          <div class="sig-title">Người mua hàng (Buyer)</div>
          <div style="font-style:italic;font-size:11px;color:#64748b;margin-top:2px;">(Ký, ghi rõ họ tên)</div>
        </div>

        <div class="sig-col">
          <div class="sig-title">Người bán hàng (Seller)</div>
          <div class="sig-box-softdreams">
            <div class="sig-valid-tag">
              <span>✔</span> Signature Valid
            </div>
            <div><strong>Ký bởi:</strong> ${escapeHtml(invoice.nbten || 'Người bán hàng')}</div>
            <div><strong>Ký ngày:</strong> ${escapeHtml(day)}-${escapeHtml(month)}-${escapeHtml(year)}</div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer-section">
        <div><strong>Mã của cơ quan thuế (Tax authority code):</strong> <span style="font-family:monospace;font-weight:bold;">${escapeHtml(taxAuthorityCode)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:2px;">
          <div>Trang tra cứu: <a href="${escapeHtml(pUrl)}" target="_blank" style="color:#2563eb;text-decoration:none;">${escapeHtml(pUrl)}</a></div>
          <div>Mã tra cứu: <strong style="color:#b91c1c;font-family:monospace;">${escapeHtml(mCode)}</strong></div>
        </div>
        <div style="text-align:center;font-style:italic;margin-top:3px;color:#475569;">(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)</div>
      </div>

      <div class="footer-provider">
        Đơn vị cung cấp giải pháp: Công ty cổ phần đầu tư công nghệ và thương mại SOFTDREAMS, MST: 0105987432, Http://easyinvoice.vn/
      </div>
    </div>
  </div>
</body>
</html>`;
}
