import React from 'react';
import { GDTInvoice } from '../types';

interface TaxSummaryDashboardProps {
  invoices: GDTInvoice[];
  invoiceType?: 'purchase' | 'sold' | 'both';
}

export const TaxSummaryDashboard: React.FC<TaxSummaryDashboardProps> = ({ invoices, invoiceType = 'purchase' }) => {
  // Compute metrics
  const totalCount = invoices.length;
  const purchases = invoices.filter(i => i.loaiHdon === 'purchase');
  const solds = invoices.filter(i => i.loaiHdon === 'sold');

  const totalBeforeTax = invoices.reduce((sum, inv) => sum + (inv.tgtcthue || 0), 0);
  const totalTax = invoices.reduce((sum, inv) => sum + (inv.tgtthue || 0), 0);
  const totalPayment = invoices.reduce((sum, inv) => sum + (inv.tgtttbso || 0), 0);
  const withCqtCodeCount = invoices.filter(i => i.hsgcma).length;

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  const isSold = invoiceType === 'sold';
  const isBoth = invoiceType === 'both';

  return (
    <div className="bg-slate-50/60 border-b border-slate-200 px-4 sm:px-6 py-2 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 text-xs">
        {/* Metric 1: Số lượng hóa đơn */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">
            {isSold ? 'Tổng HĐ bán ra:' : isBoth ? 'Tổng số HĐ:' : 'Tổng HĐ mua vào:'}
          </span>
          <span className="font-mono font-semibold text-slate-900 text-sm">
            {totalCount.toLocaleString()}
          </span>
          <span className="text-slate-500 font-normal">HĐ</span>
          {isBoth && (
            <span className="text-[11px] font-mono text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
              {purchases.length} Mua · {solds.length} Bán
            </span>
          )}
          {withCqtCodeCount > 0 && (
            <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
              {withCqtCodeCount} có mã CQT
            </span>
          )}
        </div>

        <span className="text-slate-200 hidden lg:inline">|</span>

        {/* Metric 2: Doanh thu / Tiền hàng chưa thuế */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">
            {isSold ? 'Doanh thu chưa thuế:' : isBoth ? 'Tổng tiền chưa thuế:' : 'Tiền hàng chưa thuế:'}
          </span>
          <span className="font-mono font-semibold text-blue-700 text-sm">
            {formatVND(totalBeforeTax)}
          </span>
        </div>

        <span className="text-slate-200 hidden lg:inline">|</span>

        {/* Metric 3: Thuế GTGT */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">
            {isSold ? 'Thuế GTGT bán ra (đầu ra):' : isBoth ? 'Tổng thuế GTGT:' : 'Thuế GTGT mua vào (đầu vào):'}
          </span>
          <span className={`font-mono font-semibold text-sm ${isSold ? 'text-emerald-700' : 'text-amber-700'}`}>
            {formatVND(totalTax)}
          </span>
        </div>

        <span className="text-slate-200 hidden lg:inline">|</span>

        {/* Metric 4: Tổng Thanh Toán */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Tổng thanh toán:</span>
          <span className="font-mono font-bold text-emerald-700 text-sm">
            {formatVND(totalPayment)}
          </span>
        </div>
      </div>
    </div>
  );
};
