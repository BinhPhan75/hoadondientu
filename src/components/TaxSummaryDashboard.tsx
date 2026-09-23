import React from 'react';
import { GDTInvoice } from '../types';

interface TaxSummaryDashboardProps {
  invoices: GDTInvoice[];
}

export const TaxSummaryDashboard: React.FC<TaxSummaryDashboardProps> = ({ invoices }) => {
  // Compute metrics
  const totalCount = invoices.length;
  const totalBeforeTax = invoices.reduce((sum, inv) => sum + inv.tgtcthue, 0);
  const totalTax = invoices.reduce((sum, inv) => sum + inv.tgtthue, 0);
  const totalPayment = invoices.reduce((sum, inv) => sum + inv.tgtttbso, 0);
  const withCqtCodeCount = invoices.filter(i => i.hsgcma).length;

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  return (
    <div className="bg-slate-50/60 border-b border-slate-200 px-4 sm:px-6 py-2 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 text-xs">
        {/* Metric 1: Tổng HĐ Mua Vào */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Tổng HĐ mua vào:</span>
          <span className="font-mono font-semibold text-slate-900 text-sm">
            {totalCount.toLocaleString()}
          </span>
          <span className="text-slate-500 font-normal">HĐ</span>
          {withCqtCodeCount > 0 && (
            <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
              {withCqtCodeCount} có mã CQT
            </span>
          )}
        </div>

        <span className="text-slate-200 hidden lg:inline">|</span>

        {/* Metric 2: Tiền Hàng Chưa Thuế */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Tiền hàng chưa thuế:</span>
          <span className="font-mono font-semibold text-blue-700 text-sm">
            {formatVND(totalBeforeTax)}
          </span>
        </div>

        <span className="text-slate-200 hidden lg:inline">|</span>

        {/* Metric 3: Thuế GTGT Đầu Vào */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Thuế GTGT đầu vào:</span>
          <span className="font-mono font-semibold text-amber-700 text-sm">
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
