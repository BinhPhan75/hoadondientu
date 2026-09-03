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
    <div className="bg-white border-b border-[#d1d5db] px-4 sm:px-6 py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 text-xs">
        {/* Metric 1: Tổng HĐ Mua Vào */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 font-medium">Tổng HĐ Mua Vào:</span>
          <span className="font-mono font-bold text-gray-900 text-sm">
            {totalCount.toLocaleString()}
          </span>
          <span className="text-gray-500 font-normal">HĐ</span>
          {withCqtCodeCount > 0 && (
            <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {withCqtCodeCount} có mã CQT
            </span>
          )}
        </div>

        <span className="text-gray-300 hidden lg:inline">|</span>

        {/* Metric 2: Tiền Hàng Chưa Thuế */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 font-medium">Tiền Hàng Chưa Thuế:</span>
          <span className="font-mono font-bold text-blue-700 text-sm">
            {formatVND(totalBeforeTax)}
          </span>
        </div>

        <span className="text-gray-300 hidden lg:inline">|</span>

        {/* Metric 3: Thuế GTGT Đầu Vào */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 font-medium">Thuế GTGT Đầu Vào:</span>
          <span className="font-mono font-bold text-amber-700 text-sm">
            {formatVND(totalTax)}
          </span>
        </div>

        <span className="text-gray-300 hidden lg:inline">|</span>

        {/* Metric 4: Tổng Thanh Toán */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 font-medium">Tổng Thanh Toán:</span>
          <span className="font-mono font-black text-[#166534] text-sm">
            {formatVND(totalPayment)}
          </span>
        </div>
      </div>
    </div>
  );
};
