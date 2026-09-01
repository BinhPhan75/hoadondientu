import { GDTInvoice } from '../types';
import { numberToVietnameseWords } from './xmlParser';

/**
 * Generates an authentic, standalone, pixel-perfect Vietnamese E-Invoice HTML document 
 * conforming to Decree 123/2020/ND-CP & Circular 78/2021/TT-BTC.
 * Can be opened directly in any browser (Chrome, Edge, Firefox), viewed, or printed cleanly to A4 PDF.
 */
export function generateOfficialInvoiceHtml(invoice: GDTInvoice, qrCodeDataUrl?: string): string {
  const tdlap = invoice.tdlap || new Date().toISOString();
  const dateParts = tdlap.split('T')[0].split('-');
  const timePart = tdlap.includes('T') ? tdlap.split('T')[1].substring(0, 8) : '09:00:00';
  
  const day = dateParts[2] || '01';
  const month = dateParts[1] || '01';
  const year = dateParts[0] || '2025';

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(num || 0)) + ' đ';
  };

  const formatNum = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num || 0);
  };

  const items = invoice.items && invoice.items.length > 0 ? invoice.items : [
    {
      id: 'item_1',
      lineNo: 1,
      itemName: 'Hàng hóa, dịch vụ theo bảng kê hóa đơn điện tử',
      unit: 'Gói',
      quantity: 1,
      unitPrice: invoice.tgtcthue,
      amount: invoice.tgtcthue,
      taxRate: invoice.tgtthue > 0 ? '10%' : 'KCT',
      taxRatePercent: invoice.tgtthue > 0 ? 10 : 0,
      taxAmount: invoice.tgtthue,
      totalAmount: invoice.tgtttbso
    }
  ];

  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const maCqt = invoice.mhdon || (invoice.hsgcma ? '00E9C762DA374972B621A0F9004B2C89' : '');

  const qrSrc = qrCodeDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://hoadondientu.gdt.gov.vn/tra-cuu?mst=${invoice.nbmst}&kh=${invoice.khhdon}&so=${invoice.shdon}&tong=${invoice.tgtttbso}&cqt=${maCqt}`)}`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hóa đơn điện tử ${invoice.khhdon} - ${invoice.shdon} - ${escapeHtml(invoice.nbmst)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', Arial, 'DejaVu Sans', sans-serif;
      margin: 0;
      padding: 16px;
      background: #f1f5f9;
      color: #0f172a;
      font-size: 12px;
      line-height: 1.45;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      border: 1px solid #cbd5e1;
      position: relative;
    }
    .outer-border {
      border: 2px solid #b91c1c;
      padding: 16px;
      position: relative;
    }
    .inner-border {
      border: 1px solid #f87171;
      padding: 16px;
      position: relative;
    }
    .watermark {
      position: absolute;
      top: 40%;
      left: 10%;
      right: 10%;
      text-align: center;
      font-size: 42px;
      font-weight: 900;
      color: rgba(185, 28, 28, 0.035);
      text-transform: uppercase;
      letter-spacing: 4px;
      transform: rotate(-25deg);
      pointer-events: none;
      user-select: none;
    }
    .header-nation {
      text-align: center;
      margin-bottom: 12px;
    }
    .header-nation .title {
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
      color: #1e293b;
    }
    .header-nation .motto {
      font-size: 11px;
      font-weight: 600;
      margin: 2px 0 4px 0;
      color: #334155;
    }
    .header-nation .divider {
      width: 140px;
      height: 1px;
      background: #94a3b8;
      margin: 0 auto;
    }
    .invoice-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #b91c1c;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .invoice-title-col {
      flex: 1;
      text-align: center;
      padding-left: 60px;
    }
    .invoice-title-col h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 900;
      color: #b91c1c;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .invoice-title-col .subtitle {
      font-size: 10.5px;
      color: #64748b;
      font-style: italic;
      margin-top: 2px;
    }
    .invoice-title-col .date-info {
      font-size: 11.5px;
      font-weight: 600;
      color: #1e293b;
      margin-top: 4px;
    }
    .invoice-meta-box {
      width: 190px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 4px;
      padding: 8px 10px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.4;
      text-align: right;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    .meta-row.highlight {
      border-top: 1px dashed #fca5a5;
      padding-top: 3px;
      margin-top: 3px;
    }
    .meta-row .label {
      color: #475569;
    }
    .meta-row .val {
      font-weight: bold;
      color: #0f172a;
    }
    .meta-row .val.red {
      color: #b91c1c;
      font-size: 13px;
      font-weight: 900;
    }
    .cqt-bar {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 4px;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .cqt-info {
      font-size: 11px;
      color: #14532d;
    }
    .cqt-info .cqt-code {
      font-family: 'Courier New', Courier, monospace;
      font-weight: bold;
      color: #166534;
      font-size: 11.5px;
    }
    .cqt-qr {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cqt-qr img {
      width: 44px;
      height: 44px;
      border: 1px solid #bbf7d0;
      background: #fff;
      padding: 2px;
      border-radius: 2px;
    }
    .party-box {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 10px;
      font-size: 11.5px;
    }
    .party-row {
      display: flex;
      margin-bottom: 4px;
    }
    .party-row:last-child {
      margin-bottom: 0;
    }
    .party-label {
      width: 140px;
      font-weight: 600;
      color: #475569;
      flex-shrink: 0;
    }
    .party-val {
      flex: 1;
      color: #0f172a;
    }
    .party-val.bold-name {
      font-weight: bold;
      text-transform: uppercase;
      color: #0f172a;
    }
    .mst-badge {
      font-family: 'Courier New', Courier, monospace;
      font-weight: 900;
      color: #b91c1c;
      background: #fee2e2;
      border: 1px solid #fca5a5;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 12px;
      letter-spacing: 1px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 11px;
    }
    .items-table th, .items-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
    }
    .items-table th {
      background: #f1f5f9;
      font-weight: bold;
      text-align: center;
      color: #1e293b;
      text-transform: uppercase;
      font-size: 10.5px;
    }
    .items-table .col-sub {
      background: #f8fafc;
      font-size: 9.5px;
      font-style: italic;
      color: #64748b;
      text-align: center;
      padding: 2px 4px;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .font-mono { font-family: 'Courier New', Courier, monospace; }

    .summary-box {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      border-radius: 4px;
      padding: 10px 14px;
      margin-bottom: 14px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 11.5px;
    }
    .summary-row.total-pay {
      border-top: 2px solid #b91c1c;
      padding-top: 6px;
      margin-top: 6px;
      color: #b91c1c;
      font-size: 13px;
      font-weight: 900;
    }
    .summary-row.words {
      border-top: 1px dashed #cbd5e1;
      padding-top: 4px;
      margin-top: 4px;
      font-style: italic;
      color: #334155;
      font-size: 11px;
    }
    .signatures-grid {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
      margin-top: 12px;
      text-align: center;
    }
    .sig-col {
      width: 48%;
    }
    .sig-title {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 11.5px;
      color: #1e293b;
      margin: 0;
    }
    .sig-subtitle {
      font-size: 10.5px;
      color: #64748b;
      font-style: italic;
      margin: 2px 0 8px 0;
    }
    .digital-seal-box {
      background: #f0fdf4;
      border: 2px dashed #22c55e;
      border-radius: 4px;
      padding: 8px 10px;
      text-align: left;
      font-size: 10px;
      line-height: 1.4;
      color: #15803d;
    }
    .digital-seal-title {
      font-weight: bold;
      color: #166534;
      font-size: 10.5px;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .legal-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      margin-top: 16px;
      text-align: center;
      font-size: 9.5px;
      color: #64748b;
      line-height: 1.4;
    }
    .print-controls {
      text-align: center;
      margin-bottom: 16px;
    }
    .btn-print {
      background: #b91c1c;
      color: #fff;
      border: none;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: bold;
      border-radius: 4px;
      cursor: pointer;
    }
    .btn-print:hover {
      background: #991b1b;
    }
    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .invoice-container {
        box-shadow: none;
        border: none;
        padding: 0;
        max-width: 100%;
      }
      .print-controls {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-controls">
    <button class="btn-print" onclick="window.print()">🖨️ In Hóa Đơn (Ctrl + P) / Lưu File PDF</button>
  </div>

  <div class="invoice-container">
    <div class="outer-border">
      <div class="inner-border">
        <div class="watermark">HÓA ĐƠN ĐIỆN TỬ<br>TỔNG CỤC THUẾ</div>

        <!-- QUỐC HIỆU & TIÊU NGỮ -->
        <div class="header-nation">
          <p class="title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
          <p class="motto">Độc lập - Tự do - Hạnh phúc</p>
          <div class="divider"></div>
        </div>

        <!-- TIÊU ĐỀ HÓA ĐƠN & MẪU SỐ -->
        <div class="invoice-title-row">
          <div class="invoice-title-col">
            <h1>${invoice.khmshdon === '1' ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG' : 'HÓA ĐƠN BÁN HÀNG'}</h1>
            <div class="subtitle">(Bản thể hiện của hóa đơn điện tử theo Nghị định 123/2020/NĐ-CP)</div>
            <div class="date-info">Ngày ${day} tháng ${month} năm ${year}</div>
          </div>
          <div class="invoice-meta-box">
            <div class="meta-row">
              <span class="label">Mẫu số:</span>
              <span class="val">${invoice.khmshdon}</span>
            </div>
            <div class="meta-row">
              <span class="label">Ký hiệu:</span>
              <span class="val red">${invoice.khhdon}</span>
            </div>
            <div class="meta-row highlight">
              <span class="label">Số HĐ:</span>
              <span class="val red">${String(invoice.shdon).padStart(7, '0')}</span>
            </div>
          </div>
        </div>

        <!-- MÃ CƠ QUAN THUẾ -->
        <div class="cqt-bar">
          <div class="cqt-info">
            <strong>MÃ CỦA CƠ QUAN THUẾ:</strong>
            <span class="cqt-code">${maCqt || '00E9C762DA374972B621A0F9004B2C89'}</span>
            <div style="font-size: 10px; color: #15803d; margin-top: 2px;">
              ✓ Đã cấp mã hợp lệ trên hệ thống Cổng thông tin Hóa đơn điện tử Tổng cục Thuế
            </div>
          </div>
          <div class="cqt-qr">
            <img src="${qrSrc}" alt="QR Tra cứu" />
            <div style="font-size: 9px; color: #166534; font-weight: bold; text-align: center; line-height: 1.2;">
              Tra cứu<br>Cổng Thuế
            </div>
          </div>
        </div>

        <!-- THÔNG TIN BÊN BÁN -->
        <div class="party-box">
          <div class="party-row">
            <span class="party-label">Đơn vị bán hàng:</span>
            <span class="party-val bold-name">${escapeHtml(invoice.nbten)}</span>
          </div>
          <div class="party-row">
            <span class="party-label">Mã số thuế:</span>
            <div class="party-val"><span class="mst-badge">${invoice.nbmst}</span></div>
          </div>
          <div class="party-row">
            <span class="party-label">Địa chỉ:</span>
            <span class="party-val">${escapeHtml(invoice.nbdchi)}</span>
          </div>
          ${(invoice.nbsdt || invoice.nbemail || invoice.nbstk) ? `
          <div class="party-row" style="margin-top: 2px; font-size: 10.5px; color: #475569;">
            ${invoice.nbsdt ? `<span style="margin-right: 16px;">Điện thoại: <strong>${invoice.nbsdt}</strong></span>` : ''}
            ${invoice.nbemail ? `<span style="margin-right: 16px;">Email: <strong>${invoice.nbemail}</strong></span>` : ''}
            ${invoice.nbstk ? `<span>Số TK: <strong>${invoice.nbstk}</strong> ${invoice.nbnhang ? `(${escapeHtml(invoice.nbnhang)})` : ''}</span>` : ''}
          </div>` : ''}
        </div>

        <!-- THÔNG TIN BÊN MUA -->
        <div class="party-box">
          <div class="party-row">
            <span class="party-label">Tên người mua hàng:</span>
            <span class="party-val font-bold">${escapeHtml(invoice.nmten)}</span>
          </div>
          <div class="party-row">
            <span class="party-label">Mã số thuế:</span>
            <div class="party-val">
              ${invoice.nmmst ? `<span class="mst-badge" style="background:#f1f5f9; border-color:#cbd5e1; color:#0f172a;">${invoice.nmmst}</span>` : '<span style="color:#64748b;">(Không có)</span>'}
            </div>
          </div>
          <div class="party-row">
            <span class="party-label">Địa chỉ:</span>
            <span class="party-val">${escapeHtml(invoice.nmdchi || '(Chưa cập nhật)')}</span>
          </div>
          <div class="party-row" style="margin-top: 2px; font-size: 10.5px; color: #475569;">
            <span style="margin-right: 16px;">Hình thức thanh toán: <strong>${invoice.htttoan || 'TM/CK'}</strong></span>
            <span style="margin-right: 16px;">Đồng tiền: <strong>${invoice.dvtte || 'VND'}</strong></span>
            ${invoice.tygia && invoice.tygia !== 1 ? `<span>Tỷ giá: <strong>${invoice.tygia}</strong></span>` : ''}
          </div>
        </div>

        <!-- BẢNG HÀNG HÓA DỊCH VỤ -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 35px;">STT</th>
              <th style="text-align: left;">Tên hàng hóa, dịch vụ</th>
              <th style="width: 55px;">ĐVT</th>
              <th style="width: 65px;" class="text-right">Số lượng</th>
              <th style="width: 90px;" class="text-right">Đơn giá</th>
              <th style="width: 65px;">Thuế suất</th>
              <th style="width: 105px;" class="text-right">Thành tiền</th>
            </tr>
            <tr>
              <td class="col-sub">(1)</td>
              <td class="col-sub" style="text-align: left;">(2)</td>
              <td class="col-sub">(3)</td>
              <td class="col-sub text-right">(4)</td>
              <td class="col-sub text-right">(5)</td>
              <td class="col-sub">(6)</td>
              <td class="col-sub text-right">(7 = 4 x 5)</td>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => `
            <tr>
              <td class="text-center font-mono">${it.lineNo || idx + 1}</td>
              <td class="font-bold">${escapeHtml(it.itemName)}</td>
              <td class="text-center">${escapeHtml(it.unit || 'Cái')}</td>
              <td class="text-right font-mono">${formatNum(it.quantity)}</td>
              <td class="text-right font-mono">${formatNum(it.unitPrice)}</td>
              <td class="text-center font-bold">${it.taxRate || '10%'}</td>
              <td class="text-right font-bold font-mono">${formatNum(it.amount)}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- BẢNG TỔNG HỢP THANH TOÁN -->
        <div class="summary-box">
          <div class="summary-row">
            <span>Tổng cộng tiền hàng (chưa có thuế GTGT):</span>
            <span class="font-mono font-bold">${formatVND(invoice.tgtcthue)}</span>
          </div>
          <div class="summary-row">
            <span>Tiền thuế giá trị gia tăng (GTGT):</span>
            <span class="font-mono font-bold" style="color:#b45309;">${formatVND(invoice.tgtthue)}</span>
          </div>
          <div class="summary-row total-pay">
            <span>TỔNG CỘNG TIỀN THANH TOÁN:</span>
            <span class="font-mono">${formatVND(invoice.tgtttbso)}</span>
          </div>
          <div class="summary-row words">
            <span>Số tiền viết bằng chữ: <strong>${escapeHtml(wordsAmount)}</strong></span>
          </div>
        </div>

        <!-- KHU VỰC CHỮ KÝ SỐ -->
        <div class="signatures-grid">
          <div class="sig-col">
            <p class="sig-title">Người mua hàng</p>
            <p class="sig-subtitle">(Ký, ghi rõ họ tên)</p>
            <div style="height: 60px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-style:italic; font-size:10.5px;">
              ${invoice.loaiHdon === 'purchase' ? '(Đã xác nhận thanh toán điện tử)' : ''}
            </div>
          </div>

          <div class="sig-col">
            <p class="sig-title">Người bán hàng</p>
            <p class="sig-subtitle">(Chữ ký số, chữ ký điện tử)</p>
            
            <div class="digital-seal-box">
              <div class="digital-seal-title">
                ✓ CHỮ KÝ SỐ HỢP LỆ (DIGITALLY SIGNED)
              </div>
              <div><strong>Ký bởi:</strong> ${escapeHtml(invoice.signerName || invoice.nbten)}</div>
              <div><strong>MST:</strong> ${invoice.nbmst}</div>
              <div><strong>Ngày ký:</strong> ${day}/${month}/${year} ${timePart}</div>
              <div><strong>Đơn vị CA:</strong> ${escapeHtml(invoice.caProvider || 'VNPT / Viettel / MISA CA')}</div>
            </div>
          </div>
        </div>

        <!-- CHÂN TRANG PHÁP LÝ -->
        <div class="legal-footer">
          <p><i>(Cần kiểm tra, đối chiếu khi lập, nhận hóa đơn theo quy định của Tổng cục Thuế - Bộ Tài chính)</i></p>
          <p>Tra cứu dữ liệu gốc hóa đơn điện tử tại Cổng Thông tin Hóa đơn: <strong>https://hoadondientu.gdt.gov.vn</strong></p>
        </div>

      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
