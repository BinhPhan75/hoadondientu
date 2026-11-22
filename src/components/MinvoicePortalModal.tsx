import React, { useState } from 'react';
import { Check, Copy, ExternalLink, FileUp, Loader2, Sparkles, X } from 'lucide-react';
import { GDTInvoice } from '../types';
import { importMinvoiceIssuerPdf } from '../services/minvoicePdfImport';

interface MinvoicePortalModalProps {
  isOpen: boolean;
  invoice: GDTInvoice | null;
  sellerTaxCode: string;
  lookupCode: string;
  onClose: () => void;
  onPdfImported: (pdfUrl: string) => void;
}

export const MinvoicePortalModal: React.FC<MinvoicePortalModalProps> = ({
  isOpen,
  invoice,
  sellerTaxCode,
  lookupCode,
  onClose,
  onPdfImported,
}) => {
  const [copiedMst, setCopiedMst] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const cleanMst = (sellerTaxCode || '').trim();
  const cleanCode = (lookupCode || '').trim();
  const portalUrl = `https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don?mst=${encodeURIComponent(cleanMst)}&sbm=${encodeURIComponent(cleanCode)}`;

  const handleCopyMst = () => {
    if (!cleanMst) return;
    navigator.clipboard?.writeText(cleanMst).then(() => {
      setCopiedMst(true);
      setTimeout(() => setCopiedMst(false), 2000);
    });
  };

  const handleCopyCode = () => {
    if (!cleanCode) return;
    navigator.clipboard?.writeText(cleanCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !invoice) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const blob = await importMinvoiceIssuerPdf(file, invoice);
      const url = URL.createObjectURL(blob);
      onPdfImported(url);
      onClose();
    } catch (err: any) {
      setImportError(err?.message || 'Không thể xác thực tệp PDF này.');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-2 sm:p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl h-[92vh] max-h-[850px] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Cổng tra cứu & Tải hóa đơn gốc M-Invoice
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-900/60 text-teal-300 border border-teal-700/50">
                  Tự động điền dữ liệu
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Hệ thống tự động điền Mã số thuế và Số bảo mật vào khung tra cứu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Mở cổng tra cứu trong tab trình duyệt mới"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Mở tab mới</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh công cụ thông tin & hướng dẫn nhanh */}
        <div className="border-b border-slate-800 bg-slate-900/90 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
              <span className="text-slate-400">MST bên bán:</span>
              <strong className="text-teal-300 font-mono">{cleanMst || 'Chưa có'}</strong>
              {cleanMst && (
                <button
                  type="button"
                  onClick={handleCopyMst}
                  className="p-0.5 text-slate-400 hover:text-white transition-colors ml-1"
                  title="Sao chép MST"
                >
                  {copiedMst ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
              <span className="text-slate-400">Số bảo mật:</span>
              <strong className="text-teal-300 font-mono">{cleanCode || 'Chưa có'}</strong>
              {cleanCode && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-0.5 text-slate-400 hover:text-white transition-colors ml-1"
                  title="Sao chép Số bảo mật"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            <span className="text-slate-400 hidden md:inline">
              👉 Bấm nút <strong className="text-blue-400">"Tra cứu"</strong> trên cổng bên dưới để tải hoặc xem hóa đơn.
            </span>
          </div>

          {/* Nút nạp nhanh PDF đã tải vào phần mềm */}
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white cursor-pointer shadow-md transition-colors">
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
              <span>{isImporting ? 'Đang xác minh PDF...' : 'Mở PDF vừa tải vào phần mềm'}</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={isImporting}
                onChange={handleFileInputChange}
              />
            </label>
          </div>
        </div>

        {importError && (
          <div className="px-5 py-2 bg-rose-950/70 border-b border-rose-800 text-xs text-rose-300 flex items-center justify-between shrink-0">
            <span>{importError}</span>
            <button type="button" onClick={() => setImportError(null)} className="text-rose-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Khung iframe hiển thị cổng M-Invoice trực tiếp */}
        <div className="flex-1 w-full bg-white relative">
          <iframe
            src={portalUrl}
            title="Cổng tra cứu M-Invoice"
            className="w-full h-full border-0"
            allow="clipboard-write; clipboard-read"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
          />
        </div>
      </div>
    </div>
  );
};
