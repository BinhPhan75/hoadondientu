import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { preprocessPosCaptchaImage } from '../utils/captchaOcrHelper';
import { solveCaptchaWithTesseract } from '../services/invoice-engine/captcha/tesseractCaptchaSolver';

interface PosCaptchaModalProps {
  captchaImage: string;
  rangeLabel: string;
  isOpen: boolean;
  onCancel: () => void;
  onSubmit: (code: string) => void;
}

/** Human verification for a single GDT POS query with Local OCR Auto-solve. */
export const PosCaptchaModal: React.FC<PosCaptchaModalProps> = ({
  captchaImage,
  rangeLabel,
  isOpen,
  onCancel,
  onSubmit,
}) => {
  const [code, setCode] = useState('');
  const [isSolving, setIsSolving] = useState(false);
  const [statusText, setStatusText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Tự động kích hoạt nhận diện OCR ngay khi mở modal hoặc có ảnh CAPTCHA mới
  useEffect(() => {
    if (!isOpen || !captchaImage) return;
    setCode('');
    setStatusText('Đang tự động đọc mã CAPTCHA...');
    setIsSolving(true);

    let isMounted = true;

    const runAutoOcr = async () => {
      try {
        // 1. Tiền xử lý ảnh (khử nhiễu, làm sắc nét ký tự)
        const cleanImage = await preprocessPosCaptchaImage(captchaImage);

        // 2. Chạy Tesseract local OCR trên trình duyệt
        const result = await solveCaptchaWithTesseract(cleanImage, {
          digitsOnly: false,
          timeoutMs: 8000
        });

        if (isMounted) {
          if (result && result.code) {
            const detectedCode = result.code.trim().toUpperCase();
            setCode(detectedCode);
            setStatusText(`Đã nhận diện thành công: ${detectedCode}`);
            
            // Tự động điền xong và submit luôn sau 300ms để không gián đoạn luồng 10 tháng
            window.setTimeout(() => {
              if (isMounted && detectedCode) {
                onSubmit(detectedCode);
              }
            }, 300);
          } else {
            setStatusText('Không tự đọc được, vui lòng nhập tay.');
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }
        }
      } catch (err) {
        if (isMounted) {
          setStatusText('Lỗi OCR tự động, vui lòng nhập tay.');
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }
      } finally {
        if (isMounted) {
          setIsSolving(false);
        }
      }
    };

    runAutoOcr();

    return () => {
      isMounted = false;
    };
  }, [isOpen, captchaImage]);

  if (!isOpen) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = code.trim();
    if (value) onSubmit(value);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <h2 className="text-base font-semibold text-white">Xác nhận CAPTCHA hóa đơn máy tính tiền</h2>
        <p className="mt-1 text-sm text-slate-300">Đợt truy vấn: {rangeLabel}</p>
        <p className="mt-3 text-xs leading-5 text-slate-400">
          Tổng cục Thuế yêu cầu mã mới cho từng đợt. Hệ thống đang tự động nhận diện mã CAPTCHA để tiếp tục tải.
        </p>

        {/* Khung hiển thị ảnh CAPTCHA */}
        <div className="mt-4 flex min-h-20 items-center justify-center rounded border border-slate-700 bg-white p-2 relative">
          <img src={captchaImage} alt="CAPTCHA Tổng cục Thuế" className="max-h-20 max-w-full select-none" />
          {isSolving && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center gap-2 text-xs font-medium text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Đang giải mã AI...</span>
            </div>
          )}
        </div>

        {/* Trạng thái OCR */}
        <div className="mt-2 text-[11px] text-cyan-400 font-mono flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>{statusText || 'Sẵn sàng'}</span>
        </div>

        <label className="mt-3 block text-sm font-medium text-slate-200" htmlFor="pos-captcha-code">Mã CAPTCHA</label>
        <input
          ref={inputRef}
          id="pos-captcha-code"
          value={code}
          onChange={event => setCode(event.target.value.toUpperCase())}
          autoComplete="off"
          maxLength={12}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono tracking-[0.2em] text-white outline-none focus:border-cyan-400 text-center font-bold text-base"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 cursor-pointer">Hủy đợt này</button>
          <button type="submit" disabled={!code.trim() || isSolving} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">Xác nhận và tải</button>
        </div>
      </form>
    </div>
  );
};
