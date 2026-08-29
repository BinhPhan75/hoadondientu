import React, { useState } from 'react';
import { 
  FileCode2, 
  FileText, 
  Eye, 
  Copy, 
  Check, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ShieldCheck, 
  Download, 
  CheckSquare, 
  Square,
  AlertCircle,
  FileSpreadsheet,
  FolderArchive
} from 'lucide-react';
import { GDTInvoice } from '../types';

interface InvoiceTableProps {
  invoices: GDTInvoice[];
  selectedInvoices: GDTInvoice[];
  onToggleSelect: (invoice: GDTInvoice) => void;
  onToggleSelectAll: () => void;
  onViewDetail: (invoice: GDTInvoice) => void;
  onDownloadXml: (invoice: GDTInvoice) => void;
  onDownloadPdf: (invoice: GDTInvoice) => void;
  onBatchDownloadSelected: () => void;
  onExportExcelSelected: () => void;
  onQuickSyncPeriod?: () => void;
  onQuickResetPeriod?: () => void;
  onOpenImportXml?: () => void;
  currentDateRange?: { from: string; to: string };
  currentMst?: string;
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  selectedInvoices,
  onToggleSelect,
  onToggleSelectAll,
  onViewDetail,
  onDownloadXml,
  onDownloadPdf,
  onBatchDownloadSelected,
  onExportExcelSelected,
  onQuickSyncPeriod,
  onQuickResetPeriod,
  onOpenImportXml,
  currentDateRange,
  currentMst
}) => {
  const [copiedMst, setCopiedMst] = useState<string | null>(null);

  const handleCopyMst = (mst: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(mst);
    setCopiedMst(mst);
    setTimeout(() => setCopiedMst(null), 1500);
  };

  const isAllSelected = invoices.length > 0 && selectedInvoices.length === invoices.length;
  const isSomeSelected = selectedInvoices.length > 0 && selectedInvoices.length < invoices.length;

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  const formatDate = (isoStr: string) => {
    try {
      const parts = isoStr.split('T');
      const dateParts = parts[0].split('-');
      return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* High Density Table Container */}
      <div className="overflow-x-auto w-full border-b border-[#d1d5db] bg-white">
        <table className="data-table">
          {/* Table Header */}
          <thead>
            <tr>
              <th className="w-8 text-center" style={{ width: '36px' }}>
                <button
                  onClick={onToggleSelectAll}
                  className="text-gray-500 hover:text-gray-900 transition-colors flex items-center justify-center mx-auto"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[#ef4444]" />
                  ) : isSomeSelected ? (
                    <div className="w-3.5 h-3.5 rounded-2xs bg-[#ef4444] flex items-center justify-center text-white text-[9px] font-bold">
                      -
                    </div>
                  ) : (
                    <Square className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </button>
              </th>
              <th style={{ width: '38px' }} className="text-center">STT</th>
              <th style={{ width: '90px' }}>Loại HĐ</th>
              <th style={{ width: '100px' }}>Ký hiệu</th>
              <th style={{ width: '80px' }}>Số HĐ</th>
              <th style={{ width: '95px' }}>Ngày lập</th>
              <th style={{ minWidth: '220px' }}>Bên bán (Nhà cung cấp)</th>
              <th style={{ minWidth: '220px' }}>Bên mua (Khách hàng)</th>
              <th style={{ width: '115px' }} className="text-right">Doanh số</th>
              <th style={{ width: '95px' }} className="text-right">Tiền thuế</th>
              <th style={{ width: '125px' }} className="text-right">Tổng tiền</th>
              <th style={{ width: '95px' }} className="text-center">Trạng thái</th>
              <th style={{ width: '95px' }} className="text-center">Mã CQT</th>
              <th style={{ width: '90px' }} className="text-center">Tác vụ</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={14} className="p-10 text-center text-gray-600 bg-gray-50/40">
                  <div className="flex flex-col items-center justify-center max-w-lg mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        Không tìm thấy hóa đơn nào trong khoảng thời gian đã lọc
                      </p>
                      <p className="text-xs text-gray-500 font-mono mt-1">
                        Kỳ tra cứu:{' '}
                        <strong className="text-gray-800">
                          {currentDateRange ? `${currentDateRange.from} -> ${currentDateRange.to}` : 'Tất cả'}
                        </strong>{' '}
                        | MST:{' '}
                        <strong className="text-gray-800 font-mono">
                          {currentMst || '(Chưa nhập)'}
                        </strong>
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Hóa đơn có thể chưa phát sinh trong kỳ này hoặc chưa được đồng bộ từ Cổng Tổng cục Thuế.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      {onQuickSyncPeriod && (
                        <button
                          onClick={onQuickSyncPeriod}
                          className="px-3 py-1.5 bg-[#ef4444] hover:bg-red-600 text-white rounded text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Tự động đồng bộ kỳ này</span>
                        </button>
                      )}

                      {onOpenImportXml && (
                        <button
                          onClick={onOpenImportXml}
                          className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 rounded text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileCode2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Nhập tệp XML / ZIP thực tế</span>
                        </button>
                      )}

                      {onQuickResetPeriod && (
                        <button
                          onClick={onQuickResetPeriod}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <span>Đặt lại bộ lọc kỳ</span>
                        </button>
                      )}

                      <a
                        href="https://hoadondientu.gdt.gov.vn"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-semibold transition-colors inline-flex items-center gap-1"
                      >
                        <span>Mở Cổng GDT (hoadondientu.gdt.gov.vn)</span>
                      </a>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              invoices.map((inv, idx) => {
                const isSelected = selectedInvoices.some(s => s.id === inv.id);

                let statusTag = (
                  <span className="tag tag-success">
                    Gốc
                  </span>
                );
                if (inv.tthdon === 2) {
                  statusTag = (
                    <span className="tag tag-info">
                      Thay thế
                    </span>
                  );
                } else if (inv.tthdon === 3) {
                  statusTag = (
                    <span className="tag tag-pending">
                      Điều chỉnh
                    </span>
                  );
                } else if (inv.tthdon === 4) {
                  statusTag = (
                    <span className="tag tag-error">
                      Bị hủy
                    </span>
                  );
                }

                return (
                  <tr
                    key={inv.id}
                    onClick={() => onToggleSelect(inv)}
                    className={`hover:bg-[#f9fafb] transition-colors cursor-pointer ${
                      isSelected ? 'bg-red-50/50' : idx % 2 === 1 ? 'bg-gray-50/30' : 'bg-white'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onToggleSelect(inv)}
                        className="text-gray-400 hover:text-[#ef4444] transition-colors flex items-center justify-center mx-auto"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-[#ef4444]" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-gray-300" />
                        )}
                      </button>
                    </td>

                    {/* STT */}
                    <td className="text-center text-gray-500 font-mono text-[11px]">{idx + 1}</td>

                    {/* Loại HĐ */}
                    <td>
                      {inv.loaiHdon === 'purchase' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-blue-700 text-[11px]">
                          <ArrowDownLeft className="w-3 h-3" /> Mua vào
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 text-[11px]">
                          <ArrowUpRight className="w-3 h-3" /> Bán ra
                        </span>
                      )}
                    </td>

                    {/* Mẫu số / Ký hiệu */}
                    <td className="font-mono font-medium text-gray-900 text-xs">
                      <span className="text-gray-400">{inv.khmshdon}/</span>
                      <strong className="text-gray-900">{inv.khhdon}</strong>
                    </td>

                    {/* Số HĐ */}
                    <td className="font-mono font-bold text-[#ef4444] text-xs">
                      {inv.shdon}
                    </td>

                    {/* Ngày lập */}
                    <td className="text-gray-600 font-mono text-[11px]">
                      {formatDate(inv.tdlap)}
                    </td>

                    {/* Bên bán */}
                    <td>
                      <div className="font-medium text-gray-900 truncate max-w-[240px] text-xs" title={inv.nbten}>
                        {inv.nbten}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-500 font-mono">
                        <span>MST: {inv.nbmst}</span>
                        <button
                          onClick={(e) => handleCopyMst(inv.nbmst, e)}
                          className="hover:text-gray-900 p-0.5"
                          title="Sao chép MST"
                        >
                          {copiedMst === inv.nbmst ? (
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-2.5 h-2.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Bên mua */}
                    <td>
                      <div className="font-medium text-gray-800 truncate max-w-[240px] text-xs" title={inv.nmten}>
                        {inv.nmten}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        MST: {inv.nmmst}
                      </div>
                    </td>

                    {/* Tiền chưa thuế */}
                    <td className="text-right font-mono font-medium text-gray-700 text-xs">
                      {formatVND(inv.tgtcthue)}
                    </td>

                    {/* Tiền thuế GTGT */}
                    <td className="text-right font-mono text-amber-700 font-semibold text-xs">
                      {formatVND(inv.tgtthue)}
                    </td>

                    {/* Tổng thanh toán */}
                    <td className="text-right font-mono font-bold text-gray-900 text-xs">
                      {formatVND(inv.tgtttbso)}
                    </td>

                    {/* Trạng thái HĐ */}
                    <td className="text-center">
                      {statusTag}
                    </td>

                    {/* Trạng thái CQT */}
                    <td className="text-center">
                      {inv.hsgcma ? (
                        <span
                          className="tag tag-success"
                          title={`Mã CQT: ${inv.mhdon || 'Đã cấp mã'}`}
                        >
                          <ShieldCheck className="w-3 h-3 text-emerald-600" /> Có mã
                        </span>
                      ) : (
                        <span className="tag" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                          Không mã
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onViewDetail(inv)}
                          className="p-1 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          title="Xem bản thể hiện / XML"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onDownloadXml(inv)}
                          className="p-1 text-gray-500 hover:text-[#ef4444] hover:bg-red-50 rounded transition-colors"
                          title="Tải XML gốc"
                        >
                          <FileCode2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onDownloadPdf(inv)}
                          className="p-1 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                          title="In / PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Floating Bottom Selection Toolbar */}
      {selectedInvoices.length > 0 && (
        <div className="fixed bottom-5 right-6 z-40 bg-[#111827] text-white px-4 py-2.5 rounded shadow-2xl border border-gray-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-150 text-xs">
          <div className="flex items-center gap-2">
            <span className="status-dot status-active"></span>
            <span>
              Đã chọn: <strong className="text-emerald-400 font-mono font-bold">{selectedInvoices.length}</strong> HĐ
            </span>
            <span className="text-gray-600">|</span>
            <span>
              Tổng:{' '}
              <strong className="text-amber-300 font-mono font-bold">
                {formatVND(selectedInvoices.reduce((s, i) => s + i.tgtttbso, 0))}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportExcelSelected}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-colors"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>Xuất Excel</span>
            </button>

            <button
              onClick={onBatchDownloadSelected}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#ef4444] hover:bg-red-600 text-white rounded text-xs font-bold transition-colors"
            >
              <FolderArchive className="w-3 h-3" />
              <span>Tải ZIP</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
