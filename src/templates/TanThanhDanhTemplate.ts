import { GDTInvoice } from '../types';
import { ensureInvoiceItems } from '../utils/xmlParser';
import { 
  escapeHtml, 
  formatVND, 
  extractDateParts, 
  extractLookupDetails, 
  generateDefaultQrSvg, 
  getPrintControlsHtml,
  numberToVietnameseWords,
  buildDirectLookupUrl
} from './templateUtils';
import { RenderTemplateOptions } from './types';

/**
 * Mẫu Hóa đơn bán hàng điện tử - CÔNG TY TNHH KINH DOANH VÀNG BẠC TÂN THANH DANH
 * Nhà cung cấp giải pháp HĐĐT: MISA meInvoice (Công ty Cổ phần MISA - MST: 0101243150)
 * Cổng tra cứu: https://www.meinvoice.vn/tra-cuu
 * Mở trực tiếp kèm ?code=[MÃ_TRA_CỨU] tự động hiển thị hóa đơn không cần captcha.
 */
export function renderTanThanhDanhTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  
  const mCode = lookupCode || invoice.lookupCode || '';
  const pUrl = 'https://www.meinvoice.vn/tra-cuu';
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, 'MISA', invoice.nbmst || '0317978711');
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:${invoice.nbmst || '0317978711'};KH:${invoice.khhdon || '2C26MTD'};SHD:${invoice.shdon || ''};MTC:${mCode}`);

  const items = ensureInvoiceItems(invoice);
  const calculatedTotal = items.reduce((sum, item) => sum + (Number(item.amount || item.thtien || 0)), 0);
  const totalAmount = typeof invoice.tgtttbso === 'number' && invoice.tgtttbso > 0 ? invoice.tgtttbso : calculatedTotal;
  const wordsAmount = invoice.tgtttbchu || (totalAmount > 0 ? numberToVietnameseWords(totalAmount) : '');
  const maCqt = invoice.mhdon || '';
  const showControls = options?.showPrintControls !== false;

  const sellerName = invoice.nbten || 'CÔNG TY TNHH KINH DOANH VÀNG BẠC TÂN THANH DANH';
  const sellerTaxCode = invoice.nbmst || '0317978711';
  const sellerAddress = invoice.nbdchi || (invoice as any).nmdchi_seller || '25-27 An Dương Vương, Phường 08, Quận 5, Thành phố Hồ Chí Minh, Việt Nam';
  const sellerPhone = (invoice as any).sdt_seller || (invoice as any).nbsdt || '028 3835 1868';
  const sellerBank = invoice.nbstk ? `${invoice.nbstk}${invoice.nbnhang ? ` - ${invoice.nbnhang}` : ''}` : '';

  const buyerName = invoice.nmten || 'CÔNG TY TNHH MỘT THÀNH VIÊN VÀNG BẠC NGHĨA TÍN';
  const buyerTaxCode = invoice.nmmst || '4000926165';
  const buyerAddress = invoice.nmdchi || '448 Phan Chu Trinh, Phường Tam Kỳ, Thành phố Tam Kỳ, Tỉnh Quảng Nam, Việt Nam';
  const paymentMethod = invoice.htttoan || 'TM/CK';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN BÁN HÀNG - ${escapeHtml(sellerName)} - Số: ${escapeHtml(invoice.shdon || '')}</title>
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
      .invoice-outer { box-shadow: none !important; border: 3px double #047857 !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #047857;
      border-radius: 4px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
      position: relative;
      padding: 6px;
    }
    .invoice-inner {
      border: 1px solid #10b981;
      padding: 16px 20px 14px 20px;
      position: relative;
    }
    .header-layout {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      border-bottom: 1.5px solid #047857;
      padding-bottom: 12px;
    }
    .logo-box {
      width: 78px;
      height: 78px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid #047857;
      border-radius: 6px;
      background: #ecfdf5;
      color: #047857;
      font-size: 26px;
      font-weight: bold;
    }
    .seller-info {
      flex: 1;
      padding: 0 4px;
    }
    .seller-name {
      font-size: 15px;
      font-weight: bold;
      color: #065f46;
      text-transform: uppercase;
      margin-bottom: 4px;
      line-height: 1.25;
    }
    .seller-detail {
      font-size: 12.5px;
      color: #1e293b;
      margin-bottom: 2px;
    }
    .qr-box {
      width: 80px;
      flex-shrink: 0;
      text-align: right;
    }
    .qr-box img {
      width: 76px;
      height: 76px;
      display: block;
      margin-left: auto;
    }
    
    .title-area {
      text-align: center;
      margin-top: 10px;
      margin-bottom: 10px;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: bold;
      color: #047857;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .invoice-date {
      font-style: italic;
      font-size: 12.5px;
      color: #334155;
    }
    .invoice-meta-grid {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 4px;
      font-size: 12.5px;
    }
    
    .buyer-section {
      background: #f0fdf4;
      border: 1px dashed #6ee7b7;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 10px;
      font-size: 12.5px;
    }
    .buyer-row {
      display: flex;
      margin-bottom: 3px;
    }
    .buyer-label {
      width: 140px;
      flex-shrink: 0;
      color: #334155;
    }
    .buyer-val {
      flex: 1;
      font-weight: 500;
      color: #0f172a;
    }

    /* Bảng hàng hóa */
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #047857;
      font-size: 12px;
      margin-bottom: 8px;
    }
    table.items-table th, table.items-table td {
      border: 1px solid #047857;
      padding: 5px 6px;
    }
    table.items-table th {
      background: #ecfdf5;
      color: #065f46;
      font-weight: bold;
      text-align: center;
    }
    .col-stt { width: 36px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 55px; text-align: center; }
    .col-qty { width: 60px; text-align: right; }
    .col-price { width: 95px; text-align: right; }
    .col-amount { width: 110px; text-align: right; }

    .summary-area {
      border: 1px solid #047857;
      border-top: none;
      background: #fafaf9;
      padding: 6px 10px;
      font-size: 12.5px;
      margin-top: -8px;
      margin-bottom: 12px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }

    .sign-container {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      margin-bottom: 12px;
    }
    .sign-col {
      width: 48%;
      text-align: center;
    }
    .sign-title {
      font-weight: bold;
      font-size: 13px;
      text-transform: uppercase;
      color: #065f46;
    }
    .sign-desc {
      font-style: italic;
      font-size: 11px;
      color: #64748b;
      margin-top: 1px;
    }
    .misa-sig-box {
      margin-top: 10px;
      border: 1.5px solid #16a34a;
      background: #f0fdf4;
      border-radius: 4px;
      padding: 6px 10px;
      display: inline-block;
      text-align: left;
      font-size: 11px;
      color: #15803d;
      min-width: 220px;
    }
    .sig-valid-header {
      display: flex;
      align-items: center;
      gap: 5px;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 2px;
      border-bottom: 1px solid #bbf7d0;
      padding-bottom: 2px;
    }

    /* FOOTER */
    .footer-area {
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
      margin-top: 10px;
      text-align: center;
      font-size: 11.5px;
      color: #334155;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml('Hóa đơn Tân Thanh Danh') : ''}

  <div class="invoice-outer">
    <div class="invoice-inner">
      <!-- HEADER -->
      <div class="header-layout">
        <div class="logo-box">
          TTD
        </div>

        <div class="seller-info">
          <div class="seller-name">${escapeHtml(sellerName)}</div>
          <div class="seller-detail"><strong>Mã số thuế:</strong> <span style="font-family:monospace;font-weight:bold;font-size:13px;color:#065f46;">${escapeHtml(sellerTaxCode)}</span></div>
          <div class="seller-detail"><strong>Địa chỉ:</strong> ${escapeHtml(sellerAddress)}</div>
          <div class="seller-detail"><strong>Điện thoại:</strong> ${escapeHtml(sellerPhone)}</div>
          <div class="seller-detail"><strong>Số tài khoản:</strong> ${escapeHtml(sellerBank)}</div>
        </div>

        <div class="qr-box">
          <img src="${qrImg}" alt="QR Tra cứu" />
        </div>
      </div>

      <!-- TITLE -->
      <div class="title-area">
        <div class="invoice-title">HÓA ĐƠN BÁN HÀNG</div>
        <div class="invoice-date">Ngày ${escapeHtml(day)} tháng ${escapeHtml(month)} năm ${escapeHtml(year)}</div>
        <div class="invoice-meta-grid">
          <div>Ký hiệu: <strong style="font-family:monospace;color:#065f46;">${escapeHtml(invoice.khhdon || '2C26MTD')}</strong></div>
          <div>Số: <strong style="font-family:monospace;font-size:14px;color:#b91c1c;">${escapeHtml(invoice.shdon || '00001667')}</strong></div>
        </div>
        <div style="font-size:11.5px;color:#475569;margin-top:3px;">
          Mã của CQT: <strong style="font-family:monospace;color:#047857;">${escapeHtml(maCqt)}</strong>
        </div>
      </div>

      <!-- BUYER -->
      <div class="buyer-section">
        <div class="buyer-row">
          <div class="buyer-label">Họ tên người mua hàng:</div>
          <div class="buyer-val">${escapeHtml((invoice as any).tennguoimua || invoice.nmten || '')}</div>
        </div>
        <div class="buyer-row">
          <div class="buyer-label">Tên đơn vị:</div>
          <div class="buyer-val" style="font-weight:bold;color:#065f46;">${escapeHtml(buyerName)}</div>
        </div>
        <div class="buyer-row">
          <div class="buyer-label">Mã số thuế:</div>
          <div class="buyer-val" style="font-family:monospace;font-weight:bold;">${escapeHtml(buyerTaxCode)}</div>
        </div>
        <div class="buyer-row">
          <div class="buyer-label">Địa chỉ:</div>
          <div class="buyer-val">${escapeHtml(buyerAddress)}</div>
        </div>
        <div class="buyer-row">
          <div class="buyer-label">Hình thức thanh toán:</div>
          <div class="buyer-val">${escapeHtml(paymentMethod)} &nbsp;&nbsp;|&nbsp;&nbsp; Đồng tiền thanh toán: <strong>VND</strong></div>
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-stt">STT</th>
            <th class="col-name">Tên hàng hóa, dịch vụ</th>
            <th class="col-unit">ĐVT</th>
            <th class="col-qty">Số lượng</th>
            <th class="col-price">Đơn giá</th>
            <th class="col-amount">Thành tiền</th>
          </tr>
          <tr style="font-size:10.5px;background:#f8fafc;color:#64748b;">
            <th>(1)</th>
            <th>(2)</th>
            <th>(3)</th>
            <th>(4)</th>
            <th>(5)</th>
            <th>(6) = (4) x (5)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
            <tr>
              <td class="col-stt">${index + 1}</td>
              <td class="col-name">${escapeHtml(item.itemName || item.ten || 'Hàng hóa dịch vụ')}</td>
              <td class="col-unit">${escapeHtml(item.unit || item.dvt || '')}</td>
              <td class="col-qty">${item.quantity ? item.quantity.toLocaleString('vi-VN') : (item.sluong ? item.sluong.toLocaleString('vi-VN') : '1')}</td>
              <td class="col-price">${formatVND(item.unitPrice || item.dgia || item.amount || 0)}</td>
              <td class="col-amount" style="font-weight:bold;">${formatVND(item.amount || item.thtien || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- SUMMARY -->
      <div class="summary-area">
        <div class="summary-row">
          <div><strong>Cộng tiền bán hàng hóa, dịch vụ:</strong></div>
          <div><strong style="color:#b91c1c;font-size:13.5px;">${formatVND(totalAmount)} đ</strong></div>
        </div>
        <div style="font-style:italic;margin-top:2px;color:#334155;">
          Số tiền viết bằng chữ: <strong>${escapeHtml(wordsAmount)} đồng.</strong>
        </div>
      </div>

      <!-- SIGNATURES -->
      <div class="sign-container">
        <div class="sign-col">
          <div class="sign-title">Người mua hàng</div>
          <div class="sign-desc">(Ký, ghi rõ họ tên)</div>
        </div>

        <div class="sign-col">
          <div class="sign-title">Người bán hàng</div>
          <div class="sign-desc">(Ký, ghi rõ họ tên)</div>
          
          <div class="misa-sig-box">
            <div class="sig-valid-header">
              <span style="color:#15803d;font-size:14px;">✔</span>
              <span>Signature Valid</span>
            </div>
            <div><strong>Ký bởi:</strong> ${escapeHtml(sellerName)}</div>
            <div><strong>Ký ngày:</strong> ${escapeHtml(day)}/${escapeHtml(month)}/${escapeHtml(year)}</div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer-area">
        <div>Tra cứu tại Website: <a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color:#059669;text-decoration:underline;font-weight:bold;">${escapeHtml(pUrl)}</a>${mCode ? ` - Mã tra cứu hóa đơn: <strong style="font-family:monospace;font-size:12.5px;color:#065f46;">${escapeHtml(mCode)}</strong>` : ''}</div>
        <div style="font-style:italic;color:#64748b;margin-top:2px;">(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)</div>
        <div style="font-size:10.5px;color:#475569;margin-top:3px;">Phát hành bởi phần mềm MISA meInvoice - Công ty Cổ phần MISA (www.misa.vn) - MST 0101243150</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
