import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Cpu, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';

interface VisnamCaptchaModalProps {
  isOpen: boolean;
  image: string;
  code: string;
  error: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isOcrRunning?: boolean;
  onCodeChange: (value: string) => void;
  onRefresh: () => void;
  onAutoSolve?: () => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export const VisnamCaptchaModal: React.FC<VisnamCaptchaModalProps> = ({
  isOpen,
  image,
  code,
  error,
  isLoading,
  isSubmitting,
  isOcrRunning,
  onCodeChange,
  onRefresh,
  onAutoSolve,
  onCancel,
  onSubmit,
}) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [autoSubmittedCode, setAutoSubmittedCode] = useState<string | null>(null);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);

  const busy = isLoading || isSubmitting || Boolean(isOcrRunning);
  const is4Digits = /^\d{4}$/.test(code.trim());

  // Tự động nhận diện OCR nội bộ ngay khi có ảnh mà chưa có mã
  useEffect(() => {
    if (!isOpen || !image || isLoading || isSubmitting || isOcrRunning) return;
    if (!code.trim() && onAutoSolve) {
      const timer = setTimeout(() => {
        onAutoSolve();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, image, code, isLoading, isSubmitting, isOcrRunning, onAutoSolve]);

  // Tự động xác nhận khi đã nhận diện đủ 4 số (không cần người dùng bấm chuột hay gõ phím)
  useEffect(() => {
    if (!isOpen || busy || !is4Digits || error) {
      setIsAutoSubmitting(false);
      return;
    }

    const currentCode = code.trim();
    if (autoSubmittedCode === currentCode) return;

    setIsAutoSubmitting(true);
    const timer = setTimeout(() => {
      setAutoSubmittedCode(currentCode);
      if (formRef.current) {
        formRef.current.requestSubmit();
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      setIsAutoSubmitting(false);
    };
  }, [isOpen, busy, is4Digits, code, error, autoSubmittedCode]);

  // Reset trạng thái auto-submit khi đổi ảnh CAPTCHA
  useEffect(() => {
    if (image) {
      setAutoSubmittedCode(null);
    }
  }, [image]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl transition-all"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              Tự động nhận diện CAPTCHA VIN-HOADON
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              Sử dụng công nghệ OCR nội bộ (không dùng AI/Gemini). Phần mềm tự điền và xác nhận tải PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Đóng"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Khung ảnh CAPTCHA */}
        <div className="mt-4 flex min-h-24 items-center justify-center rounded-lg border border-slate-700 bg-white p-2.5 relative overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center gap-1.5 py-3">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
              <span className="text-xs text-slate-600 font-medium">Đang tải mã CAPTCHA mới...</span>
            </div>
          ) : image ? (
            <img src={image} alt="CAPTCHA VIN-HOADON" className="max-h-20 max-w-full select-none" />
          ) : (
            <span className="text-sm text-slate-500">Chưa có ảnh CAPTCHA</span>
          )}

          {isOcrRunning && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center gap-2 text-cyan-300 font-medium text-xs">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <span>OCR nội bộ đang giải mã...</span>
            </div>
          )}
        </div>

        {/* Trạng thái & hành động */}
        <div className="mt-2.5 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-cyan-300 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Đổi CAPTCHA khác
          </button>

          {onAutoSolve && image && !isOcrRunning && (
            <button
              type="button"
              onClick={onAutoSolve}
              disabled={busy}
              className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Nhận diện lại OCR
            </button>
          )}
        </div>

        {/* Trạng thái nhận diện và tự điền */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="visnam-captcha-code" className="font-medium text-slate-200">
              Mã CAPTCHA (tự điền):
            </label>
            {isOcrRunning ? (
              <span className="text-cyan-400 font-medium inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Đang quét bằng OCR...
              </span>
            ) : is4Digits ? (
              <span className="text-emerald-400 font-medium inline-flex items-center gap-1 animate-pulse">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isAutoSubmitting ? 'Đang tự động xác nhận...' : 'Đã nhận diện thành công'}
              </span>
            ) : null}
          </div>

          <input
            id="visnam-captcha-code"
            value={code}
            onChange={event => onCodeChange(event.target.value)}
            onFocus={event => event.target.select()}
            autoComplete="off"
            autoFocus
            maxLength={4}
            placeholder="0000"
            className={`w-full rounded-lg border bg-slate-950 px-3 py-2.5 text-center font-mono text-xl font-black uppercase tracking-[0.3em] outline-none transition-colors ${
              is4Digits
                ? 'border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'border-slate-700 text-white focus:border-cyan-400'
            }`}
          />
        </div>

        {/* Banner thông báo tự động xác nhận */}
        {is4Digits && !error && (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              Tự động điền <strong>{code.trim()}</strong> & xác nhận tải PDF...
            </span>
            <span className="text-[10px] text-emerald-400/80 bg-emerald-900/60 px-1.5 py-0.5 rounded">Tự động</span>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-rose-700 bg-rose-950/60 p-2.5 text-xs text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!image || !code.trim() || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-lg shadow-cyan-900/20"
          >
            {(isSubmitting || isAutoSubmitting) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isSubmitting
              ? 'Đang tải PDF gốc...'
              : isAutoSubmitting
                ? 'Đang tự động xác nhận...'
                : 'Xác nhận và tải PDF'}
          </button>
        </div>
      </form>
    </div>
  );
};
