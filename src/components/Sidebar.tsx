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
  Database,
  PanelLeftClose
} from 'lucide-react';
import { GDTAccountConfig, FilterParams } from '../types';
import { convertSvgToSharpPng } from '../utils/captchaOcrHelper';
import { executeGdtCaptcha } from '../utils/gdtQueryClient';
import { solveCaptchaWithTesseract } from '../utils/tesseractCaptchaSolver';

export interface CrawlerCredentials {
  taxCode: string;
  password?: string;
  captchaKey?: string;
  captchaCode?: string;
  captchaCookie?: string;
  vietnamProxy?: string;
  customApiKey?: string;
}

interface SidebarProps {
  account: GDTAccountConfig;
  filters: FilterParams;
  onFilterChange: (filters: FilterParams) => void;
  onUpdateAccount: (account: GDTAccountConfig) => void;
  onRunCrawler: (credentials?: CrawlerCredentials) => Promise<{ success: boolean; error?: string; isWafBlocked?: boolean; needManualCaptcha?: boolean } | void>;
  isLoading: boolean;
  onOpenConfigModal: () => void;
  onCloseMobileSidebar?: () => void;
  onCollapseSidebar?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  account,
  filters,
  onFilterChange,
  onUpdateAccount,
  onRunCrawler,
  isLoading,
  onOpenConfigModal,
  onCloseMobileSidebar,
  onCollapseSidebar
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
  const [ocrNotice, setOcrNotice] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isWafBlocked, setIsWafBlocked] = useState<boolean>(false);

  // Synchronize local input state if parent account updates
  useEffect(() => {
    if (account.taxCode && account.taxCode !== localMst) {
      setLocalMst(account.taxCode);
    }
    if (account.password && account.password !== localPassword) {
      setLocalPassword(account.password);
    }
  }, [account.taxCode, account.password]);

  // AI & Local OCR Scanner helper (Ưu tiên Tesseract local -> Fallback API)
  const handleScanOcr = async (imgToScan?: string, keyToScan?: string, isManualClick = false) => {
    const rawImg = imgToScan || captchaImg;
    const targetKey = keyToScan || captchaKey;
    if (!rawImg && !targetKey) return;

    setIsScanningOcr(true);
    setOcrSuccess(false);
    setOcrNotice(null);

    try {
      // 1. Thử giải nhanh bằng Tesseract Client-side
      try {
        const localResult = await solveCaptchaWithTesseract(rawImg, {
          digitsOnly: false,
          timeoutMs: 2500,
          preprocessEasyInvoice: true
        });

        if (localResult && localResult.code && localResult.code.length >= 3) {
          setCaptchaCode(localResult.code.toUpperCase());
          setOcrSuccess(true);
          setOcrNotice(null);
          if (authError) setAuthError(null);
          setIsScanningOcr(false);
          return;
        }
      } catch (localErr) {
        // Nếu Tesseract local không đọc được hoặc timeout thì bỏ qua để xuống API
      }

      // 2. Chuyển đổi SVG/Format ảnh và gọi API OCR Server
      const targetImg = await convertSvgToSharpPng(rawImg);
      const res = await fetch('/api/gdt/ocr-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captchaImage: targetImg, captchaKey: targetKey })
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        // Safe JSON parse fallback
      }

      if (data && data.success && data.captchaCode) {
        setCaptchaCode(data.captchaCode.toUpperCase());
        setOcrSuccess(true);
        setOcrNotice(null);
        if (authError) setAuthError(null);
      } else {
        setOcrSuccess(false);
        if (data?.isSpendingCap) {
          setOcrNotice('Hạn mức AI tạm dừng. Vui lòng nhập thủ công.');
        } else {
          setOcrNotice('Vui lòng nhìn hình và nhập mã thủ công.');
        }
      }
    } catch {
      setOcrSuccess(false);
      setOcrNotice('Vui lòng nhìn hình và nhập mã thủ công.');
    } finally {
      setIsScanningOcr(false);
    }
  };

  // Load Real Captcha from GDT with Dual-Strategy (Server Proxy + Direct Browser Fallback)
  const fetchCaptcha = async () => {
    setIsLoadingCaptcha(true);
    setAuthError(null);
    setOcrNotice(null);
    setCaptchaCode('');
    setOcrSuccess(false);

    const res = await executeGdtCaptcha();
    if (res.success && res.captchaImage) {
      setCaptchaImg(res.captchaImage);
      setCaptchaKey(res.captchaKey || '');
      setCaptchaCookie(res.captchaCookie || '');
      setIsRealGdtCaptcha(res.source === 'proxy' || res.source === 'direct_browser');
      setAuthError(null);
      setIsLoadingCaptcha(false);

      // TỰ ĐỘNG KÍCH HOẠT NHẬN DIỆN NGAY KHI ẢNH VỪA TẢI XONG
      handleScanOcr(res.captchaImage, res.captchaKey || '');
      return;
    }

    // If both failed:
    setCaptchaImg('');
    setCaptchaKey('');
    setCaptchaCookie('');
    setCaptchaCode('');
    setOcrSuccess(false);
    setIsRealGdtCaptcha(false);
    setAuthError('Không thể tải mã Captcha từ Cổng Tổng cục Thuế. Vui lòng bấm "Đổi mã" để thử lại.');
    setIsLoadingCaptcha(false);
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
    setIsWafBlocked(false);

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
      
      if (!activeCaptchaCode) {
        setAuthError('Vui lòng nhìn hình và nhập mã Captcha hoặc bấm "Đọc mã AI" để gán vào.');
        return;
      }
    }

    const result = await onRunCrawler({
      taxCode: mst,
      password: pwd,
      captchaKey,
      captchaCode: activeCaptchaCode,
      captchaCookie,
      vietnamProxy: account.vietnamProxy,
      customApiKey: account.customApiKey
    });

    if (result && result.success) {
      setIsWafBlocked(false);
      // Khi nhấn vào bắt đầu truy xuất, nếu kết nối thành công với cổng tổng cục thuế, menu trên trái sẽ tự động ẩn để gọn màn hình
      if (onCollapseSidebar) onCollapseSidebar();
      if (onCloseMobileSidebar) onCloseMobileSidebar();
    } else if (result && !result.success) {
      if (result.isWafBlocked) {
        setIsWafBlocked(true);
      }
      if (result.needManualCaptcha) {
        fetchCaptcha();
      }
      if (result.error) {
        setAuthError(result.error);
      }
      // Auto refresh captcha on failure so user can retry immediately
      fetchCaptcha();
    }
  };

  return (
    <aside className="w-72 lg:w-80 bg-slate-900 text-slate-100 p-5 flex flex-col justify-between border-r border-slate-800 shrink-0 h-full overflow-y-auto z-40">
      <div className="space-y-4.5">
        {/* Brand & Title */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-white">
                  Tra Cứu Hóa Đơn
                </h2>
                <span className={`w-2 h-2 rounded-full ${account.isRealGDT ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Globe2 className="w-3 h-3 text-slate-500" />
                <span>hoadondientu.gdt.gov.vn</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onCollapseSidebar && (
              <button
                type="button"
                onClick={onCollapseSidebar}
                className="hidden lg:flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-100 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                title="Ẩn menu bên trái để mở rộng không gian nhìn"
              >
                <PanelLeftClose className="w-4 h-4 text-slate-400" />
                <span className="text-[11px] font-medium">Ẩn</span>
              </button>
            )}

            {onCloseMobileSidebar && (
              <button
                type="button"
                onClick={onCloseMobileSidebar}
                className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 cursor-pointer"
                title="Đóng menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Connection Status Soft Badge */}
        <div className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 font-medium transition-colors ${
          account.isRealGDT 
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
            : 'bg-slate-800/80 border border-slate-700/60 text-slate-300'
        }`}>
          {account.isRealGDT ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">Đã kết nối Cổng Tổng cục Thuế</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
              <span className="truncate">Sẵn sàng kết nối Cơ quan Thuế</span>
            </>
          )}
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* MST Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Mã số thuế (Tên đăng nhập)
              </label>
              <span className="text-[11px] text-emerald-400 flex items-center gap-0.5">
                <ShieldCheck className="w-3 h-3" /> Hợp lệ
              </span>
            </div>
            <input
              type="text"
              value={localMst}
              onChange={(e) => setLocalMst(e.target.value.replace(/\s+/g, ''))}
              onBlur={handleMstBlur}
              placeholder="VD: 4000926165"
              className="text-input-dark font-mono text-sm tracking-wide"
              required
            />
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Mật khẩu CQT cấp
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
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
                className="text-input-dark pr-9 text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Captcha Section */}
          <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                <span>Mã Captcha</span>
              </span>

              {/* Nút bấm đọc OCR và gán vào */}
              <button
                type="button"
                onClick={() => handleScanOcr(undefined, undefined, true)}
                disabled={isScanningOcr || isLoadingCaptcha || !captchaImg}
                className="text-[11px] text-amber-300 hover:text-amber-200 font-medium flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30 transition-colors cursor-pointer disabled:opacity-40"
                title="Quét ảnh Captcha và tự động gán ký tự vào ô bên dưới"
              >
                <Sparkles className={`w-3 h-3 ${isScanningOcr ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
                <span>{isScanningOcr ? 'Đang đọc...' : 'Đọc mã AI'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {/* Khung ảnh Captcha thật */}
                <div 
                  className="h-10 bg-white rounded-md flex items-center justify-center p-1 overflow-hidden border border-slate-600 cursor-pointer shadow-xs min-w-[120px] flex-1 relative group"
                  onClick={fetchCaptcha}
                  title="Nhấn vào hình để đổi ảnh Captcha khác"
                >
                  {isLoadingCaptcha ? (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3 animate-spin text-slate-500" /> Đang tải...
                    </div>
                  ) : captchaImg ? (
                    <img
                      src={captchaImg}
                      alt="GDT Captcha"
                      className="max-h-full object-contain filter contrast-125 select-none"
                    />
                  ) : (
                    <div className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Bấm thử lại
                    </div>
                  )}
                </div>

                {/* Ô Nhập Captcha */}
                <div className="relative">
                  <input
                    type="text"
                    value={captchaCode}
                    onChange={(e) => {
                      setCaptchaCode(e.target.value.toUpperCase());
                      if (authError) setAuthError(null);
                    }}
                    placeholder="Mã ảnh"
                    maxLength={8}
                    className={`w-28 text-input-dark font-mono text-base uppercase text-center font-bold tracking-widest bg-slate-950 py-1.5 focus:border-blue-500 ${
                      ocrSuccess ? 'border-emerald-500 text-emerald-300' : 'border-slate-700 text-amber-300'
                    }`}
                  />
                </div>
              </div>

              {/* Thông tin hỗ trợ */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                {ocrNotice ? (
                  <span className={ocrSuccess ? 'text-emerald-400 font-medium flex items-center gap-1' : 'text-amber-400'}>
                    {ocrSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    {ocrNotice}
                  </span>
                ) : captchaCode ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Đã nhập: <strong className="font-mono">{captchaCode}</strong></span>
                  </span>
                ) : (
                  <span className="text-slate-400">Nhập ký tự từ ảnh</span>
                )}

                <button
                  type="button"
                  onClick={fetchCaptcha}
                  disabled={isLoadingCaptcha || isScanningOcr}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingCaptcha ? 'animate-spin' : ''}`} />
                  <span>Đổi ảnh</span>
                </button>
              </div>
            </div>
          </div>

          {/* WAF 403 Warning */}
          {isWafBlocked && (
            <div className="p-3 bg-amber-950/60 border border-amber-600/60 rounded-lg text-amber-200 text-xs leading-relaxed space-y-2 animate-fadeIn shadow-xs">
              <div className="flex items-start gap-1.5 font-semibold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>Cổng Thuế tạm từ chối kết nối IP (HTTP 403)</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-normal">
                Tường lửa Tổng cục Thuế phát hiện kết nối từ IP đám mây. Bạn hãy thử lại sau giây lát hoặc làm mới mã Captcha.
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={onOpenConfigModal}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-md text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Cấu hình</span>
                </button>
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs cursor-pointer transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Đổi mã</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Message if Authentication Failed */}
          {authError && !isWafBlocked && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-lg text-rose-200 text-xs leading-relaxed flex items-start gap-2 animate-fadeIn shadow-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-rose-300 font-semibold">Kết nối Cổng Thuế không thành công:</strong>
                <span className="text-rose-200/90 text-[11px]">{authError}</span>
              </div>
            </div>
          )}

          {/* Date Range Inputs */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Khoảng thời gian tra cứu
              </label>
              <span className="text-[11px] text-slate-400">Chọn nhanh:</span>
            </div>
            
            {/* Quick Period Buttons: Modern Segmented Switch */}
            <div className="bg-slate-950/70 p-1 rounded-lg border border-slate-800 grid grid-cols-4 gap-1 mb-2.5">
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, fromDate: '2026-01-01', toDate: '2026-12-31' })}
                className={`py-1 text-xs font-medium rounded-md transition-all text-center cursor-pointer ${
                  filters.fromDate === '2026-01-01' && filters.toDate === '2026-12-31'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                2026
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, fromDate: '2025-01-01', toDate: '2025-12-31' })}
                className={`py-1 text-xs font-medium rounded-md transition-all text-center cursor-pointer ${
                  filters.fromDate === '2025-01-01' && filters.toDate === '2025-12-31'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                2025
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, fromDate: '2024-01-01', toDate: '2024-12-31' })}
                className={`py-1 text-xs font-medium rounded-md transition-all text-center cursor-pointer ${
                  filters.fromDate === '2024-01-01' && filters.toDate === '2024-12-31'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                2024
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, fromDate: '2022-01-01', toDate: '2026-12-31' })}
                className={`py-1 text-xs font-medium rounded-md transition-all text-center cursor-pointer ${
                  filters.fromDate === '2022-01-01'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                Tất cả
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Từ ngày:</span>
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => onFilterChange({ ...filters, fromDate: e.target.value })}
                  className="text-input-dark text-xs p-1.5"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Đến ngày:</span>
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => onFilterChange({ ...filters, toDate: e.target.value })}
                  className="text-input-dark text-xs p-1.5"
                />
              </div>
            </div>
          </div>

          {/* Invoice Type Fixed to Purchase */}
          <div className="flex items-center justify-between py-2 px-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
            <span className="text-xs text-slate-400 font-medium">Phạm vi tra cứu</span>
            <span className="text-xs font-semibold text-blue-400">Hóa đơn mua vào</span>
          </div>

          {/* Primary Action Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary-accent w-full flex items-center justify-center gap-2 cursor-pointer shadow-sm py-2.5 text-xs font-semibold rounded-lg"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang truy xuất Cổng Thuế...</span>
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
        <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800/80 space-y-2 text-xs">
          <div className="text-slate-400 font-medium text-xs pb-1.5 border-b border-slate-800 flex items-center justify-between">
            <span>Trạng thái hệ thống</span>
            <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-medium">
              Hoạt động
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300 text-[11px]">
            <span className="text-slate-400">Cổng Thuế:</span>
            <span className="text-slate-200 font-medium font-mono">hoadondientu.gdt.gov.vn</span>
          </div>
          <div className="flex items-center justify-between text-slate-300 text-[11px]">
            <span className="text-slate-400">Chứng thư số:</span>
            <span className="text-blue-400 font-medium font-mono">CQT SHA-256</span>
          </div>
        </div>
      </div>

      {/* Footer Utility Links */}
      <div className="pt-3 border-t border-slate-800 space-y-1 text-xs">
        <button
          onClick={onOpenConfigModal}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors text-xs cursor-pointer"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>Cấu hình tài khoản & Captcha</span>
        </button>
      </div>
    </aside>
  );
};
