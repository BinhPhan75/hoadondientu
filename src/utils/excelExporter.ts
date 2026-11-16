import * as XLSX from 'xlsx';
import { GDTInvoice, MonthSyncChunk } from '../types';

export interface ExportExcelOptions {
  taxCode?: string;
  taxpayerName?: string;
  periodLabel?: string;
  invoiceType?: 'purchase' | 'sold' | 'both';
}

/**
 * Phân loại nhóm thuế suất theo Thông tư 119/2014/TT-BTC
 */
export function classifyVatRateCategory(inv: GDTInvoice): 'kct' | '0' | '5' | '8' | '10' {
  const taxSummary = formatTaxRateExcel(inv).toLowerCase();
  if (taxSummary.includes('kct') || taxSummary.includes('kkknt')) return 'kct';
  if (taxSummary.includes('0%')) return '0';
  if (taxSummary.includes('5%')) return '5';
  if (taxSummary.includes('8%')) return '8';
  if (taxSummary.includes('10%')) return '10';

  if (inv.tgtcthue > 0) {
    if (inv.tgtthue === 0) return '0';
    const ratio = Math.round((inv.tgtthue / inv.tgtcthue) * 100);
    if (ratio >= 4 && ratio <= 6) return '5';
    if (ratio >= 7 && ratio <= 9) return '8';
    if (ratio >= 9.5 && ratio <= 11) return '10';
  }
  return '10';
}

/**
 * BẢNG KÊ HÓA ĐƠN, CHỨNG TỪ HÀNG HÓA, DỊCH VỤ MUA VÀO
 * Mẫu số: 01-2/GTGT (Ban hành kèm theo Thông tư số 119/2014/TT-BTC ngày 25/8/2014 của Bộ Tài chính)
 */
export function createPurchaseSheetTT119(
  invoices: GDTInvoice[],
  options: { taxCode?: string; taxpayerName?: string; periodLabel?: string } = {}
): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  // 1. Tiêu ngữ & Thông tin biểu mẫu
  rows.push(['', '', '', '', '', '', 'Mẫu số: 01-2/GTGT']);
  rows.push(['', '', '', '', '', '', '(Ban hành kèm theo Thông tư số 119/2014/TT-BTC']);
  rows.push(['', '', '', '', '', '', 'ngày 25/8/2014 của Bộ Tài chính)']);
  rows.push([]);
  rows.push(['BẢNG KÊ HÓA ĐƠN, CHỨNG TỪ HÀNG HÓA, DỊCH VỤ MUA VÀO']);
  rows.push(['(Kèm theo tờ khai thuế GTGT theo mẫu số 01/GTGT)']);
  rows.push([`Kỳ tính thuế: ${options.periodLabel || 'Kỳ tra cứu'}`]);
  rows.push([`Tên người nộp thuế: ${options.taxpayerName || 'Doanh nghiệp nộp thuế'}`]);
  rows.push([`Mã số thuế: ${options.taxCode || '---'}`]);
  rows.push(['Tên đại lý thuế (nếu có):']);
  rows.push(['Mã số thuế đại lý thuế:']);
  rows.push(['Đơn vị tiền tệ: Đồng Việt Nam (VNĐ)']);
  rows.push([]);

  // 2. Nhóm 1: Hàng hóa, dịch vụ dùng riêng cho SXKD chịu thuế GTGT đủ điều kiện khấu trừ
  rows.push(['1. Hàng hóa, dịch vụ dùng riêng cho SXKD chịu thuế GTGT và sử dụng cho các hoạt động cung cấp HHDV không kê khai, nộp thuế GTGT đủ điều kiện khấu trừ thuế:']);

  // Tiêu đề các cột chuẩn Thông tư 119
  rows.push([
    'STT',
    'Số hóa đơn',
    'Ngày, tháng, năm lập hóa đơn',
    'Tên người bán',
    'Mã số thuế của người bán',
    'Doanh số mua chưa có thuế',
    'Thuế GTGT đủ điều kiện khấu trừ',
    'Ghi chú'
  ]);
  rows.push(['(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)']);

  // Sắp xếp theo ngày lập tăng dần
  const sortedInvoices = [...invoices].sort((a, b) => {
    const timeA = new Date(a.tdlap || 0).getTime();
    const timeB = new Date(b.tdlap || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (a.shdon || '').localeCompare(b.shdon || '', undefined, { numeric: true });
  });

  const group1 = sortedInvoices.filter(i => i.tthdon !== 4);
  const group2 = sortedInvoices.filter(i => i.tthdon === 4);

  let g1Amount = 0;
  let g1Tax = 0;

  group1.forEach((inv, idx) => {
    g1Amount += (inv.tgtcthue || 0);
    g1Tax += (inv.tgtthue || 0);

    const invoiceNo = inv.shdon ? String(inv.shdon).padStart(7, '0') : '';
    const noteParts: string[] = [];
    if (inv.khhdon) noteParts.push(`Ký hiệu: ${inv.khhdon}`);
    if (inv.isPos) noteParts.push('Máy tính tiền');
    if (inv.tthdon === 2) noteParts.push('HĐ Thay thế');
    if (inv.tthdon === 3) noteParts.push('HĐ Điều chỉnh');
    const taxRateStr = formatTaxRateExcel(inv);
    if (taxRateStr) noteParts.push(`Thuế: ${taxRateStr}`);

    rows.push([
      idx + 1,
      invoiceNo || inv.shdon || '',
      formatDateDDMMYYYY(inv.tdlap),
      toProperCase(inv.nbten),
      inv.nbmst || '',
      inv.tgtcthue || 0,
      inv.tgtthue || 0,
      noteParts.join('; ')
    ]);
  });

  rows.push([
    'Tổng cộng nhóm 1:',
    '',
    '',
    '',
    '',
    g1Amount,
    g1Tax,
    ''
  ]);

  // Nhóm 2: Hàng hóa, dịch vụ không đủ điều kiện khấu trừ (nếu có hóa đơn hủy)
  let g2Amount = 0;
  let g2Tax = 0;
  if (group2.length > 0) {
    rows.push([]);
    rows.push(['2. Hàng hóa, dịch vụ không đủ điều kiện khấu trừ:']);
    group2.forEach((inv, idx) => {
      g2Amount += (inv.tgtcthue || 0);
      g2Tax += (inv.tgtthue || 0);
      rows.push([
        idx + 1,
        inv.shdon || '',
        formatDateDDMMYYYY(inv.tdlap),
        toProperCase(inv.nbten),
        inv.nbmst || '',
        inv.tgtcthue || 0,
        0,
        `HĐ Bị hủy; Ký hiệu: ${inv.khhdon || ''}`
      ]);
    });
    rows.push([
      'Tổng cộng nhóm 2:',
      '',
      '',
      '',
      '',
      g2Amount,
      0,
      ''
    ]);
  }

  // Tổng kết toàn bảng kê mua vào
  rows.push([]);
  rows.push([
    'Tổng doanh số mua chưa có thuế GTGT:',
    '',
    '',
    '',
    '',
    g1Amount + g2Amount,
    '',
    ''
  ]);
  rows.push([
    'Tổng số thuế GTGT của HHDV mua vào đủ điều kiện khấu trừ:',
    '',
    '',
    '',
    '',
    '',
    g1Tax,
    ''
  ]);

  // Chữ ký kế toán & Giám đốc
  const now = new Date();
  rows.push([]);
  rows.push(['', '', '', '', '', '', `Ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`, '']);
  rows.push(['NGƯỜI LẬP BIỂU', '', 'KẾ TOÁN TRƯỞNG', '', '', '', 'NGƯỜI ĐẠI DIỆN THEO PHÁP LUẬT', '']);
  rows.push(['(Ký, ghi rõ họ tên)', '', '(Ký, ghi rõ họ tên)', '', '', '', '(Ký, đóng dấu, ghi rõ họ tên)', '']);
  rows.push([]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },  // (1) STT
    { wch: 14 }, // (2) Số HĐ
    { wch: 16 }, // (3) Ngày lập
    { wch: 40 }, // (4) Tên người bán
    { wch: 16 }, // (5) MST người bán
    { wch: 24 }, // (6) Doanh số chưa thuế
    { wch: 22 }, // (7) Thuế GTGT khấu trừ
    { wch: 30 }, // (8) Ghi chú
  ];
  return ws;
}

/**
 * BẢNG KÊ HÓA ĐƠN, CHỨNG TỪ HÀNG HÓA, DỊCH VỤ BÁN RA
 * Mẫu số: 01-1/GTGT (Ban hành kèm theo Thông tư số 119/2014/TT-BTC ngày 25/8/2014 của Bộ Tài chính)
 */
export function createSoldSheetTT119(
  invoices: GDTInvoice[],
  options: { taxCode?: string; taxpayerName?: string; periodLabel?: string } = {}
): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  // 1. Tiêu ngữ & Thông tin biểu mẫu
  rows.push(['', '', '', '', '', '', 'Mẫu số: 01-1/GTGT']);
  rows.push(['', '', '', '', '', '', '(Ban hành kèm theo Thông tư số 119/2014/TT-BTC']);
  rows.push(['', '', '', '', '', '', 'ngày 25/8/2014 của Bộ Tài chính)']);
  rows.push([]);
  rows.push(['BẢNG KÊ HÓA ĐƠN, CHỨNG TỪ HÀNG HÓA, DỊCH VỤ BÁN RA']);
  rows.push(['(Kèm theo tờ khai thuế GTGT theo mẫu số 01/GTGT)']);
  rows.push([`Kỳ tính thuế: ${options.periodLabel || 'Kỳ tra cứu'}`]);
  rows.push([`Tên người nộp thuế: ${options.taxpayerName || 'Doanh nghiệp nộp thuế'}`]);
  rows.push([`Mã số thuế: ${options.taxCode || '---'}`]);
  rows.push(['Tên đại lý thuế (nếu có):']);
  rows.push(['Mã số thuế đại lý thuế:']);
  rows.push(['Đơn vị tiền tệ: Đồng Việt Nam (VNĐ)']);
  rows.push([]);

  // Tiêu đề các cột chuẩn Thông tư 119
  rows.push([
    'STT',
    'Số hóa đơn',
    'Ngày, tháng, năm lập hóa đơn',
    'Tên người mua',
    'Mã số thuế của người mua',
    'Doanh thu chưa có thuế GTGT',
    'Thuế GTGT',
    'Ghi chú'
  ]);
  rows.push(['(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)']);

  // Sắp xếp theo ngày lập tăng dần
  const sortedInvoices = [...invoices].sort((a, b) => {
    const timeA = new Date(a.tdlap || 0).getTime();
    const timeB = new Date(b.tdlap || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (a.shdon || '').localeCompare(b.shdon || '', undefined, { numeric: true });
  });

  // Phân nhóm thuế suất theo chuẩn Thông tư 119:
  const groups: Array<{
    title: string;
    items: GDTInvoice[];
  }> = [
    { title: '1. Hàng hóa, dịch vụ không chịu thuế giá trị gia tăng (GTGT):', items: [] },
    { title: '2. Hàng hóa, dịch vụ chịu thuế suất thuế GTGT 0%:', items: [] },
    { title: '3. Hàng hóa, dịch vụ chịu thuế suất thuế GTGT 5%:', items: [] },
    { title: '4. Hàng hóa, dịch vụ chịu thuế suất thuế GTGT 10%:', items: [] },
    { title: '5. Hàng hóa, dịch vụ chịu thuế suất thuế GTGT 8% (giảm thuế theo NQ Quốc hội):', items: [] }
  ];

  sortedInvoices.forEach(inv => {
    const cat = classifyVatRateCategory(inv);
    if (cat === 'kct') groups[0].items.push(inv);
    else if (cat === '0') groups[1].items.push(inv);
    else if (cat === '5') groups[2].items.push(inv);
    else if (cat === '8') groups[4].items.push(inv);
    else groups[3].items.push(inv);
  });

  let totalBeforeTax = 0;
  let totalTax = 0;

  groups.forEach((group, gIdx) => {
    rows.push([]);
    rows.push([group.title]);

    let sumGrpAmount = 0;
    let sumGrpTax = 0;

    if (group.items.length === 0) {
      rows.push(['', '', '', '', '', 0, 0, '']);
    } else {
      group.items.forEach((inv, idx) => {
        sumGrpAmount += (inv.tgtcthue || 0);
        sumGrpTax += (inv.tgtthue || 0);

        const invoiceNo = inv.shdon ? String(inv.shdon).padStart(7, '0') : '';
        const noteParts: string[] = [];
        if (inv.khhdon) noteParts.push(`Ký hiệu: ${inv.khhdon}`);
        if (inv.isPos) noteParts.push('Máy tính tiền');
        if (inv.tthdon === 2) noteParts.push('HĐ Thay thế');
        if (inv.tthdon === 3) noteParts.push('HĐ Điều chỉnh');
        if (inv.tthdon === 4) noteParts.push('HĐ Bị hủy');

        rows.push([
          idx + 1,
          invoiceNo || inv.shdon || '',
          formatDateDDMMYYYY(inv.tdlap),
          inv.nmten || 'Khách hàng cá nhân không lấy HĐ',
          inv.nmmst || '',
          inv.tgtcthue || 0,
          inv.tgtthue || 0,
          noteParts.join('; ')
        ]);
      });
    }

    totalBeforeTax += sumGrpAmount;
    totalTax += sumGrpTax;

    rows.push([
      `Tổng cộng nhóm ${gIdx + 1}:`,
      '',
      '',
      '',
      '',
      sumGrpAmount,
      sumGrpTax,
      ''
    ]);
  });

  // Dòng tổng kết toàn bảng kê bán ra
  rows.push([]);
  rows.push([
    'TỔNG DOANH THU VÀ THUẾ GTGT BÁN RA:',
    '',
    '',
    '',
    '',
    totalBeforeTax,
    totalTax,
    ''
  ]);

  // Chữ ký
  const now = new Date();
  rows.push([]);
  rows.push(['', '', '', '', '', '', `Ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`, '']);
  rows.push(['NGƯỜI LẬP BIỂU', '', 'KẾ TOÁN TRƯỞNG', '', '', '', 'NGƯỜI ĐẠI DIỆN THEO PHÁP LUẬT', '']);
  rows.push(['(Ký, ghi rõ họ tên)', '', '(Ký, ghi rõ họ tên)', '', '', '', '(Ký, đóng dấu, ghi rõ họ tên)', '']);
  rows.push([]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },  // (1) STT
    { wch: 14 }, // (2) Số HĐ
    { wch: 16 }, // (3) Ngày lập
    { wch: 40 }, // (4) Tên người mua
    { wch: 16 }, // (5) MST người mua
    { wch: 24 }, // (6) Doanh thu chưa thuế
    { wch: 22 }, // (7) Thuế GTGT
    { wch: 30 }, // (8) Ghi chú
  ];
  return ws;
}

/**
 * Xuất file Excel bảng kê hóa đơn theo đúng chuẩn Thông tư 119/2014/TT-BTC
 */
export function exportInvoicesToExcel(
  invoices: GDTInvoice[],
  title: string = 'Bang_Ke_Hoa_Don_GDT',
  options: ExportExcelOptions = {}
): void {
  const wb = XLSX.utils.book_new();

  const purchaseInvoices = invoices.filter(i => i.loaiHdon === 'purchase');
  const soldInvoices = invoices.filter(i => i.loaiHdon === 'sold');

  // Nếu có cả mua vào và bán ra, thêm Sheet Tổng hợp nghĩa vụ thuế GTGT lên đầu
  if (purchaseInvoices.length > 0 && soldInvoices.length > 0) {
    const summaryRows: (string | number)[][] = [];
    summaryRows.push(['BẢNG TỔNG HỢP NGHĨA VỤ THUẾ GTGT (MUA VÀO & BÁN RA)']);
    summaryRows.push([`Người nộp thuế: ${options.taxpayerName || 'Doanh nghiệp'} - MST: ${options.taxCode || '---'}`]);
    summaryRows.push([`Kỳ tính thuế: ${options.periodLabel || 'Kỳ tra cứu'}`]);
    summaryRows.push([`Thời điểm xuất: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`]);
    summaryRows.push([]);
    summaryRows.push([
      'Chỉ tiêu',
      'Số lượng HĐ',
      'Doanh số / Tiền chưa thuế (VNĐ)',
      'Tiền thuế GTGT (VNĐ)',
      'Tổng thanh toán (VNĐ)'
    ]);

    const pAmount = purchaseInvoices.reduce((s, i) => s + (i.tgtcthue || 0), 0);
    const pTax = purchaseInvoices.reduce((s, i) => s + (i.tgtthue || 0), 0);
    const pPayment = purchaseInvoices.reduce((s, i) => s + (i.tgtttbso || 0), 0);

    const sAmount = soldInvoices.reduce((s, i) => s + (i.tgtcthue || 0), 0);
    const sTax = soldInvoices.reduce((s, i) => s + (i.tgtthue || 0), 0);
    const sPayment = soldInvoices.reduce((s, i) => s + (i.tgtttbso || 0), 0);

    const netTax = sTax - pTax;

    summaryRows.push([
      '1. Hàng hóa, dịch vụ BÁN RA (Đầu ra - Mẫu 01-1/GTGT TT 119)',
      soldInvoices.length,
      sAmount,
      sTax,
      sPayment
    ]);
    summaryRows.push([
      '2. Hàng hóa, dịch vụ MUA VÀO (Đầu vào - Mẫu 01-2/GTGT TT 119)',
      purchaseInvoices.length,
      pAmount,
      pTax,
      pPayment
    ]);
    summaryRows.push([]);
    summaryRows.push([
      '3. CHÊNH LỆCH THUẾ GTGT (Bán ra - Mua vào):',
      '',
      '',
      netTax,
      netTax > 0
        ? `Nghĩa vụ nộp ngân sách: ${new Intl.NumberFormat('vi-VN').format(netTax)} đ`
        : `Số thuế GTGT còn được khấu trừ: ${new Intl.NumberFormat('vi-VN').format(Math.abs(netTax))} đ`
    ]);

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [
      { wch: 45 },
      { wch: 16 },
      { wch: 28 },
      { wch: 24 },
      { wch: 38 }
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tong_Hop_Thue');
  }

  // 1. SHEET MUA VÀO: Mẫu 01-2/GTGT (Thông tư 119/2014/TT-BTC)
  if (purchaseInvoices.length > 0) {
    const wsPurchase = createPurchaseSheetTT119(purchaseInvoices, options);
    XLSX.utils.book_append_sheet(wb, wsPurchase, '01-2_GTGT_Mua_Vao');
  }

  // 2. SHEET BÁN RA: Mẫu 01-1/GTGT (Thông tư 119/2014/TT-BTC)
  if (soldInvoices.length > 0) {
    const wsSold = createSoldSheetTT119(soldInvoices, options);
    XLSX.utils.book_append_sheet(wb, wsSold, '01-1_GTGT_Ban_Ra');
  }

  // 3. SHEET CHI TIẾT ĐẦY ĐỦ: Hỗ trợ đối chiếu chi tiết mặt hàng, mã CQT
  const wsDetail = createAllInvoicesSheet(invoices);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi_Tiet_Hoa_Don');

  const typeTag = options.invoiceType === 'sold'
    ? 'Ban_Ra_TT119'
    : options.invoiceType === 'both'
      ? 'Mua_Ban_TT119'
      : 'Mua_Vao_TT119';

  const fileName = `${title}_${typeTag}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export detailed report for a single month theo Thông tư 119/2014/TT-BTC
 */
export function exportSingleMonthToExcel(
  invoices: GDTInvoice[],
  monthLabel: string,
  taxCode: string = '',
  taxpayerName: string = ''
): void {
  const safeLabel = monthLabel.replace(/[\/\s]/g, '_');
  const title = `Bang_Ke_Thue_TT119_${safeLabel}_MST_${taxCode || 'GDT'}`;
  exportInvoicesToExcel(invoices, title, {
    taxCode,
    taxpayerName,
    periodLabel: monthLabel
  });
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

  // 2. SHEET 2: BẢNG KÊ BÁN RA (MẪU 01-1/GTGT - TT 119/2014/TT-BTC)
  const soldInvoices = invoices.filter(i => i.loaiHdon === 'sold');
  const wsSold = createSoldSheetTT119(soldInvoices, { taxCode, taxpayerName, periodLabel });
  XLSX.utils.book_append_sheet(wb, wsSold, '01-1_GTGT_Ban_Ra');

  // 3. SHEET 3: BẢNG KÊ MUA VÀO (MẪU 01-2/GTGT - TT 119/2014/TT-BTC)
  const purchaseInvoices = invoices.filter(i => i.loaiHdon === 'purchase');
  const wsPurchase = createPurchaseSheetTT119(purchaseInvoices, { taxCode, taxpayerName, periodLabel });
  XLSX.utils.book_append_sheet(wb, wsPurchase, '01-2_GTGT_Mua_Vao');

  // 4. SHEET 4: BẢNG KÊ TOÀN BỘ HÓA ĐƠN
  const wsAll = createAllInvoicesSheet(invoices);
  XLSX.utils.book_append_sheet(wb, wsAll, 'Tat_Ca_Hoa_Don');

  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Bao_Cao_Tong_Hop_Thue_GTGT_${taxCode || 'GDT'}_${cleanPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function createVatSubSheet(
  invoices: GDTInvoice[],
  title: string,
  type: 'purchase' | 'sold',
  options: { taxCode?: string; taxpayerName?: string; periodLabel?: string } = {}
): XLSX.WorkSheet {
  if (type === 'sold') {
    return createSoldSheetTT119(invoices, options);
  }
  return createPurchaseSheetTT119(invoices, options);
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

  // Sắp xếp theo ngày lập hóa đơn (tdlap): tăng dần
  const sortedInvoices = [...invoices].sort((a, b) => {
    const timeA = new Date(a.tdlap || 0).getTime();
    const timeB = new Date(b.tdlap || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (a.shdon || '').localeCompare(b.shdon || '', undefined, { numeric: true });
  });

  sortedInvoices.forEach((inv, idx) => {
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
      toProperCase(inv.nbten),
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

/**
 * Chuyển đổi tên người bán sang định dạng viết hoa đầu mỗi từ theo chuẩn hàm PROPER trong Excel.
 * Ví dụ: "CÔNG TY TNHH VÀNG BẠC TKJ" -> "Công Ty Tnhh Vàng Bạc Tkj"
 * Hoạt động chính xác với đầy đủ ký tự tiếng Việt có dấu.
 */
export function toProperCase(text?: string): string {
  if (!text) return '';
  const str = String(text).trim();
  if (!str) return '';

  return str
    .toLowerCase()
    .replace(/(^|[\s\-\/\(\)\.,_])([a-zA-ZÀ-ỹ])/g, (_, boundary, char) => boundary + char.toUpperCase());
}
