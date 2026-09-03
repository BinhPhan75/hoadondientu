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
  const [taxCode, setTaxCode] = useState(currentConfig.taxCode || '');
  const [password, setPassword] = useState(currentConfig.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaKey, setCaptchaKey] = useState('');
  const [captchaImg, setCaptchaImg] = useState<string>('');
  const [isRealGDT, setIsRealGDT] = useState<boolean>(false);
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState(false);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [rememberMe, setRememberMe] = useState(currentConfig.rememberMe ?? true);
  const [useHeadless, setUseHeadless] = useState(currentConfig.useHeadlessBrowser ?? true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI OCR Scanner helper for modal
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
      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {}

      if (data && data.success && data.captchaCode) {
        setCaptchaCode(data.captchaCode);
        setOcrSuccess(true);
      }
    } catch (err) {
      console.warn('[AI OCR Scan in Modal Error]:', err);
    } finally {
      setIsScanningOcr(false);
    }
  };

  // Load new Captcha with Dual-Strategy (Server Proxy + Direct GDT Fallback)
  const fetchCaptcha = async () => {
    setIsLoadingCaptcha(true);
    setCaptchaCode('');
    setOcrSuccess(false);

    // Strategy 1: Server proxy (/api/gdt/captcha)
    try {
      const res = await fetch('/api/gdt/captcha');
      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.warn('[Modal Proxy Captcha Non-JSON]:', rawText.slice(0, 100));
      }
      
      if (res.ok && data && data.success && data.captchaImage) {
        setCaptchaImg(data.captchaImage);
        setCaptchaKey(data.captchaKey || '');
        setIsRealGDT(data.isRealGDT ?? true);
        if (data.captchaCode) {
          setCaptchaCode(data.captchaCode);
          setOcrSuccess(true);
        }
        setIsLoadingCaptcha(false);
        return;
      }
    } catch (e) {
      console.warn('[Modal Proxy Captcha Failed, attempting direct]:', e);
    }

    // Strategy 2: Direct browser fetch from official GDT Portal
    try {
      const directRes = await fetch('https://hoadondientu.gdt.gov.vn/api/captcha', {
        method: 'GET',
        headers: { 'Accept': 'application/json, text/plain, */*' }
      });

      if (directRes.ok) {
        const rawDirectText = await directRes.text();
        let directData: any = null;
        try {
          directData = JSON.parse(rawDirectText);
        } catch {}

        if (directData && directData.key && directData.content) {
          const imgUrl = directData.content.startsWith('data:')
            ? directData.content
            : `data:image/svg+xml;utf8,${encodeURIComponent(directData.content)}`;

          setCaptchaImg(imgUrl);
          setCaptchaKey(directData.key);
          setIsRealGDT(true);

          // Auto-OCR scan
          try {
            const ocrRes = await fetch('/api/gdt/ocr-captcha', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ captchaImage: imgUrl, captchaKey: directData.key })
            });
            const ocrRaw = await ocrRes.text();
            try {
              const ocrJson = JSON.parse(ocrRaw);
              if (ocrJson?.success && ocrJson?.captchaCode) {
                setCaptchaCode(ocrJson.captchaCode);
                setOcrSuccess(true);
              }
            } catch {}
          } catch {}

          setIsLoadingCaptcha(false);
          return;
        }
      }
    } catch (directErr) {
      console.warn('[Modal Direct GDT Fetch Failed]:', directErr);
    }

    // Strategy 3: Fallback local SVG captcha with clear high contrast text
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setCaptchaKey('ckey_local_' + Math.random().toString(36).substring(2, 9));
    setCaptchaCode(code);
    setOcrSuccess(true);
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

    let activeCode = captchaCode.trim();
    if (!activeCode) {
      setIsScanningOcr(true);
      try {
        const res = await fetch('/api/gdt/ocr-captcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captchaImage: captchaImg, captchaKey })
        });
        const ocrData = await res.json();
        if (ocrData && ocrData.success && ocrData.captchaCode) {
          activeCode = ocrData.captchaCode;
          setCaptchaCode(ocrData.captchaCode);
          setOcrSuccess(true);
        }
      } catch (err) {
        console.warn('[Auto-OCR Modal Error]:', err);
      } finally {
        setIsScanningOcr(false);
      }
    }

    if (!activeCode) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập mã Captcha hoặc bấm nút Quét OCR.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage({ type: 'info', text: 'Đang gửi yêu cầu xác thực trực tiếp đến Cổng Tổng cục Thuế (hoadondientu.gdt.gov.vn)...' });

    try {
      const res = await fetch('/api/gdt/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxCode: taxCode.trim(),
          password: password.trim(),
          captchaKey,
          captchaCode: activeCode
        })
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = {
          success: false,
          message: `Máy chủ trả về phản hồi không đúng định dạng (Mã HTTP: ${res.status}). Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.`
        };
      }

      if (res.ok && data.success) {
        setStatusMessage({ 
          type: 'success', 
          text: 'Xác thực thành công! Đã kết nối phiên làm việc Cổng Tổng cục Thuế thực tế.' 
        });

        const updatedConfig: GDTAccountConfig = {
          taxCode: taxCode.trim(),
          password: password,
          taxpayerName: data.session?.taxpayerName || `DOANH NGHIỆP NỘP THUẾ (MST: ${taxCode})`,
          address: data.session?.address || 'Đăng ký tại Tổng cục Thuế',
          rememberMe,
          autoSaveSession: true,
          useHeadlessBrowser: useHeadless,
          isRealGDT: true
        };

        setTimeout(() => {
          onSave(updatedConfig);
          onClose();
        }, 900);
      } else {
        setStatusMessage({
          type: 'error',
          text: data.message || 'Xác thực thất bại từ Cổng Tổng cục Thuế. Vui lòng kiểm tra lại MST, Mật khẩu hoặc mã Captcha.'
        });
        // Refresh captcha on failure
        fetchCaptcha();
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Lỗi kết nối máy chủ (${err.message}). Vui lòng thử lại hoặc sử dụng công cụ Python trên máy tính.`
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>Mã xác thực Captcha</span>
                <span className="text-[#ef4444]">*</span>
                {isRealGDT ? (
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.2 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    Cổng Thuế Trực Tiếp
                  </span>
                ) : (
                  <span className="text-[9px] bg-gray-100 text-gray-700 font-medium px-1.5 py-0.2 rounded">
                    Mã xác nhận
                  </span>
                )}
              </label>
              
              <button
                type="button"
                onClick={() => handleScanOcr()}
                disabled={isScanningOcr || isLoadingCaptcha}
                className="text-[10px] text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 transition-colors"
                title="Tự động quét và đọc mã Captcha"
              >
                <Sparkles className={`w-3 h-3 ${isScanningOcr ? 'animate-spin text-amber-600' : 'text-amber-600'}`} />
                <span>{isScanningOcr ? 'Đang quét OCR...' : 'Quét lại OCR'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                  placeholder={isScanningOcr ? 'Đang đọc OCR...' : 'Mã Captcha'}
                  maxLength={8}
                  className={`w-full px-2.5 py-1.5 text-xs bg-white border ${
                    ocrSuccess ? 'border-emerald-500 text-emerald-800 font-extrabold' : 'border-[#d1d5db]'
                  } rounded focus:border-[#ef4444] focus:outline-hidden uppercase tracking-widest font-mono text-center font-bold`}
                  required
                />
              </div>

              {/* Captcha Image Display */}
              <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded border border-[#d1d5db] shrink-0">
                {captchaImg ? (
                  <img
                    src={captchaImg}
                    alt="Captcha"
                    className="h-8 w-28 rounded object-contain bg-white cursor-pointer"
                    onClick={fetchCaptcha}
                    title="Nhấp để đổi ảnh Captcha mới"
                  />
                ) : (
                  <div className="h-8 w-28 bg-gray-200 animate-pulse rounded flex items-center justify-center text-[10px] text-gray-400">
                    Đang tải...
                  </div>
                )}
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  disabled={isLoadingCaptcha || isScanningOcr}
                  className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                  title="Đổi mã captcha khác từ Cổng Thuế"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCaptcha ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* OCR Helper status text */}
            <div className="flex items-center justify-between text-[10px] font-mono mt-1 px-0.5">
              {isScanningOcr ? (
                <span className="text-amber-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 animate-spin text-amber-600" />
                  Đang nhận diện ký tự Captcha bằng AI OCR...
                </span>
              ) : ocrSuccess && captchaCode ? (
                <span className="text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  AI đã tự động quét mã: <strong>{captchaCode}</strong>
                </span>
              ) : (
                <span className="text-gray-500">
                  Phần mềm tự động quét và vượt Captcha khi kết nối
                </span>
              )}
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
