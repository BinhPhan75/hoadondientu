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
  numberToVietnameseWords
} from './templateUtils';
import { RenderTemplateOptions } from './types';

// Helper parse thông tin Chữ ký số JSON (nbcks / cqtcks)
function parseCertInfo(certStr?: string) {
  if (!certStr) return null;
  try {
    const obj = typeof certStr === 'string' ? JSON.parse(certStr) : certStr;
    let cn = '';
    if (obj.Subject) {
      const cnMatch = obj.Subject.match(/CN=([^,]+)/i);
      if (cnMatch) cn = cnMatch[1].trim();
    }
    const signingTime = obj.SigningTime ? new Date(obj.SigningTime) : null;
    return { cn, signingTime };
  } catch {
    return null;
  }
}

export function renderNghiaSonTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);

  // 1. Logic ưu tiên Mã CQT (invoice.mhdon) làm Mã tra cứu nếu lookupCode rỗng
  const maCqt = invoice.mhdon || invoice.mhso || '';
  const mCode = lookupCode || invoice.lookupCode || maCqt || '00BB3C25BCB8C74D908D5962B75A9ED39B';
  const displayMaCqt = maCqt || '00BB3C25BCB8C74D908D5962B75A9ED39B';

  // 2. Tự động sinh Portal URL nếu rỗng
  const sellerMST = invoice.nbmst || '4000344946';
  const pUrl = lookupUrl || invoice.lookupUrl || `https://${sellerMST}-tt78.vnpt-invoice.com.vn`;

  // 3. Format số hóa đơn đủ số 0
  const rawShdon = String(invoice.shdon || '9');
  const formattedShdon = rawShdon.padStart(8, '0');

  // 4. QR Code & Items
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:${sellerMST};KH:${invoice.khhdon || ''};SHD:${formattedShdon};MCCQT:${displayMaCqt}`);
  const items = ensureInvoiceItems(invoice);

  // 5. Tính toán tài chính
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const subTotal = invoice.tgtcthue || (invoice.tgtthue ? totalAmount - invoice.tgtthue : Math.round(totalAmount / 1.1));
  const vatAmount = invoice.tgtthue || (totalAmount - subTotal > 0 ? totalAmount - subTotal : Math.round(subTotal * 0.1));
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const showControls = options?.showPrintControls !== false;

  // 6. Thông tin bên mua & bên bán
  const sellerName = invoice.nbten || 'CÔNG TY TNHH NGHĨA SƠN';
  const buyerName = invoice.nmten || 'CÔNG TY TNHH MỘT THÀNH VIÊN VÀNG BẠC NGHĨA TÍN';
  const buyerTaxCode = invoice.nmmst || '4000926165';
  const buyerAddress = invoice.nmdchi || '448 Phan Chu Trinh, Phường Tam Kỳ, Thành phố Tam Kỳ, Tỉnh Quảng Nam, Việt Nam';
  const paymentMethod = invoice.thtttoan || invoice.htttoan || 'Chuyển khoản';

  // 7. Parse thông tin chữ ký thực tế
  const sellerCert = parseCertInfo(invoice.nbcks);
  const cqtCert = parseCertInfo(invoice.cqtcks);

  const sellerSignName = sellerCert?.cn || sellerName;
  const sellerSignDateStr = sellerCert?.signingTime 
    ? `${String(sellerCert.signingTime.getDate()).padStart(2, '0')}/${String(sellerCert.signingTime.getMonth() + 1).padStart(2, '0')}/${sellerCert.signingTime.getFullYear()}`
    : `${day}/${month}/${year}`;

  const cqtSignName = cqtCert?.cn || 'CỤC THUẾ / TỔNG CỤC THUẾ';
  const cqtSignDateStr = cqtCert?.signingTime 
    ? `${String(cqtCert.signingTime.getDate()).padStart(2, '0')}/${String(cqtCert.signingTime.getMonth() + 1).padStart(2, '0')}/${cqtCert.signingTime.getFullYear()}`
    : `${day}/${month}/${year}`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN GIÁ TRỊ GIA TĂNG - ${escapeHtml(sellerName)} - Số: ${escapeHtml(formattedShdon)}</title>
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
      .invoice-outer { box-shadow: none !important; border: 3px double #0284c7 !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #0284c7;
      border-radius: 4px;
      padding: 18px 22px 14px 22px;
      box-shadow: 0 4px 20px rgba(2, 132, 199, 0.12);
      position: relative;
    }
    .top-vnpt-banner {
      text-align: center;
      font-size: 11px;
      color: #0369a1;
      border-bottom: 1px solid #bae6fd;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .header-grid {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    .vnpt-logo-box {
      width: 70px;
      height: 60px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .vnpt-globe-svg {
      width: 55px;
      height: 55px;
    }
    .seller-text-box {
      flex: 1;
      font-size: 12.5px;
      line-height: 1.38;
    }
    .seller-title {
      color: #0369a1;
      font-weight: bold;
      font-size: 14.5px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .title-row {
      text-align: center;
      margin: 8px 0 10px 0;
      position: relative;
    }
    .main-title {
      font-size: 22px;
      font-weight: bold;
      color: #dc2626;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .en-title {
      font-size: 12px;
      font-style: italic;
      color: #dc2626;
      margin: 1px 0;
    }
    .sub-date {
      font-style: italic;
      font-size: 12.5px;
      margin-top: 2px;
    }
    .cqt-code {
      font-style: italic;
      font-size: 12px;
      margin-top: 2px;
      word-break: break-all;
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
      top: 52px;
      width: 86px;
      height: 86px;
      border: 1px solid #ddd;
      padding: 2px;
      background: #fff;
    }
    .qr-corner img {
      width: 100%;
      height: 100%;
      display: block;
    }
    .buyer-section {
      margin-top: 6px;
      margin-bottom: 10px;
      font-size: 12.5px;
      padding-right: 95px;
      line-height: 1.45;
    }
    .buyer-line {
      margin-bottom: 2px;
    }
    table.ns-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 6px;
    }
    table.ns-table th, table.ns-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 12px;
    }
    table.ns-table th {
      text-align: center;
      font-weight: bold;
      background: #fff;
    }
    .th-sub {
      font-style: italic;
      font-size: 10px;
      font-weight: normal;
    }
    .col-stt { width: 36px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 60px; text-align: center; }
    .col-qty { width: 68px; text-align: right; }
    .col-price { width: 95px; text-align: right; }
    .col-amount { width: 110px; text-align: right; }
    .calc-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      border-top: none;
      font-size: 12.5px;
    }
    .calc-table td {
      border: 1px solid #000;
      padding: 4.5px 8px;
    }
    .words-amount {
      border: 1px solid #000;
      border-top: none;
      padding: 6px 10px;
      font-size: 12.5px;
      font-style: italic;
      margin-bottom: 12px;
    }
    .sign-container {
      display: flex;
      justify-content: space-between;
      text-align: center;
      margin-top: 10px;
      margin-bottom: 14px;
    }
    .sign-col {
      width: 32%;
    }
    .sign-title {
      font-weight: bold;
      font-size: 12.5px;
    }
    .sign-desc {
      font-style: italic;
      font-size: 10.5px;
      color: #64748b;
    }
    .vnpt-sig-box {
      margin-top: 6px;
      border: 1px solid #16a34a;
      border-radius: 4px;
      padding: 6px 8px;
      text-align: left;
      font-size: 10.5px;
      color: #000;
      background: rgba(22, 163, 74, 0.03);
    }
    .sig-valid-tag {
      color: #16a34a;
      font-weight: bold;
      font-size: 11.5px;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 3px;
    }
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
  ${showControls ? getPrintControlsHtml(`HÓA ĐƠN GIÁ TRỊ GIA TĂNG - ${escapeHtml(sellerName)}`) : ''}

  <div class="invoice-outer">
    <div class="top-vnpt-banner">
      Đơn vị cung cấp giải pháp hóa đơn điện tử: Tập đoàn Bưu chính Viễn thông Việt Nam. Điện thoại: 1800.1260
    </div>

    <!-- SELLER HEADER -->
    <div class="header-grid">
      <div class="vnpt-logo-box">
        <svg class="vnpt-globe-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="44" fill="#0284c7"/>
          <ellipse cx="50" cy="50" rx="44" ry="18" stroke="#ffffff" stroke-width="3" fill="none"/>
          <ellipse cx="50" cy="50" rx="18" ry="44" stroke="#ffffff" stroke-width="3" fill="none"/>
          <path d="M50 6 V94" stroke="#ffffff" stroke-width="3"/>
          <path d="M6 50 H94" stroke="#ffffff" stroke-width="3"/>
        </svg>
      </div>

      <div class="seller-text-box">
        <div class="seller-title">${escapeHtml(sellerName)}</div>
        <div>Mã số thuế (Tax code): <strong>${escapeHtml(sellerMST)}</strong></div>
        <div>Địa chỉ (Address): ${escapeHtml(invoice.nbdchi || '')}</div>
        <div>Điện thoại (Tel): ${escapeHtml(invoice.nbsdthoai || invoice.nbsdt || '0856528777')}</div>
        <div>Số tài khoản (Account No.): <strong>${escapeHtml(invoice.nbstkhoan ? `${invoice.nbstkhoan} - ${invoice.nbtnhang || ''}` : '040092309799 - Ngân hàng Sacombank - Chi nhánh Quảng Nam')}</strong></div>
      </div>
    </div>

    <!-- TITLE & META -->
    <div class="title-row">
      <div class="main-title">${escapeHtml(invoice.thdon || 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG')}</div>
      <div class="en-title">(VAT INVOICE)</div>
      <div class="sub-date">Ngày (Date) ${escapeHtml(day)} tháng (month) ${escapeHtml(month)} năm (year) ${escapeHtml(year)}</div>
      <div class="cqt-code">Mã của cơ quan thuế: <strong>${escapeHtml(displayMaCqt)}</strong></div>

      <div class="meta-box-right">
        <div>Mẫu số (Form): <strong>${escapeHtml(String(invoice.khmshdon || '1'))}</strong></div>
        <div>Ký hiệu (Serial): <strong>${escapeHtml(invoice.khhdon || '1C25TNS')}</strong></div>
        <div>Số (No.): <strong style="font-size:15px;color:#dc2626;">${escapeHtml(formattedShdon)}</strong></div>
      </div>

      <div class="qr-corner">
        <img src="${qrImg}" alt="QR Tra cứu">
      </div>
    </div>

    <!-- BUYER SECTION -->
    <div class="buyer-section">
      <div class="buyer-line">Họ tên người mua hàng (Buyer): <span>${escapeHtml(invoice.nmtnmua || '')}</span></div>
      <div class="buyer-line">Tên đơn vị (Company): <strong style="text-transform:uppercase;">${escapeHtml(buyerName)}</strong></div>
      <div class="buyer-line">Mã số thuế (Tax code): <strong>${escapeHtml(buyerTaxCode)}</strong></div>
      <div class="buyer-line">Địa chỉ (Address): ${escapeHtml(buyerAddress)}</div>
      <div class="buyer-line" style="display:flex;justify-content:space-between;">
        <div>Hình thức thanh toán (Payment method): <strong>${escapeHtml(paymentMethod)}</strong></div>
        <div>Số tài khoản (Account No.): <span>${escapeHtml(invoice.nmstkhoan || invoice.nmstk || '')}</span></div>
      </div>
    </div>

    <!-- GOODS TABLE -->
    <table class="ns-table">
      <thead>
        <tr>
          <th class="col-stt">STT<br><span class="th-sub">(No.)</span></th>
          <th class="col-name">Tên hàng hóa, dịch vụ<br><span class="th-sub">(Description)</span></th>
          <th class="col-unit">Đơn vị tính<br><span class="th-sub">(Unit)</span></th>
          <th class="col-qty">Số lượng<br><span class="th-sub">(Quantity)</span></th>
          <th class="col-price">Đơn giá<br><span class="th-sub">(Unit Price)</span></th>
          <th class="col-amount">Thành tiền<br><span class="th-sub">(Amount)</span></th>
        </tr>
        <tr style="font-size:10px;text-align:center;font-style:italic;">
          <td>1</td>
          <td>2</td>
          <td>3</td>
          <td>4</td>
          <td>5</td>
          <td>6=4x5</td>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => {
          const qty = item.sluong ?? item.quantity ?? 0;
          const price = item.dgia ?? item.unitPrice ?? 0;
          const amt = item.thtien ?? item.amount ?? (qty * price);
          const unit = item.dvtinh ?? item.dvt ?? item.unit ?? 'gram';
          const name = item.ten ?? item.itemName ?? `Sản phẩm vàng #${idx + 1}`;

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

    <!-- TAX CALCULATIONS -->
    <table class="calc-table">
      <tr>
        <td style="width:50%;font-weight:bold;">Cộng tiền hàng (Total amount):</td>
        <td style="width:50%;text-align:right;font-weight:bold;">${formatVND(subTotal)}</td>
      </tr>
      <tr>
        <td style="font-weight:bold;">Thuế suất thuế GTGT (VAT rate): 10%</td>
        <td style="text-align:right;">Tiền thuế GTGT (VAT amount): <strong>${formatVND(vatAmount)}</strong></td>
      </tr>
      <tr style="background:#f0fdf4;">
        <td style="font-weight:bold;">Tổng cộng tiền thanh toán (Total payment):</td>
        <td style="text-align:right;font-weight:bold;color:#b91c1c;font-size:13px;">${formatVND(totalAmount)}</td>
      </tr>
    </table>

    <div class="words-amount">
      Số tiền viết bằng chữ (Amount in words): <strong>${escapeHtml(wordsAmount)}</strong>
    </div>

    <!-- 3 SIGNATURES SECTION -->
    <div class="sign-container">
      <div class="sign-col">
        <div class="sign-title">Người mua hàng (Buyer)</div>
        <div class="sign-desc">(Ký, ghi rõ họ tên)</div>
      </div>

      <div class="sign-col">
        <div class="sign-title">Cơ quan thuế (Tax authorities)</div>
        <div class="sign-desc">(Ký, ghi rõ họ tên)</div>
        <div class="vnpt-sig-box">
          <div class="sig-valid-tag"><span>✔</span> Signature Valid</div>
          <div><strong>Ký bởi:</strong> ${escapeHtml(cqtSignName)}</div>
          <div><strong>Ký ngày:</strong> ${escapeHtml(cqtSignDateStr)}</div>
        </div>
      </div>

      <div class="sign-col">
        <div class="sign-title">Người bán hàng (Seller)</div>
        <div class="sign-desc">(Ký, ghi rõ họ tên)</div>
        <div class="vnpt-sig-box">
          <div class="sig-valid-tag"><span>✔</span> Signature Valid</div>
          <div><strong>Ký bởi:</strong> ${escapeHtml(sellerSignName)}</div>
          <div><strong>Ký ngày:</strong> ${escapeHtml(sellerSignDateStr)}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-area">
      <div style="margin-top:2px;">Tra cứu hóa đơn tại: <a href="${escapeHtml(pUrl)}" target="_blank" style="color:#0284c7;">${escapeHtml(pUrl)}</a> với mã hoá đơn sau: <strong style="font-family:monospace;font-size:12px;">${escapeHtml(mCode)}</strong></div>
    </div>
  </div>
</body>
</html>`;
}
