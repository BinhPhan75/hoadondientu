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

/**
 * Bản thể hiện chuẩn hóa đơn điện tử VNPAY Invoice
 * (portal.vnpayinvoice.vn / Cổng Vietcombank einvoice.vietcombank.com.vn)
 * Phát hành bởi Công ty CP Giải pháp Thanh toán Việt Nam (MST: 0102182292)
 */
export function renderVnpayTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  
  // Lọc bỏ mã không hợp lệ như Vietcombank hay mã thông điệp T-VAN
  const isInvalidCode = (code?: string) => !code || 
    code.toLowerCase() === 'vietcombank' || 
    /^[VTMB]\d{10,14}[A-Za-z0-9]{16,}$/i.test(code.trim()) ||
    (code.includes('0102182292') && code.length > 20);

  const mCode = (!isInvalidCode(lookupCode) ? lookupCode : (!isInvalidCode(invoice.lookupCode) ? invoice.lookupCode : '')) || '';
  
  const isVcb = invoice.nbmst === '0100112437' || (invoice.nbten || '').toUpperCase().includes('VIETCOMBANK');
  const defaultPortalUrl = isVcb ? 'https://einvoice.vietcombank.com.vn/' : 'https://portal.vnpayinvoice.vn/';
  const pUrl = lookupUrl || invoice.lookupUrl || defaultPortalUrl;
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, 'VNPAY', invoice.nbmst);

  const qrPayload = invoice.mhdon 
    ? `https://hoadondientu.gdt.gov.vn/tra-cuu?cqt=${encodeURIComponent(invoice.mhdon)}`
    : `MST:${invoice.nbmst};KH:${invoice.khhdon};SHD:${invoice.shdon};MTC:${mCode}`;
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(qrPayload);
  
  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const vatAmount = typeof invoice.tgtthue === 'number' ? invoice.tgtthue : 0;
  const subTotal = typeof invoice.tgtcthue === 'number' 
    ? invoice.tgtcthue 
    : (totalAmount - vatAmount > 0 ? totalAmount - vatAmount : totalAmount);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const taxAuthorityCode = invoice.mhdon || '';
  const showControls = options?.showPrintControls !== false;

  const mauSo = (invoice as any).khmshdon || (invoice.khhdon ? invoice.khhdon.charAt(0) : '1');
  const kyHieu = invoice.khhdon || '';
  const soHdon = invoice.shdon || '';

  // Xác định tiêu đề hóa đơn
  let invoiceTitle = invoice.thdon || '';
  if (!invoiceTitle) {
    if (kyHieu.startsWith('2')) {
      invoiceTitle = 'HÓA ĐƠN BÁN HÀNG';
    } else {
      invoiceTitle = 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG';
    }
  } else {
    invoiceTitle = invoiceTitle.toUpperCase();
  }

  const isVatInvoice = !kyHieu.startsWith('2') && (vatAmount > 0 || invoiceTitle.includes('GIÁ TRỊ GIA TĂNG'));
  const paymentMethod = invoice.htttoan || 'TM/CK';

  // Nhóm các dòng theo thuế suất
  const taxRateGroups: { [rate: string]: { subTotal: number; taxAmount: number } } = {};
  items.forEach(it => {
    const rate = it.taxRate || it.tsuat || (isVatInvoice ? '10%' : 'KCT');
    if (!taxRateGroups[rate]) {
      taxRateGroups[rate] = { subTotal: 0, taxAmount: 0 };
    }
    const itemSubTotal = it.amount || it.thtien || 0;
    taxRateGroups[rate].subTotal += itemSubTotal;
    taxRateGroups[rate].taxAmount += (it.taxAmount || it.tthue || 0);
  });

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(invoiceTitle)} - ${escapeHtml(invoice.nbten || 'VNPAY')} - Số: ${escapeHtml(soHdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      color: #0f172a;
      font-size: 13px;
      line-height: 1.4;
    }
    .invoice-card {
      max-width: 840px;
      margin: 0 auto;
      background: #fff;
      border: 1.5px solid #005baa;
      padding: 24px 28px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      position: relative;
    }
    .watermark-bg {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 58px;
      color: rgba(0, 91, 170, 0.035);
      font-weight: 800;
      pointer-events: none;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 4px;
      user-select: none;
      z-index: 0;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #005baa;
      padding-bottom: 14px;
      margin-bottom: 14px;
      position: relative;
      z-index: 1;
    }
    .brand-section {
      display: flex;
      align-items: center;
      gap: 14px;
      flex: 1;
    }
    .vnpay-logo-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #005baa 0%, #003e75 100%);
      color: #fff;
      padding: 8px 14px;
      border-radius: 6px;
      min-width: 100px;
      text-align: center;
    }
    .vnpay-logo-badge .brand-title {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 1px;
      color: #fff;
      line-height: 1.1;
    }
    .vnpay-logo-badge .brand-sub {
      font-size: 9px;
      letter-spacing: 1.5px;
      color: #fbbf24;
      font-weight: 700;
      text-transform: uppercase;
    }
    .seller-header-info {
      flex: 1;
    }
    .seller-header-info h2 {
      margin: 0 0 4px 0;
      font-size: 15px;
      font-weight: 700;
      color: #005baa;
      text-transform: uppercase;
      line-height: 1.25;
    }
    .seller-header-info .meta-line {
      font-size: 12px;
      color: #334155;
      margin: 2px 0;
    }
    .invoice-meta-box {
      min-width: 210px;
      text-align: right;
      padding-left: 16px;
    }
    .invoice-meta-box .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 3px;
    }
    .invoice-meta-box .meta-label {
      color: #64748b;
    }
    .invoice-meta-box .meta-val {
      font-weight: 700;
      color: #0f172a;
    }
    .invoice-meta-box .so-hd {
      color: #ed1c24;
      font-size: 16px;
      font-weight: 800;
    }

    .title-section {
      text-align: center;
      margin: 14px 0 12px 0;
      position: relative;
      z-index: 1;
    }
    .title-section h1 {
      margin: 0;
      font-size: 21px;
      font-weight: 800;
      color: #005baa;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .title-section .cqt-badge {
      display: inline-block;
      margin-top: 4px;
      font-size: 11px;
      font-style: italic;
      color: #475569;
    }
    .title-section .cqt-code-box {
      margin-top: 4px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      border: 1px dashed #3b82f6;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 12px;
      color: #1e40af;
      font-weight: 700;
    }
    .title-section .date-line {
      margin-top: 4px;
      font-size: 12.5px;
      font-style: italic;
      color: #334155;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      margin-bottom: 14px;
      position: relative;
      z-index: 1;
    }
    .info-box {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 10px 14px;
      background: #fdfefe;
    }
    .info-box-header {
      font-weight: 700;
      color: #005baa;
      font-size: 13px;
      text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    .info-table td {
      padding: 3px 0;
      vertical-align: top;
    }
    .info-table .lbl {
      width: 140px;
      color: #475569;
      font-weight: 600;
    }
    .info-table .val {
      color: #0f172a;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      position: relative;
      z-index: 1;
      font-size: 12.5px;
    }
    .items-table th, .items-table td {
      border: 1px solid #94a3b8;
      padding: 6px 8px;
    }
    .items-table th {
      background: #005baa;
      color: #ffffff;
      font-weight: 700;
      text-align: center;
      font-size: 12px;
    }
    .items-table th.col-sub {
      background: #004684;
      font-size: 11px;
      font-weight: normal;
    }
    .items-table td.center { text-align: center; }
    .items-table td.right { text-align: right; }
    .items-table tr:nth-child(even) td { background-color: #f8fafc; }

    .summary-section {
      margin-bottom: 16px;
      position: relative;
      z-index: 1;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
      border: 1px solid #94a3b8;
    }
    .summary-table td {
      padding: 6px 12px;
      border: 1px solid #cbd5e1;
    }
    .summary-table .sum-lbl {
      text-align: right;
      font-weight: 600;
      color: #334155;
      background: #f8fafc;
    }
    .summary-table .sum-val {
      text-align: right;
      font-weight: 700;
      color: #0f172a;
      width: 170px;
    }
    .summary-table .total-row td {
      background: #eff6ff;
      border-top: 2px solid #005baa;
      font-size: 13.5px;
    }
    .summary-table .total-val {
      color: #ed1c24 !important;
      font-size: 15px !important;
      font-weight: 800 !important;
    }
    .amount-words-box {
      margin-top: 8px;
      padding: 8px 12px;
      background: #f1f5f9;
      border-left: 4px solid #005baa;
      font-size: 12.5px;
      font-style: italic;
      color: #1e293b;
    }

    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 18px;
      margin-bottom: 18px;
      position: relative;
      z-index: 1;
    }
    .sig-box {
      text-align: center;
      padding: 10px;
    }
    .sig-box .sig-title {
      font-weight: 700;
      text-transform: uppercase;
      color: #005baa;
      font-size: 13px;
    }
    .sig-box .sig-note {
      font-size: 11.5px;
      font-style: italic;
      color: #64748b;
      margin-top: 2px;
    }
    .sig-stamp {
      margin-top: 14px;
      border: 1.5px dashed #16a34a;
      background: #f0fdf4;
      border-radius: 6px;
      padding: 10px;
      display: inline-block;
      min-width: 220px;
      text-align: left;
    }
    .sig-stamp .stamp-title {
      color: #15803d;
      font-weight: 800;
      font-size: 11px;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
    }
    .sig-stamp .stamp-detail {
      font-size: 11px;
      color: #166534;
      line-height: 1.35;
    }

    .footer-box {
      border-top: 1.5px solid #005baa;
      padding-top: 12px;
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      z-index: 1;
      font-size: 11.5px;
      color: #475569;
    }
    .footer-links a {
      color: #005baa;
      font-weight: 700;
      text-decoration: none;
    }
    .footer-links a:hover {
      text-decoration: underline;
    }
    .vnpay-powered {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .qr-container {
      width: 54px;
      height: 54px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-container img, .qr-container svg {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    @media print {
      body { background: #fff; padding: 0; }
      .invoice-card { border: 1.5px solid #005baa; box-shadow: none; padding: 14mm 16mm; max-width: 100%; }
      .print-actions { display: none !important; }
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml(`Hóa đơn VNPAY: ${invoice.nbten || 'VNPAY'} - Số: ${soHdon}`) : ''}

  <div class="invoice-card">
    <div class="watermark-bg">VNPAY INVOICE</div>

    <!-- Header -->
    <div class="header-row">
      <div class="brand-section">
        <div class="vnpay-logo-badge">
          <span class="brand-title">VNPAY</span>
          <span class="brand-sub">INVOICE</span>
        </div>
        <div class="seller-header-info">
          <h2>${escapeHtml(invoice.nbten || 'CÔNG TY CỔ PHẦN GIẢI PHÁP THANH TOÁN VIỆT NAM')}</h2>
          <div class="meta-line"><strong>Mã số thuế:</strong> ${renderSpacedTaxCode(invoice.nbmst || '0102182292')}</div>
          <div class="meta-line"><strong>Địa chỉ:</strong> ${escapeHtml(invoice.nbdchi || 'Tầng 8, Số 22 phố Láng Hạ, Phường Láng Hạ, Quận Đống Đa, TP Hà Nội, Việt Nam')}</div>
          ${invoice.nbsdt ? `<div class="meta-line"><strong>Điện thoại:</strong> ${escapeHtml(invoice.nbsdt)}</div>` : ''}
          ${invoice.nbemail ? `<div class="meta-line"><strong>Email:</strong> ${escapeHtml(invoice.nbemail)}</div>` : ''}
        </div>
      </div>

      <div class="invoice-meta-box">
        <div class="meta-row">
          <span class="meta-label">Mẫu số (Form):</span>
          <span class="meta-val">${escapeHtml(mauSo)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Ký hiệu (Serial):</span>
          <span class="meta-val">${escapeHtml(kyHieu)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Số (No.):</span>
          <span class="meta-val so-hd">${escapeHtml(soHdon)}</span>
        </div>
        ${taxAuthorityCode ? `
        <div class="meta-row" style="margin-top:4px;">
          <span class="meta-label">Mã CQT:</span>
          <span class="meta-val" style="font-size:11px;color:#0284c7;">${escapeHtml(taxAuthorityCode)}</span>
        </div>` : ''}
      </div>
    </div>

    <!-- Title Section -->
    <div class="title-section">
      <h1>${escapeHtml(invoiceTitle)}</h1>
      <div class="cqt-badge">
        ${taxAuthorityCode ? 'Hóa đơn điện tử có mã của cơ quan thuế' : 'Hóa đơn điện tử khởi tạo từ máy tính tiền / không có mã CQT'}
      </div>
      ${taxAuthorityCode ? `
      <div>
        <span class="cqt-code-box">
          <span>🏛️ Mã CQT:</span>
          <span>${escapeHtml(taxAuthorityCode)}</span>
        </span>
      </div>` : ''}
      <div class="date-line">
        Ngày ${escapeHtml(day)} tháng ${escapeHtml(month)} năm ${escapeHtml(year)}
      </div>
    </div>

    <!-- Buyer & Seller Info -->
    <div class="info-grid">
      <div class="info-box">
        <div class="info-box-header">Thông Tin Người Mua Hàng (Customer)</div>
        <table class="info-table">
          <tr>
            <td class="lbl">Họ tên người mua:</td>
            <td class="val"><strong>${escapeHtml(invoice.nmten || 'Khách hàng không lấy hóa đơn')}</strong></td>
          </tr>
          ${invoice.nmmst ? `
          <tr>
            <td class="lbl">Mã số thuế:</td>
            <td class="val">${renderSpacedTaxCode(invoice.nmmst)}</td>
          </tr>` : ''}
          ${invoice.nmdchi ? `
          <tr>
            <td class="lbl">Địa chỉ:</td>
            <td class="val">${escapeHtml(invoice.nmdchi)}</td>
          </tr>` : ''}
          <tr>
            <td class="lbl">Hình thức thanh toán:</td>
            <td class="val">${escapeHtml(paymentMethod)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 40px;">STT</th>
          <th>Tên hàng hóa, dịch vụ</th>
          <th style="width: 60px;">ĐVT</th>
          <th style="width: 65px;">Số lượng</th>
          <th style="width: 95px;">Đơn giá</th>
          <th style="width: 110px;">Thành tiền</th>
          ${isVatInvoice ? '<th style="width: 70px;">Thuế suất</th>' : ''}
        </tr>
        <tr>
          <th class="col-sub">(1)</th>
          <th class="col-sub">(2)</th>
          <th class="col-sub">(3)</th>
          <th class="col-sub">(4)</th>
          <th class="col-sub">(5)</th>
          <th class="col-sub">(6 = 4 × 5)</th>
          ${isVatInvoice ? '<th class="col-sub">(7)</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${items.length > 0 ? items.map((item, idx) => `
          <tr>
            <td class="center">${idx + 1}</td>
            <td><strong>${escapeHtml(item.itemName || item.ten || 'Dịch vụ / Hàng hóa')}</strong></td>
            <td class="center">${escapeHtml(item.unit || item.dvt || '')}</td>
            <td class="right">${formatNum(item.quantity || item.sluong || 0)}</td>
            <td class="right">${formatVND(item.unitPrice || item.dgia || 0)}</td>
            <td class="right">${formatVND(item.amount || item.thtien || 0)}</td>
            ${isVatInvoice ? `<td class="center">${escapeHtml(item.taxRate || item.tsuat || '10%')}</td>` : ''}
          </tr>
        `).join('') : `
          <tr>
            <td class="center">1</td>
            <td><strong>Cung cấp dịch vụ / Hàng hóa thanh toán</strong></td>
            <td class="center">Gói</td>
            <td class="right">1</td>
            <td class="right">${formatVND(totalAmount)}</td>
            <td class="right">${formatVND(totalAmount)}</td>
            ${isVatInvoice ? '<td class="center">10%</td>' : ''}
          </tr>
        `}
      </tbody>
    </table>

    <!-- Summary Section -->
    <div class="summary-section">
      <table class="summary-table">
        ${isVatInvoice ? `
        <tr>
          <td class="sum-lbl">Cộng tiền hàng (Subtotal):</td>
          <td class="sum-val">${formatVND(subTotal)}</td>
        </tr>
        <tr>
          <td class="sum-lbl">Tiền thuế GTGT (VAT Amount):</td>
          <td class="sum-val">${formatVND(vatAmount)}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td class="sum-lbl" style="font-weight: 700; color: #005baa;">Tổng cộng tiền thanh toán (Total Payment):</td>
          <td class="sum-val total-val">${formatVND(totalAmount)} VND</td>
        </tr>
      </table>
      <div class="amount-words-box">
        <strong>Số tiền viết bằng chữ:</strong> ${escapeHtml(wordsAmount)}.
      </div>
    </div>

    <!-- Signatures -->
    <div class="signature-grid">
      <div class="sig-box">
        <div class="sig-title">Người mua hàng</div>
        <div class="sig-note">(Ký, ghi rõ họ tên)</div>
      </div>

      <div class="sig-box">
        <div class="sig-title">Người bán hàng</div>
        <div class="sig-note">(Ký điện tử, ghi rõ họ tên)</div>
        <div class="sig-stamp">
          <div class="stamp-title">
            <span>✓</span> KÝ BỞI: ${escapeHtml(invoice.nbten || 'VNPAY')}
          </div>
          <div class="stamp-detail">
            <div>Ngày ký: ${escapeHtml(day)}/${escapeHtml(month)}/${escapeHtml(year)}</div>
            <div>Trạng thái: <strong>Hợp lệ</strong> theo Nghị định 123/2020/NĐ-CP</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer-box">
      <div class="footer-links">
        <div><strong>Tra cứu hóa đơn:</strong> <a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pUrl)}</a></div>
        ${mCode ? `<div><strong>Số bảo mật:</strong> <span style="font-family:monospace;font-weight:700;color:#005baa;">${escapeHtml(mCode)}</span></div>` : `<div><em>Đã xác thực mã Cơ quan Thuế cấp: <strong>${escapeHtml(taxAuthorityCode || 'Hợp lệ')}</strong></em></div>`}
        <div style="font-size: 11px; margin-top: 3px; color: #64748b;">Giải pháp HĐĐT VNPAY Invoice (Công ty CP Giải pháp Thanh toán Việt Nam)</div>
      </div>

      <div class="vnpay-powered">
        <div class="qr-container">
          <img src="${qrImg}" alt="QR Tra cứu hóa đơn" />
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
