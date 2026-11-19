import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';

interface SaigonCoopCaptchaModalProps {
  isOpen: boolean;
  lookupCode: string;
  image: string;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  onRefresh: () => void;
  onSubmit: (captcha: string) => void;
  onClose: () => void;
  title?: string;
}

export const SaigonCoopCaptchaModal: React.FC<SaigonCoopCaptchaModalProps> = ({
  isOpen,
  lookupCode,
  image,
  loading,
  submitting,
  error,
  onRefresh,
  onSubmit,
  onClose,
  title = 'Tra cứu hóa đơn Saigon Co.op',
}) => {
  const [captcha, setCaptcha] = useState('');

  useEffect(() => {
    setCaptcha('');
  }, [image, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={event => {
          event.preventDefault();
          onSubmit(captcha.trim());
        }}
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-300">
          Mã nhận hóa đơn đã lấy từ XML. Nhập CAPTCHA đúng như ảnh, giữ nguyên chữ HOA/thường nếu có.
        </p>

        <label className="mb-1 block text-sm font-medium text-slate-200">Mã nhận HĐ</label>
        <input readOnly value={lookupCode}
          className="mb-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300" />

        <div className="flex min-h-20 items-center justify-center rounded-md bg-white p-2">
          {loading && !image ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          ) : image ? (
            <img src={image} alt="CAPTCHA hóa đơn" className="max-h-24 max-w-full object-contain" />
          ) : (
            <span className="text-sm text-slate-500">Chưa tải được ảnh CAPTCHA</span>
          )}
        </div>
        <button type="button" onClick={onRefresh} disabled={loading || submitting}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-cyan-300 hover:text-cyan-200 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Lấy CAPTCHA mới
        </button>

        <label htmlFor="saigoncoop-captcha-input" className="mb-1 mt-4 block text-sm font-medium text-slate-200">
          Mã kiểm tra
        </label>
        <input id="saigoncoop-captcha-input" value={captcha} onChange={event => setCaptcha(event.target.value)}
          autoComplete="off" autoCorrect="off" spellCheck={false} disabled={submitting}
          className="w-full rounded-md border border-cyan-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500" />

        {error && <div role="alert" className="mt-3 rounded-md border border-rose-700 bg-rose-950/60 p-3 text-sm text-rose-200">{error}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50">
            Hủy
          </button>
          <button type="submit" disabled={!image || !captcha.trim() || loading || submitting}
            className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Đang tra cứu...' : 'Tra cứu hóa đơn'}
          </button>
        </div>
      </form>
    </div>
  );
};
