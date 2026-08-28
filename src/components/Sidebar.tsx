import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert,
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
  AlertTriangle,
  X,
  FileCode2,
  Globe2,
  Database
} from 'lucide-react';
import { GDTAccountConfig, FilterParams } from '../types';

export interface CrawlerCredentials {
  taxCode: string;
  password?: string;
  captchaKey?: string;
  captchaCode?: string;
  isDemo?: boolean;
}

interface SidebarProps {
  account: GDTAccountConfig;
  filters: FilterParams;
  onFilterChange: (filters: FilterParams) => void;
  onUpdateAccount: (account: GDTAccountConfig) => void;
  onRunCrawler: (credentials?: CrawlerCredentials) => Promise<{ success: boolean; error?: string } | void>;
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
  
  // Captcha State
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaKey, setCaptchaKey] = useState('');
  const [captchaImg, setCaptchaImg] = useState<string>('');
  const [isRealGdtCaptcha, setIsRealGdtCaptcha] = useState(true);
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Synchronize local input state if parent account updates
  useEffect(() => {
    if (account.taxCode && account.taxCode !== localMst) {
      setLocalMst(account.taxCode);
    }
    if (account.password && account.password !== localPassword) {
      setLocalPassword(account.password);
    }
  }, [account.taxCode, account.password]);

  // Load Captcha on Mount
  const fetchCaptcha = async () => {
    setIsLoadingCaptcha(true);
    setAuthError(null);
    setCaptchaCode('');
    try {
      const res = await fetch('/api/gdt/captcha');
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: false };
      }

      if (data && data.success) {
        setCaptchaImg(data.captchaImage);
        setCaptchaKey(data.captchaKey || '');
        setIsRealGdtCaptcha(Boolean(data.isRealGDT));
        if (data.captchaCode) {
          // If in local fallback mode with pre-solved code
          setCaptchaCode(data.captchaCode);
        }
      }
    } catch (err) {
      console.warn('Cannot fetch GDT captcha:', err);
    } finally {
      setIsLoadingCaptcha(false);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleMstBlur = () => {
    const trimmed = localMst.trim();
    if (trimmed !== account.taxCode) {
      onUpdateAccount({
        ...account,
        taxCode: trimmed,
        taxpayerName: trimmed === '0316892345' ? 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG ĐÔNG NAM Á' : `DOANH NGHIỆP NỘP THUẾ (MST: ${trimmed})`,
        isRealGDT: false // Reset authenticated state on MST change
      });
    }
  };

  const handlePasswordBlur = () => {
    const trimmed = localPassword.trim();
    if (trimmed !== account.password) {
      onUpdateAccount({
        ...account,
        password: trimmed,
        isRealGDT: false
      });
    }
  };

  // Submit flow
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);

    const mst = localMst.trim();
    const pwd = localPassword.trim();

    if (!mst) {
      setAuthError('Vui lòng nhập Mã số thuế (MST).');
      return;
    }

    // If user has not authenticated with real GDT yet, check credentials
    if (!account.isRealGDT) {
      if (!pwd) {
        setAuthError('Vui lòng nhập Mật khẩu do Cơ quan Thuế cấp.');
        return;
      }
      if (!captchaCode.trim()) {
        setAuthError('Vui lòng nhập mã Captcha hiển thị trên hình ảnh.');
        return;
      }
    }

    const result = await onRunCrawler({
      taxCode: mst,
      password: pwd,
      captchaKey,
      captchaCode: captchaCode.trim()
    });

    if (result && !result.success && result.error) {
      setAuthError(result.error);
      // Auto refresh captcha on failure so user can retry immediately
      fetchCaptcha();
    }
  };

  // Switch to Sample Demo Mode
  const handleUseDemo = async () => {
    setAuthError(null);
    setLocalMst('0316892345');
    setLocalPassword('Gdt@Tax2025!');
    await onRunCrawler({
      taxCode: '0316892345',
      password: 'Gdt@Tax2025!',
      isDemo: true
    });
  };

  return (
    <aside className="w-72 lg:w-80 bg-[#111827] text-white p-4.5 flex flex-col justify-between border-r border-gray-800 shrink-0 h-full overflow-y-auto z-40">
      <div className="space-y-4">
        {/* Brand & Title */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${account.isRealGDT ? 'bg-emerald-500 animate-pulse' : 'bg-[#ef4444]'}`}></span>
              <h2 className="text-base font-black tracking-wider text-[#ef4444] uppercase font-mono">
                GDT INVOICE BOT
              </h2>
            </div>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5 flex items-center gap-1">
              <Globe2 className="w-3 h-3 text-gray-500" />
              hoadondientu.gdt.gov.vn
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

        {/* Connection Status Badge */}
        <div className={`px-2.5 py-1.5 rounded text-[11px] flex items-center gap-2 font-mono ${
          account.isRealGDT 
            ? 'bg-emerald-950/70 border border-emerald-700 text-emerald-300' 
            : 'bg-gray-900 border border-gray-800 text-gray-300'
        }`}>
          {account.isRealGDT ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">ĐÃ KẾT NỐI CỔNG THUẾ THẬT</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
              <span className="truncate">Nhập Captcha để kết nối CQT</span>
            </>
          )}
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* MST Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                Mã Số Thuế (Tên ĐN)
              </label>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5">
                <ShieldCheck className="w-3 h-3" /> Hợp lệ
              </span>
            </div>
            <input
              type="text"
              value={localMst}
              onChange={(e) => setLocalMst(e.target.value.replace(/\s+/g, ''))}
              onBlur={handleMstBlur}
              placeholder="VD: 4000926165"
              className="text-input-dark font-mono text-sm tracking-wider"
              required
            />
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
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
                placeholder="Nhập mật khẩu thuế..."
                className="text-input-dark pr-8 font-mono text-sm"
                required
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

          {/* Captcha Section */}
          <div className="bg-gray-900/90 p-2.5 rounded border border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1">
                <span>Mã Captcha CQT</span>
                {isRealGdtCaptcha && (
                  <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1 py-0.2 rounded border border-emerald-800 font-mono">
                    Live GDT
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={fetchCaptcha}
                disabled={isLoadingCaptcha}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono cursor-pointer"
                title="Lấy mã Captcha mới từ Cổng Thuế"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingCaptcha ? 'animate-spin' : ''}`} />
                <span>Đổi mã</span>
              </button>
            </div>

            {/* Captcha Image Display */}
            <div className="flex items-center gap-2">
              <div 
                className="h-10 bg-white rounded flex items-center justify-center p-1 overflow-hidden border border-gray-600 cursor-pointer shadow-inner min-w-[130px] flex-1"
                onClick={fetchCaptcha}
                title="Nhấn để đổi mã Captcha"
              >
                {isLoadingCaptcha ? (
                  <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Đang tải...
                  </div>
                ) : captchaImg ? (
                  <img
                    src={captchaImg}
                    alt="GDT Captcha"
                    className="max-h-full object-contain filter contrast-125"
                  />
                ) : (
                  <span className="text-[11px] text-gray-400 font-mono">Chưa có Captcha</span>
                )}
              </div>

              {/* Captcha Input */}
              <input
                type="text"
                value={captchaCode}
                onChange={(e) => {
                  setCaptchaCode(e.target.value.toUpperCase());
                  if (authError) setAuthError(null);
                }}
                placeholder="Nhập mã"
                maxLength={8}
                className="w-24 text-input-dark font-mono text-base uppercase text-center font-bold tracking-widest bg-gray-950 border-gray-700 text-amber-300 focus:border-amber-500 py-1.5"
                required={!account.isRealGDT}
              />
            </div>
          </div>

          {/* Error Message if Authentication Failed */}
          {authError && (
            <div className="p-2 bg-red-950/80 border border-red-800 rounded text-red-200 text-[11px] leading-tight flex items-start gap-1.5 animate-fadeIn">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-red-300">Không thể kết nối Cổng Thuế:</strong>
                <span>{authError}</span>
              </div>
            </div>
          )}

          {/* Date Range Inputs */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                Khoảng Thời Gian
              </label>
              <span className="text-[10px] text-amber-400 font-mono">Chọn nhanh:</span>
            </div>
            
            {/* Quick Period Buttons */}
            <div className="grid grid-cols-4 gap-1 mb-2">
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, fromDate: '2025-01-01', toDate: '2025-12-31' })}
                className={`py-0.5 px-1 text-[10px] font-bold rounded transition-colors ${
                  filters.fromDate === '2025-01-01' && filters.toDate === '2025-12-31'
                    ? 'bg-amber-500 text-black font-extrabold'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                2025
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, fromDate: '2024-01-01', toDate: '2024-12-31' })}
                className={`py-0.5 px-1 text-[10px] font-bold rounded transition-colors ${
                  filters.fromDate === '2024-01-01' && filters.toDate === '2024-12-31'
                    ? 'bg-amber-500 text-black font-extrabold'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                2024
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, fromDate: '2023-01-01', toDate: '2023-12-31' })}
                className={`py-0.5 px-1 text-[10px] font-bold rounded transition-colors ${
                  filters.fromDate === '2023-01-01' && filters.toDate === '2023-12-31'
                    ? 'bg-amber-500 text-black font-extrabold'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                2023
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, fromDate: '2022-01-01', toDate: '2026-12-31' })}
                className={`py-0.5 px-1 text-[10px] font-bold rounded transition-colors ${
                  filters.fromDate === '2022-01-01'
                    ? 'bg-amber-500 text-black font-extrabold'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Tất Cả
              </button>
            </div>

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
            <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
              Loại Hóa Đơn
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, invoiceType: 'purchase' })}
                className={`py-1 px-1 text-center text-[11px] font-bold rounded transition-colors ${
                  filters.invoiceType === 'purchase'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Mua Vào
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, invoiceType: 'sold' })}
                className={`py-1 px-1 text-center text-[11px] font-bold rounded transition-colors ${
                  filters.invoiceType === 'sold'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Bán Ra
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, invoiceType: 'both' })}
                className={`py-1 px-1 text-center text-[11px] font-bold rounded transition-colors ${
                  filters.invoiceType === 'both'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Tất Cả
              </button>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="pt-1.5 space-y-2">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary-accent w-full flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-950/50 py-2.5 text-sm font-black"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>ĐANG TRUY XUẤT CỔNG THUẾ...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>BẮT ĐẦU TRUY XUẤT</span>
                </>
              )}
            </button>

            {/* Quick Demo Sandbox Switch Button */}
            <button
              type="button"
              onClick={handleUseDemo}
              className="w-full py-1 px-2 rounded bg-gray-800 hover:bg-gray-700 text-amber-300 text-[11px] font-medium flex items-center justify-center gap-1.5 border border-gray-700 transition-colors cursor-pointer"
              title="Xem và kiểm tra toàn bộ tính năng với dữ liệu mẫu minh họa"
            >
              <Database className="w-3 h-3 text-amber-400" />
              <span>Chạy chế độ Mẫu (Demo Sandbox)</span>
            </button>
          </div>
        </form>

        {/* Engine Status Specification */}
        <div className="p-2.5 bg-gray-900 rounded border border-gray-800 space-y-1.5 text-[11px] font-mono">
          <div className="text-gray-400 font-bold uppercase tracking-wider text-[10px] pb-1 border-b border-gray-800 flex items-center justify-between">
            <span>Trạng Thái Hệ Thống</span>
            <span className="text-emerald-400">ONLINE</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span>Cổng Thuế:</span>
            <span className="text-emerald-400 font-bold">hoadondientu.gdt</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span>Chứng thư số:</span>
            <span className="text-blue-400">CQT SHA-256</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span>Nghị định:</span>
            <span className="text-purple-400">123/2020 & TT78</span>
          </div>
        </div>
      </div>

      {/* Footer Utility Links */}
      <div className="pt-3 border-t border-gray-800 space-y-1.5 text-xs">
        {onOpenImportXml && (
          <button
            onClick={onOpenImportXml}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-blue-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-[11px] font-semibold cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Nạp tệp XML / Gói ZIP thực tế</span>
          </button>
        )}

        <button
          onClick={onOpenConfigModal}
          className="w-full flex items-center gap-2 px-2 py-1 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-[11px] cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-gray-400" />
          <span>Cấu hình tài khoản & Captcha</span>
        </button>

        <button
          onClick={onOpenPythonRunner}
          className="w-full flex items-center gap-2 px-2 py-1 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-[11px] cursor-pointer"
        >
          <Terminal className="w-3.5 h-3.5 text-purple-400" />
          <span>Mở Python CLI Console</span>
        </button>

        <button
          onClick={onDownloadPackage}
          className="w-full flex items-center gap-2 px-2 py-1 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-[11px] cursor-pointer"
        >
          <Code2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Tải script Python Selenium (.zip)</span>
        </button>
      </div>
    </aside>
  );
};
