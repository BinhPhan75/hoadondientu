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

/**
 * Mẫu hóa đơn TỔNG QUÁT cho mọi hóa đơn khởi tạo từ phần mềm 4SI (Công ty
 * TNHH L.C.S, MST 0302999571) — áp dụng cho BẤT KỲ người bán nào dùng phần
 * mềm này, không riêng PNJ. Bố cục dựa trên hóa đơn thật đã đối chiếu:
 * khung 7 cột (STT/Tên hàng hóa dịch vụ/Đơn vị tính/Loại SP/Số lượng
 * (Trọng lượng)/Đơn giá/Thành tiền), khối "Đơn vị bán hàng" lặp lại ở đầu,
 * dòng nhắc "Khởi tạo từ phần mềm..." ở trên cùng, và mục tra cứu ở footer
 * chỉ hiện khi có mã tra cứu thật (4SI không gửi kèm mã tra cứu công khai
 * trong dữ liệu GDT nên phần lớn trường hợp sẽ không có mục này).
 *
 * Toàn bộ tên người bán/địa chỉ/MST/logo chữ đầu đều lấy ĐỘNG từ dữ liệu
 * hóa đơn thật — không hardcode riêng cho công ty nào.
 */
export function renderFourSiTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);

  const mCode = lookupCode || invoice.lookupCode || '';
  const pUrl = lookupUrl || invoice.lookupUrl || 'https://inv.4si.vn/tra-cuu-hoa-don';

  const sellerName = invoice.nbten || 'Đơn vị bán hàng';
  const sellerMst = invoice.nbmst || '';
  const sellerAddress = invoice.nbdchi || '';
  const sellerPhone = invoice.nbsdt || '';

  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(
    `MST:${sellerMst};KH:${invoice.khhdon};SHD:${invoice.shdon}${mCode ? `;MTC:${mCode}` : ''}`
  );

  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const maCqt = invoice.mhdon || '';
  const showControls = options?.showPrintControls !== false;

  const buyerName = invoice.nmten || '';
  const buyerTaxCode = invoice.nmmst || '';
  const buyerAddress = invoice.nmdchi || '';
  const paymentMethod = invoice.htttoan || '';

  // Chữ cái đầu của tên công ty, dùng làm "logo" chữ trung tính (không giả
  // mạo logo thật của bất kỳ thương hiệu nào).
  const initials = sellerName
    .replace(/CÔNG TY|TNHH|MTV|CỔ PHẦN|DOANH NGHIỆP TƯ NHÂN/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>HÓA ĐƠN BÁN HÀNG - ${escapeHtml(sellerName)} - Số: ${escapeHtml(invoice.shdon)}</title>
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
    .print-actions { max-width: 820px; margin: 0 auto 16px auto; }
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
    .fsi-logo-block {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      flex-shrink: 0;
      border-radius: 8px;
      background: #f1f5f9;
      border: 1.5px solid #cbd5e1;
    }
    .fsi-logo-initials {
      font-family: 'Times New Roman', serif;
      font-size: 22px;
      font-weight: bold;
      color: #0c4a6e;
      letter-spacing: 0.5px;
    }
    .seller-text-block { flex: 1; font-size: 12px; line-height: 1.35; }
    .seller-company-name { font-size: 13.5px; font-weight: bold; color: #000; }
    .title-banner { text-align: center; margin: 6px 0 10px 0; }
    .main-title { font-size: 23px; font-weight: bold; letter-spacing: 0.5px; margin: 0; }
    .invoice-date { font-size: 13px; margin: 3px 0; }
    .cqt-code { font-size: 13px; font-weight: bold; font-family: monospace; margin-top: 2px; }
    .meta-tags-right {
      display: flex; justify-content: flex-end; gap: 24px;
      font-size: 13px; font-weight: 500; margin-top: -30px; margin-bottom: 12px;
    }
    .barcode-qr-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .qr-sub-block { display: flex; flex-direction: column; align-items: center; width: 90px; }
    .qr-img { width: 80px; height: 80px; display: block; border: 1px solid #ddd; }
    .qr-subtext { font-size: 10px; font-weight: bold; font-family: monospace; margin-top: 2px; }
    .buyer-panel { border: 1px solid #000; padding: 8px 10px; margin-bottom: 8px; font-size: 12px; line-height: 1.45; }
    .buyer-line { display: flex; align-items: baseline; margin-bottom: 2px; }
    .buyer-label { font-weight: 500; flex-shrink: 0; margin-right: 4px; }
    table.fsi-table { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 8px; }
    table.fsi-table th, table.fsi-table td { border: 1px solid #000; padding: 4px 6px; font-size: 11.5px; }
    table.fsi-table th { text-align: center; font-weight: bold; background: #fafafa; }
    .col-stt { width: 34px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 50px; text-align: center; }
    .col-type { width: 55px; text-align: center; }
    .col-qty { width: 85px; text-align: center; }
    .col-price { width: 85px; text-align: right; }
    .col-amount { width: 105px; text-align: right; }
    .qty-number { font-weight: bold; }
    .qty-weight { font-size: 11px; color: #333; }
    .total-section { border: 1px solid #000; padding: 6px 10px; margin-bottom: 12px; font-size: 12.5px; line-height: 1.4; }
    .total-row-flex { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px; }
    .sign-row { display: flex; justify-content: space-between; margin-top: 10px; margin-bottom: 14px; text-align: center; }
    .sign-col { width: 45%; }
    .sign-title { font-weight: bold; font-size: 13px; }
    .sign-sub { font-style: italic; font-size: 11px; color: #555; }
    .fsi-signature-box {
      margin-top: 10px; border: 1px solid #64748b; padding: 6px 10px; font-size: 11px;
      text-align: center; display: inline-block; min-width: 250px; background: #fafafa;
    }
    .fsi-signature-valid { color: #15803d; font-weight: bold; font-size: 12px; margin-bottom: 2px; }
    .footer-lookup { border-top: 1px solid #000; padding-top: 6px; font-size: 11.5px; text-align: center; }
    .footer-lookup-flex { display: flex; justify-content: space-between; margin-top: 2px; font-size: 11px; }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml(`Hóa đơn bán hàng điện tử - ${sellerName}`) : ''}

  <div class="invoice-outer">
    <div class="top-provider-notice">
      Khởi tạo từ phần mềm hóa đơn điện tử được cung cấp bởi Công ty TNHH L.C.S – Mã số thuế: 0302999571 – Tel: 19001837
    </div>

    <!-- HEADER SELLER & LOGO CHỮ (trung tính, không giả mạo logo thật) -->
    <div class="header-flex">
      <div class="fsi-logo-block">
        <div class="fsi-logo-initials">${escapeHtml(initials)}</div>
      </div>

      <div class="seller-text-block">
        <div class="seller-company-name">${escapeHtml(sellerName)}</div>
        <div>Địa chỉ : ${escapeHtml(sellerAddress)}</div>
        <div>Mã số thuế : <strong>${escapeHtml(sellerMst)}</strong></div>
        <div style="margin-top:2px;">Đơn vị bán hàng : <strong>${escapeHtml(sellerName)}</strong></div>
        <div>Địa chỉ : ${escapeHtml(sellerAddress)}</div>
        <div>Mã số thuế : <strong>${escapeHtml(sellerMst)}</strong>${sellerPhone ? ` &nbsp;&nbsp;&nbsp;&nbsp; SĐT : <strong>${escapeHtml(sellerPhone)}</strong>` : ''}</div>
      </div>
    </div>

    <!-- QR ROW -->
    <div class="barcode-qr-row">
      <div class="qr-sub-block">
        <img src="${qrImg}" alt="QR code" class="qr-img">
        ${mCode ? `<div class="qr-subtext">${escapeHtml(mCode.slice(0, 12))}</div>` : ''}
      </div>
    </div>

    <!-- TITLE BANNER -->
    <div class="title-banner">
      <div class="main-title">HÓA ĐƠN BÁN HÀNG</div>
      <div class="invoice-date">Ngày ${escapeHtml(day)} tháng ${escapeHtml(month)} năm ${escapeHtml(year)}</div>
      ${maCqt ? `<div class="cqt-code">MÃ CQT : ${escapeHtml(maCqt)}</div>` : ''}
    </div>

    <div class="meta-tags-right">
      <div>Ký hiệu : <strong>${escapeHtml(invoice.khhdon || '')}</strong></div>
      <div>Số : <strong>${escapeHtml(invoice.shdon || '')}</strong></div>
    </div>

    <!-- BUYER PANEL -->
    <div class="buyer-panel">
      <div class="buyer-line">
        <span class="buyer-label">Tên đơn vị :</span>
        <strong style="text-transform:uppercase;">${escapeHtml(buyerName)}</strong>
      </div>

      <div class="buyer-line">
        <span class="buyer-label">Địa chỉ :</span>
        <span>${escapeHtml(buyerAddress)}</span>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
        ${paymentMethod ? `
        <div class="buyer-line">
          <span class="buyer-label">Hình thức thanh toán :</span>
          <strong>${escapeHtml(paymentMethod)}</strong>
        </div>` : '<div></div>'}
        <div class="buyer-line">
          <span class="buyer-label" style="margin-right:6px;">Mã số thuế :</span>
          ${renderTaxCodeBoxes(buyerTaxCode)}
        </div>
      </div>
    </div>

    <!-- 7-COLUMN GOODS TABLE -->
    <table class="fsi-table">
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
          const unit = item.unit || item.dvt || '';
          const name = item.itemName || item.ten || `Hàng hóa, dịch vụ #${idx + 1}`;

          // Chỉ hiển thị trọng lượng nếu tìm thấy con số thật trong tên hàng
          // (không tự suy đoán/bịa trọng lượng khi dữ liệu không có).
          const weightMatch = name.match(/Trọng lượng\s*(?:đá)?\s*([0-9\.,]+)\s*(?:phân|chỉ|gram|g)?/i);
          const weightStr = weightMatch ? `(${weightMatch[1]})` : '';

          return `
            <tr>
              <td class="col-stt">${idx + 1}</td>
              <td class="col-name">${escapeHtml(name)}</td>
              <td class="col-unit">${escapeHtml(unit)}</td>
              <td class="col-type"></td>
              <td class="col-qty">
                <div class="qty-number">${formatNum(qty)}</div>
                ${weightStr ? `<div class="qty-weight">${escapeHtml(weightStr)}</div>` : ''}
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
        <div class="fsi-signature-box">
          <div class="fsi-signature-valid">Đã ký ✔</div>
          <div><strong>Ký bởi:</strong> ${escapeHtml(sellerName)}</div>
          <div><strong>Ký ngày:</strong> ${escapeHtml(day)}/${escapeHtml(month)}/${escapeHtml(year)}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-lookup">
      <div style="font-style:italic;color:#475569;">(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)</div>
      ${mCode ? `
      <div class="footer-lookup-flex">
        <div>Tra cứu thông tin hóa đơn điện tử tại: <a href="${escapeHtml(pUrl)}" target="_blank" style="color:#0284c7;">${escapeHtml(pUrl)}</a></div>
        <div>Mã tra cứu: <strong style="font-family:monospace;font-size:12px;">${escapeHtml(mCode)}</strong></div>
      </div>` : `
      <!-- Không có mã tra cứu thật từ dữ liệu Cổng Thuế cho nhà cung cấp này (4SI/L.C.S
           không gửi kèm mã tra cứu công khai trong API/XML của GDT). Ẩn dòng này thay vì
           hiển thị trống/sai. -->`}
    </div>
  </div>
</body>
</html>`;
}
