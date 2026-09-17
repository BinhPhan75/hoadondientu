import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  KeyRound, 
  ShieldCheck, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { GDTAccountConfig } from '../types';
import { convertSvgToSharpPng } from '../utils/captchaOcrHelper';
import { executeGdtCaptcha, executeGdtLogin } from '../utils/gdtQueryClient';

interface AccountConfigModalProps {
  isOpen: boolean;
  currentConfig: GDTAccountConfig;
  onSave: (config: GDTAccountConfig) => void;
  onClose: () => void;
}

export const AccountConfigModal: React.FC<AccountConfigModalProps> = ({
  isOpen,
  currentConfig,
  onSave,
  onClose,
}) => {
  const [taxCode, setTaxCode] = useState(currentConfig.taxCode || '');
  const [password, setPassword] = useState(currentConfig.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaKey, setCaptchaKey] = useState('');
  const [captchaCookie, setCaptchaCookie] = useState('');
  const [captchaImg, setCaptchaImg] = useState<string>('');
  const [isRealGDT, setIsRealGDT] = useState<boolean>(false);
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState(false);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [ocrNotice, setOcrNotice] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(currentConfig.rememberMe ?? true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI OCR Scanner: Nhận diện mã Captcha và gán trực tiếp vào ô input
  const handleScanOcr = async (imgToScan?: string, keyToScan?: string) => {
    const rawImg = imgToScan || captchaImg;
    const targetKey = keyToScan || captchaKey;
    if (!rawImg && !targetKey) return;

    setIsScanningOcr(true);
    setOcrSuccess(false);
    setOcrNotice(null);
    try {
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
      } catch {}

      if (data && data.success && data.captchaCode) {
        setCaptchaCode(data.captchaCode);
        setOcrSuccess(true);
        setOcrNotice(`Đã đọc được mã: ${data.captchaCode}`);
        if (statusMessage) setStatusMessage(null);
      } else {
        setOcrNotice('Không thể đọc tự động ảnh này, vui lòng nhập tay.');
      }
    } catch {
      setOcrNotice('Lỗi khi đọc OCR, vui lòng nhìn hình và nhập thủ công.');
    } finally {
      setIsScanningOcr(false);
    }
  };

  // Load new Captcha from GDT
  const fetchCaptcha = async () => {
    setIsLoadingCaptcha(true);
    setCaptchaCode('');
    setOcrSuccess(false);
    setOcrNotice(null);

    const res = await executeGdtCaptcha();
    if (res.success && res.captchaImage) {
      setCaptchaImg(res.captchaImage);
      setCaptchaKey(res.captchaKey || '');
      setCaptchaCookie(res.captchaCookie || '');
      setIsRealGDT(true);
      setIsLoadingCaptcha(false);
      return;
    }

    // Fallback local SVG captcha
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setCaptchaKey('ckey_local_' + Math.random().toString(36).substring(2, 9));
    setCaptchaCode('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="38" viewBox="0 0 120 38"><rect width="100%" height="100%" fill="#f1f5f9"/><line x1="10" y1="12" x2="110" y2="28" stroke="#cbd5e1" stroke-width="2"/><text x="18" y="27" font-family="monospace, sans-serif" font-size="22" font-weight="bold" fill="#1e293b" letter-spacing="6">${code}</text></svg>`;
    setCaptchaImg(`data:image/svg+xml;base64,${btoa(svg)}`);
    setIsRealGDT(false);
    setIsLoadingCaptcha(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchCaptcha();
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxCode.trim()) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập Mã số thuế (MST) của doanh nghiệp.' });
      return;
    }
    if (!password) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập mật khẩu tài khoản Tổng cục Thuế cấp.' });
      return;
    }

    const activeCode = captchaCode.trim();
    if (!activeCode) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhìn hình và nhập mã Captcha (4-6 ký tự) hoặc bấm "Đọc mã OCR" để gán vào.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage({ 
      type: 'info', 
      text: 'Đang gửi yêu cầu xác thực đến Cổng Tổng cục Thuế (hoadondientu.gdt.gov.vn)...' 
    });

    try {
      const loginResult = await executeGdtLogin({
        taxCode: taxCode.trim(),
        password: password.trim(),
        captchaKey: captchaKey || undefined,
        captchaCode: activeCode,
        captchaCookie: captchaCookie || undefined
      });

      if (loginResult.success && loginResult.token) {
        setStatusMessage({ 
          type: 'success', 
          text: 'Xác thực thành công! Đã kết nối phiên làm việc Cổng Thuế.' 
        });

        const updatedConfig: GDTAccountConfig = {
          taxCode: taxCode.trim(),
          password: password,
          taxpayerName: loginResult.taxpayerName || `DOANH NGHIỆP NỘP THUẾ (MST: ${taxCode})`,
          address: loginResult.address || 'Đăng ký tại Tổng cục Thuế',
          rememberMe,
          autoSaveSession: true,
          isRealGDT: true,
          autoSolveCaptcha: false
        };

        setTimeout(() => {
          onSave(updatedConfig);
          onClose();
        }, 900);
      } else {
        if (loginResult.isWafBlocked) {
          setStatusMessage({
            type: 'error',
            text: 'Cổng Thuế tạm thời từ chối kết nối IP (HTTP 403 Forbidden). Vui lòng thử lại sau giây lát.'
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: loginResult.error || 'Xác thực thất bại từ Cổng Tổng cục Thuế. Vui lòng kiểm tra lại MST, Mật khẩu hoặc mã Captcha.'
          });
        }
        fetchCaptcha();
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Lỗi kết nối máy chủ (${err.message}). Vui lòng thử lại.`
      });
      fetchCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded max-w-lg w-full shadow-2xl border border-[#d1d5db] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="bg-[#111827] text-white px-5 py-3.5 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#ef4444]" />
            <div>
              <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                CẤU HÌNH TÀI KHOẢN TỔNG CỤC THUẾ
              </h3>
              <p className="text-[11px] text-gray-400">
                Đăng nhập Cổng Hóa đơn điện tử hoadondientu.gdt.gov.vn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Information box */}
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-amber-950 uppercase">Lưu ý bảo mật:</p>
              <p className="text-amber-800">
                Sử dụng tài khoản và mật khẩu được Tổng cục Thuế cấp khi đăng ký sử dụng HĐĐT theo Nghị định 123/2020/NĐ-CP.
              </p>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`p-2.5 rounded text-[11px] flex flex-col gap-1.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 font-medium'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 border border-rose-300 text-rose-800 font-medium'
                  : 'bg-blue-50 border border-blue-300 text-blue-800 font-medium'
              }`}
            >
              <div className="flex items-start gap-2">
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="flex-1 leading-snug">{statusMessage.text}</span>
              </div>
            </div>
          )}

          {/* Tax Code (MST) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Mã số thuế (Tên đăng nhập) <span className="text-[#ef4444]">*</span>
              </label>
            </div>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value.trim())}
                placeholder="VD: 0100109106 hoặc 4000926165"
                className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#d1d5db] rounded focus:border-[#ef4444] focus:outline-hidden font-mono tracking-wider text-gray-900"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
              Mật khẩu do Tổng cục Thuế cấp <span className="text-[#ef4444]">*</span>
            </label>
            <div className="relative">
              <KeyRound className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full pl-8 pr-8 py-2 text-xs bg-white border border-[#d1d5db] rounded focus:border-[#ef4444] focus:outline-hidden font-mono text-gray-900"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Captcha Verification: Nhập thủ công hoặc bấm OCR để đọc gán vào */}
          <div className="border border-gray-200 p-3 rounded-md bg-gray-50/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>Mã xác thực Captcha</span>
                <span className="text-[#ef4444]">*</span>
              </label>

              {/* Nút bấm đọc OCR và gán vào */}
              <button
                type="button"
                onClick={() => handleScanOcr()}
                disabled={isScanningOcr || isLoadingCaptcha || !captchaImg}
                className="text-[11px] text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded border border-amber-300 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                title="Sử dụng OCR để nhận diện mã Captcha và tự động gán vào ô nhập"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isScanningOcr ? 'animate-spin text-amber-600' : 'text-amber-700'}`} />
                <span>{isScanningOcr ? 'Đang đọc OCR...' : 'Đọc mã OCR (Gán vào)'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Captcha Image Display with Click to Refresh */}
              <div 
                className="flex items-center gap-1 bg-white p-1 rounded border border-[#d1d5db] shrink-0 cursor-pointer shadow-2xs hover:border-gray-400 transition-colors"
                onClick={fetchCaptcha}
                title="Nhấp vào hình để đổi mã Captcha khác"
              >
                {captchaImg ? (
                  <img
                    src={captchaImg}
                    alt="Captcha Tổng cục Thuế"
                    className="h-9 w-32 rounded object-contain bg-white select-none"
                  />
                ) : (
                  <div className="h-9 w-32 bg-gray-200 animate-pulse rounded flex items-center justify-center text-[10px] text-gray-400">
                    Đang tải...
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchCaptcha();
                  }}
                  disabled={isLoadingCaptcha || isScanningOcr}
                  className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                  title="Đổi mã captcha khác từ Cổng Thuế"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCaptcha ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Ô Nhập Thủ Công (hoặc được OCR gán vào) */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={captchaCode}
                  onChange={(e) => {
                    setCaptchaCode(e.target.value.toUpperCase());
                    if (statusMessage) setStatusMessage(null);
                  }}
                  placeholder="Nhập mã ảnh..."
                  maxLength={8}
                  className={`w-full px-3 py-2 text-sm bg-white border ${
                    ocrSuccess ? 'border-emerald-500 text-emerald-800 font-extrabold' : 'border-[#d1d5db] text-gray-900'
                  } rounded focus:border-[#ef4444] focus:outline-hidden uppercase tracking-widest font-mono text-center font-bold shadow-2xs`}
                  required
                />
              </div>
            </div>

            {/* Helper status text */}
            <div className="flex items-center justify-between text-[11px] font-mono px-0.5">
              {ocrNotice ? (
                <span className={ocrSuccess ? 'text-emerald-700 font-semibold flex items-center gap-1' : 'text-amber-800'}>
                  {ocrSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  {ocrNotice}
                </span>
              ) : captchaCode ? (
                <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Mã đang nhập: <strong>{captchaCode}</strong> (có thể sửa nếu cần)
                </span>
              ) : (
                <span className="text-gray-500">
                  Nhìn hình để nhập tay hoặc bấm <strong>"Đọc mã OCR"</strong> để tự động gán.
                </span>
              )}
            </div>
          </div>

          {/* Ghi nhớ tài khoản */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 text-[#ef4444] rounded-2xs"
              />
              <span className="text-[11px] text-gray-600">Ghi nhớ cấu hình tài khoản trên trình duyệt</span>
            </label>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#d1d5db]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-[#ef4444] hover:bg-red-600 rounded transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang kết nối GDT...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Lưu & Kết Nối CQT</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
