import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileCode2, 
  FolderArchive, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  FileText, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { GDTInvoice } from '../types';
import { parseGDTInvoiceXml, parseInvoicesFromZip } from '../utils/xmlParser';

interface ImportXmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedInvoices: GDTInvoice[]) => void;
  onViewInvoice?: (invoice: GDTInvoice) => void;
}

export const ImportXmlModal: React.FC<ImportXmlModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onViewInvoice
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedList, setParsedList] = useState<GDTInvoice[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | File[]) => {
    setIsProcessing(true);
    const newInvoices: GDTInvoice[] = [];
    const newErrors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name.toLowerCase();

      try {
        if (name.endsWith('.xml') || name.endsWith('.inv')) {
          const text = await file.text();
          const invoice = parseGDTInvoiceXml(text, file.name);
          newInvoices.push(invoice);
        } else if (name.endsWith('.zip')) {
          const buffer = await file.arrayBuffer();
          const zipInvoices = await parseInvoicesFromZip(buffer);
          if (zipInvoices.length === 0) {
            newErrors.push(`Tệp ZIP "${file.name}" không chứa tệp XML hóa đơn hợp lệ.`);
          } else {
            newInvoices.push(...zipInvoices);
          }
        } else {
          newErrors.push(`Tệp "${file.name}" không phải định dạng .xml hoặc .zip.`);
        }
      } catch (err: any) {
        newErrors.push(`Lỗi khi đọc tệp "${file.name}": ${err.message}`);
      }
    }

    setParsedList(prev => [...prev, ...newInvoices]);
    setErrors(prev => [...prev, ...newErrors]);
    setIsProcessing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleApplyImport = () => {
    if (parsedList.length === 0) return;
    onImportSuccess(parsedList);
    setParsedList([]);
    setErrors([]);
    onClose();
  };

  const handleRemoveItem = (index: number) => {
    setParsedList(prev => prev.filter((_, i) => i !== index));
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-xs">
        {/* Modal Header */}
        <div className="bg-[#111827] text-white px-5 py-3.5 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-[#ef4444]" />
            <span className="font-bold uppercase tracking-wider text-xs">
              Nhập Tệp XML Hóa Đơn Điện Tử Thực Tế
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-[#ef4444] bg-red-50/50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xml,.zip"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFiles(e.target.files);
                }
              }}
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-[#ef4444]">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-sm">
                  Kéo và thả tệp XML hoặc ZIP vào đây
                </p>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Hỗ trợ định dạng XML gốc Tổng cục Thuế (NĐ 123 / TT 78) hoặc gói ZIP từ Cổng hoadondientu.gdt.gov.vn
                </p>
              </div>
              <button
                type="button"
                className="mt-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded hover:bg-gray-100 shadow-2xs"
              >
                Chọn tệp từ máy tính
              </button>
            </div>
          </div>

          {/* Loading Indicator */}
          {isProcessing && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Đang phân tích cú pháp tệp XML và trích xuất dữ liệu hóa đơn...</span>
            </div>
          )}

          {/* Errors List */}
          {errors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-red-800">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                <span>Một số tệp không đọc được:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-red-700 space-y-0.5">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Parsed Invoices Preview List */}
          {parsedList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-gray-900">
                    Đã nhận diện thành công ({parsedList.length} hóa đơn):
                  </span>
                </div>
                <button
                  onClick={() => setParsedList([])}
                  className="text-gray-500 hover:text-red-600 flex items-center gap-1 text-[11px]"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Xóa tất cả</span>
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded divide-y divide-gray-100 bg-white">
                {parsedList.map((inv, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-gray-400 text-[11px] w-5 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900">
                            {inv.khhdon} - #{inv.shdon}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            ({inv.tdlap.substring(0, 10)})
                          </span>
                          {inv.hsgcma && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-medium">
                              <ShieldCheck className="w-2.5 h-2.5" /> Có mã CQT
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-600 truncate max-w-md mt-0.5">
                          <strong>Bán:</strong> {inv.nbten} (MST: {inv.nbmst})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right mr-1">
                        <div className="font-mono font-bold text-gray-900">
                          {formatVND(inv.tgtttbso)}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          Thuế: {formatVND(inv.tgtthue)}
                        </div>
                      </div>
                      {onViewInvoice && (
                        <button
                          onClick={() => onViewInvoice(inv)}
                          className="px-2 py-1 text-[11px] font-semibold text-white bg-[#ef4444] hover:bg-red-600 rounded flex items-center gap-1 transition-colors"
                          title="Xem giao diện hóa đơn hoàn chỉnh chuẩn A4 / HTML / XSLT"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Xem HĐ</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100"
                        title="Xóa hóa đơn này khỏi danh sách nhập"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            Dữ liệu sau khi nạp sẽ hiển thị trực tiếp trên Bảng kê & Báo cáo thuế.
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-gray-700 bg-white border border-gray-300 rounded font-semibold hover:bg-gray-100 transition-colors"
            >
              Đóng
            </button>
            <button
              onClick={handleApplyImport}
              disabled={parsedList.length === 0}
              className="btn-primary-accent px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>Nạp vào bảng dữ liệu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
