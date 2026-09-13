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
  numberToVietnameseWords,
  buildDirectLookupUrl
} from './templateUtils';
import { RenderTemplateOptions } from './types';

export function renderBaoDuyTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  
  const mCode = lookupCode || invoice.lookupCode || '';
  const pUrl = lookupUrl || invoice.lookupUrl || `http://${invoice.nbmst}hd.easyinvoice.com.vn`;
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, 'BAO_DUY', invoice.nbmst);
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:0318657735;KH:${invoice.khhdon};SHD:${invoice.shdon};MTC:${mCode}`);
  
  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const taxAuthorityCode = invoice.mhdon || 'M2-26-IXTFA-14279040746';
  const showControls = options?.showPrintControls !== false;

  const buyerName = invoice.nmten || 'CÔNG TY TNHH MỘT THÀNH VIÊN VÀNG BẠC NGHĨA TÍN';
  const buyerTaxCode = invoice.nmmst || '4000926165';
  const buyerAddress = invoice.nmdchi || '448 Phan Chu Trinh, Phường Tam Kỳ, TP Đà Nẵng, Việt Nam';
  const paymentMethod = invoice.htttoan || 'Chuyển khoản';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN BÁN HÀNG - TRANG SỨC BẢO DUY - Số: ${escapeHtml(invoice.shdon)}</title>
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
      .invoice-outer { box-shadow: none !important; border: 3px double #db2777 !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #db2777;
      border-radius: 4px;
      padding: 20px 24px 16px 24px;
      box-shadow: 0 4px 20px rgba(219, 39, 119, 0.12);
      position: relative;
    }
    /* Watermark */
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 58px;
      font-weight: 800;
      color: rgba(219, 39, 119, 0.05);
      text-transform: uppercase;
      letter-spacing: 6px;
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
      border-bottom: 1px solid #fbcfe8;
    }
    .logo-area {
      width: 170px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .logo-svg {
      width: 70px;
      height: 55px;
    }
    .logo-text {
      font-size: 17px;
      font-weight: bold;
      color: #9d174d;
      letter-spacing: 1px;
      margin-top: 3px;
    }
    .logo-subtext {
      font-size: 10px;
      color: #be185d;
      letter-spacing: 3px;
      font-weight: 600;
    }
    .title-area {
      flex: 1;
      text-align: center;
      padding: 0 8px;
    }
    .main-title {
      color: #c2185b;
      font-size: 21px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .sub-title {
      color: #c2185b;
      font-size: 13.5px;
      font-weight: bold;
      margin: 2px 0 1px 0;
    }
    .en-title {
      color: #c2185b;
      font-size: 12.5px;
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
    .serial-row {
      margin-bottom: 4px;
    }
    .no-row .inv-num {
      color: #c2185b;
      font-size: 17px;
      font-weight: bold;
    }
    /* Seller & Buyer sections */
    .seller-box {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .seller-info {
      flex: 1;
    }
    .seller-name {
      color: #b91c1c;
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
    /* Buyer box */
    .buyer-box {
      margin-bottom: 12px;
    }
    /* Items table */
    table.invoice-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 6px;
      margin-bottom: 8px;
    }
    table.invoice-table th, table.invoice-table td {
      border: 1px solid #000;
      padding: 4.5px 6px;
      font-size: 12px;
    }
    table.invoice-table th {
      text-align: center;
      font-weight: bold;
      background: #fff;
    }
    .th-sub {
      font-style: italic;
      font-size: 10.5px;
      font-weight: normal;
    }
    .col-stt { width: 38px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 62px; text-align: center; }
    .col-qty { width: 68px; text-align: right; }
    .col-price { width: 95px; text-align: right; }
    .col-amount { width: 110px; text-align: right; }
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
    /* Signature area */
    .signature-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 16px;
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
      margin-top: 10px;
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
      margin-bottom: 4px;
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
      margin-top: 5px;
      padding-top: 4px;
      border-top: 1px dashed #e2e8f0;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml('Hóa đơn bán hàng điện tử - CÔNG TY TNHH TM TRANG SỨC BẢO DUY') : ''}

  <div class="invoice-outer">
    <div class="watermark">BẢO DUY<br>JEWELRY</div>
    
    <div class="relative-content">
      <!-- HEADER -->
      <div class="header-grid">
        <div class="logo-area">
          <svg class="logo-svg" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="40" r="36" stroke="#db2777" stroke-width="3" fill="#fdf2f8"/>
            <path d="M36 26 H48 C55 26 59 29 59 34 C59 38 56 40 51 41 C57 42 61 45 61 50 C61 56 55 60 47 60 H36 Z" fill="#db2777"/>
            <path d="M42 32 H47 C50 32 53 33 53 36 C53 39 50 40 47 40 H42 Z" fill="#ffffff"/>
            <path d="M42 46 H47 C51 46 54 47 54 50 C54 54 51 55 47 55 H42 Z" fill="#ffffff"/>
            <path d="M60 30 Q70 40 60 54" stroke="#be185d" stroke-width="3" stroke-linecap="round" fill="none"/>
          </svg>
          <div class="logo-text">BẢO DUY</div>
          <div class="logo-subtext">JEWELRY</div>
        </div>

        <div class="title-area">
          <div class="main-title">HÓA ĐƠN BÁN HÀNG</div>
          <div class="sub-title">(KHỞI TẠO TỪ MÁY TÍNH TIỀN)</div>
          <div class="en-title">(SALES INVOICE)</div>
          <div class="date-str">Ngày (Date) ${escapeHtml(day)} tháng (month) ${escapeHtml(month)} năm (year) ${escapeHtml(year)}</div>
        </div>

        <div class="meta-area">
          <div class="serial-row">Ký hiệu (Serial): <strong>${escapeHtml(invoice.khhdon || '2C26MAA')}</strong></div>
          <div class="no-row">Số (No.): <span class="inv-num">${escapeHtml(invoice.shdon || '285')}</span></div>
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
            <span style="margin-left:6px;">${escapeHtml(invoice.nbstk ? `${invoice.nbstk} ${invoice.nbnhang || ''}` : '112348668 Ngân hàng TMCP Á Châu - CN Sài Gòn')}</span>
          </div>
        </div>

        <div class="qr-box">
          <img src="${qrImg}" alt="QR Tra cứu Bảo Duy">
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
        <div class="info-row">
          <span class="info-label">Điện thoại (Tel):</span>
          <span class="info-dots">${escapeHtml(invoice.nmsdt || '')}</span>
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

      <!-- TABLE OF GOODS -->
      <table class="invoice-table">
        <thead>
          <tr>
            <th class="col-stt">STT<br><span class="th-sub">(No.)</span></th>
            <th class="col-name">Tên hàng hóa, dịch vụ<br><span class="th-sub">(Name of goods, services)</span></th>
            <th class="col-unit">Đơn vị tính<br><span class="th-sub">(Unit)</span></th>
            <th class="col-qty">Số lượng<br><span class="th-sub">(Quantity)</span></th>
            <th class="col-price">Đơn giá<br><span class="th-sub">(Unit price)</span></th>
            <th class="col-amount">Thành tiền<br><span class="th-sub">(Amount)</span></th>
          </tr>
          <tr style="font-size:10px;text-align:center;font-style:italic;">
            <td>(1)</td>
            <td>(2)</td>
            <td>(3)</td>
            <td>(4)</td>
            <td>(5)</td>
            <td>(6)=(4)x(5)</td>
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
          <tr class="total-row">
            <td colspan="5" style="text-align:right;font-weight:bold;">Tổng cộng tiền thanh toán (Total payment):</td>
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
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
          <div>Trang tra cứu: <a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${escapeHtml(pUrl)}</a>
          ${mCode ? ` &nbsp;<a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:2px 8px;background:#2563eb;color:#fff;border-radius:4px;font-size:11px;text-decoration:none;font-weight:bold;vertical-align:middle;">Mở tra cứu ↗</a>` : ''}
          </div>
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
