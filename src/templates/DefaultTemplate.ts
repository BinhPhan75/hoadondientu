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

/**
 * Bản thể hiện chuẩn hóa đơn điện tử chính thức từ Cổng Thông tin HĐĐT Tổng cục Thuế (GDT)
 * (hoadondientu.gdt.gov.vn / viewinvoice)
 * 
 * Áp dụng theo quy định của Tổng cục Thuế cho:
 * - Hóa đơn chưa nhận diện nhà cung cấp riêng biệt
 * - Hóa đơn chưa có mẫu chuyên biệt như 4SI của PNJ, hóa đơn viễn thông,
 *   hóa đơn điện lực (EVN), hóa đơn thu phí ngân hàng...
 */
export function renderDefaultTemplate(
  invoice: GDTInvoice,
  rawXml?: string,
  options?: RenderTemplateOptions
): string {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode } = extractLookupDetails(rawXml);
  const mCode = lookupCode || invoice.lookupCode || '';
  
  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const vatAmount = typeof invoice.tgtthue === 'number' ? invoice.tgtthue : 0;
  const subTotal = typeof invoice.tgtcthue === 'number' 
    ? invoice.tgtcthue 
    : (totalAmount - vatAmount > 0 ? totalAmount - vatAmount : totalAmount);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const showControls = options?.showPrintControls !== false;

  const mauSo = (invoice as any).khmshdon || (invoice.khhdon ? invoice.khhdon.charAt(0) : '1');
  const kyHieu = invoice.khhdon || '';
  const soHdon = invoice.shdon || '';
  const maCqt = invoice.mhdon || '';

  // Xác định tiêu đề hóa đơn theo chuẩn GDT
  let invoiceTitle = invoice.thdon || '';
  if (!invoiceTitle) {
    if (kyHieu.startsWith('2')) {
      invoiceTitle = 'HOÁ ĐƠN BÁN HÀNG';
    } else {
      invoiceTitle = 'HOÁ ĐƠN GIÁ TRỊ GIA TĂNG';
    }
  } else {
    invoiceTitle = invoiceTitle.toUpperCase();
  }

  const isVatInvoice = !kyHieu.startsWith('2') && (vatAmount > 0 || invoiceTitle.includes('GIÁ TRỊ GIA TĂNG'));

  // QR Code chuẩn
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(
    maCqt 
      ? `https://hoadondientu.gdt.gov.vn/tra-cuu?cqt=${encodeURIComponent(maCqt)}`
      : `MST:${invoice.nbmst};KH:${kyHieu};SHD:${soHdon};TONG:${totalAmount}${mCode ? `;MTC:${mCode}` : ''}`
  );

  // Người bán & Người mua
  const sellerName = invoice.nbten || '';
  const sellerTaxCode = invoice.nbmst || '';
  const sellerStoreCode = (invoice as any).sellerStoreCode || '';
  const sellerStoreName = (invoice as any).sellerStoreName || '';
  const sellerAddress = invoice.nbdchi || '';
  const sellerPhone = invoice.nbsdt || (invoice as any).sellerPhone || '';
  const sellerBankAcc = invoice.nbstk || '';
  const sellerBankName = invoice.nbnhang || '';

  const buyerName = invoice.nmten || '';
  const buyerContact = (invoice as any).buyerContactPerson || (invoice as any).nmnguoimua || '';
  const buyerTaxCode = invoice.nmmst || '';
  const buyerBudgetCode = (invoice as any).buyerBudgetCode || (invoice as any).nmdvcqhnsnn || '';
  const buyerIdCard = (invoice as any).buyerIdCard || (invoice as any).nmcccd || '';
  const buyerPassport = (invoice as any).buyerPassport || (invoice as any).nmhc || '';
  const buyerAddress = invoice.nmdchi || '';
  const buyerBankAcc = invoice.nmstk || '';
  const buyerBankName = invoice.nmnhang || '';
  const paymentMethod = invoice.htttoan || 'Tiền mặt/Chuyển khoản';
  const sbke = (invoice as any).sbke || '';
  const ngayBke = (invoice as any).ngayBke || '';

  // Chữ ký số người bán
  const signerName = (invoice as any).signerName || sellerName || 'CƠ QUAN / ĐƠN VỊ PHÁT HÀNH';
  const signedDate = (invoice as any).signedDate || invoice.tdlap || `${year}-${month}-${day}T00:00:00`;

  // Bảng hàng hóa
  const itemsHtml = items.length > 0 
    ? items.map((item, idx) => {
        const it = item as any;
        const lineNo = it.lineNo || it.stt || idx + 1;
        const nature = it.tchat || (String(it.nature) === '2' ? 'Khuyến mại' : String(it.nature) === '3' ? 'Chiết khấu' : String(it.nature) === '4' ? 'Ghi chú' : 'Hàng hóa, dịch vụ');
        const lhhdt = it.lhhdt || '';
        const itemName = it.itemName || it.name || it.thhdvu || '';
        const unit = it.unit || it.dvtinh || '';
        const qty = it.quantity ? formatNum(it.quantity) : (it.sluong ? formatNum(it.sluong) : '');
        const price = (it.unitPrice || it.dgia) ? formatVND(it.unitPrice || it.dgia) : '';
        const discount = (it.discount || it.stckhau) ? formatVND(it.discount || it.stckhau) : '0';
        const taxRate = it.taxRate || it.tsuat || (isVatInvoice ? '8%' : '\\');
        const itemAmount = formatVND(it.amount || it.thtien || 0);

        return `<tr>
  <td class="tx-center">${lineNo}</td>
  <td class="tx-left"><span>${escapeHtml(nature)}</span></td>
  <td class="tx-left" style="max-width: 200px; word-wrap: break-word;">${escapeHtml(lhhdt)}</td>
  <td class="tx-left">${escapeHtml(itemName)}</td>
  <td class="tx-left">${escapeHtml(unit)}</td>
  <td class="tx-center">${qty}</td>
  <td class="tx-center">${price}</td>
  <td class="tx-center">${discount}</td>
  <td class="tx-center"><HHDVu>${escapeHtml(taxRate)}</HHDVu></td>
  <td class="tx-center">${itemAmount}</td>
</tr>`;
      }).join('\n')
    : `<tr>
  <td class="tx-center">1</td>
  <td class="tx-left"><span>Hàng hóa, dịch vụ</span></td>
  <td class="tx-left"></td>
  <td class="tx-left">${escapeHtml(invoice.thdon || 'Cung cấp hàng hóa, dịch vụ')}</td>
  <td class="tx-left">Gói</td>
  <td class="tx-center">1</td>
  <td class="tx-center">${formatVND(subTotal)}</td>
  <td class="tx-center">0</td>
  <td class="tx-center"><HHDVu>${isVatInvoice ? '8%' : '\\'}</HHDVu></td>
  <td class="tx-center">${formatVND(subTotal)}</td>
</tr>`;

  // Bảng thuế suất chi tiết
  const vatRows = (invoice.vatBreakdown && invoice.vatBreakdown.length > 0)
    ? invoice.vatBreakdown
    : (isVatInvoice
        ? [{ taxRate: items.find(it => (it as any).taxRate || (it as any).tsuat)?.taxRate || (items.find(it => (it as any).taxRate || (it as any).tsuat) as any)?.tsuat || '8%', amount: subTotal, taxAmount: vatAmount }]
        : [{ taxRate: '\\', amount: subTotal, taxAmount: 0 }]);

  const vatRowsHtml = vatRows.map(row => `<tr>
  <td class="tx-center"><LTSuat>${escapeHtml(row.taxRate)}</LTSuat></td>
  <td class="tx-center">${formatVND(row.amount)}</td>
  <td class="tx-center">${formatVND(row.taxAmount)}</td>
</tr>`).join('\n');

  const printControls = showControls ? getPrintControlsHtml('Hóa đơn điện tử chuẩn Tổng cục Thuế') : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>${escapeHtml(invoiceTitle)} - Số: ${escapeHtml(soHdon)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=Edge">
<style>
  * {
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    width: 100%;
    height: 100%;
    margin: 0 auto;
    padding: 16px 0;
    font-size: 13pt;
    font-family: "Times New Roman", Times, serif;
    background-color: #f1f5f9;
    color: #000;
  }

  .print-page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
  }

  .main-page {
    max-width: 210mm;
    padding: 24px 22px 14px;
    margin: auto;
    background-color: #ffffff;
    border: 3px double rgba(145, 87, 21, 0.69);
    line-height: 1.5;
    box-shadow: rgb(222 226 230 / 70%) 0px 0px 9px 2px;
    position: relative;
    font-family: "Times New Roman", Times, serif;
  }

  .print-actions {
    max-width: 210mm;
    margin: 0 auto 12px auto;
  }

  .heading-content .main-title {
    font-size: 20pt;
    text-align: center;
    display: block;
    font-weight: bold;
    text-transform: uppercase;
    margin: 4px 0;
    color: #000;
  }

  .heading-content p {
    font-size: 13pt;
    text-align: right;
    margin: 2px 0;
  }

  .heading-content .day {
    text-align: center;
    display: block;
  }

  .heading-content p.day {
    text-align: center;
    display: block;
  }

  .heading-content .top-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .heading-content .code-content {
    display: inline-block;
    text-align: right;
    font-size: 12pt;
    line-height: 1.4;
  }

  .vip-divide {
    width: 100%;
    height: 0;
    border-bottom: 1px solid rgba(145, 87, 21, 0.69);
    margin: 8px 0;
  }

  .flex-li {
    display: flex;
  }

  .content-info {
    padding-top: 2px;
  }

  .content-info .list-fill-out {
    list-style: none;
    padding-inline-start: 0;
    padding-left: 0;
    margin-top: 4px;
    margin-bottom: 4px;
  }

  .content-info .list-fill-out li {
    font-size: 13pt;
  }

  .data-item {
    width: 100%;
    display: flex;
    justify-content: left;
    align-items: flex-start;
    font-size: 13pt;
    color: rgba(0, 0, 0, 0.85);
    margin-bottom: 2px;
  }

  .data-item .di-label {
    min-height: 24px;
    height: auto;
    border-bottom: 1px dashed transparent;
    display: flex;
    align-items: flex-start;
    white-space: nowrap;
    color: #111;
  }

  .data-item .di-value {
    box-sizing: border-box;
    flex: 1;
    min-height: 24px;
    display: flex;
    align-items: flex-start;
    padding-left: 6px;
    height: auto;
    justify-content: unset;
    color: #000;
  }

  .table-horizontal-wrapper {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 6px;
  }

  .res-tb {
    border-collapse: collapse;
    border-spacing: 0px;
    width: 100%;
    overflow-x: auto;
    margin: 8px 0px;
    min-width: 250px;
  }

  .res-tb tr td {
    border: 1px solid black;
    padding: 5px 4px;
    vertical-align: baseline;
    font-size: 12pt;
    color: #000;
  }

  .res-tb tr td.tx-center {
    text-align: center;
  }

  .res-tb tr td.tx-left {
    text-align: left;
  }

  .res-tb tr td.tx-right {
    text-align: right;
  }

  .res-tb thead tr th {
    border: 1px solid black;
    vertical-align: middle;
    padding: 6px 4px;
    font-size: 12pt;
    color: #000;
  }

  .res-tb thead tr th.tb-stt {
    width: 48px;
    text-align: center;
  }

  .res-tb thead tr th.tb-thh {
    width: 220px;
    text-align: center;
  }

  .res-tb thead tr th.tb-dvt {
    width: 75px;
    text-align: center;
  }

  .res-tb thead tr th.tb-sl {
    width: 70px;
    text-align: center;
  }

  .res-tb thead tr th.tb-dg {
    width: 80px;
    text-align: center;
  }

  .res-tb thead tr th.tb-ts {
    width: 70px;
    text-align: center;
  }

  .res-tb thead tr th.tb-ttct {
    width: 160px;
    text-align: center;
  }

  .ft-sign {
    padding-top: 16px;
  }

  .ft-sign .sign-dx {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-around;
    align-items: flex-start;
  }

  .ft-sign .sign-dx h3 {
    margin: 0;
    font-size: 13pt;
    font-weight: normal;
  }

  .ft-sign .sign-dx h3 p {
    text-align: center;
    font-size: 13pt;
    font-weight: bold;
    margin: 0;
    color: #000;
  }

  .ft-sign .sign-dx h3 p:nth-child(2) {
    font-size: 12pt;
    font-weight: normal;
    font-style: italic;
    margin-top: 4px;
  }

  .ft-sign .fd-end {
    padding-top: 36px;
    text-align: center;
  }

  .ft-sign .fd-end p {
    margin: 0;
    font-size: 11pt;
    color: #222;
  }

  .sign-box {
    width: 270px !important;
    padding: 6px 8px !important;
    border: 2px solid #23b709 !important;
    background-color: #f0fdf4;
    border-radius: 4px;
    margin-top: 8px !important;
    font-weight: 500;
    text-align: left;
    box-shadow: 0 1px 3px rgba(35, 183, 9, 0.15);
  }

  .sign-box span {
    color: #23b709 !important;
    font-size: 11.5pt !important;
    text-align: left !important;
    display: block;
    line-height: 1.3;
  }

  .span-sign-box {
    display: inline !important;
    color: #166534 !important;
    font-size: 9.5pt !important;
  }

  @page {
    size: A4 portrait;
    margin: 0 !important;
  }

  @media print {
    body {
      width: auto;
      height: auto;
      margin: 0 auto;
      background: transparent !important;
      padding: 0 !important;
    }
    .print-actions {
      display: none !important;
    }
    table, tr, td, th {
      page-break-inside: avoid;
    }
    table thead {
      display: table-row-group !important;
    }
    .table-horizontal-wrapper {
      page-break-inside: avoid;
      padding-top: 5px;
    }
    .main-page {
      margin: 0 auto;
      width: initial;
      min-height: 296mm;
      background: #fff !important;
      border: 3px double rgba(145, 87, 21, 0.69) !important;
      box-shadow: none !important;
    }
    .ft-sign {
      page-break-inside: avoid !important;
      page-break-after: auto;
    }
    .fd-end {
      padding-top: 20px !important;
    }
  }
</style>
</head>
<body>
${printControls}
<div class="print-page">
<div class="main-page">
<div class="heading-content">
  <div class="top-content">
    <div style="width: 80px; min-height: 20px">
      <div id="qrcodeTable">
        <img src="${qrImg}" style="width: 76px; height: 76px; display: block;" alt="QR Code">
      </div>
    </div>
    <div class="code-content">
      <b>Mẫu số: ${escapeHtml(mauSo)}</b><br>
      <b>Ký hiệu: ${escapeHtml(kyHieu)}</b><br>
      <b>Số: ${escapeHtml(soHdon)}</b>
    </div>
  </div>
  <div class="title-heading">
    <h2 class="main-title">${escapeHtml(invoiceTitle)}</h2>
    <div class="day">
      <p class="day">Ngày ${day} tháng ${month} năm ${year}</p>
      ${maCqt ? `<p class="day" style="font-family: monospace; font-size: 11.5pt;">MCCQT: ${escapeHtml(maCqt)}</p>` : ''}
    </div>
  </div>
</div>

<div class="vip-divide"></div>

<div class="content-info">
  <ul class="list-fill-out">
    <li>
      <div class="data-item">
        <div class="di-label"><span>Tên người bán:</span></div>
        <div class="di-value"><div style="font-weight: bold; text-transform: uppercase;">${escapeHtml(sellerName)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Mã số thuế:</span></div>
        <div class="di-value"><div style="font-weight: bold; font-family: monospace; font-size: 13pt;">${escapeHtml(sellerTaxCode)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Mã cửa hàng:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerStoreCode)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Tên cửa hàng:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerStoreName)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Địa chỉ:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerAddress)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Điện thoại:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerPhone)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Số tài khoản:</span></div>
        <div class="di-value">
          <div>
            ${escapeHtml(sellerBankAcc)}
            ${sellerBankAcc && sellerBankName ? '&nbsp;&nbsp;&nbsp;' : ''}
            ${escapeHtml(sellerBankName)}
          </div>
        </div>
      </div>
    </li>
    <li>
      <div class="vip-divide" style="margin: 5px 0;"></div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Tên người mua:</span></div>
        <div class="di-value"><div style="font-weight: bold; text-transform: uppercase;">${escapeHtml(buyerName)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Họ tên người mua:</span></div>
        <div class="di-value"><div>${escapeHtml(buyerContact)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Mã số thuế:</span></div>
        <div class="di-value"><div style="font-weight: bold; font-family: monospace; font-size: 13pt;">${escapeHtml(buyerTaxCode)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Mã ĐVCQHVNSNN:</span></div>
        <div class="di-value"><div>${escapeHtml(buyerBudgetCode)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>CCCD người mua:</span></div>
        <div class="di-value"><div>${escapeHtml(buyerIdCard)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Số hộ chiếu:</span></div>
        <div class="di-value"><div>${escapeHtml(buyerPassport)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Địa chỉ:</span></div>
        <div class="di-value"><div>${escapeHtml(buyerAddress)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Số tài khoản:</span></div>
        <div class="di-value">
          <div>
            ${escapeHtml(buyerBankAcc)}
            ${buyerBankAcc && buyerBankName ? '&nbsp;&nbsp;&nbsp;' : ''}
            ${escapeHtml(buyerBankName)}
          </div>
        </div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>Hình thức thanh toán:</span></div>
        <div class="di-value"><div>${escapeHtml(paymentMethod)}</div></div>
      </div>
    </li>
    <li class="flex-li">
      <div class="data-item" style="width: 50%">
        <div class="di-label"><span>Số bảng kê:</span></div>
        <div class="di-value"><div>${escapeHtml(sbke)}</div></div>
      </div>
      <div class="data-item" style="width: 50%">
        <div class="di-label"><span>Ngày bảng kê:</span></div>
        <div class="di-value"><div>${escapeHtml(ngayBke)}</div></div>
      </div>
    </li>
  </ul>

  <table class="res-tb">
    <thead style="text-align: center;">
      <tr>
        <th class="tb-stt">STT</th>
        <th class="tb-stt">Tính chất</th>
        <th class="tb-stt">Loại hàng hoá đặc trưng</th>
        <th class="tb-thh">Tên hàng hóa, dịch vụ</th>
        <th class="tb-dvt">Đơn vị tính</th>
        <th class="tb-sl">Số lượng</th>
        <th class="tb-dg">Đơn giá</th>
        <th class="tb-dg">Chiết khấu</th>
        <th class="tb-ts">Thuế suất</th>
        <th class="tb-ttct">Thành tiền chưa có thuế GTGT</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="table-horizontal-wrapper">
    <div style="margin-right: 10px; min-width: 270px;">
      <table class="res-tb">
        <thead style="text-align: center">
          <tr>
            <th>Thuế suất</th>
            <th>Tổng tiền chưa thuế</th>
            <th>Tổng tiền thuế</th>
          </tr>
        </thead>
        <tbody>
          ${vatRowsHtml}
        </tbody>
      </table>
    </div>
    <div style="flex: 1">
      <table class="res-tb">
        <tbody>
          <tr>
            <td class="tx-center">
              Tổng tiền chưa thuế<br>
              (Tổng cộng thành tiền chưa có thuế)
            </td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px; font-weight: bold;">
              ${formatVND(subTotal)}
            </td>
          </tr>
          <tr>
            <td class="tx-center">Tổng tiền thuế (Tổng cộng tiền thuế)</td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px; font-weight: bold;">
              ${formatVND(vatAmount)}
            </td>
          </tr>
          <tr>
            <td class="tx-center">Tổng tiền phí</td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px;">0</td>
          </tr>
          <tr>
            <td class="tx-center">Tổng tiền chiết khấu thương mại</td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px;">0</td>
          </tr>
          <tr>
            <td class="tx-center" style="font-weight: bold;">Tổng tiền thanh toán bằng số</td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px; font-weight: bold; font-size: 13pt;">
              ${formatVND(totalAmount)}
            </td>
          </tr>
          <tr>
            <td class="tx-center" style="font-weight: bold;">Tổng tiền thanh toán bằng chữ</td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px; font-style: italic;">
              ${escapeHtml(wordsAmount)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<div class="vip-divide"></div>

<div class="ft-sign">
  <div class="sign-dx">
    <h3>
      <p>NGƯỜI MUA HÀNG</p>
      <p><i>(Chữ ký số (nếu có))</i></p>
    </h3>
    <h3>
      <p>NGƯỜI BÁN HÀNG</p>
      <p><i>(Chữ ký điện tử, chữ ký số)</i></p>
      <div class="sign-box">
        <div style="display:flex; align-items:center; gap:5px; margin-bottom:3px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#23b709" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <span style="font-weight: bold; font-size: 11.5pt; color: #23b709 !important;">Signature Valid</span>
        </div>
        <div>
          <span class="span-sign-box">Ký bởi&nbsp;</span>
          <span id="cks" class="span-sign-box" style="font-weight: 600;">${escapeHtml(signerName)}</span>
        </div>
        <div style="margin-top: 2px;">
          <span class="span-sign-box">Ký ngày:&nbsp;</span>
          <span class="span-sign-box" style="font-family: monospace;">${escapeHtml(signedDate)}</span>
        </div>
      </div>
    </h3>
  </div>
  <div class="fd-end">
    <p><i>(Cần kiểm tra, đối chiếu khi lập, nhận hóa đơn)</i></p>
  </div>
</div>
</div>
</div>
<input type="hidden" id="qrcodeContent" value="${escapeHtml(maCqt)}">
</body>
</html>`;
}
