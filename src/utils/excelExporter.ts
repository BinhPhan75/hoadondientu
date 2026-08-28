import * as XLSX from 'xlsx';
import { GDTInvoice } from '../types';

export function exportInvoicesToExcel(invoices: GDTInvoice[], title: string = 'Bang_Ke_Hoa_Don_GDT'): void {
  // Create worksheet data
  const rows: (string | number)[][] = [];

  // Header information
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
    const taxRatesSummary = Array.from(new Set(inv.items.map(i => i.taxRate))).join(', ') || '10%';

    let statusText = 'Gốc (Mới)';
    if (inv.tthdon === 2) statusText = 'Hóa đơn Thay thế';
    if (inv.tthdon === 3) statusText = 'Hóa đơn Điều chỉnh';
    if (inv.tthdon === 4) statusText = 'Hóa đơn Bị hủy';

    let cqtStatus = inv.hsgcma ? (inv.mhdon ? `Có mã (${inv.mhdon.slice(0, 8)}...)` : 'Có mã') : 'Không mã CQT';

    rows.push([
      index + 1,
      inv.loaiHdon === 'purchase' ? 'Mua vào' : 'Bán ra',
      inv.khmshdon,
      inv.khhdon,
      inv.shdon,
      inv.tdlap.replace('T', ' ').substring(0, 19),
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

  // Set column widths for readability
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 10 }, // Loại HĐ
    { wch: 14 }, // Ký hiệu MS
    { wch: 12 }, // Ký hiệu
    { wch: 10 }, // Số HĐ
    { wch: 18 }, // Ngày lập
    { wch: 22 }, // Mã CQT
    { wch: 15 }, // MST Bán
    { wch: 35 }, // Tên Bán
    { wch: 15 }, // MST Mua
    { wch: 35 }, // Tên Mua
    { wch: 40 }, // Hàng hóa
    { wch: 20 }, // Tiền chưa thuế
    { wch: 12 }, // Thuế suất
    { wch: 18 }, // Tiền thuế
    { wch: 22 }, // Tổng thanh toán
    { wch: 16 }, // Trạng thái
    { wch: 20 }, // Xử lý CQT
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bang_Ke_Hoa_Don_GDT');

  const fileName = `${title}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
