import React, { useState } from 'react';
import { 
  ShieldCheck, 
  KeyRound, 
  Building2, 
  Calendar, 
  Layers, 
  Play, 
  RefreshCw, 
  Settings, 
  Code2, 
  Terminal, 
  Eye, 
  EyeOff,
  Sparkles,
  CheckCircle2,
  X,
  FileCode2
} from 'lucide-react';
import { GDTAccountConfig, FilterParams } from '../types';

interface SidebarProps {
  account: GDTAccountConfig;
  filters: FilterParams;
  onFilterChange: (filters: FilterParams) => void;
  onUpdateAccount: (account: GDTAccountConfig) => void;
  onRunCrawler: () => void;
  isLoading: boolean;
  onOpenConfigModal: () => void;
  onOpenPythonRunner: () => void;
  onDownloadPackage: () => void;
  onOpenImportXml?: () => void;
  onCloseMobileSidebar?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  account,
  filters,
  onFilterChange,
  onUpdateAccount,
  onRunCrawler,
  isLoading,
  onOpenConfigModal,
  onOpenPythonRunner,
  onDownloadPackage,
  onOpenImportXml,
  onCloseMobileSidebar
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [localMst, setLocalMst] = useState(account.taxCode || '0316892345');
  const [localPassword, setLocalPassword] = useState(account.password || 'Gdt@Tax2025!');

  const handleMstBlur = () => {
    if (localMst !== account.taxCode) {
      onUpdateAccount({
        ...account,
        taxCode: localMst,
        taxpayerName: localMst === '0316892345' ? 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG ĐÔNG NAM Á' : `DOANH NGHIỆP NỘP THUẾ (MST: ${localMst})`
      });
    }
  };

  const handlePasswordBlur = () => {
    if (localPassword !== account.password) {
      onUpdateAccount({
        ...account,
        password: localPassword
      });
    }
  };

  return (
    <aside className="w-72 lg:w-80 bg-[#111827] text-white p-5 flex flex-col justify-between border-r border-gray-800 shrink-0 h-full overflow-y-auto z-40">
      <div className="space-y-5">
        {/* Brand & Title */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span>
              <h2 className="text-base font-black tracking-wider text-[#ef4444] uppercase font-mono">
                GDT INVOICE BOT
              </h2>
            </div>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
              Tổng Cục Thuế Automation Engine
            </p>
          </div>

          {onCloseMobileSidebar && (
            <button
              onClick={onCloseMobileSidebar}
              className="lg:hidden p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Account Credentials Form */}
        <div className="space-y-3.5">
          {/* MST Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Mã Số Thuế (Tên ĐN)
              </label>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Hợp lệ
              </span>
            </div>
            <input
              type="text"
              value={localMst}
              onChange={(e) => setLocalMst(e.target.value)}
              onBlur={handleMstBlur}
              placeholder="VD: 0316892345"
              className="text-input-dark"
            />
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Mật Khẩu CQT Cấp
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] text-gray-400 hover:text-gray-200"
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={localPassword}
                onChange={(e) => setLocalPassword(e.target.value)}
                onBlur={handlePasswordBlur}
                placeholder="Nhập mật khẩu..."
                className="text-input-dark pr-8"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
              Khoảng Thời Gian Truy Xuất
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-gray-400 block mb-0.5">Từ ngày:</span>
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => onFilterChange({ ...filters, fromDate: e.target.value })}
                  className="text-input-dark text-[11px] p-1.5"
                />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block mb-0.5">Đến ngày:</span>
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => onFilterChange({ ...filters, toDate: e.target.value })}
                  className="text-input-dark text-[11px] p-1.5"
                />
              </div>
            </div>
          </div>

          {/* Invoice Type Radio */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
              Loại Hóa Đơn
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, invoiceType: 'purchase' })}
                className={`py-1 px-1.5 text-center text-[11px] font-bold rounded transition-colors ${
                  filters.invoiceType === 'purchase'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Mua Vào
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, invoiceType: 'sold' })}
                className={`py-1 px-1.5 text-center text-[11px] font-bold rounded transition-colors ${
                  filters.invoiceType === 'sold'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Bán Ra
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, invoiceType: 'both' })}
                className={`py-1 px-1.5 text-center text-[11px] font-bold rounded transition-colors ${
                  filters.invoiceType === 'both'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Tất Cả
              </button>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="pt-2">
            <button
              onClick={onRunCrawler}
              disabled={isLoading}
              className="btn-primary-accent flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>ĐANG TRUY XUẤT GDT...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>BẮT ĐẦU TRUY XUẤT</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Engine Status Specification */}
        <div className="p-3 bg-gray-900 rounded border border-gray-800 space-y-2 text-[11px] font-mono">
          <div className="text-gray-400 font-bold uppercase tracking-wider text-[10px] pb-1 border-b border-gray-800">
            Trạng Thái Engine Tự Động
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span>Selenium Engine:</span>
            <span className="text-emerald-400 font-bold">v4.26.0</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span>Chrome Driver:</span>
            <span className="text-blue-400">Headless v132</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span>Captcha AI Solver:</span>
            <span className="text-purple-400">Tự động (OCR)</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span>Bảo mật:</span>
            <span className="text-amber-400">SSL 256-bit Direct</span>
          </div>
        </div>
      </div>

      {/* Footer Utility Links */}
      <div className="pt-4 border-t border-gray-800 space-y-2 text-xs">
        {onOpenImportXml && (
          <button
            onClick={onOpenImportXml}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-blue-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-[11px] font-semibold"
          >
            <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Nhập tệp XML / ZIP thực tế</span>
          </button>
        )}

        <button
          onClick={onOpenConfigModal}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-[11px]"
        >
          <Settings className="w-3.5 h-3.5 text-gray-400" />
          <span>Cấu hình tài khoản & Captcha</span>
        </button>

        <button
          onClick={onOpenPythonRunner}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-[11px]"
        >
          <Terminal className="w-3.5 h-3.5 text-purple-400" />
          <span>Mở Python CLI Console</span>
        </button>

        <button
          onClick={onDownloadPackage}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-[11px]"
        >
          <Code2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Tải script Python Selenium (.zip)</span>
        </button>
      </div>
    </aside>
  );
};
