import React from 'react';
import { 
  Building2, 
  Download, 
  FileSpreadsheet, 
  Settings, 
  RefreshCw,
  FolderArchive,
  Menu
} from 'lucide-react';
import { GDTAccountConfig, GDTInvoice } from '../types';

interface HeaderProps {
  account: GDTAccountConfig;
  selectedInvoices: GDTInvoice[];
  totalInvoicesCount: number;
  dataSourceType?: 'live_gdt' | 'imported_xml';
  onOpenConfig: () => void;
  onOpenBatchDownload: () => void;
  onExportExcel: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  onLogout: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  account,
  selectedInvoices,
  totalInvoicesCount,
  onOpenConfig,
  onOpenBatchDownload,
  onExportExcel,
  onRefreshData,
  isRefreshing,
  onToggleSidebar
}) => {
  return (
    <header className="bg-white border-b border-[#d1d5db] sticky top-0 z-30 shrink-0">
      {/* Main Header */}
      <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Left Side: Company & MST Info */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md border border-gray-300 transition-colors"
              title="Mở menu tác vụ"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Hóa đơn mua vào
              </span>
              <span className="text-xs font-mono font-bold text-gray-900">
                MST: {account.taxCode || '(Chưa nhập)'}
              </span>
            </div>
            {account.taxpayerName && (
              <p className="text-xs text-gray-600 font-medium mt-0.5 truncate max-w-[280px] sm:max-w-xl">
                {account.taxpayerName}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Essential Action Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Refresh Button */}
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-[#d1d5db] rounded transition-colors disabled:opacity-50 cursor-pointer"
            title="Đồng bộ lại từ Tổng cục Thuế"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          {/* Export Excel Button */}
          <button
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition-colors cursor-pointer"
            title="Xuất bảng kê Excel Thông tư 78"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Xuất Excel</span>
            <span className="font-mono font-bold">({totalInvoicesCount})</span>
          </button>

          {/* Batch Download ZIP */}
          <button
            onClick={onOpenBatchDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#ef4444] hover:bg-red-600 rounded transition-colors shadow-xs cursor-pointer"
            title="Tải gói tệp XML & PDF hàng loạt"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>
              Tải ZIP {selectedInvoices.length > 0 ? `(${selectedInvoices.length})` : `(${totalInvoicesCount})`}
            </span>
          </button>

          {/* Account Settings */}
          <button
            onClick={onOpenConfig}
            className="p-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-[#d1d5db] rounded transition-colors cursor-pointer"
            title="Cấu hình tài khoản và mật khẩu GDT"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

