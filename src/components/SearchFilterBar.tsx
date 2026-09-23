import React from 'react';
import { 
  Search, 
  RotateCcw
} from 'lucide-react';
import { FilterParams } from '../types';

interface SearchFilterBarProps {
  filters: FilterParams;
  onFilterChange: (newFilters: FilterParams) => void;
  onResetFilters: () => void;
  totalFilteredCount: number;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  totalFilteredCount
}) => {
  return (
    <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 shadow-2xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 text-xs items-center">
        {/* Date From - To */}
        <div className="lg:col-span-4 flex items-center gap-1.5">
          <div className="flex-1 flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 px-2.5 py-1.5 rounded-lg transition-all">
            <span className="text-[11px] text-slate-500 font-medium shrink-0">Từ:</span>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => onFilterChange({ ...filters, fromDate: e.target.value })}
              className="bg-transparent text-slate-900 font-mono text-xs w-full focus:outline-hidden"
            />
          </div>
          <span className="text-slate-300 font-medium">-</span>
          <div className="flex-1 flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 px-2.5 py-1.5 rounded-lg transition-all">
            <span className="text-[11px] text-slate-500 font-medium shrink-0">Đến:</span>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => onFilterChange({ ...filters, toDate: e.target.value })}
              className="bg-transparent text-slate-900 font-mono text-xs w-full focus:outline-hidden"
            />
          </div>
        </div>

        {/* Keyword Search */}
        <div className="lg:col-span-3 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.searchKeyword}
            onChange={(e) => onFilterChange({ ...filters, searchKeyword: e.target.value })}
            placeholder="Tìm số HĐ, MST, nhà cung cấp..."
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-400 transition-all font-sans"
          />
        </div>

        {/* Invoice Status Filter */}
        <div className="lg:col-span-2">
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-slate-700 font-medium transition-all"
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
            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-slate-700 font-medium transition-all"
          >
            <option value="all">Mã CQT: Tất cả</option>
            <option value="with_code">Có mã CQT</option>
            <option value="without_code">Không mã CQT</option>
          </select>
        </div>

        {/* Tax Rate Filter & Reset */}
        <div className="lg:col-span-1.5 flex items-center gap-1.5">
          <select
            value={filters.taxRateFilter}
            onChange={(e) => onFilterChange({ ...filters, taxRateFilter: e.target.value })}
            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-slate-700 font-medium transition-all"
          >
            <option value="all">Thuế suất</option>
            <option value="10%">10%</option>
            <option value="8%">8%</option>
            <option value="5%">5%</option>
            <option value="0%">0%</option>
            <option value="kct">KCT</option>
          </select>

          <button
            type="button"
            onClick={onResetFilters}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer shrink-0 shadow-2xs"
            title="Đặt lại bộ lọc về mặc định"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
