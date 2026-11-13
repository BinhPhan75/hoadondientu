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
import { solveCaptchaWithClientTemplateMatching } from '../utils/clientTemplateCaptchaSolver';

export interface CrawlerCredentials {
  taxCode: string;
  password?: string;
  captchaKey?: string;
  captchaCode?: string;
  captchaCookie?: string;
  vietnamProxy?: string;
  customApiKey?: string;
  attemptNumber?: number;
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
  const [localMst, setLocalMst] = useState(() => account.taxCode || localStorage.getItem('gdt_saved_tax_code') || '');
  const [localPassword, setLocalPassword] = useState(() => account.password || localStorage.getItem('gdt_saved_password') || '');
  
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
  const captchaInputRef = React.useRef<HTMLInputElement>(null);

  // Synchronize local input state if parent account updates
  useEffect(() => {
    if (account.taxCode && account.taxCode !== localMst) {
      setLocalMst(account.taxCode);
    }
    if (account.password && account.password !== localPassword) {
      setLocalPassword(account.password);
    }
  }, [account.taxCode, account.password]);

  // Tải Captcha từ Cổng Thuế và tự động nhận diện bằng OCR cục bộ (Template Matching + Local Tesseract)
  const fetchCaptchaAndSolve = async (): Promise<{ key: string; cookie: string; code: string; image: string } | null> => {
    setIsLoadingCaptcha(true);
    setOcrNotice('Đang tải và nhận diện mã CAPTCHA...');
    setOcrSuccess(false);

    const res = await executeGdtCaptcha();
    if (res.success && res.captchaImage) {
      setCaptchaImg(res.captchaImage);
      setCaptchaKey(res.captchaKey || '');
      setCaptchaCookie(res.captchaCookie || '');
      setIsRealGdtCaptcha(res.source === 'proxy' || res.source === 'direct_browser');
      setAuthError(null);

      let detected = '';

      // 1. Ưu tiên số 1: Nhận diện vector font Comismsh trực tiếp bằng Vector Zonal Solver (100% Cục bộ)
      try {
        const { solveCaptchaFromSvg } = await import('../utils/vectorCaptchaSolver');
        const svgContent = res.rawSvg || (res.captchaImage.includes('<svg') ? res.captchaImage : '');
        if (svgContent) {
          const vRes = await solveCaptchaFromSvg(svgContent);
          if (vRes && vRes.success && vRes.code && vRes.code.length >= 4) {
            detected = vRes.code;
          }
        }
      } catch {}

      // 2. Thử qua endpoint OCR vector chuyên dụng trên server (100% Cục bộ)
      if (!detected || detected.length < 4) {
        try {
          const ocrResp = await fetch('/api/gdt/ocr-captcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rawSvg: res.rawSvg,
              captchaImage: res.captchaImage,
              captchaKey: res.captchaKey,
            }),
          });
          if (ocrResp.ok) {
            const ocrData = await ocrResp.json().catch(() => ({}));
            if (ocrData?.success && ocrData.captchaCode) {
              const code = String(ocrData.captchaCode).trim().toUpperCase();
              if (code.length >= 4) detected = code;
            }
          }
        } catch {}
      }

      // 3. Dự phòng qua Client Template Matching
      if (!detected || detected.length < 4) {
        try {
          const tmRes = await solveCaptchaWithClientTemplateMatching(res.captchaImage, {
            minConfidenceThreshold: 35,
            expectedLength: 6,
          });
          if (tmRes && tmRes.code && tmRes.code.length >= 4 && !tmRes.code.includes('?')) {
            detected = tmRes.code;
          }
        } catch {}
      }

      setIsLoadingCaptcha(false);

      if (detected) {
        setCaptchaCode(detected);
        setOcrSuccess(true);
        setOcrNotice(null);
        return {
          key: res.captchaKey || '',
          cookie: res.captchaCookie || '',
          code: detected,
          image: res.captchaImage,
        };
      } else {
        setCaptchaCode('');
        setOcrSuccess(false);
        setOcrNotice('Vui lòng nhìn hình và nhập mã thủ công.');
        return {
          key: res.captchaKey || '',
          cookie: res.captchaCookie || '',
          code: '',
          image: res.captchaImage,
        };
      }
    }

    setCaptchaImg('');
    setCaptchaKey('');
    setCaptchaCookie('');
    setCaptchaCode('');
    setOcrSuccess(false);
    setIsRealGdtCaptcha(false);
    setAuthError('Không thể tải mã Captcha từ Cổng Tổng cục Thuế. Vui lòng bấm "Đổi mã" để thử lại.');
    setIsLoadingCaptcha(false);
    return null;
  };

  const handleScanOcr = async (imgToScan?: string, _keyToScan?: string) => {
    const rawImg = imgToScan || captchaImg;
    if (!rawImg) return;

    setIsScanningOcr(true);
    setOcrSuccess(false);
    setOcrNotice('Đang nhận diện mã...');

    try {
      // 1. Thử nhận diện trực tiếp bằng Vector Zonal Solver (100% Cục bộ)
      try {
        const { solveCaptchaFromSvg } = await import('../utils/vectorCaptchaSolver');
        let svgContent = '';
        if (rawImg.includes('<svg')) {
          svgContent = rawImg;
        } else if (rawImg.startsWith('data:image/svg+xml;base64,')) {
          try {
            svgContent = atob(rawImg.replace('data:image/svg+xml;base64,', ''));
          } catch {}
        }
        if (svgContent) {
          const vRes = await solveCaptchaFromSvg(svgContent);
          if (vRes && vRes.success && vRes.code && vRes.code.length >= 4) {
            setCaptchaCode(vRes.code);
            setOcrSuccess(true);
            setOcrNotice(null);
            if (authError) setAuthError(null);
            setIsScanningOcr(false);
            return;
          }
        }
      } catch {}

      // 2. Thử qua endpoint OCR vector chuyên dụng trên server (100% Cục bộ)
      try {
        const ocrResp = await fetch('/api/gdt/ocr-captcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            captchaImage: rawImg,
            captchaKey: _keyToScan || captchaKey,
          }),
        });
        if (ocrResp.ok) {
          const ocrData = await ocrResp.json().catch(() => ({}));
          if (ocrData?.success && ocrData.captchaCode) {
            const detectedCode = String(ocrData.captchaCode).trim().toUpperCase();
            if (detectedCode.length >= 4) {
              setCaptchaCode(detectedCode);
              setOcrSuccess(true);
              setOcrNotice(null);
              if (authError) setAuthError(null);
              setIsScanningOcr(false);
              return;
            }
          }
        }
      } catch {}

      // 3. Thử nhận diện bằng Client Template Matching trước (100% Cục bộ)
      try {
        const tmRes = await solveCaptchaWithClientTemplateMatching(rawImg, {
          minConfidenceThreshold: 35,
          expectedLength: 6,
        });

        if (tmRes && tmRes.code && tmRes.code.length >= 4 && !tmRes.code.includes('?')) {
          setCaptchaCode(tmRes.code);
          setOcrSuccess(true);
          setOcrNotice(null);
          if (authError) setAuthError(null);
          setIsScanningOcr(false);
          return;
        }
      } catch {}

      // 2. Dự phòng: Tesseract Local trên máy chủ
      let payloadImg = rawImg;
      try {
        payloadImg = await convertSvgToSharpPng(rawImg);
      } catch {
        payloadImg = rawImg;
      }

      const res = await fetch('/api/invoice-downloader/solve-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: payloadImg,
          alphanumeric: true,
          localOnly: true,
          preprocess: false,
          timeoutMs: 8000,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (data && data.success && data.code) {
        const detectedCode = String(data.code).trim().toUpperCase();
        setCaptchaCode(detectedCode);
        setOcrSuccess(true);
        setOcrNotice(null);
        if (authError) setAuthError(null);
      } else {
        setOcrSuccess(false);
        setOcrNotice('Vui lòng nhìn hình và nhập mã thủ công.');
      }
    } catch {
      setOcrSuccess(false);
      setOcrNotice('Vui lòng nhìn hình và nhập mã thủ công.');
    } finally {
      setIsScanningOcr(false);
    }
  };

  const fetchCaptcha = async () => {
    await fetchCaptchaAndSolve();
  };

  useEffect(() => {
    fetchCaptchaAndSolve();
  }, []);

  const handleMstBlur = () => {
    const trimmed = localMst.trim();
    try {
      if (trimmed) localStorage.setItem('gdt_saved_tax_code', trimmed);
    } catch {}
    if (trimmed !== account.taxCode) {
      onUpdateAccount({
        ...account,
        taxCode: trimmed,
        taxpayerName: trimmed ? `DOANH NGHIỆP NỘP THUẾ (MST: ${trimmed})` : 'Chưa đăng nhập CQT',
        isRealGDT: false // Reset authenticated state on MST change
      });
    }
  };

  const handlePasswordBlur = () => {
    const trimmed = localPassword.trim();
    try {
      if (trimmed) localStorage.setItem('gdt_saved_password', trimmed);
    } catch {}
    if (trimmed !== account.password) {
      onUpdateAccount({
        ...account,
        password: trimmed,
        isRealGDT: false
      });
    }
  };

  // Submit flow với cơ chế tự động đọc và thử lại đăng nhập cho đến khi thành công
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

    if (!account.isRealGDT && !pwd) {
      setAuthError('Vui lòng nhập Mật khẩu do Cơ quan Thuế cấp.');
      return;
    }

    // Luôn lưu thông tin MST và mật khẩu vào local máy người dùng
    try {
      localStorage.setItem('gdt_saved_tax_code', mst);
      if (pwd) localStorage.setItem('gdt_saved_password', pwd);
    } catch {}

    let activeKey = captchaKey;
    let activeCookie = captchaCookie;
    let activeCode = captchaCode.trim();

    // Nếu ô Mã Ảnh chưa có giá trị, tự động tải và đọc mã ngay
    if (!activeCode) {
      const initSolve = await fetchCaptchaAndSolve();
      if (initSolve && initSolve.code) {
        activeKey = initSolve.key;
        activeCookie = initSolve.cookie;
        activeCode = initSolve.code;
      }
    }

    if (!activeCode) {
      setAuthError('Vui lòng nhìn hình ảnh và nhập mã Captcha vào ô bên cạnh.');
      if (captchaInputRef.current) captchaInputRef.current.focus();
      return;
    }

    // Tự động lặp lại nếu đăng nhập thất bại do Captcha sai hoặc hết hạn
    const MAX_LOGIN_RETRIES = 6;
    for (let attempt = 1; attempt <= MAX_LOGIN_RETRIES; attempt++) {
      const result = await onRunCrawler({
        taxCode: mst,
        password: pwd,
        captchaKey: activeKey,
        captchaCode: activeCode,
        captchaCookie: activeCookie,
        vietnamProxy: account.vietnamProxy,
        customApiKey: account.customApiKey,
        attemptNumber: attempt,
      });

      if (result && result.success) {
        setIsWafBlocked(false);
        if (onCollapseSidebar) onCollapseSidebar();
        if (onCloseMobileSidebar) onCloseMobileSidebar();
        return;
      }

      if (result && !result.success) {
        if (result.isWafBlocked) {
          setIsWafBlocked(true);
          return;
        }

        const errText = (result.error || '').toLowerCase();
        // Nếu sai mật khẩu hoặc tài khoản không tồn tại, dừng ngay không lặp tiếp
        if (errText.includes('mật khẩu') || errText.includes('tên đăng nhập')) {
          setAuthError(result.error);
          return;
        }
      }

      // Thất bại do CAPTCHA chưa chính xác hoặc hết hạn:
      // Tự động tải CAPTCHA mới, giải mã OCR cục bộ, gán mã ảnh vào và gửi tiếp
      if (attempt < MAX_LOGIN_RETRIES) {
        const nextSolve = await fetchCaptchaAndSolve();
        if (nextSolve && nextSolve.code) {
          activeKey = nextSolve.key;
          activeCookie = nextSolve.cookie;
          activeCode = nextSolve.code;
          await new Promise(r => setTimeout(r, 400));
        } else {
          break;
        }
      } else {
        setAuthError(`Đã thử tự động ${MAX_LOGIN_RETRIES} lần chưa vượt được Captcha. Vui lòng nhìn ảnh và nhập mã thủ công.`);
        fetchCaptchaAndSolve();
      }
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

          {/* Captcha Section: Hiển thị đầy đủ, rõ ràng để người dùng nhập hoặc nhận diện AI */}
          {account.isRealGDT ? (
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-2.5 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-medium">Phiên làm việc Cổng Thuế đang hoạt động</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onUpdateAccount({ ...account, isRealGDT: false });
                  fetchCaptcha();
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                Đăng nhập lại
              </button>
            </div>
          ) : (
            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                  <span>Mã Captcha Cổng Thuế</span>
                </span>

                {/* Nút bấm đọc OCR và gán vào */}
                <button
                  type="button"
                  onClick={() => handleScanOcr()}
                  disabled={isScanningOcr || isLoadingCaptcha || !captchaImg}
                  className="text-[11px] text-amber-300 hover:text-amber-200 font-medium flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30 transition-colors cursor-pointer disabled:opacity-40"
                  title="Quét ảnh Captcha và tự động gán ký tự vào ô bên dưới"
                >
                  <Sparkles className={`w-3 h-3 ${isScanningOcr ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
                  <span>{isScanningOcr ? 'Đang đọc...' : 'Đọc mã OCR'}</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {/* Khung ảnh Captcha thật */}
                  <div 
                    className="h-10 bg-white rounded-md flex items-center justify-center p-1 overflow-hidden border border-slate-600 hover:border-blue-400 cursor-pointer shadow-xs min-w-[120px] flex-1 relative group transition-colors"
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
                    <span className="absolute bottom-0 right-1 text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-1 rounded">Đổi ảnh</span>
                  </div>

                  {/* Ô Nhập Captcha */}
                  <div className="relative">
                    <input
                      ref={captchaInputRef}
                      type="text"
                      value={captchaCode}
                      onChange={(e) => {
                        setCaptchaCode(e.target.value.toUpperCase());
                        if (authError) setAuthError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSubmit();
                        }
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
                      <span className="truncate max-w-[170px]">{ocrNotice}</span>
                    </span>
                  ) : captchaCode ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Đã điền: <strong className="font-mono">{captchaCode}</strong></span>
                    </span>
                  ) : (
                    <span className="text-slate-400">Nhìn hình và nhập mã</span>
                  )}

                  <button
                    type="button"
                    onClick={fetchCaptcha}
                    disabled={isLoadingCaptcha || isScanningOcr}
                    className="text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                    title="Đổi ảnh Captcha mới"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingCaptcha ? 'animate-spin' : ''}`} />
                    <span>Đổi ảnh</span>
                  </button>
                </div>
              </div>
            </div>
          )}

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
            
            {/* Quick Period Buttons: Modern Segmented Switch (Mặc định năm hiện tại) */}
            {(() => {
              const currentYear = new Date().getFullYear();
              const prevYear = currentYear - 1;
              const twoYearsAgo = currentYear - 2;
              return (
                <div className="bg-slate-950/70 p-1 rounded-lg border border-slate-800 grid grid-cols-4 gap-1 mb-2.5">
                  <button
                    type="button"
                    onClick={() => onFilterChange({ ...filters, fromDate: `${currentYear}-01-01`, toDate: `${currentYear}-12-31` })}
                    className={`py-1 text-xs font-medium rounded-md transition-all text-center cursor-pointer ${
                      filters.fromDate === `${currentYear}-01-01` && filters.toDate === `${currentYear}-12-31`
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {currentYear}
                  </button>
                  <button
                    type="button"
                    onClick={() => onFilterChange({ ...filters, fromDate: `${prevYear}-01-01`, toDate: `${prevYear}-12-31` })}
                    className={`py-1 text-xs font-medium rounded-md transition-all text-center cursor-pointer ${
                      filters.fromDate === `${prevYear}-01-01` && filters.toDate === `${prevYear}-12-31`
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {prevYear}
                  </button>
                  <button
                    type="button"
                    onClick={() => onFilterChange({ ...filters, fromDate: `${twoYearsAgo}-01-01`, toDate: `${twoYearsAgo}-12-31` })}
                    className={`py-1 text-xs font-medium rounded-md transition-all text-center cursor-pointer ${
                      filters.fromDate === `${twoYearsAgo}-01-01` && filters.toDate === `${twoYearsAgo}-12-31`
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {twoYearsAgo}
                  </button>
                  <button
                    type="button"
                    onClick={() => onFilterChange({ ...filters, fromDate: '2022-01-01', toDate: `${currentYear}-12-31` })}
                    className={`py-1 text-xs font-medium rounded-md transition-all text-center cursor-pointer ${
                      filters.fromDate === '2022-01-01'
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    Tất cả
                  </button>
                </div>
              );
            })()}

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

          <div className="space-y-2 rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={account.includeElectronicInvoices ?? true}
                onChange={event => onUpdateAccount({ ...account, includeElectronicInvoices: event.target.checked })}
                className="h-4 w-4 accent-blue-500"
              />
              <span>Hóa đơn điện tử</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={account.includePosInvoices ?? true}
                onChange={event => onUpdateAccount({ ...account, includePosInvoices: event.target.checked })}
                className="h-4 w-4 accent-blue-500"
              />
              <span>Hóa đơn máy tính tiền</span>
            </label>
            {!(account.includeElectronicInvoices ?? true) && !(account.includePosInvoices ?? true) && (
              <p className="text-[11px] text-amber-300">Chọn ít nhất một loại hóa đơn để bắt đầu tra cứu.</p>
            )}
          </div>

          {/* Primary Action Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading || (!(account.includeElectronicInvoices ?? true) && !(account.includePosInvoices ?? true))}
              className="btn-primary-accent w-full flex items-center justify-center gap-2 cursor-pointer shadow-sm py-2.5 text-xs font-semibold rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
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
      </div>
    </aside>
  );
};
