import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { preprocessPosCaptchaImage, solveCaptchaWithClientTemplateMatching } from '../utils/captchaOcrHelper';

interface PosCaptchaModalProps {
  captchaImage: string;
  rangeLabel: string;
  isOpen: boolean;
  onCancel: () => void;
  onSubmit: (code: string) => void;
}

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
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !captchaImage) return;
    setCode('');
    submittedRef.current = false;
    setStatusText('Đang tự động nhận diện mã CAPTCHA...');
    setIsSolving(true);

    let isMounted = true;

    const solveCaptchaAutomatically = async () => {
      let candidateCode = '';

      try {
        // 1. Thử giải nhanh bằng Template Matching trực tiếp trên Client
        try {
          const tmRes = await solveCaptchaWithClientTemplateMatching(captchaImage, {
            minConfidenceThreshold: 45,
          });

          if (isMounted && tmRes.code && tmRes.code.length >= 4) {
            candidateCode = tmRes.code;

            if (tmRes.success && !tmRes.needsFallback && tmRes.confidence >= 48) {
              setCode(tmRes.code);
              setStatusText(`Template Matching tự động giải: ${tmRes.code} (${tmRes.confidence}%)`);
              setIsSolving(false);
              if (!submittedRef.current) {
                submittedRef.current = true;
                window.setTimeout(() => {
                  if (isMounted) onSubmit(tmRes.code);
                }, 300);
              }
              return;
            }
          }
        } catch {
          // Bỏ qua và chuyển sang Tesseract local
        }

        if (isMounted) setStatusText('Đang quét qua Tesseract OCR Local...');
        const cleanImage = await preprocessPosCaptchaImage(captchaImage);
        const response = await fetch('/api/invoice-downloader/solve-captcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: cleanImage,
            alphanumeric: true,
            localOnly: true,
            preprocess: false,
            timeoutMs: 15000,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (isMounted) {
          if (response.ok && data?.success && data.code) {
            const detectedCode = String(data.code).trim().toUpperCase();
            candidateCode = detectedCode;
            setCode(detectedCode);
            setStatusText(`Tesseract Local nhận diện: ${detectedCode}`);
            setIsSolving(false);

            if (!submittedRef.current) {
              submittedRef.current = true;
              window.setTimeout(() => {
                if (isMounted) {
                  onSubmit(detectedCode);
                }
              }, 300);
            }
          } else {
            // Nếu có mã dự đoán từ Template Matching, tự động điền sẵn để người dùng chỉ cần kiểm tra
            if (candidateCode) {
              setCode(candidateCode);
              setStatusText(`Đã điền sẵn mã dự đoán "${candidateCode}". Vui lòng kiểm tra và bấm "Xác nhận và tải".`);
            } else {
              setStatusText('Không tự động nhận diện được, vui lòng nhập mã bên dưới.');
            }
            setIsSolving(false);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }
        }
      } catch (err) {
        if (isMounted) {
          if (candidateCode) {
            setCode(candidateCode);
            setStatusText(`Đã điền sẵn mã gợi ý "${candidateCode}". Vui lòng kiểm tra lại.`);
          } else {
            setStatusText('Vui lòng nhập mã CAPTCHA hiển thị trong ảnh.');
          }
          setIsSolving(false);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }
      }
    };

    solveCaptchaAutomatically();

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

        <div className="mt-4 flex min-h-20 items-center justify-center rounded border border-slate-700 bg-white p-2 relative">
          <img src={captchaImage} alt="CAPTCHA Tổng cục Thuế" className="max-h-20 max-w-full select-none" />
          {isSolving && (
            <div className="absolute inset-0 bg-white/90 flex items-center justify-center gap-2 text-xs font-semibold text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Đang đọc mã CAPTCHA tự động...</span>
            </div>
          )}
        </div>

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
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono tracking-[0.2em] text-white outline-none focus:border-cyan-400 text-center font-bold text-base uppercase"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 cursor-pointer">Hủy đợt này</button>
          <button type="submit" disabled={!code.trim() || isSolving} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">Xác nhận và tải</button>
        </div>
      </form>
    </div>
  );
};
