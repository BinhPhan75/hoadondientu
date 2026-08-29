import React from 'react';
import { 
  Building2, 
  Download, 
  FileSpreadsheet, 
  Terminal, 
  ShieldCheck, 
  Settings, 
  RefreshCw,
  FolderArchive,
  Code2,
  Menu,
  FileCode2
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
  onOpenSeleniumModal: () => void;
  onDownloadPythonScript: () => void;
  onRefreshData: () => void;
  onOpenImportXml?: () => void;
  isRefreshing: boolean;
  onLogout: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  account,
  selectedInvoices,
  totalInvoicesCount,
  dataSourceType = 'live_gdt',
  onOpenConfig,
  onOpenBatchDownload,
  onExportExcel,
  onOpenSeleniumModal,
  onDownloadPythonScript,
  onRefreshData,
  onOpenImportXml,
  isRefreshing,
  onLogout,
  onToggleSidebar
}) => {
  return (
    <header className="bg-white border-b border-[#d1d5db] sticky top-0 z-30 shrink-0">
      {/* Top Banner (High Density Gov Info Line) */}
      <div className="bg-[#111827] text-gray-300 px-4 py-1 text-[11px] font-mono flex flex-wrap items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="status-dot status-active"></span>
          <span className="text-white font-semibold">hoadondientu.gdt.gov.vn</span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC</span>
        </div>
        <div className="flex items-center gap-3 text-gray-400">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Selenium v4.26 & Live GDT Proxy Active</span>
          </span>
        </div>
      </div>

      {/* Main High Density Header */}
      <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Left Side: Title & Status */}
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
              <h1 className="text-sm font-bold text-gray-900 tracking-tight">
                Bảng điều khiển tác vụ Hóa đơn điện tử
              </h1>
              {dataSourceType === 'imported_xml' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                  <FileCode2 className="w-3 h-3 text-blue-600" />
                  TỆP XML/ZIP GỐC
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  CỔNG THUẾ TRỰC TIẾP (LIVE)
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5 flex items-center gap-2">
              <span>MST: <strong className="text-gray-900">{account.taxCode || '(Chưa nhập MST)'}</strong></span>
              {account.taxpayerName && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="truncate max-w-[260px] sm:max-w-md text-gray-600">{account.taxpayerName}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right Side: High Density Action Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Refresh Button */}
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-[#d1d5db] rounded transition-colors disabled:opacity-50"
            title="Đồng bộ lại từ Tổng cục Thuế"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Làm mới</span>
          </button>

          {/* Import XML/ZIP Button */}
          {onOpenImportXml && (
            <button
              onClick={onOpenImportXml}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors"
              title="Nhập tệp XML hoặc ZIP tải từ Cổng Thuế"
            >
              <FileCode2 className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Nhập XML/ZIP</span>
            </button>
          )}

          {/* Python Runner Button */}
          <button
            onClick={onOpenSeleniumModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded transition-colors"
            title="Mở Terminal Runner"
          >
            <Terminal className="w-3.5 h-3.5 text-[#ef4444]" />
            <span>Python Runner</span>
          </button>

          {/* Export Excel Button */}
          <button
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition-colors"
            title="Xuất bảng kê Excel Thông tư 78"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Xuất Excel</span>
            <span className="font-mono font-bold">({totalInvoicesCount})</span>
          </button>

          {/* Batch Download ZIP */}
          <button
            onClick={onOpenBatchDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#ef4444] hover:bg-red-600 rounded transition-colors shadow-xs"
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
            className="p-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-[#d1d5db] rounded transition-colors"
            title="Cấu hình tài khoản và mật khẩu GDT"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Download Script */}
          <button
            onClick={onDownloadPythonScript}
            className="p-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-[#d1d5db] rounded transition-colors"
            title="Tải bộ mã nguồn Python Selenium (.zip)"
          >
            <Code2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
