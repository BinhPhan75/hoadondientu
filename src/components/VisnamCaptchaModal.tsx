import React from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';

interface VisnamCaptchaModalProps {
  isOpen: boolean;
  image: string;
  code: string;
  error: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  onCodeChange: (value: string) => void;
  onRefresh: () => void;
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
  onCodeChange,
  onRefresh,
  onCancel,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const busy = isLoading || isSubmitting;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Xác minh CAPTCHA VIN-HOADON</h2>
            <p className="mt-1 text-sm text-slate-300">
              Mã số bí mật được lấy tự động từ XML. Nhập CAPTCHA để tải PDF gốc.
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Đóng" className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex min-h-24 items-center justify-center rounded border border-slate-700 bg-white p-2">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
          ) : image ? (
            <img src={image} alt="CAPTCHA VIN-HOADON" className="max-h-24 max-w-full select-none" />
          ) : (
            <span className="text-sm text-slate-500">Chưa có ảnh CAPTCHA</span>
          )}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={busy}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Lấy CAPTCHA mới
        </button>

        <label htmlFor="visnam-captcha-code" className="mt-4 block text-sm font-medium text-slate-200">
          Mã CAPTCHA
        </label>
        <input
          id="visnam-captcha-code"
          value={code}
          onChange={event => onCodeChange(event.target.value)}
          autoComplete="off"
          autoFocus
          maxLength={8}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-center font-mono text-base font-bold uppercase tracking-[0.2em] text-white outline-none focus:border-cyan-400"
        />

        {error && <p role="alert" className="mt-3 rounded border border-rose-700 bg-rose-950/60 p-2 text-sm text-rose-200">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800">
            Hủy
          </button>
          <button
            type="submit"
            disabled={!image || !code.trim() || busy}
            className="inline-flex items-center gap-2 rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận và tải PDF
          </button>
        </div>
      </form>
    </div>
  );
};
