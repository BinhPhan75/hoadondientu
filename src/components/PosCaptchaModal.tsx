import React, { useEffect, useRef, useState } from 'react';

interface PosCaptchaModalProps {
  captchaImage: string;
  rangeLabel: string;
  isOpen: boolean;
  onCancel: () => void;
  onSubmit: (code: string) => void;
}

/** Human verification for a single GDT POS query. */
export const PosCaptchaModal: React.FC<PosCaptchaModalProps> = ({
  captchaImage,
  rangeLabel,
  isOpen,
  onCancel,
  onSubmit,
}) => {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCode('');
    window.setTimeout(() => inputRef.current?.focus(), 0);
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
          Tổng cục Thuế yêu cầu mã mới cho từng đợt. Nhập mã trong ảnh để tiếp tục tải đúng đợt này.
        </p>
        <div className="mt-4 flex min-h-20 items-center justify-center rounded border border-slate-700 bg-white p-2">
          <img src={captchaImage} alt="CAPTCHA Tổng cục Thuế" className="max-h-20 max-w-full" />
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-200" htmlFor="pos-captcha-code">Mã CAPTCHA</label>
        <input
          ref={inputRef}
          id="pos-captcha-code"
          value={code}
          onChange={event => setCode(event.target.value.toUpperCase())}
          autoComplete="off"
          maxLength={12}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono tracking-[0.2em] text-white outline-none focus:border-cyan-400"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800">Hủy đợt này</button>
          <button type="submit" disabled={!code.trim()} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50">Xác nhận và tải</button>
        </div>
      </form>
    </div>
  );
};
