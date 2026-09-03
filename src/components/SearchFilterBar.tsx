import React from 'react';
import { 
  Search, 
  Calendar, 
  Filter, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Layers, 
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
  FileCode2,
  Info
} from 'lucide-react';
import { FilterParams } from '../types';
import { isMultiMonthRange, generateMonthChunks } from '../utils/dateChunker';

interface SearchFilterBarProps {
  filters: FilterParams;
  onFilterChange: (newFilters: FilterParams) => void;
  onResetFilters: () => void;
  onRunSelenium: () => void;
  isLoading: boolean;
  totalFilteredCount: number;
  onOpenImportXml?: () => void;
  onOpenMonthlyReport?: () => void;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  onRunSelenium,
  isLoading,
  totalFilteredCount,
  onOpenImportXml,
  onOpenMonthlyReport
}) => {
  // Preset date helpers
  const applyPreset = (preset: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    let fromDate = '';
    let toDate = '';

    const formatDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    switch (preset) {
      case 'this_month':
        fromDate = formatDate(new Date(year, month, 1));
        toDate = formatDate(new Date(year, month + 1, 0));
        break;
      case 'last_month':
        fromDate = formatDate(new Date(year, month - 1, 1));
        toDate = formatDate(new Date(year, month, 0));
        break;
      case '2026_8m':
        // As requested by user: 01/01/2026 to 31/08/2026
        fromDate = '2026-01-01';
        toDate = '2026-08-31';
        break;
      case '2026':
        fromDate = '2026-01-01';
        toDate = '2026-12-31';
        break;
      case '2025':
        fromDate = '2025-01-01';
        toDate = '2025-12-31';
        break;
      case '2024':
        fromDate = '2024-01-01';
        toDate = '2024-12-31';
        break;
      case '2023':
        fromDate = '2023-01-01';
        toDate = '2023-12-31';
        break;
      case 'all_time':
        fromDate = '2022-01-01';
        toDate = '2026-12-31';
        break;
      case 'q1_2025':
        fromDate = '2025-01-01';
        toDate = '2025-03-31';
        break;
      case 'q2_2025':
        fromDate = '2025-04-01';
        toDate = '2025-06-30';
        break;
      case 'q3_2025':
        fromDate = '2025-07-01';
        toDate = '2025-09-30';
        break;
      case 'q4_2025':
        fromDate = '2025-10-01';
        toDate = '2025-12-31';
        break;
      default:
        return;
    }

    onFilterChange({
      ...filters,
      fromDate,
      toDate
    });
  };

  const isMultiMonth = isMultiMonthRange(filters.fromDate, filters.toDate);
  const monthChunks = isMultiMonth ? generateMonthChunks(filters.fromDate, filters.toDate) : [];

  return (
    <div className="bg-white border-b border-[#d1d5db] px-4 sm:px-6 py-2.5 space-y-2">
      {/* Top Row: Type Segments & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
        {/* Invoice Type Tabs */}
        <div className="inline-flex p-0.5 bg-gray-100 rounded border border-gray-300 self-start">
          <button
            onClick={() => onFilterChange({ ...filters, invoiceType: 'purchase' })}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-all ${
              filters.invoiceType === 'purchase'
                ? 'bg-white text-blue-700 shadow-2xs border border-gray-300'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
            <span>Mua vào (Đầu vào)</span>
          </button>

          <button
            onClick={() => onFilterChange({ ...filters, invoiceType: 'sold' })}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-all ${
              filters.invoiceType === 'sold'
                ? 'bg-white text-emerald-700 shadow-2xs border border-gray-300'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bán ra (Đầu ra)</span>
          </button>

          <button
            onClick={() => onFilterChange({ ...filters, invoiceType: 'both' })}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-all ${
              filters.invoiceType === 'both'
                ? 'bg-white text-purple-700 shadow-2xs border border-gray-300'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>Tất cả</span>
          </button>
        </div>

        {/* Date Presets & Quick Import */}
        <div className="flex flex-wrap items-center gap-1 text-[11px] font-medium">
          <span className="text-gray-500 uppercase font-semibold mr-1">Kỳ kê khai:</span>
          <button
            type="button"
            onClick={() => applyPreset('this_month')}
            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors"
          >
            Tháng này
          </button>
          <button
            type="button"
            onClick={() => applyPreset('2026_8m')}
            className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors font-mono font-bold"
            title="Kỳ ví dụ: 01/01/2026 đến 31/08/2026 (8 tháng)"
          >
            01-08/2026 (8T)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('2026')}
            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors font-mono font-semibold"
          >
            2026
          </button>
          <button
            type="button"
            onClick={() => applyPreset('2025')}
            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors font-mono font-semibold"
          >
            2025
          </button>
          <button
            type="button"
            onClick={() => applyPreset('2024')}
            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors font-mono font-semibold"
          >
            2024
          </button>
          <button
            type="button"
            onClick={() => applyPreset('all_time')}
            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors font-semibold"
            title="Tra cứu từ năm 2022 đến nay"
          >
            Toàn bộ
          </button>

          {onOpenImportXml && (
            <button
              onClick={onOpenImportXml}
              className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold transition-colors"
              title="Nhập tệp XML hoặc ZIP từ Tổng cục Thuế"
            >
              <FileCode2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Nhập XML/ZIP</span>
            </button>
          )}

          <button
            onClick={onResetFilters}
            className="ml-auto lg:ml-1 p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded border border-gray-300 transition-colors"
            title="Đặt lại bộ lọc"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Multi-Month Notice Banner if period > 1 month */}
      {isMultiMonth && (
        <div className="bg-amber-50 border border-amber-200 rounded px-2.5 py-1 flex items-center justify-between text-[11px] text-amber-900">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              <strong>Kỳ tra cứu dài hơn 1 tháng ({monthChunks.length} tháng):</strong> Cổng Thuế giới hạn 1 tháng/lần. Hệ thống sẽ tự động tra cứu lần lượt từng tháng và cập nhật trực quan tiến trình.
            </span>
          </div>
          {onOpenMonthlyReport && (
            <button
              onClick={onOpenMonthlyReport}
              className="font-bold text-amber-800 hover:text-amber-950 underline shrink-0 cursor-pointer ml-2"
            >
              Xem tiến trình & Báo cáo tháng
            </button>
          )}
        </div>
      )}

      {/* Bottom Row: Date Inputs, Keywords & Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 text-xs">
        {/* Date From - To */}
        <div className="lg:col-span-4 flex items-center gap-1.5">
          <div className="flex-1 flex items-center gap-1 bg-white border border-[#d1d5db] px-2.5 py-1.5 rounded">
            <span className="text-[10px] text-gray-500 uppercase font-semibold shrink-0">Từ:</span>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => onFilterChange({ ...filters, fromDate: e.target.value })}
              className="bg-transparent text-gray-900 font-mono font-medium text-xs w-full focus:outline-hidden"
            />
          </div>
          <span className="text-gray-400 font-bold">-</span>
          <div className="flex-1 flex items-center gap-1 bg-white border border-[#d1d5db] px-2.5 py-1.5 rounded">
            <span className="text-[10px] text-gray-500 uppercase font-semibold shrink-0">Đến:</span>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => onFilterChange({ ...filters, toDate: e.target.value })}
              className="bg-transparent text-gray-900 font-mono font-medium text-xs w-full focus:outline-hidden"
            />
          </div>
        </div>

        {/* Keyword Search */}
        <div className="lg:col-span-3 relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.searchKeyword}
            onChange={(e) => onFilterChange({ ...filters, searchKeyword: e.target.value })}
            placeholder="Tìm số HĐ, MST, tên bên bán/mua..."
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-[#d1d5db] rounded focus:outline-hidden focus:border-[#ef4444] font-mono text-gray-900 placeholder:text-gray-400"
          />
        </div>

        {/* Invoice Status Filter */}
        <div className="lg:col-span-2">
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className="w-full px-2 py-1.5 text-xs bg-white border border-[#d1d5db] rounded focus:outline-hidden focus:border-[#ef4444] text-gray-800 font-medium"
          >
            <option value="all">Trạng thái: Tất cả</option>
            <option value="1">HĐ Gốc (Mới)</option>
            <option value="2">HĐ Thay thế</option>
            <option value="3">HĐ Điều chỉnh</option>
            <option value="4">HĐ Bị hủy</option>
          </select>
        </div>

        {/* Tax Authority Code */}
        <div className="lg:col-span-1.5">
          <select
            value={filters.cqtCodeStatus}
            onChange={(e) => onFilterChange({ ...filters, cqtCodeStatus: e.target.value as any })}
            className="w-full px-2 py-1.5 text-xs bg-white border border-[#d1d5db] rounded focus:outline-hidden focus:border-[#ef4444] text-gray-800 font-medium"
          >
            <option value="all">Mã CQT: Tất cả</option>
            <option value="with_code">Có mã CQT</option>
            <option value="without_code">Không mã CQT</option>
          </select>
        </div>

        {/* Tax Rate Filter */}
        <div className="lg:col-span-1.5">
          <select
            value={filters.taxRateFilter}
            onChange={(e) => onFilterChange({ ...filters, taxRateFilter: e.target.value })}
            className="w-full px-2 py-1.5 text-xs bg-white border border-[#d1d5db] rounded focus:outline-hidden focus:border-[#ef4444] text-gray-800 font-medium"
          >
            <option value="all">Thuế suất: Tất cả</option>
            <option value="10%">10%</option>
            <option value="8%">8% (NQ 142)</option>
            <option value="5%">5%</option>
            <option value="0%">0%</option>
            <option value="kct">Không chịu thuế</option>
          </select>
        </div>
      </div>
    </div>
  );
};
