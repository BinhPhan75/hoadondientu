import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert,
  KeyRound, 
  Building2, 
  Calendar, 
  Play, 
  RefreshCw, 
  Settings, 
  Eye, 
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Globe2,
  Database
} from 'lucide-react';
import { GDTAccountConfig, FilterParams } from '../types';

export interface CrawlerCredentials {
  taxCode: string;
  password?: string;
  captchaKey?: string;
  captchaCode?: string;
  captchaCookie?: string;
}

interface SidebarProps {
  account: GDTAccountConfig;
  filters: FilterParams;
  onFilterChange: (filters: FilterParams) => void;
  onUpdateAccount: (account: GDTAccountConfig) => void;
  onRunCrawler: (credentials?: CrawlerCredentials) => Promise<{ success: boolean; error?: string } | void>;
  isLoading: boolean;
  onOpenConfigModal: () => void;
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
  onCloseMobileSidebar
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [localMst, setLocalMst] = useState(account.taxCode || '');
  const [localPassword, setLocalPassword] = useState(account.password || '');
  
  // Captcha & AI OCR State
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaKey, setCaptchaKey] = useState('');
  const [captchaCookie, setCaptchaCookie] = useState('');
  const [captchaImg, setCaptchaImg] = useState<string>('');
  const [isRealGdtCaptcha, setIsRealGdtCaptcha] = useState(true);
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState(false);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);
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

  // AI OCR Scanner helper
  const handleScanOcr = async (imgToScan?: string, keyToScan?: string) => {
    const targetImg = imgToScan || captchaImg;
    const targetKey = keyToScan || captchaKey;
    if (!targetImg && !targetKey) return;

    setIsScanningOcr(true);
    setOcrSuccess(false);
    try {
      const res = await fetch('/api/gdt/ocr-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captchaImage: targetImg, captchaKey: targetKey })
      });
      const data = await res.json();
      if (data && data.success && data.captchaCode) {
        setCaptchaCode(data.captchaCode);
        setOcrSuccess(true);
        if (authError) setAuthError(null);
      } else {
        setOcrSuccess(false);
      }
    } catch (err) {
      console.warn('[AI OCR Scan Error]:', err);
      setOcrSuccess(false);
    } finally {
      setIsScanningOcr(false);
    }
  };

  // Load Real Captcha from GDT & Trigger Auto-OCR
  const fetchCaptcha = async () => {
    setIsLoadingCaptcha(true);
    setAuthError(null);
    setCaptchaCode('');
    setOcrSuccess(false);
    try {
      const res = await fetch('/api/gdt/captcha');
      const data = await res.json();

      if (res.ok && data && data.success && data.isRealGDT && data.captchaImage) {
        setCaptchaImg(data.captchaImage);
        setCaptchaKey(data.captchaKey || '');
        setCaptchaCookie(data.captchaCookie || '');
        setIsRealGdtCaptcha(true);
        
        if (data.captchaCode) {
          setCaptchaCode(data.captchaCode);
          setOcrSuccess(true);
        } else {
          setCaptchaCode('');
          setOcrSuccess(false);
        }
        return;
      }

      // If GDT portal is unreachable from this IP
      setCaptchaImg('');
      setCaptchaKey('');
      setCaptchaCookie('');
      setCaptchaCode('');
      setOcrSuccess(false);
      setIsRealGdtCaptcha(false);
      setAuthError(data?.message || 'Không thể tải mã Captcha từ Cổng Tổng cục Thuế (hoadondientu.gdt.gov.vn). Cổng Thuế có thể đang chặn IP nước ngoài của Vercel.');
    } catch (err: any) {
      console.warn('Cannot fetch GDT captcha:', err);
      setCaptchaImg('');
      setCaptchaKey('');
      setCaptchaCookie('');
      setCaptchaCode('');
      setOcrSuccess(false);
      setIsRealGdtCaptcha(false);
      setAuthError('Không thể kết nối đến máy chủ Cổng Thuế (' + (err.message || 'Lỗi mạng') + '). Vui lòng thử lại.');
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
        taxpayerName: `DOANH NGHIỆP NỘP THUẾ (MST: ${trimmed})`,
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

  // Submit flow with Auto-OCR validation
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);

    const mst = localMst.trim();
    const pwd = localPassword.trim();

    if (!mst) {
      setAuthError('Vui lòng nhập Mã số thuế (MST).');
      return;
    }

    let activeCaptchaCode = captchaCode.trim();

    // If user has not authenticated with real GDT yet, check credentials
    if (!account.isRealGDT) {
      if (!pwd) {
        setAuthError('Vui lòng nhập Mật khẩu do Cơ quan Thuế cấp.');
        return;
      }
      
      // Auto-scan captcha on-the-fly if empty
      if (!activeCaptchaCode) {
        setIsScanningOcr(true);
        try {
          const res = await fetch('/api/gdt/ocr-captcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ captchaImage: captchaImg, captchaKey })
          });
          const ocrData = await res.json();
          if (ocrData && ocrData.success && ocrData.captchaCode) {
            activeCaptchaCode = ocrData.captchaCode;
            setCaptchaCode(ocrData.captchaCode);
            setOcrSuccess(true);
          }
        } catch (err) {
          console.warn('[Auto-OCR in Submit Error]:', err);
        } finally {
          setIsScanningOcr(false);
        }
      }

      if (!activeCaptchaCode) {
        setAuthError('Vui lòng nhập mã Captcha hiển thị trên hình.');
        return;
      }
    }

    const result = await onRunCrawler({
      taxCode: mst,
      password: pwd,
      captchaKey,
      captchaCode: activeCaptchaCode,
      captchaCookie
    });

    if (result && !result.success && result.error) {
      setAuthError(result.error);
      // Auto refresh captcha on failure so user can retry immediately
      fetchCaptcha();
    }
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

          {/* Captcha Section with Automated AI OCR Scanner */}
          <div className="bg-gray-900/90 p-2.5 rounded border border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Mã Captcha</span>
                {isRealGdtCaptcha ? (
                  <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1 py-0.2 rounded border border-emerald-800 font-mono">
                    Cổng Thuế GDT
                  </span>
                ) : (
                  <span className="text-[9px] bg-amber-950/80 text-amber-400 px-1 py-0.2 rounded border border-amber-800/80 font-mono">
                    Chờ kết nối
                  </span>
                )}
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleScanOcr()}
                  disabled={isScanningOcr || isLoadingCaptcha || !captchaImg}
                  className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono cursor-pointer transition-colors disabled:opacity-50"
                  title="Tự động quét và đọc mã Captcha bằng AI OCR"
                >
                  <Sparkles className={`w-3 h-3 ${isScanningOcr ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
                  <span>{isScanningOcr ? 'Đang quét...' : 'Quét OCR'}</span>
                </button>
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  disabled={isLoadingCaptcha || isScanningOcr}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-mono cursor-pointer transition-colors"
                  title="Đổi ảnh Captcha mới từ Cổng Thuế"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingCaptcha ? 'animate-spin' : ''}`} />
                  <span>Đổi mã</span>
                </button>
              </div>
            </div>

            {/* Captcha Image Display & Input */}
            <div className="flex items-center gap-2">
              <div 
                className="h-10 bg-white rounded flex items-center justify-center p-1 overflow-hidden border border-gray-600 cursor-pointer shadow-inner min-w-[125px] flex-1 relative group"
                onClick={fetchCaptcha}
                title="Nhấn vào hình để đổi mã Captcha khác"
              >
                {isLoadingCaptcha ? (
                  <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Đang kết nối...
                  </div>
                ) : captchaImg ? (
                  <img
                    src={captchaImg}
                    alt="GDT Captcha"
                    className="max-h-full object-contain filter contrast-125 select-none"
                  />
                ) : (
                  <div className="text-[10px] text-red-600 font-medium flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5" /> Bấm thử lại
                  </div>
                )}
              </div>

              {/* Captcha Input with auto-OCR indicator */}
              <div className="relative">
                <input
                  type="text"
                  value={captchaCode}
                  onChange={(e) => {
                    setCaptchaCode(e.target.value.toUpperCase());
                    if (authError) setAuthError(null);
                  }}
                  placeholder={isScanningOcr ? 'Quét...' : 'Mã...'}
                  maxLength={8}
                  className={`w-24 text-input-dark font-mono text-base uppercase text-center font-bold tracking-widest bg-gray-950 border-gray-700 py-1.5 ${
                    ocrSuccess ? 'text-emerald-300 border-emerald-700/80' : 'text-amber-300'
                  } focus:border-amber-500`}
                  required={!account.isRealGDT}
                />
              </div>
            </div>

            {/* OCR Status Line */}
            <div className="flex items-center justify-between text-[10px] font-mono px-0.5">
              {isScanningOcr ? (
                <span className="text-amber-400 flex items-center gap-1 animate-pulse">
                  <Sparkles className="w-3 h-3 animate-spin text-amber-400" />
                  AI OCR đang nhận diện mã...
                </span>
              ) : ocrSuccess && captchaCode ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Đã tự động đọc: <strong className="text-white bg-emerald-950 px-1 rounded">{captchaCode}</strong>
                </span>
              ) : captchaCode ? (
                <span className="text-emerald-400/90 flex items-center gap-1">
                  Mã đã nhập: <strong className="text-white bg-emerald-950 px-1 rounded">{captchaCode}</strong>
                </span>
              ) : isRealGdtCaptcha ? (
                <span className="text-gray-400">
                  Nhìn hình nhập mã vào ô bên cạnh (hoặc bấm Quét OCR)
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Nhấn &quot;Đổi mã&quot; để kết nối Cổng Thuế
                </span>
              )}
            </div>
          </div>

          {/* Error Message if Authentication Failed */}
          {authError && (
            <div className="p-2.5 bg-red-950/90 border border-red-800 rounded text-red-200 text-[11px] leading-tight flex items-start gap-1.5 animate-fadeIn shadow-md">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-red-300 font-semibold">Kết nối Cổng Thuế không thành công:</strong>
                <span className="text-red-200/90">{authError}</span>
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
                onClick={() => onFilterChange({ ...filters, fromDate: '2026-01-01', toDate: '2026-12-31' })}
                className={`py-0.5 px-1 text-[10px] font-bold rounded transition-colors ${
                  filters.fromDate === '2026-01-01' && filters.toDate === '2026-12-31'
                    ? 'bg-amber-500 text-black font-extrabold'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                2026
              </button>
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

          {/* Invoice Type Fixed to Purchase */}
          <div className="flex items-center justify-between py-1.5 px-2.5 bg-blue-950/40 border border-blue-900/60 rounded">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Phạm vi tra cứu</span>
            <span className="text-xs font-bold text-blue-400 font-mono">HÓA ĐƠN MUA VÀO</span>
          </div>

          {/* Primary Action Button */}
          <div className="pt-1.5">
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
        </div>
      </div>

      {/* Footer Utility Links */}
      <div className="pt-3 border-t border-gray-800 space-y-1.5 text-xs">
        <button
          onClick={onOpenConfigModal}
          className="w-full flex items-center gap-2 px-2 py-1 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors text-[11px] cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-gray-400" />
          <span>Cấu hình tài khoản & Captcha</span>
        </button>
      </div>
    </aside>
  );
};
