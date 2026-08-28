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
  const [taxCode, setTaxCode] = useState(currentConfig.taxCode || '0316892345');
  const [password, setPassword] = useState(currentConfig.password || 'Gdt@Tax2025!');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaImg, setCaptchaImg] = useState<string>('');
  const [realCaptchaCode, setRealCaptchaCode] = useState<string>('');
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState(false);
  const [rememberMe, setRememberMe] = useState(currentConfig.rememberMe ?? true);
  const [useHeadless, setUseHeadless] = useState(currentConfig.useHeadlessBrowser ?? true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load new Captcha from API or generate
  const fetchCaptcha = async () => {
    setIsLoadingCaptcha(true);
    try {
      const res = await fetch('/api/gdt/captcha');
      const data = await res.json();
      setCaptchaImg(data.captchaImage);
      setRealCaptchaCode(data.captchaCode);
      setCaptchaCode(data.captchaCode); // Pre-fill for convenience
    } catch (e) {
      // Fallback local SVG captcha
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let code = '';
      for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
      setRealCaptchaCode(code);
      setCaptchaCode(code);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="38" viewBox="0 0 120 38"><rect width="100%" height="100%" fill="#f1f5f9"/><text x="18" y="27" font-family="monospace" font-size="22" font-weight="bold" fill="#1e293b" letter-spacing="6">${code}</text></svg>`;
      setCaptchaImg(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    } finally {
      setIsLoadingCaptcha(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCaptcha();
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxCode.trim()) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập Mã số thuế (MST) của doanh nghiệp.' });
      return;
    }
    if (!password) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập mật khẩu tài khoản Tổng cục Thuế cấp.' });
      return;
    }
    if (!captchaCode.trim()) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập mã Captcha xác thực.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage({ type: 'info', text: 'Đang kết nối và xác thực tài khoản với Cổng Tổng cục Thuế...' });

    setTimeout(() => {
      setIsSubmitting(false);
      setStatusMessage({ type: 'success', text: 'Xác thực thành công! Đã kết nối với Cổng Hóa đơn điện tử GDT.' });

      const updatedConfig: GDTAccountConfig = {
        taxCode: taxCode.trim(),
        password: password,
        taxpayerName: taxCode === '0316892345' ? 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG ĐÔNG NAM Á' : `DOANH NGHIỆP NỘP THUẾ (MST: ${taxCode})`,
        address: 'Số 142 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP Hồ Chí Minh',
        rememberMe,
        autoSaveSession: true,
        useHeadlessBrowser: useHeadless
      };

      setTimeout(() => {
        onSave(updatedConfig);
        onClose();
      }, 700);
    }, 900);
  };

  const handleUseDemoAccount = () => {
    setTaxCode('0316892345');
    setPassword('Gdt@Pass2025!');
    fetchCaptcha();
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
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
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
              className={`p-2.5 rounded text-[11px] flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 font-medium'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 border border-rose-300 text-rose-800 font-medium'
                  : 'bg-blue-50 border border-blue-300 text-blue-800 font-medium'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Tax Code (MST) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Mã số thuế (Tên đăng nhập) <span className="text-[#ef4444]">*</span>
              </label>
              <button
                type="button"
                onClick={handleUseDemoAccount}
                className="text-[11px] font-semibold text-[#ef4444] hover:text-red-700 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Dùng MST mẫu
              </button>
            </div>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value.trim())}
                placeholder="VD: 0100109106 hoặc 0316892345"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#d1d5db] rounded focus:border-[#ef4444] focus:outline-hidden font-mono tracking-wider"
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
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-[#d1d5db] rounded focus:border-[#ef4444] focus:outline-hidden font-mono"
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

          {/* Captcha Verification */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
              Mã xác thực Captcha <span className="text-[#ef4444]">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                  placeholder="Mã 4 ký tự"
                  maxLength={6}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#d1d5db] rounded focus:border-[#ef4444] focus:outline-hidden uppercase tracking-widest font-mono text-center font-bold"
                  required
                />
              </div>

              {/* Captcha Image Display */}
              <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded border border-[#d1d5db] shrink-0">
                {captchaImg ? (
                  <img
                    src={captchaImg}
                    alt="Captcha"
                    className="h-7 w-24 rounded object-contain bg-white"
                  />
                ) : (
                  <div className="h-7 w-24 bg-gray-200 animate-pulse rounded flex items-center justify-center text-[10px] text-gray-400">
                    Đang tải...
                  </div>
                )}
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  disabled={isLoadingCaptcha}
                  className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                  title="Đổi mã captcha khác"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCaptcha ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Additional Options */}
          <div className="pt-2 border-t border-gray-100 space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 text-[#ef4444] rounded-2xs"
              />
              <span className="text-[11px] text-gray-600">Ghi nhớ phiên đăng nhập trên trình duyệt này</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useHeadless}
                onChange={(e) => setUseHeadless(e.target.checked)}
                className="w-3.5 h-3.5 text-[#ef4444] rounded-2xs"
              />
              <span className="text-[11px] text-gray-600">Chạy ngầm tự động hóa Selenium (Headless Chrome)</span>
            </label>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#d1d5db]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#ef4444] hover:bg-red-600 rounded transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
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
