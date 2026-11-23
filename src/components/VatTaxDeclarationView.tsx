import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Calculator, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';
import { GDTAccountConfig, GDTInvoice, FilterParams } from '../types';
import { exportInvoicesToExcel } from '../utils/excelExporter';

interface VatTaxDeclarationViewProps {
  invoices: GDTInvoice[];
  account: GDTAccountConfig;
  filters: FilterParams;
  onSwitchToPurchase: () => void;
  onSwitchToSold: () => void;
}

export const VatTaxDeclarationView: React.FC<VatTaxDeclarationViewProps> = ({
  invoices,
  account,
  filters,
  onSwitchToPurchase,
  onSwitchToSold
}) => {
  // Chỉ tiêu [22]: Thuế GTGT còn được khấu trừ kỳ trước chuyển sang (người dùng có thể chỉnh sửa nếu có số dư)
  const [indicator22, setIndicator22] = useState<number>(0);
  // Chỉ tiêu [21]: Không phát sinh hoạt động mua bán trong kỳ
  const [isZeroActivity, setIsZeroActivity] = useState<boolean>(false);
  // Chỉ tiêu [37], [38]: Điều chỉnh tăng / giảm khấu trừ các kỳ trước
  const [indicator37, setIndicator37] = useState<number>(0);
  const [indicator38, setIndicator38] = useState<number>(0);
  const [indicator39, setIndicator39] = useState<number>(0);
  const [indicator42, setIndicator42] = useState<number>(0);

  // Phân loại hóa đơn mua vào & bán ra hợp lệ (loại trừ hóa đơn bị hủy - tthdon === 4)
  const activeInvoices = useMemo(() => {
    return invoices.filter(inv => inv.tthdon !== 4);
  }, [invoices]);

  const purchaseInvoices = useMemo(() => {
    return activeInvoices.filter(inv => inv.loaiHdon === 'purchase');
  }, [activeInvoices]);

  const soldInvoices = useMemo(() => {
    return activeInvoices.filter(inv => inv.loaiHdon === 'sold');
  }, [activeInvoices]);

  // Xác định kỳ tính thuế
  const periodLabel = useMemo(() => {
    if (!filters.fromDate && !filters.toDate) return 'Toàn bộ kỳ';
    const fromParts = (filters.fromDate || '').split('-');
    const toParts = (filters.toDate || '').split('-');
    if (fromParts.length === 3 && toParts.length === 3) {
      if (fromParts[0] === toParts[0] && fromParts[1] === toParts[1]) {
        return `Tháng ${fromParts[1]}/${fromParts[0]}`;
      }
      return `Kỳ từ ${fromParts[2]}/${fromParts[1]}/${fromParts[0]} đến ${toParts[2]}/${toParts[1]}/${toParts[0]}`;
    }
    return `${filters.fromDate} - ${filters.toDate}`;
  }, [filters.fromDate, filters.toDate]);

  // === TÍNH TOÁN CÁC CHỈ TIÊU THEO MẪU 01/GTGT THÔNG TƯ 80/2021/TT-BTC ===

  // I. Hàng hóa dịch vụ mua vào
  // [23] Giá trị HHDV mua vào chưa có thuế GTGT
  const indicator23 = useMemo(() => {
    return purchaseInvoices.reduce((sum, inv) => sum + (inv.tgtcthue || 0), 0);
  }, [purchaseInvoices]);

  // [24] Thuế GTGT của HHDV mua vào
  const indicator24 = useMemo(() => {
    return purchaseInvoices.reduce((sum, inv) => sum + (inv.tgtthue || 0), 0);
  }, [purchaseInvoices]);

  // [25] Tổng số thuế GTGT được khấu trừ kỳ này (mặc định = [24])
  const indicator25 = indicator24;

  // II. Hàng hóa dịch vụ bán ra
  const soldMetrics = useMemo(() => {
    let salesKct = 0; // [26] Không chịu thuế
    let sales0 = 0;   // [29] Thuế suất 0%
    let sales5 = 0;   // [30] Doanh số 5%
    let tax5 = 0;     // [31] Thuế 5%
    let sales10 = 0;  // [32] Doanh số 10%
    let tax10 = 0;    // [33] Thuế 10%
    let sales8 = 0;   // [32a] Doanh số 8%
    let tax8 = 0;     // [33a] Thuế 8%

    soldInvoices.forEach(inv => {
      // Nếu có chi tiết mặt hàng
      if (inv.items && inv.items.length > 0) {
        inv.items.forEach(it => {
          const rateStr = String(it.taxRate || '').toUpperCase();
          const amount = it.amount || it.thtien || 0;
          const tax = it.taxAmount || it.tthue || 0;

          if (rateStr.includes('KCT') || rateStr.includes('KHÔNG CHỊU')) {
            salesKct += amount;
          } else if (rateStr.includes('0%') || it.taxRatePercent === 0) {
            sales0 += amount;
          } else if (rateStr.includes('5%') || it.taxRatePercent === 5) {
            sales5 += amount;
            tax5 += tax;
          } else if (rateStr.includes('8%') || it.taxRatePercent === 8) {
            sales8 += amount;
            tax8 += tax;
          } else {
            // Mặc định 10% hoặc các loại chịu thuế thông thường
            sales10 += amount;
            tax10 += tax;
          }
        });
      } else {
        // Dự phòng tính theo tổng HĐ nếu chưa có dòng chi tiết items
        const amount = inv.tgtcthue || 0;
        const tax = inv.tgtthue || 0;
        if (tax === 0) {
          sales0 += amount;
        } else {
          // Ước tính theo tỷ lệ thuế
          const ratio = amount > 0 ? (tax / amount) : 0;
          if (ratio > 0.07 && ratio < 0.09) {
            sales8 += amount;
            tax8 += tax;
          } else if (ratio > 0.04 && ratio < 0.06) {
            sales5 += amount;
            tax5 += tax;
          } else {
            sales10 += amount;
            tax10 += tax;
          }
        }
      }
    });

    const salesTaxable = sales0 + sales5 + sales10 + sales8; // [27]
    const taxTotal = tax5 + tax10 + tax8;                     // [28]
    const totalRevenue = salesKct + salesTaxable;             // [34]

    return {
      salesKct,
      sales0,
      sales5,
      tax5,
      sales10,
      tax10,
      sales8,
      tax8,
      salesTaxable,
      taxTotal,
      totalRevenue
    };
  }, [soldInvoices]);

  const indicator26 = soldMetrics.salesKct;
  const indicator27 = soldMetrics.salesTaxable;
  const indicator28 = soldMetrics.taxTotal;
  const indicator29 = soldMetrics.sales0;
  const indicator30 = soldMetrics.sales5;
  const indicator31 = soldMetrics.tax5;
  const indicator32 = soldMetrics.sales10;
  const indicator33 = soldMetrics.tax10;
  const indicator32a = soldMetrics.sales8;
  const indicator33a = soldMetrics.tax8;
  const indicator34 = soldMetrics.totalRevenue;
  const indicator35 = indicator28;

  // III. Nghĩa vụ thuế phát sinh trong kỳ
  // [36] Thuế GTGT phát sinh trong kỳ: [36] = [35] - [25]
  const indicator36 = indicator35 - indicator25;

  // Tính thuế phải nộp hoặc còn được khấu trừ
  // Net = [36] - [22] + [37] - [38] - [39]
  const netTaxAmount = indicator36 - indicator22 + indicator37 - indicator38 - indicator39;

  // [40] Thuế GTGT phải nộp trong kỳ (Nếu net > 0)
  const indicator40 = netTaxAmount > 0 ? netTaxAmount : 0;

  // [41] Thuế GTGT chưa khấu trừ hết kỳ này (Nếu net < 0)
  const indicator41 = netTaxAmount < 0 ? Math.abs(netTaxAmount) : 0;

  // [43] Thuế GTGT còn được khấu trừ chuyển kỳ sau ([43] = [41] - [42])
  const indicator43 = Math.max(0, indicator41 - indicator42);

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(num));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportFullExcel = () => {
    exportInvoicesToExcel(invoices, `To_Khai_Va_Bang_Ke_Thue_GTGT_${account.taxCode || 'GDT'}`, {
      taxCode: account.taxCode,
      taxpayerName: account.taxpayerName,
      periodLabel: periodLabel
    });
  };

  return (
    <div className="vat-declaration-scroll flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 lg:p-8 print:p-0 print:bg-white">
      {/* Top Controls & Navigation Bar (Hidden when printing) */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <Calculator className="w-5 h-5 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Tờ khai thuế GTGT (Mẫu 01/GTGT)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold uppercase">
                Thông tư 80/2021/TT-BTC
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{periodLabel}</span>
              <span className="text-slate-300">·</span>
              <span>Tổng {purchaseInvoices.length} HĐ mua vào</span>
              <span className="text-slate-300">·</span>
              <span>{soldInvoices.length} HĐ bán ra</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onSwitchToPurchase}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Xem danh sách bảng kê hóa đơn mua vào"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
            <span>Bảng kê mua vào ({purchaseInvoices.length})</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToSold}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Xem danh sách bảng kê hóa đơn bán ra"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bảng kê bán ra ({soldInvoices.length})</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="In tờ khai thuế chuẩn A4"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>In tờ khai</span>
          </button>

          <button
            type="button"
            onClick={handleExportFullExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors shadow-xs cursor-pointer"
            title="Xuất file Excel gồm đầy đủ Tờ khai và 2 Bảng kê mua/bán"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Excel Tờ khai & Bảng kê</span>
          </button>
        </div>
      </div>

      {/* 4 Cards Summary of Tax Obligation */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6 print:hidden">
        {/* Card 1: Hàng hóa mua vào */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-medium">Mua vào ([23], [24])</span>
            <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-semibold">
              {purchaseInvoices.length} HĐ
            </span>
          </div>
          <div className="font-mono text-base font-bold text-slate-900">
            {formatVND(indicator23)} đ
          </div>
          <div className="text-[11px] text-blue-700 font-mono mt-0.5 font-medium">
            Thuế GTGT [24]: {formatVND(indicator24)} đ
          </div>
        </div>

        {/* Card 2: Hàng hóa bán ra */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-medium">Bán ra ([34], [35])</span>
            <span className="text-[11px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-semibold">
              {soldInvoices.length} HĐ
            </span>
          </div>
          <div className="font-mono text-base font-bold text-slate-900">
            {formatVND(indicator34)} đ
          </div>
          <div className="text-[11px] text-emerald-700 font-mono mt-0.5 font-medium">
            Thuế GTGT [35]: {formatVND(indicator35)} đ
          </div>
        </div>

        {/* Card 3: Thuế phát sinh trong kỳ */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-medium">Thuế phát sinh [36]</span>
            <span className="text-[10px] text-slate-400 font-mono">[35] - [25]</span>
          </div>
          <div className={`font-mono text-base font-bold ${indicator36 >= 0 ? 'text-amber-700' : 'text-blue-700'}`}>
            {formatVND(indicator36)} đ
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {indicator36 >= 0 ? 'Đầu ra lớn hơn đầu vào' : 'Đầu vào lớn hơn đầu ra'}
          </div>
        </div>

        {/* Card 4: Kết quả nghĩa vụ thuế */}
        <div className={`p-3.5 rounded-xl border shadow-2xs ${
          indicator40 > 0 
            ? 'bg-rose-50/80 border-rose-200 text-rose-950' 
            : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold">
              {indicator40 > 0 ? 'Số thuế phải nộp [40]' : 'Số thuế còn khấu trừ [43]'}
            </span>
            {indicator40 > 0 ? (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div className={`font-mono text-lg font-bold tracking-tight ${
            indicator40 > 0 ? 'text-rose-700' : 'text-emerald-700'
          }`}>
            {formatVND(indicator40 > 0 ? indicator40 : indicator43)} đ
          </div>
          <div className="text-[11px] mt-0.5 font-medium">
            {indicator40 > 0 ? 'Nộp vào ngân sách nhà nước' : 'Chuyển kỳ sau khấu trừ tiếp'}
          </div>
        </div>
      </div>

      {/* Official Form 01/GTGT Paper Presentation (A4 layout) */}
      <div id="vat-declaration-print" className="max-w-5xl mx-auto bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0 text-slate-900 font-sans">
        {/* National Header */}
        <div className="text-center pb-4 border-b border-slate-200">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-900">
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </div>
          <div className="text-xs font-semibold text-slate-700 underline underline-offset-4 mt-0.5">
            Độc lập - Tự do - Hạnh phúc
          </div>

          <h1 className="text-base sm:text-lg font-extrabold uppercase tracking-wide text-slate-950 mt-4">
            TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG
          </h1>
          <p className="text-xs text-slate-600 italic mt-0.5">
            (Áp dụng đối với người nộp thuế tính thuế theo phương pháp khấu trừ có hoạt động sản xuất kinh doanh)
          </p>
          <p className="text-xs font-semibold text-blue-900 mt-1">
            [Mẫu số: 01/GTGT - Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày 29/09/2021 của Bộ Tài chính]
          </p>

          <div className="mt-2 text-xs font-medium text-slate-800">
            Kỳ tính thuế: <strong className="font-bold text-slate-950 uppercase">{periodLabel}</strong> (Lần đầu)
          </div>
        </div>

        {/* Taxpayer Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 py-4 border-b border-slate-200 text-xs">
          <div>
            <span className="text-slate-500">Tên người nộp thuế:</span>{' '}
            <strong className="font-semibold text-slate-900 uppercase">
              {account.taxpayerName && !account.taxpayerName.startsWith('DOANH NGHIỆP NỘP THUẾ') ? account.taxpayerName : 'Chưa cấu hình tên doanh nghiệp'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Mã số thuế:</span>{' '}
            <strong className="font-mono font-bold text-slate-900 text-sm">
              {account.taxCode || '---'}
            </strong>
          </div>
          <div className="md:col-span-2">
            <span className="text-slate-500">Địa chỉ trụ sở:</span>{' '}
            <span className="text-slate-800">
              {account.address && account.address !== 'Đăng ký tại Tổng cục Thuế' ? account.address : 'Chưa cấu hình địa chỉ doanh nghiệp'}
            </span>
          </div>
        </div>

        {/* Zero Activity Checkbox */}
        <div className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg my-3 flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isZeroActivity}
              onChange={(e) => setIsZeroActivity(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <span className="font-medium text-slate-800">
              [21] Không phát sinh hoạt động mua, bán trong kỳ
            </span>
          </label>
          <span className="text-[11px] text-slate-500 italic">
            (Đánh dấu nếu kỳ này doanh nghiệp không có HĐ mua vào hoặc bán ra)
          </span>
        </div>

        {/* Main Indicators Table */}
        <div className="overflow-x-auto border border-slate-300 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-800 font-bold border-b border-slate-300 text-center">
                <th className="py-2.5 px-3 border-r border-slate-300 w-12">STT</th>
                <th className="py-2.5 px-4 border-r border-slate-300 text-left">Chỉ tiêu</th>
                <th className="py-2.5 px-2 border-r border-slate-300 w-20">Mã chỉ tiêu</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right w-44">Giá trị HHDV (chưa có thuế)</th>
                <th className="py-2.5 px-3 text-right w-44">Thuế GTGT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {/* [22] Thuế kỳ trước */}
              <tr className="bg-slate-50/70 hover:bg-slate-100/60 transition-colors">
                <td className="py-2 px-3 text-center border-r border-slate-200 font-medium">1</td>
                <td className="py-2 px-4 border-r border-slate-200">
                  <span>Thuế GTGT còn được khấu trừ kỳ trước chuyển sang</span>
                </td>
                <td className="py-2 px-2 text-center border-r border-slate-200 font-mono font-bold text-blue-800 bg-blue-50/50">[22]</td>
                <td className="py-2 px-3 text-right border-r border-slate-200 text-slate-400 font-mono">---</td>
                <td className="py-1 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      value={indicator22 === 0 ? '' : indicator22}
                      onChange={(e) => setIndicator22(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-36 text-right font-mono font-bold text-xs px-2 py-1 bg-white border border-slate-300 rounded focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-[11px] text-slate-500">đ</span>
                  </div>
                </td>
              </tr>

              {/* MỤC I: HÀNG HÓA DỊCH VỤ MUA VÀO */}
              <tr className="bg-blue-50/60 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-2 px-3 text-center border-r border-slate-200">I</td>
                <td colSpan={4} className="py-2 px-4">
                  Hàng hóa, dịch vụ mua vào trong kỳ
                </td>
              </tr>

              <tr>
                <td className="py-2 px-3 text-center border-r border-slate-200">1</td>
                <td className="py-2 px-4 border-r border-slate-200">
                  Giá trị và thuế GTGT của hàng hóa, dịch vụ mua vào
                </td>
                <td className="py-2 px-2 text-center border-r border-slate-200 font-mono font-bold text-blue-800 bg-blue-50/40">[23] / [24]</td>
                <td className="py-2 px-3 text-right border-r border-slate-200 font-mono font-semibold text-slate-900">
                  {formatVND(indicator23)}
                </td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-blue-700">
                  {formatVND(indicator24)}
                </td>
              </tr>

              <tr className="bg-slate-50/40">
                <td className="py-2 px-3 text-center border-r border-slate-200">2</td>
                <td className="py-2 px-4 border-r border-slate-200 font-medium">
                  Tổng số thuế GTGT được khấu trừ kỳ này
                </td>
                <td className="py-2 px-2 text-center border-r border-slate-200 font-mono font-bold text-blue-800 bg-blue-50/40">[25]</td>
                <td className="py-2 px-3 text-right border-r border-slate-200 text-slate-400 font-mono">---</td>
                <td className="py-2 px-3 text-right font-mono font-bold text-blue-800">
                  {formatVND(indicator25)}
                </td>
              </tr>

              {/* MỤC II: HÀNG HÓA DỊCH VỤ BÁN RA */}
              <tr className="bg-emerald-50/60 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-2 px-3 text-center border-r border-slate-200">II</td>
                <td colSpan={4} className="py-2 px-4">
                  Hàng hóa, dịch vụ bán ra trong kỳ
                </td>
              </tr>

              <tr>
                <td className="py-2 px-3 text-center border-r border-slate-200">1</td>
                <td className="py-2 px-4 border-r border-slate-200">
                  Hàng hóa, dịch vụ bán ra không chịu thuế GTGT
                </td>
                <td className="py-2 px-2 text-center border-r border-slate-200 font-mono font-bold text-emerald-800 bg-emerald-50/40">[26]</td>
                <td className="py-2 px-3 text-right border-r border-slate-200 font-mono font-medium text-slate-800">
                  {formatVND(indicator26)}
                </td>
                <td className="py-2 px-3 text-right text-slate-400 font-mono">---</td>
              </tr>

              <tr className="bg-slate-50/30">
                <td className="py-2 px-3 text-center border-r border-slate-200">2</td>
                <td className="py-2 px-4 border-r border-slate-200 font-semibold">
                  Hàng hóa, dịch vụ bán ra chịu thuế GTGT ([27] = [29] + [30] + [32] + [32a])
                </td>
                <td className="py-2 px-2 text-center border-r border-slate-200 font-mono font-bold text-emerald-800 bg-emerald-50/40">[27] / [28]</td>
                <td className="py-2 px-3 text-right border-r border-slate-200 font-mono font-bold text-slate-900">
                  {formatVND(indicator27)}
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">
                  {formatVND(indicator28)}
                </td>
              </tr>

              {/* Phân loại thuế suất chi tiết */}
              <tr className="text-slate-700">
                <td className="py-1.5 px-3 text-center border-r border-slate-200 text-slate-400">a</td>
                <td className="py-1.5 px-4 pl-8 border-r border-slate-200">
                  - Hàng hóa, dịch vụ bán ra chịu thuế suất 0%
                </td>
                <td className="py-1.5 px-2 text-center border-r border-slate-200 font-mono text-slate-600">[29]</td>
                <td className="py-1.5 px-3 text-right border-r border-slate-200 font-mono">
                  {formatVND(indicator29)}
                </td>
                <td className="py-1.5 px-3 text-right text-slate-400 font-mono">---</td>
              </tr>

              <tr className="text-slate-700">
                <td className="py-1.5 px-3 text-center border-r border-slate-200 text-slate-400">b</td>
                <td className="py-1.5 px-4 pl-8 border-r border-slate-200">
                  - Hàng hóa, dịch vụ bán ra chịu thuế suất 5%
                </td>
                <td className="py-1.5 px-2 text-center border-r border-slate-200 font-mono text-slate-600">[30] / [31]</td>
                <td className="py-1.5 px-3 text-right border-r border-slate-200 font-mono">
                  {formatVND(indicator30)}
                </td>
                <td className="py-1.5 px-3 text-right font-mono">
                  {formatVND(indicator31)}
                </td>
              </tr>

              <tr className="text-slate-700">
                <td className="py-1.5 px-3 text-center border-r border-slate-200 text-slate-400">c</td>
                <td className="py-1.5 px-4 pl-8 border-r border-slate-200">
                  - Hàng hóa, dịch vụ bán ra chịu thuế suất 10%
                </td>
                <td className="py-1.5 px-2 text-center border-r border-slate-200 font-mono text-slate-600">[32] / [33]</td>
                <td className="py-1.5 px-3 text-right border-r border-slate-200 font-mono">
                  {formatVND(indicator32)}
                </td>
                <td className="py-1.5 px-3 text-right font-mono">
                  {formatVND(indicator33)}
                </td>
              </tr>

              <tr className="text-slate-700 bg-amber-50/20">
                <td className="py-1.5 px-3 text-center border-r border-slate-200 text-slate-400">d</td>
                <td className="py-1.5 px-4 pl-8 border-r border-slate-200 font-medium">
                  - Hàng hóa, dịch vụ bán ra chịu thuế suất 8% (giảm theo Nghị quyết)
                </td>
                <td className="py-1.5 px-2 text-center border-r border-slate-200 font-mono text-slate-600">[32a] / [33a]</td>
                <td className="py-1.5 px-3 text-right border-r border-slate-200 font-mono">
                  {formatVND(indicator32a)}
                </td>
                <td className="py-1.5 px-3 text-right font-mono text-amber-700">
                  {formatVND(indicator33a)}
                </td>
              </tr>

              <tr className="bg-emerald-50/40 font-bold">
                <td className="py-2 px-3 text-center border-r border-slate-200">3</td>
                <td className="py-2 px-4 border-r border-slate-200">
                  Tổng doanh thu và thuế GTGT của HHDV bán ra ([34] = [26] + [27]; [35] = [28])
                </td>
                <td className="py-2 px-2 text-center border-r border-slate-200 font-mono text-emerald-800">[34] / [35]</td>
                <td className="py-2 px-3 text-right border-r border-slate-200 font-mono text-emerald-900">
                  {formatVND(indicator34)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-emerald-900">
                  {formatVND(indicator35)}
                </td>
              </tr>

              {/* MỤC III: NGHĨA VỤ THUẾ PHÁT SINH TRONG KỲ */}
              <tr className="bg-indigo-50/60 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-2 px-3 text-center border-r border-slate-200">III</td>
                <td colSpan={4} className="py-2 px-4">
                  Thuế GTGT phát sinh trong kỳ
                </td>
              </tr>

              <tr>
                <td className="py-2 px-3 text-center border-r border-slate-200">1</td>
                <td className="py-2 px-4 border-r border-slate-200 font-medium">
                  Thuế GTGT phát sinh trong kỳ ([36] = [35] - [25])
                </td>
                <td className="py-2 px-2 text-center border-r border-slate-200 font-mono font-bold text-indigo-800 bg-indigo-50/40">[36]</td>
                <td className="py-2 px-3 text-right border-r border-slate-200 text-slate-400 font-mono">---</td>
                <td className={`py-2 px-3 text-right font-mono font-bold ${indicator36 >= 0 ? 'text-amber-700' : 'text-blue-700'}`}>
                  {formatVND(indicator36)}
                </td>
              </tr>

              {/* MỤC IV: XÁC ĐỊNH NGHĨA VỤ THUẾ PHẢI NỘP HOẶC KHẤU TRỪ */}
              <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-2 px-3 text-center border-r border-slate-200">IV</td>
                <td colSpan={4} className="py-2 px-4">
                  Xác định nghĩa vụ thuế GTGT phải nộp hoặc còn được khấu trừ chuyển kỳ sau
                </td>
              </tr>

              <tr className={indicator40 > 0 ? 'bg-rose-50/90 font-bold' : ''}>
                <td className="py-2.5 px-3 text-center border-r border-slate-200 font-semibold">1</td>
                <td className="py-2.5 px-4 border-r border-slate-200">
                  <span className={indicator40 > 0 ? 'text-rose-900 font-bold' : 'text-slate-800 font-medium'}>
                    Thuế GTGT phải nộp trong kỳ (Nếu [36] - [22] &gt; 0)
                  </span>
                </td>
                <td className="py-2.5 px-2 text-center border-r border-slate-200 font-mono font-bold text-rose-700 bg-rose-50/50">[40]</td>
                <td className="py-2.5 px-3 text-right border-r border-slate-200 text-slate-400 font-mono">---</td>
                <td className="py-2.5 px-3 text-right font-mono font-extrabold text-rose-700 text-sm">
                  {formatVND(indicator40)}
                </td>
              </tr>

              <tr className="text-slate-700">
                <td className="py-2 px-3 text-center border-r border-slate-200">2</td>
                <td className="py-2 px-4 border-r border-slate-200">
                  Thuế GTGT chưa khấu trừ hết kỳ này (Nếu [36] - [22] &lt; 0)
                </td>
                <td className="py-2 px-2 text-center border-r border-slate-200 font-mono font-bold text-blue-700">[41]</td>
                <td className="py-2 px-3 text-right border-r border-slate-200 text-slate-400 font-mono">---</td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                  {formatVND(indicator41)}
                </td>
              </tr>

              <tr className={indicator43 > 0 ? 'bg-emerald-50/90 font-bold' : ''}>
                <td className="py-2.5 px-3 text-center border-r border-slate-200 font-semibold">3</td>
                <td className="py-2.5 px-4 border-r border-slate-200">
                  <span className={indicator43 > 0 ? 'text-emerald-950 font-bold' : 'text-slate-800 font-medium'}>
                    Thuế GTGT còn được khấu trừ chuyển kỳ sau ([43] = [41] - [42])
                  </span>
                </td>
                <td className="py-2.5 px-2 text-center border-r border-slate-200 font-mono font-bold text-emerald-800 bg-emerald-50/50">[43]</td>
                <td className="py-2.5 px-3 text-right border-r border-slate-200 text-slate-400 font-mono">---</td>
                <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700 text-sm">
                  {formatVND(indicator43)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Commitment & Signature Area - aligned two-column signature row */}
        <div className="mt-8 pt-4 border-t border-slate-200 text-xs print:break-inside-avoid">
          <div className="text-right text-slate-500 italic text-[11px] mb-2">
            Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
          </div>
          <div className="grid grid-cols-2 gap-6 text-center items-start">
            <div>
              <div className="font-bold text-slate-900 uppercase">NGƯỜI LẬP BIỂU</div>
              <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký, ghi rõ họ tên)</div>
              <div className="h-16"></div>
            </div>
            <div>
              <div className="font-bold text-slate-900 uppercase">NGƯỜI ĐẠI DIỆN THEO PHÁP LUẬT</div>
              <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký, đóng dấu hoặc ký số điện tử)</div>
              <div className="h-16"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
