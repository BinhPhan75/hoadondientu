import * as XLSX from 'xlsx';
import { GDTInvoice, MonthSyncChunk } from '../types';

/**
 * Standard single-sheet Excel exporter (backward compatible)
 */
export function exportInvoicesToExcel(invoices: GDTInvoice[], title: string = 'Bang_Ke_Hoa_Don_GDT'): void {
  const rows: (string | number)[][] = [];

  rows.push(['BẢNG KÊ DANH SÁCH HÓA ĐƠN ĐIỆN TỬ - TỔNG CỤC THUẾ']);
  rows.push([`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`]);
  rows.push([`Tổng số lượng hóa đơn: ${invoices.length}`]);
  rows.push([]);

  // Column Headers
  rows.push([
    'STT',
    'Loại HĐ',
    'Ký hiệu mẫu số',
    'Ký hiệu HĐ',
    'Số HĐ',
    'Ngày lập',
    'Mã CQT cấp',
    'MST Người bán',
    'Tên Người bán',
    'MST Người mua',
    'Tên Người mua',
    'Mặt hàng / Diễn giải',
    'Tổng tiền chưa thuế (VNĐ)',
    'Thuế suất',
    'Tiền thuế GTGT (VNĐ)',
    'Tổng tiền thanh toán (VNĐ)',
    'Trạng thái HĐ',
    'Trạng thái xử lý CQT'
  ]);

  let totalBeforeTax = 0;
  let totalTax = 0;
  let totalPayment = 0;

  invoices.forEach((inv, index) => {
    totalBeforeTax += inv.tgtcthue;
    totalTax += inv.tgtthue;
    totalPayment += inv.tgtttbso;

    const itemsSummary = inv.items.map(i => `${i.itemName} (${i.quantity} ${i.unit})`).join('; ');
    const taxRatesSummary = formatTaxRateExcel(inv);

    let statusText = 'Gốc (Mới)';
    if (inv.tthdon === 2) statusText = 'Hóa đơn Thay thế';
    if (inv.tthdon === 3) statusText = 'Hóa đơn Điều chỉnh';
    if (inv.tthdon === 4) statusText = 'Hóa đơn Bị hủy';

    const cqtStatus = inv.hsgcma ? (inv.mhdon ? `Có mã (${inv.mhdon.slice(0, 8)}...)` : 'Có mã') : 'Không mã CQT';

    rows.push([
      index + 1,
      inv.loaiHdon === 'purchase' ? 'Mua vào' : 'Bán ra',
      inv.khmshdon,
      inv.khhdon,
      inv.shdon,
      formatDateDDMMYYYY(inv.tdlap),
      inv.mhdon || 'Không có',
      inv.nbmst,
      inv.nbten,
      inv.nmmst,
      inv.nmten,
      itemsSummary,
      inv.tgtcthue,
      taxRatesSummary,
      inv.tgtthue,
      inv.tgtttbso,
      statusText,
      cqtStatus
    ]);
  });

  // Summary Row
  rows.push([]);
  rows.push([
    'TỔNG CỘNG',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalBeforeTax,
    '',
    totalTax,
    totalPayment,
    '',
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setStandardColumnWidths(ws);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bang_Ke_Hoa_Don_GDT');

  const fileName = `${title}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export detailed report for a single month
 */
export function exportSingleMonthToExcel(
  invoices: GDTInvoice[],
  monthLabel: string,
  taxCode: string = ''
): void {
  const safeLabel = monthLabel.replace(/[\/\s]/g, '_');
  const title = `Bang_Ke_Thue_${safeLabel}_MST_${taxCode || 'GDT'}`;
  exportInvoicesToExcel(invoices, title);
}

/**
 * Export Multi-Sheet Comprehensive Tax & Invoices Report across multiple months
 */
export function exportComprehensiveMultiMonthReport(
  invoices: GDTInvoice[],
  chunks: MonthSyncChunk[],
  taxCode: string = '',
  taxpayerName: string = '',
  periodLabel: string = ''
): void {
  const wb = XLSX.utils.book_new();

  // 1. SHEET 1: TỔNG HỢP THEO TỪNG THÁNG
  const summaryRows: (string | number)[][] = [];
  summaryRows.push(['BẢNG TỔNG HỢP THUẾ GIÁ TRỊ GIA TĂNG THEO TỪNG THÁNG']);
  summaryRows.push([`Người nộp thuế: ${taxpayerName || 'Doanh nghiệp'} - MST: ${taxCode || 'N/A'}`]);
  summaryRows.push([`Kỳ báo cáo tổng hợp: ${periodLabel || 'Nhiều tháng'}`]);
  summaryRows.push([`Thời điểm xuất: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`]);
  summaryRows.push([]);

  summaryRows.push([
    'STT',
    'Kỳ / Tháng',
    'Từ ngày',
    'Đến ngày',
    'Số HĐ Mua Vào',
    'Doanh số Mua chưa thuế (VNĐ)',
    'Thuế GTGT Mua vào (VNĐ)',
    'Số HĐ Bán Ra',
    'Doanh thu Bán chưa thuế (VNĐ)',
    'Thuế GTGT Bán ra (VNĐ)',
    'Tổng cộng HĐ',
    'Chênh lệch thuế (Bán ra - Mua vào)',
    'Nghĩa vụ thuế GTGT'
  ]);

  let sumPurchaseCount = 0;
  let sumPurchaseAmount = 0;
  let sumPurchaseTax = 0;
  let sumSoldCount = 0;
  let sumSoldAmount = 0;
  let sumSoldTax = 0;

  chunks.forEach((chunk, index) => {
    // Filter invoices matching this month chunk
    const monthInvoices = invoices.filter(inv => {
      const invDate = inv.tdlap.substring(0, 10);
      return invDate >= chunk.fromDate && invDate <= chunk.toDate;
    });

    const purchases = monthInvoices.filter(i => i.loaiHdon === 'purchase');
    const solds = monthInvoices.filter(i => i.loaiHdon === 'sold');

    const pCount = purchases.length || chunk.purchaseCount || 0;
    const pAmount = purchases.reduce((sum, i) => sum + i.tgtcthue, 0) || chunk.purchaseAmount || 0;
    const pTax = purchases.reduce((sum, i) => sum + i.tgtthue, 0) || chunk.purchaseTax || 0;

    const sCount = solds.length || chunk.soldCount || 0;
    const sAmount = solds.reduce((sum, i) => sum + i.tgtcthue, 0) || chunk.soldAmount || 0;
    const sTax = solds.reduce((sum, i) => sum + i.tgtthue, 0) || chunk.soldTax || 0;

    const netTax = sTax - pTax;
    const obligationText = netTax > 0 
      ? `Phải nộp: ${formatVNDNumber(netTax)} đ` 
      : netTax < 0 
        ? `Được khấu trừ: ${formatVNDNumber(Math.abs(netTax))} đ` 
        : 'Cân bằng (0 đ)';

    sumPurchaseCount += pCount;
    sumPurchaseAmount += pAmount;
    sumPurchaseTax += pTax;
    sumSoldCount += sCount;
    sumSoldAmount += sAmount;
    sumSoldTax += sTax;

    summaryRows.push([
      index + 1,
      chunk.label,
      formatDateDDMMYYYY(chunk.fromDate),
      formatDateDDMMYYYY(chunk.toDate),
      pCount,
      pAmount,
      pTax,
      sCount,
      sAmount,
      sTax,
      pCount + sCount,
      netTax,
      obligationText
    ]);
  });

  // Summary Row
  summaryRows.push([]);
  const totalNetTax = sumSoldTax - sumPurchaseTax;
  summaryRows.push([
    'TỔNG CỘNG TOÀN KỲ',
    '',
    '',
    '',
    sumPurchaseCount,
    sumPurchaseAmount,
    sumPurchaseTax,
    sumSoldCount,
    sumSoldAmount,
    sumSoldTax,
    sumPurchaseCount + sumSoldCount,
    totalNetTax,
    totalNetTax > 0 
      ? `Tổng phải nộp: ${formatVNDNumber(totalNetTax)} đ` 
      : `Tổng được khấu trừ: ${formatVNDNumber(Math.abs(totalNetTax))} đ`
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 6 },  // STT
    { wch: 16 }, // Kỳ/Tháng
    { wch: 12 }, // Từ ngày
    { wch: 12 }, // Đến ngày
    { wch: 15 }, // Số HĐ Mua
    { wch: 25 }, // Doanh số Mua
    { wch: 22 }, // Thuế Mua
    { wch: 15 }, // Số HĐ Bán
    { wch: 25 }, // Doanh số Bán
    { wch: 22 }, // Thuế Bán
    { wch: 14 }, // Tổng HĐ
    { wch: 25 }, // Chênh lệch thuế
    { wch: 32 }, // Nghĩa vụ thuế
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Tong_Hop_Theo_Thang');

  // 2. SHEET 2: BẢNG KÊ BÁN RA (MẪU 01-1/GTGT)
  const soldInvoices = invoices.filter(i => i.loaiHdon === 'sold');
  const wsSold = createVatSubSheet(soldInvoices, 'BẢNG KÊ HÓA ĐƠN BÁN RA (ĐẦU RA) - MẪU 01-1/GTGT', 'sold');
  XLSX.utils.book_append_sheet(wb, wsSold, '01-1_GTGT_Ban_Ra');

  // 3. SHEET 3: BẢNG KÊ MUA VÀO (MẪU 01-2/GTGT)
  const purchaseInvoices = invoices.filter(i => i.loaiHdon === 'purchase');
  const wsPurchase = createVatSubSheet(purchaseInvoices, 'BẢNG KÊ HÓA ĐƠN MUA VÀO (ĐẦU VÀO) - MẪU 01-2/GTGT', 'purchase');
  XLSX.utils.book_append_sheet(wb, wsPurchase, '01-2_GTGT_Mua_Vao');

  // 4. SHEET 4: BẢNG KÊ TOÀN BỘ HÓA ĐƠN
  const wsAll = createAllInvoicesSheet(invoices);
  XLSX.utils.book_append_sheet(wb, wsAll, 'Tat_Ca_Hoa_Don');

  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Bao_Cao_Tong_Hop_Thue_GTGT_${taxCode || 'GDT'}_${cleanPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function createVatSubSheet(invoices: GDTInvoice[], title: string, type: 'purchase' | 'sold'): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];
  rows.push([title]);
  rows.push([`Tổng số hóa đơn: ${invoices.length}`]);
  rows.push([]);

  rows.push([
    'STT',
    'Ký hiệu MS',
    'Ký hiệu HĐ',
    'Số HĐ',
    'Ngày lập',
    'Mã CQT',
    type === 'sold' ? 'MST Người mua' : 'MST Người bán',
    type === 'sold' ? 'Tên Người mua' : 'Tên Người bán',
    'Mặt hàng / Diễn giải',
    'Doanh số chưa thuế (VNĐ)',
    'Thuế suất',
    'Tiền thuế GTGT (VNĐ)',
    'Tổng thanh toán (VNĐ)',
    'Trạng thái HĐ'
  ]);

  let sumBeforeTax = 0;
  let sumTax = 0;
  let sumPayment = 0;

  invoices.forEach((inv, idx) => {
    sumBeforeTax += inv.tgtcthue;
    sumTax += inv.tgtthue;
    sumPayment += inv.tgtttbso;

    const partnerTaxCode = type === 'sold' ? inv.nmmst : inv.nbmst;
    const partnerName = type === 'sold' ? inv.nmten : inv.nbten;
    const itemsSummary = inv.items.map(i => `${i.itemName} (${i.quantity} ${i.unit})`).join('; ');
    const taxRatesSummary = formatTaxRateExcel(inv);

    let statusText = 'Gốc';
    if (inv.tthdon === 2) statusText = 'Thay thế';
    if (inv.tthdon === 3) statusText = 'Điều chỉnh';
    if (inv.tthdon === 4) statusText = 'Bị hủy';

    rows.push([
      idx + 1,
      inv.khmshdon,
      inv.khhdon,
      inv.shdon,
      formatDateDDMMYYYY(inv.tdlap),
      inv.mhdon || '',
      partnerTaxCode,
      partnerName,
      itemsSummary,
      inv.tgtcthue,
      taxRatesSummary,
      inv.tgtthue,
      inv.tgtttbso,
      statusText
    ]);
  });

  rows.push([]);
  rows.push([
    'TỔNG CỘNG',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    sumBeforeTax,
    '',
    sumTax,
    sumPayment,
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 12 }, // Ký hiệu MS
    { wch: 12 }, // Ký hiệu HĐ
    { wch: 10 }, // Số HĐ
    { wch: 18 }, // Ngày lập
    { wch: 20 }, // Mã CQT
    { wch: 15 }, // MST
    { wch: 35 }, // Tên đối tác
    { wch: 35 }, // Hàng hóa
    { wch: 22 }, // Doanh số
    { wch: 12 }, // Thuế suất
    { wch: 18 }, // Thuế
    { wch: 22 }, // Tổng tiền
    { wch: 14 }, // Trạng thái
  ];
  return ws;
}

function createAllInvoicesSheet(invoices: GDTInvoice[]): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];
  rows.push(['BẢNG KÊ TOÀN BỘ HÓA ĐƠN ĐIỆN TỬ']);
  rows.push([]);

  rows.push([
    'STT',
    'Loại HĐ',
    'Kỳ Tháng',
    'Ký hiệu MS',
    'Ký hiệu HĐ',
    'Số HĐ',
    'Ngày lập',
    'Mã CQT cấp',
    'MST Bên bán',
    'Tên Bên bán',
    'MST Bên mua',
    'Tên Bên mua',
    'Doanh số chưa thuế (VNĐ)',
    'Thuế suất',
    'Tiền thuế GTGT (VNĐ)',
    'Tổng tiền thanh toán (VNĐ)',
    'Trạng thái HĐ'
  ]);

  let sumBeforeTax = 0;
  let sumTax = 0;
  let sumPayment = 0;

  invoices.forEach((inv, idx) => {
    sumBeforeTax += inv.tgtcthue;
    sumTax += inv.tgtthue;
    sumPayment += inv.tgtttbso;

    const monthTag = inv.tdlap ? `T${inv.tdlap.substring(5, 7)}/${inv.tdlap.substring(0, 4)}` : '';
    const taxRatesSummary = formatTaxRateExcel(inv);

    let statusText = 'Gốc';
    if (inv.tthdon === 2) statusText = 'Thay thế';
    if (inv.tthdon === 3) statusText = 'Điều chỉnh';
    if (inv.tthdon === 4) statusText = 'Bị hủy';

    rows.push([
      idx + 1,
      inv.loaiHdon === 'purchase' ? 'Mua vào' : 'Bán ra',
      monthTag,
      inv.khmshdon,
      inv.khhdon,
      inv.shdon,
      formatDateDDMMYYYY(inv.tdlap),
      inv.mhdon || '',
      inv.nbmst,
      inv.nbten,
      inv.nmmst,
      inv.nmten,
      inv.tgtcthue,
      taxRatesSummary,
      inv.tgtthue,
      inv.tgtttbso,
      statusText
    ]);
  });

  rows.push([]);
  rows.push([
    'TỔNG CỘNG',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    sumBeforeTax,
    '',
    sumTax,
    sumPayment,
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setStandardColumnWidths(ws);
  return ws;
}

function setStandardColumnWidths(ws: XLSX.WorkSheet) {
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 10 }, // Loại HĐ
    { wch: 10 }, // Kỳ Tháng
    { wch: 14 }, // Ký hiệu MS
    { wch: 12 }, // Ký hiệu
    { wch: 10 }, // Số HĐ
    { wch: 18 }, // Ngày lập
    { wch: 22 }, // Mã CQT
    { wch: 15 }, // MST Bán
    { wch: 35 }, // Tên Bán
    { wch: 15 }, // MST Mua
    { wch: 35 }, // Tên Mua
    { wch: 20 }, // Tiền chưa thuế
    { wch: 12 }, // Thuế suất
    { wch: 18 }, // Tiền thuế
    { wch: 22 }, // Tổng thanh toán
    { wch: 16 }, // Trạng thái
  ];
}

function formatVNDNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
}

/**
 * Định dạng Ngày lập theo chuẩn Việt Nam dd/mm/yyyy
 * Hỗ trợ các định dạng ngày phổ biến từ Cổng Tổng cục Thuế:
 * - YYYY-MM-DDTHH:mm:ss
 * - YYYY-MM-DD
 * - YYYY/MM/DD
 * - DD-MM-YYYY hoặc timestamp
 */
export function formatDateDDMMYYYY(dateStr?: string): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();

  // 1. Trường hợp ISO: YYYY-MM-DD hoặc YYYY/MM/DD
  const matchIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (matchIso) {
    const yyyy = matchIso[1];
    const mm = matchIso[2].padStart(2, '0');
    const dd = matchIso[3].padStart(2, '0');
    return `${dd}/${mm}/${yyyy}`;
  }

  // 2. Trường hợp đã là DD-MM-YYYY hoặc DD/MM/YYYY
  const matchDmY = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (matchDmY) {
    const dd = matchDmY[1].padStart(2, '0');
    const mm = matchDmY[2].padStart(2, '0');
    const yyyy = matchDmY[3];
    return `${dd}/${mm}/${yyyy}`;
  }

  // 3. Fallback phân tích Date object
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return str;
}

/**
 * Chuẩn hóa thuế suất hiển thị luôn có dấu % (ví dụ: 10%, 8%, 5%, 0%)
 */
export function normalizeTaxRatePercent(val: string | number): string {
  const str = String(val).trim();
  if (!str) return '';
  if (str.endsWith('%')) return str;

  // Nếu là số: 10 -> 10%, 8 -> 8%, 0.08 -> 8%
  if (/^\d+(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 0 && num < 1) {
      return `${Math.round(num * 100)}%`;
    }
    return `${str}%`;
  }

  const upper = str.toUpperCase();
  if (upper === 'KCT') return 'KCT';
  if (upper === 'KKKNT') return 'KKKNT';
  return str.includes('%') ? str : `${str}%`;
}

/**
 * Lấy chuỗi thuế suất % cho hóa đơn xuất Excel
 */
export function formatTaxRateExcel(inv: GDTInvoice): string {
  const rates: string[] = [];

  // 1. Lấy từ danh sách dòng hàng hóa (items)
  if (Array.isArray(inv.items) && inv.items.length > 0) {
    inv.items.forEach(item => {
      const raw = item.taxRate || item.tsuat;
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
        rates.push(normalizeTaxRatePercent(raw));
      } else if (item.taxRatePercent !== undefined && item.taxRatePercent !== null) {
        rates.push(`${item.taxRatePercent}%`);
      }
    });
  }

  // 2. Lấy từ bảng phân bổ thuế (vatBreakdown) nếu items trống
  if (rates.length === 0 && Array.isArray(inv.vatBreakdown) && inv.vatBreakdown.length > 0) {
    inv.vatBreakdown.forEach(vb => {
      if (vb.taxRate) {
        rates.push(normalizeTaxRatePercent(vb.taxRate));
      }
    });
  }

  // 3. Nếu vẫn trống, suy luận từ tỷ lệ Tiền thuế / Tiền chưa thuế
  if (rates.length === 0) {
    if (inv.tgtthue === 0 && inv.tgtcthue > 0) {
      rates.push('0%');
    } else if (inv.tgtcthue > 0 && inv.tgtthue > 0) {
      const ratio = Math.round((inv.tgtthue / inv.tgtcthue) * 100);
      rates.push(`${ratio}%`);
    } else {
      rates.push('10%');
    }
  }

  const unique = Array.from(new Set(rates.filter(Boolean)));
  return unique.length > 0 ? unique.join(', ') : '10%';
}
