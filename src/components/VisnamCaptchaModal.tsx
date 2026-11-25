import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [autoSubmittedCode, setAutoSubmittedCode] = useState<string | null>(null);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [hasUserTyped, setHasUserTyped] = useState(false);

  // Chỉ khóa thao tác khi đang tải ảnh mới hoặc đang gửi yêu cầu tải PDF
  const busy = isLoading || isSubmitting;
  const is4Digits = /^\d{4}$/.test(code.trim());

  // Tự động focus vào ô nhập mã khi modal mở hoặc khi đổi ảnh
  useEffect(() => {
    if (isOpen && !isLoading) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isLoading, image]);

  // Reset cờ người dùng gõ khi đổi ảnh CAPTCHA
  useEffect(() => {
    if (image) {
      setHasUserTyped(false);
      setAutoSubmittedCode(null);
    }
  }, [image]);

  // Tự động gửi nếu nhận diện thành công 4 số và người dùng chưa chủ động gõ
  useEffect(() => {
    if (!isOpen || busy || !is4Digits || error) {
      setIsAutoSubmitting(false);
      return;
    }

    const currentCode = code.trim();
    if (autoSubmittedCode === currentCode) return;

    // Nếu người dùng tự gõ đủ 4 số, tự động gửi sau 600ms hoặc họ có thể bấm nút ngay
    const delay = hasUserTyped ? 600 : 350;
    setIsAutoSubmitting(true);
    const timer = setTimeout(() => {
      setAutoSubmittedCode(currentCode);
      if (formRef.current) {
        formRef.current.requestSubmit();
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      setIsAutoSubmitting(false);
    };
  }, [isOpen, busy, is4Digits, code, error, autoSubmittedCode, hasUserTyped]);

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
              <FileText className="h-4 w-4 text-cyan-400" />
              Xác minh CAPTCHA VIN-HOADON
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              Hệ thống đã tự động thử giải 5 lần. Bạn vui lòng nhìn hình và nhập 4 số bên dưới để tải PDF gốc.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Đóng"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Khung ảnh CAPTCHA - Luôn hiển thị rõ ràng, không bị lớp phủ che khuất */}
        <div className="mt-4 flex min-h-24 items-center justify-center rounded-lg border border-slate-700 bg-white p-2.5 relative select-none">
          {isLoading ? (
            <div className="flex flex-col items-center gap-1.5 py-3">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
              <span className="text-xs text-slate-600 font-medium">Đang tải mã CAPTCHA mới...</span>
            </div>
          ) : image ? (
            <img
              src={image}
              alt="Mã CAPTCHA VIN-HOADON"
              className="max-h-20 max-w-full select-none pointer-events-none"
            />
          ) : (
            <span className="text-sm text-slate-500">Chưa có ảnh CAPTCHA</span>
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

          {isOcrRunning ? (
            <span className="inline-flex items-center gap-1 text-cyan-400 text-xs font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              Đang thử đọc OCR...
            </span>
          ) : onAutoSolve && image && !code.trim() ? (
            <button
              type="button"
              onClick={onAutoSolve}
              disabled={busy}
              className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Thử đọc OCR lại
            </button>
          ) : null}
        </div>

        {/* Ô nhập mã CAPTCHA - Luôn thao tác được ngay lập tức */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="visnam-captcha-code" className="font-medium text-slate-200">
              Nhập mã CAPTCHA (4 số):
            </label>
            {is4Digits ? (
              <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isAutoSubmitting ? 'Đang gửi...' : 'Đã đủ 4 số'}
              </span>
            ) : null}
          </div>

          <input
            ref={inputRef}
            id="visnam-captcha-code"
            value={code}
            onChange={event => {
              setHasUserTyped(true);
              const cleaned = event.target.value.replace(/[^0-9]/g, '').slice(0, 4);
              onCodeChange(cleaned);
            }}
            onFocus={event => event.target.select()}
            autoComplete="off"
            autoFocus
            maxLength={4}
            placeholder="Nhập 4 số"
            className={`w-full rounded-lg border bg-slate-950 px-3 py-2.5 text-center font-mono text-2xl font-bold uppercase tracking-[0.35em] outline-none transition-colors ${
              is4Digits
                ? 'border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'border-slate-700 text-white focus:border-cyan-400'
            }`}
          />
        </div>

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
            disabled={!image || code.trim().length < 4 || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-lg shadow-cyan-900/20"
          >
            {(isSubmitting || isAutoSubmitting) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isSubmitting
              ? 'Đang tải PDF gốc...'
              : isAutoSubmitting
                ? 'Đang xác nhận...'
                : 'Xác nhận và tải PDF'}
          </button>
        </div>
      </form>
    </div>
  );
};
