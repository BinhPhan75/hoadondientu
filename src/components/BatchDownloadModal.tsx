import React, { useState } from 'react';
import { 
  X, 
  Download, 
  FolderArchive, 
  CheckCircle2, 
  FileCode2, 
  FileSpreadsheet, 
  FileText, 
  FolderTree, 
  Sparkles,
  Layers,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { GDTInvoice } from '../types';
import { generateGDTInvoiceXml } from '../utils/xmlGenerator';
import { generateOfficialInvoiceHtml } from '../utils/officialInvoiceHtml';

interface BatchDownloadModalProps {
  isOpen: boolean;
  invoices: GDTInvoice[];
  onClose: () => void;
}

export const BatchDownloadModal: React.FC<BatchDownloadModalProps> = ({
  isOpen,
  invoices,
  onClose
}) => {
  const [includeXml, setIncludeXml] = useState(true);
  const [includePdfHtml, setIncludePdfHtml] = useState(true);
  const [includeExcel, setIncludeExcel] = useState(true);
  const [folderStructure, setFolderStructure] = useState<'flat' | 'by_month' | 'by_seller' | 'by_tax_rate'>('by_month');
  const [namingPattern, setNamingPattern] = useState<'standard' | 'readable' | 'date_mst'>('standard');
  const [isPackaging, setIsPackaging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  if (!isOpen) return null;

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.tgtttbso, 0);

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  const sanitizeAscii = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const handleStartBatchDownload = async () => {
    if (invoices.length === 0) return;
    if (!includeXml && !includePdfHtml && !includeExcel) {
      alert('Vui lòng chọn ít nhất một định dạng tệp cần tải về.');
      return;
    }

    setIsPackaging(true);
    setProgress(5);
    setStatusText('Đang khởi tạo gói tệp ZIP hóa đơn điện tử chuẩn QĐ 1450...');

    try {
      const zip = new JSZip();

      // Process invoices
      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        const currentProgress = Math.round(10 + (i / invoices.length) * 75);
        setProgress(currentProgress);
        setStatusText(`Đang đóng gói hóa đơn ${inv.shdon} (${i + 1}/${invoices.length})...`);

        // Determine folder path (ASCII safe for iTaxViewer and Windows)
        let subFolder = '';
        if (folderStructure === 'by_month') {
          const monthStr = inv.tdlap.substring(0, 7).replace('-', '_'); // 2025_02
          subFolder = `${monthStr}/${inv.loaiHdon === 'purchase' ? 'Mua_Vao' : 'Ban_Ra'}/`;
        } else if (folderStructure === 'by_seller') {
          const sanitizedSeller = sanitizeAscii(inv.nbten).substring(0, 25);
          subFolder = `${inv.nbmst}_${sanitizedSeller}/`;
        } else if (folderStructure === 'by_tax_rate') {
          const primaryTax = (inv.items[0]?.taxRate || '10%').replace('%', 'Pct');
          subFolder = `Thue_${primaryTax}/`;
        }

        // Determine file name (ASCII safe, no spaces for iTaxViewer)
        const cleanShd = String(inv.shdon).padStart(7, '0');
        let baseFileName = '';
        if (namingPattern === 'standard') {
          baseFileName = `HD_${inv.khhdon}_${cleanShd}_${inv.nbmst}`;
        } else if (namingPattern === 'readable') {
          const cleanName = sanitizeAscii(inv.nbten).substring(0, 20);
          baseFileName = `HD_${cleanShd}_${cleanName}`;
        } else {
          const dateStr = inv.tdlap.substring(0, 10).replace(/-/g, '');
          baseFileName = `${dateStr}_${inv.nbmst}_HD${cleanShd}`;
        }

        // 1. Add XML File (Decision 1450/QĐ-TCT strictly compliant)
        if (includeXml) {
          const xmlContent = inv.rawXml || generateGDTInvoiceXml(inv);
          zip.file(`${subFolder}${baseFileName}.xml`, xmlContent);
        }

        // 2. Add Authentic Official E-Invoice HTML file
        if (includePdfHtml) {
          const htmlContent = generateOfficialInvoiceHtml(inv);
          zip.file(`${subFolder}${baseFileName}.html`, htmlContent);
        }
      }

      // 3. Add Excel Summary file
      if (includeExcel) {
        setProgress(90);
        setStatusText('Đang tạo Bảng kê hóa đơn tổng hợp Excel (TT78)...');

        const rows: (string | number)[][] = [];
        rows.push(['BẢNG KÊ HÓA ĐƠN ĐIỆN TỬ TẢI VỀ TỪ TỔNG CỤC THUẾ (hoadondientu.gdt.gov.vn)']);
        rows.push([`Ngày xuất tệp: ${new Date().toLocaleString('vi-VN')}`]);
        rows.push([`Tổng số hóa đơn: ${invoices.length}`]);
        rows.push([]);
        rows.push([
          'STT', 'Loại HĐ', 'Ký hiệu MS', 'Ký hiệu HĐ', 'Số HĐ', 'Ngày lập',
          'Mã CQT', 'MST Bên bán', 'Tên Bên bán', 'MST Bên mua', 'Tên Bên mua',
          'Mặt hàng', 'Tiền chưa thuế', 'Thuế suất', 'Tiền thuế GTGT', 'Tổng thanh toán'
        ]);

        invoices.forEach((inv, idx) => {
          rows.push([
            idx + 1,
            inv.loaiHdon === 'purchase' ? 'Mua vào' : 'Bán ra',
            inv.khmshdon,
            inv.khhdon,
            inv.shdon,
            inv.tdlap.replace('T', ' '),
            inv.mhdon || 'Không có',
            inv.nbmst,
            inv.nbten,
            inv.nmmst,
            inv.nmten,
            inv.items.map(i => i.itemName).join('; '),
            inv.tgtcthue,
            inv.items[0]?.taxRate || '10%',
            inv.tgtthue,
            inv.tgtttbso
          ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Bang_Ke_Hoa_Don');
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        zip.file('Bang_Ke_Tong_Hop_Hoa_Don_GDT.xlsx', excelBuffer);
      }

      setProgress(96);
      setStatusText('Đang nén tệp lưu trữ ZIP hoàn chỉnh...');

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      setProgress(100);
      setStatusText('Hoàn tất! Đang tải tệp xuống...');

      // Trigger browser download
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HoaDon_GDT_TongCucThue_${new Date().toISOString().slice(0, 10)}_${invoices.length}HD.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setTimeout(() => {
        setIsPackaging(false);
        onClose();
      }, 800);
    } catch (error: any) {
      alert(`Có lỗi xảy ra trong quá trình nén tệp: ${error.message}`);
      setIsPackaging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded max-w-lg w-full shadow-2xl border border-[#d1d5db] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-[#111827] text-white px-5 py-3.5 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <FolderArchive className="w-5 h-5 text-[#ef4444]" />
            <div>
              <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                TẢI HÀNG LOẠT HÓA ĐƠN (.ZIP)
              </h3>
              <p className="text-[11px] text-gray-400">
                Đóng gói tệp XML gốc QĐ 1450, bản in HTML và bảng kê Excel TT78
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

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Summary Box */}
          <div className="bg-gray-50 border border-[#d1d5db] p-3 rounded flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-500 font-semibold uppercase">Số lượng hóa đơn:</p>
              <h4 className="text-base font-bold text-gray-900 font-mono">
                {invoices.length} <span className="text-xs font-normal text-gray-600">HĐ</span>
              </h4>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-gray-500 font-semibold uppercase">Tổng thanh toán:</p>
              <h4 className="text-base font-bold text-[#ef4444] font-mono">{formatVND(totalAmount)}</h4>
            </div>
          </div>

          {/* Compliance Notice */}
          <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded text-emerald-900 flex items-start gap-2 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Định dạng XML chuẩn QĐ 1450/QĐ-TCT & QĐ 1510/QĐ-TCT:</strong>
              <p className="text-emerald-800 text-[10.5px] mt-0.5">
                Tương thích 100% với iTaxViewer, HTKK, MISA meInvoice, VNPT, Viettel và phần mềm kế toán.
              </p>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
              1. Định dạng tệp đóng gói:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${
                includeXml ? 'bg-red-50/60 border-red-300 text-red-950 font-bold' : 'bg-white border-[#d1d5db] text-gray-700'
              }`}>
                <input
                  type="checkbox"
                  checked={includeXml}
                  onChange={(e) => setIncludeXml(e.target.checked)}
                  className="w-3.5 h-3.5 text-[#ef4444]"
                />
                <span className="text-[11px]">XML Gốc (QĐ 1450)</span>
              </label>

              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${
                includePdfHtml ? 'bg-blue-50/60 border-blue-300 text-blue-950 font-bold' : 'bg-white border-[#d1d5db] text-gray-700'
              }`}>
                <input
                  type="checkbox"
                  checked={includePdfHtml}
                  onChange={(e) => setIncludePdfHtml(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600"
                />
                <span className="text-[11px]">Bản In HTML/PDF</span>
              </label>

              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${
                includeExcel ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 font-bold' : 'bg-white border-[#d1d5db] text-gray-700'
              }`}>
                <input
                  type="checkbox"
                  checked={includeExcel}
                  onChange={(e) => setIncludeExcel(e.target.checked)}
                  className="w-3.5 h-3.5 text-emerald-600"
                />
                <span className="text-[11px]">Bảng Kê Excel</span>
              </label>
            </div>
          </div>

          {/* Folder Organization */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
              2. Cấu trúc thư mục ZIP:
            </label>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <label className="flex items-center gap-2 p-2 bg-gray-50 border border-[#d1d5db] rounded cursor-pointer">
                <input
                  type="radio"
                  name="folderStructure"
                  checked={folderStructure === 'by_month'}
                  onChange={() => setFolderStructure('by_month')}
                  className="text-[#ef4444]"
                />
                <span>Theo Tháng (`2025_02/...`)</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-gray-50 border border-[#d1d5db] rounded cursor-pointer">
                <input
                  type="radio"
                  name="folderStructure"
                  checked={folderStructure === 'by_seller'}
                  onChange={() => setFolderStructure('by_seller')}
                  className="text-[#ef4444]"
                />
                <span>Theo MST & Bên Bán</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-gray-50 border border-[#d1d5db] rounded cursor-pointer">
                <input
                  type="radio"
                  name="folderStructure"
                  checked={folderStructure === 'by_tax_rate'}
                  onChange={() => setFolderStructure('by_tax_rate')}
                  className="text-[#ef4444]"
                />
                <span>Theo Thuế suất (8%, 10%)</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-gray-50 border border-[#d1d5db] rounded cursor-pointer">
                <input
                  type="radio"
                  name="folderStructure"
                  checked={folderStructure === 'flat'}
                  onChange={() => setFolderStructure('flat')}
                  className="text-[#ef4444]"
                />
                <span>Gộp chung 1 thư mục</span>
              </label>
            </div>
          </div>

          {/* Naming Pattern */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
              3. Quy tắc đặt tên tệp:
            </label>
            <select
              value={namingPattern}
              onChange={(e) => setNamingPattern(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-[#d1d5db] rounded focus:bg-white focus:border-[#ef4444] font-mono text-gray-800"
            >
              <option value="standard">HD_[KýHiệu]_[SốHĐ]_[MST].xml (Chuẩn Tổng cục Thuế)</option>
              <option value="readable">HD_[SốHĐ]_[TênBênBán].xml (Dễ đọc cho kế toán)</option>
              <option value="date_mst">[YYYYMMDD]_[MST]_[SốHĐ].xml (Theo ngày lập)</option>
            </select>
          </div>

          {/* Progress Bar (when packaging) */}
          {isPackaging && (
            <div className="p-3 bg-[#111827] text-white rounded space-y-1.5 animate-in fade-in duration-150">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-gray-300">{statusText}</span>
                <span className="font-bold text-emerald-400">{progress}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Modal Footer Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#d1d5db]">
            <button
              type="button"
              onClick={onClose}
              disabled={isPackaging}
              className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors disabled:opacity-50"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleStartBatchDownload}
              disabled={isPackaging || invoices.length === 0}
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#ef4444] hover:bg-red-600 rounded transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Gói ZIP ({invoices.length} HĐ)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
