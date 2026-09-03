import React, { useState } from 'react';
import { 
  DollarSign, 
  Receipt, 
  Percent, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp, 
  PieChart as PieChartIcon, 
  BarChart3,
  FileCheck,
  AlertTriangle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { GDTInvoice } from '../types';

interface TaxSummaryDashboardProps {
  invoices: GDTInvoice[];
}

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export const TaxSummaryDashboard: React.FC<TaxSummaryDashboardProps> = ({ invoices }) => {
  const [showCharts, setShowCharts] = useState(false);

  // Compute metrics
  const totalCount = invoices.length;
  const totalBeforeTax = invoices.reduce((sum, inv) => sum + inv.tgtcthue, 0);
  const totalTax = invoices.reduce((sum, inv) => sum + inv.tgtthue, 0);
  const totalPayment = invoices.reduce((sum, inv) => sum + inv.tgtttbso, 0);
  const withCqtCodeCount = invoices.filter(i => i.hsgcma).length;

  // Tax distribution
  const taxRateMap: { [key: string]: { amount: number; tax: number; count: number } } = {};
  invoices.forEach(inv => {
    inv.items.forEach(item => {
      const rate = item.taxRate || '10%';
      if (!taxRateMap[rate]) {
        taxRateMap[rate] = { amount: 0, tax: 0, count: 0 };
      }
      taxRateMap[rate].amount += item.amount;
      taxRateMap[rate].tax += item.taxAmount;
      taxRateMap[rate].count += 1;
    });
  });

  const taxDistributionData = Object.entries(taxRateMap).map(([rate, val]) => ({
    name: `Thuế ${rate}`,
    value: val.amount,
    tax: val.tax,
    count: val.count
  }));

  // Top Sellers / Partners
  const partnerMap: { [key: string]: number } = {};
  invoices.forEach(inv => {
    const partner = inv.loaiHdon === 'purchase' ? (inv.nbten.length > 22 ? inv.nbten.slice(0, 22) + '...' : inv.nbten) : (inv.nmten.length > 22 ? inv.nmten.slice(0, 22) + '...' : inv.nmten);
    partnerMap[partner] = (partnerMap[partner] || 0) + inv.tgtttbso;
  });

  const topPartnersData = Object.entries(partnerMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({
      name,
      total: Math.round(total / 1000000) // in Millions VND
    }));

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  return (
    <div className="bg-white border-b border-[#d1d5db]">
      {/* High Density Stats Bar */}
      <div className="px-4 sm:px-6 py-3 grid grid-cols-2 md:grid-cols-5 gap-4 divide-y md:divide-y-0 md:divide-x divide-gray-200">
        {/* Metric 1: Total Invoices */}
        <div className="pt-2 md:pt-0 md:pr-4">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Tổng HĐ Mua Vào
          </div>
          <div className="text-xl font-bold font-mono text-gray-900 mt-0.5">
            {totalCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {withCqtCodeCount} hóa đơn có mã CQT
          </div>
        </div>

        {/* Metric 2: Total Before Tax */}
        <div className="pt-2 md:pt-0 md:px-4">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Tiền Hàng Chưa Thuế
          </div>
          <div className="text-lg font-bold font-mono text-blue-700 mt-0.5">
            {formatVND(totalBeforeTax)}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Tổng giá trị hàng mua
          </div>
        </div>

        {/* Metric 3: Total VAT */}
        <div className="pt-2 md:pt-0 md:px-4">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Thuế GTGT Đầu Vào
          </div>
          <div className="text-lg font-bold font-mono text-amber-700 mt-0.5">
            {formatVND(totalTax)}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Thuế GTGT khấu trừ
          </div>
        </div>

        {/* Metric 4: Total Payment */}
        <div className="pt-2 md:pt-0 md:px-4">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Tổng Thanh Toán
          </div>
          <div className="text-lg font-black font-mono text-[#166534] mt-0.5">
            {formatVND(totalPayment)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
            Đã gồm thuế GTGT
          </div>
        </div>

        {/* Metric 5: Automation Status & Chart Toggle */}
        <div className="pt-2 md:pt-0 md:pl-4 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Đồng bộ dữ liệu
            </div>
            <div className="text-xs font-mono font-bold text-emerald-600 mt-0.5 flex items-center gap-1.5">
              <span className="status-dot status-active"></span>
              <span>100% Khớp Dữ Liệu GDT</span>
            </div>
          </div>

          <button
            onClick={() => setShowCharts(!showCharts)}
            className="inline-flex items-center justify-between text-[11px] font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded border border-gray-300 transition-colors mt-2"
          >
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-[#ef4444]" />
              <span>{showCharts ? 'Ẩn đồ thị' : 'Biểu đồ phân tích'}</span>
            </span>
            {showCharts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Visual Charts Container (Expandable) */}
      {showCharts && (
        <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-[#d1d5db] grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-150">
          {/* Chart 1: Tax Rate Distribution */}
          <div className="bg-white p-4 rounded border border-[#d1d5db] shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Cơ cấu doanh số theo thuế suất
                </h4>
              </div>
              <span className="text-[10px] font-mono text-gray-500">QĐ 1450/QĐ-TCT</span>
            </div>
            <div className="h-56">
              {taxDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taxDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {taxDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [formatVND(val), 'Doanh số']}
                      contentStyle={{ backgroundColor: '#111827', borderRadius: '4px', color: '#fff', fontSize: '11px', border: '1px solid #374151' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">Không có dữ liệu</div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-1 text-[11px]">
              {taxDistributionData.map((d, i) => (
                <span key={i} className="flex items-center gap-1 text-gray-600 font-medium font-mono">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                  <span>{d.name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Chart 2: Top Partners Bar Chart */}
          <div className="bg-white p-4 rounded border border-[#d1d5db] shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Top nhà cung cấp theo giá trị (Triệu VNĐ)
                </h4>
              </div>
              <span className="text-[10px] font-mono text-gray-500">Tổng thanh toán</span>
            </div>
            <div className="h-56">
              {topPartnersData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topPartnersData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#4b5563', fontFamily: 'monospace' }}
                      angle={-10}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#4b5563', fontFamily: 'monospace' }} />
                    <Tooltip
                      formatter={(val: number) => [`${val.toLocaleString()} Tr. VNĐ`, 'Tổng thanh toán']}
                      contentStyle={{ backgroundColor: '#111827', borderRadius: '4px', color: '#fff', fontSize: '11px', border: '1px solid #374151' }}
                    />
                    <Bar dataKey="total" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">Không có dữ liệu</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
