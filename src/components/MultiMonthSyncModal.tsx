import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  X, 
  Play, 
  Pause, 
  ChevronRight, 
  ShieldCheck,
  Eye,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { MonthSyncChunk, MultiMonthSyncState, GDTInvoice, GDTAccountConfig } from '../types';
import { exportSingleMonthToExcel, exportComprehensiveMultiMonthReport } from '../utils/excelExporter';

interface MultiMonthSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncState: MultiMonthSyncState;
  account: GDTAccountConfig;
  allInvoices: GDTInvoice[];
  onPauseSync: () => void;
  onResumeSync: () => void;
  onRetryChunk: (chunkIndex: number) => void;
  onStartSync?: () => void;
}

export const MultiMonthSyncModal: React.FC<MultiMonthSyncModalProps> = ({
  isOpen,
  onClose,
  syncState,
  account,
  allInvoices,
  onPauseSync,
  onResumeSync,
  onRetryChunk,
  onStartSync
}) => {
  const [activeTab, setActiveTab] = useState<'progress' | 'summary'>('progress');

  if (!isOpen) return null;

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';
  };

  const handleExportAll = () => {
    const firstChunk = syncState.chunks[0];
    const lastChunk = syncState.chunks[syncState.chunks.length - 1];
    const periodLabel = firstChunk && lastChunk ? `${firstChunk.shortLabel} - ${lastChunk.shortLabel}` : 'Multi_Month';
    
    exportComprehensiveMultiMonthReport(
      allInvoices,
      syncState.chunks,
      account.taxCode,
      account.taxpayerName,
      periodLabel
    );
  };

  const handleExportMonth = (chunk: MonthSyncChunk) => {
    const monthInvoices = allInvoices.filter(inv => {
      const d = inv.tdlap.substring(0, 10);
      return d >= chunk.fromDate && d <= chunk.toDate;
    });
    exportSingleMonthToExcel(monthInvoices, chunk.label, account.taxCode);
  };

  // Tax calculations
  const totalSoldTax = syncState.chunks.reduce((sum, c) => sum + c.soldTax, 0);
  const totalPurchaseTax = syncState.chunks.reduce((sum, c) => sum + c.purchaseTax, 0);
  const netVat = totalSoldTax - totalPurchaseTax;

  const firstDate = syncState.chunks[0]?.fromDate || '';
  const lastDate = syncState.chunks[syncState.chunks.length - 1]?.toDate || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#111827] text-white border border-gray-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between bg-gray-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${syncState.isCompleted ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}`}>
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Tiến Trình Tra Cứu & Xuất Báo Cáo Từng Tháng
                </h3>
                {syncState.isCompleted ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/80 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> ĐÃ HOÀN TẤT
                  </span>
                ) : syncState.isActive ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900/80 text-amber-300 border border-amber-700 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> ĐANG LẤY LẦN LƯỢT
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-700">
                    TẠM DỪNG
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5 flex items-center gap-2">
                <span>Kỳ: <strong>{firstDate}</strong> đến <strong>{lastDate}</strong></span>
                <span className="text-gray-600">•</span>
                <span>Tổng: <strong>{syncState.totalMonths} tháng</strong></span>
                <span className="text-gray-600">•</span>
                <span>MST: <strong>{account.taxCode || 'Chưa có'}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              title="Đóng cửa sổ (Tiến trình vẫn tiếp tục chạy ngầm)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Banner: Rule of GDT 1-month limit */}
        <div className="px-5 py-2.5 bg-blue-950/40 border-b border-blue-900/50 flex items-center justify-between text-xs text-blue-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Quy định Tổng cục Thuế: Chỉ cho phép tra cứu tối đa <strong>1 tháng/lần</strong>. Phần mềm tự động chia thành {syncState.totalMonths} tháng, lấy lần lượt có giãn cách nhịp để tránh bị nghẽn (429) và tổng hợp kết quả toàn kỳ.
            </span>
          </div>
        </div>

        {/* Overall Progress Section */}
        <div className="p-5 border-b border-gray-800 bg-gray-950 shrink-0">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Tiến độ chung:</span>
              <strong className="text-white text-sm">
                {syncState.completedMonths} / {syncState.totalMonths} tháng ({Math.round(syncState.progressPercent)}%)
              </strong>
              {syncState.isActive && !syncState.isCompleted && (
                <span className="text-amber-400 text-xs animate-pulse">
                  (Đang xử lý: {syncState.currentMonthLabel})
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-emerald-400">
                Mua vào: <strong>{syncState.totalPurchaseFound} HĐ</strong>
              </span>
              <span className="text-gray-600">|</span>
              <span className="text-blue-400">
                Bán ra: <strong>{syncState.totalSoldFound} HĐ</strong>
              </span>
              <span className="text-gray-600">|</span>
              <span className="text-white font-bold">
                Tổng: {syncState.totalInvoicesFound} HĐ
              </span>
            </div>
          </div>

          {/* Progress Bar with animated stripes */}
          <div className="h-3 w-full bg-gray-800 rounded-full overflow-hidden p-0.5 border border-gray-700 relative">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                syncState.isCompleted 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/50' 
                  : syncState.hasErrors 
                    ? 'bg-gradient-to-r from-amber-500 to-red-500' 
                    : 'bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, syncState.progressPercent))}%` }}
            />
          </div>

          {/* Controls toolbar */}
          <div className="flex items-center justify-between mt-3 text-xs">
            <div className="flex items-center gap-2">
              {!syncState.isCompleted && (
                syncState.isPaused ? (
                  <button
                    onClick={onResumeSync}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Tiếp tục lấy dữ liệu</span>
                  </button>
                ) : (
                  <button
                    onClick={onPauseSync}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-semibold transition-colors cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Tạm dừng</span>
                  </button>
                )
              )}

              {syncState.hasErrors && (
                <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Có một số tháng gặp lỗi mạng, bạn có thể nhấn &quot;Thử lại&quot; ở từng tháng.
                </span>
              )}
            </div>

            {/* Quick Export Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportAll}
                disabled={syncState.totalInvoicesFound === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition-colors cursor-pointer shadow-md shadow-emerald-950"
                title="Xuất bảng kê Excel đầy đủ (kèm sheet tổng hợp theo tháng)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xuất Báo Cáo Tổng Hợp Toàn Kỳ ({syncState.totalInvoicesFound})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content area: Table of Months */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">
              Bảng Theo Dõi Tiến Trình Từng Tháng ({syncState.chunks.length} tháng)
            </h4>
            <span className="text-[11px] text-gray-500 font-mono">
              Dữ liệu được cập nhật trực tiếp vào hệ thống ngay khi mỗi tháng hoàn tất
            </span>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-950/80 text-gray-400 font-mono text-[11px] border-b border-gray-800">
                  <th className="py-2.5 px-3 font-semibold w-12 text-center">STT</th>
                  <th className="py-2.5 px-3 font-semibold">Kỳ / Tháng</th>
                  <th className="py-2.5 px-3 font-semibold">Khoảng Ngày</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Trạng Thái</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Mua Vào</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Bán Ra</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Tổng HĐ</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Doanh Số (VNĐ)</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Báo Cáo Tháng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {syncState.chunks.map((chunk, index) => {
                  const isCurrent = syncState.isActive && syncState.currentMonthIndex === index && !syncState.isCompleted;
                  
                  return (
                    <tr 
                      key={chunk.id} 
                      className={`transition-colors ${
                        isCurrent 
                          ? 'bg-amber-950/30 border-l-2 border-l-amber-500' 
                          : chunk.status === 'completed'
                            ? 'hover:bg-gray-800/40'
                            : 'hover:bg-gray-800/20'
                      }`}
                    >
                      {/* STT */}
                      <td className="py-2.5 px-3 text-center text-gray-400 font-mono text-[11px]">
                        {index + 1}
                      </td>

                      {/* Month Label */}
                      <td className="py-2.5 px-3 font-bold text-white font-mono">
                        <div className="flex items-center gap-1.5">
                          <span>{chunk.label}</span>
                          {isCurrent && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          )}
                        </div>
                      </td>

                      {/* Date Range */}
                      <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px]">
                        {chunk.fromDate} → {chunk.toDate}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        {chunk.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Hoàn tất
                          </span>
                        ) : chunk.status === 'running' || isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Đang tải...
                          </span>
                        ) : chunk.status === 'failed' ? (
                          <div className="inline-flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800" title={chunk.errorMessage}>
                              <AlertTriangle className="w-3 h-3" /> Lỗi
                            </span>
                            <button
                              onClick={() => onRetryChunk(index)}
                              className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-[10px] font-mono transition-colors"
                              title="Thử lại tháng này"
                            >
                              Thử lại
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-gray-800/80 text-gray-400 border border-gray-700/50">
                            <Clock className="w-3 h-3 text-gray-500" /> Chờ lượt
                          </span>
                        )}
                      </td>

                      {/* Purchase count */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        {chunk.status === 'completed' ? `${chunk.purchaseCount} HĐ` : '-'}
                      </td>

                      {/* Sold count */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-400">
                        {chunk.status === 'completed' ? `${chunk.soldCount} HĐ` : '-'}
                      </td>

                      {/* Total count */}
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-white">
                        {chunk.status === 'completed' ? (
                          <span className="bg-gray-800 px-1.5 py-0.5 rounded">
                            {chunk.totalCount}
                          </span>
                        ) : '-'}
                      </td>

                      {/* Total Amount */}
                      <td className="py-2.5 px-3 text-right font-mono text-gray-300">
                        {chunk.status === 'completed' ? (
                          formatVND(chunk.totalAmount)
                        ) : '-'}
                      </td>

                      {/* Action for this month */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleExportMonth(chunk)}
                          disabled={chunk.status !== 'completed' || chunk.totalCount === 0}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none rounded transition-colors cursor-pointer"
                          title={`Xuất Excel riêng cho ${chunk.label}`}
                        >
                          <Download className="w-3 h-3 text-emerald-400" />
                          <span>Xuất Excel</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tax Summary Cards across all months */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h5 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Tổng Hợp Toàn Bộ Kỳ ({syncState.completedMonths}/{syncState.totalMonths} tháng)
                </h5>
              </div>
              <span className="text-[11px] font-mono text-gray-400">
                Theo Thông tư 78/2021/TT-BTC & Nghị định 123/2020/NĐ-CP
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Purchase Box */}
              <div className="p-3 bg-gray-900/90 rounded border border-gray-800">
                <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Tổng Mua Vào (Đầu vào)</span>
                  <span className="font-mono text-white bg-emerald-950 px-1.5 py-0.5 rounded text-[10px]">
                    {syncState.totalPurchaseFound} HĐ
                  </span>
                </div>
                <div className="mt-1">
                  <div className="text-xs text-gray-400">Doanh số chưa thuế:</div>
                  <div className="text-sm font-bold font-mono text-white">
                    {formatVND(syncState.chunks.reduce((s, c) => s + c.purchaseAmount, 0))}
                  </div>
                </div>
                <div className="mt-1">
                  <div className="text-xs text-gray-400">Thuế GTGT đầu vào:</div>
                  <div className="text-sm font-bold font-mono text-emerald-400">
                    {formatVND(totalPurchaseTax)}
                  </div>
                </div>
              </div>

              {/* Sold Box */}
              <div className="p-3 bg-gray-900/90 rounded border border-gray-800">
                <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Tổng Bán Ra (Đầu ra)</span>
                  <span className="font-mono text-white bg-blue-950 px-1.5 py-0.5 rounded text-[10px]">
                    {syncState.totalSoldFound} HĐ
                  </span>
                </div>
                <div className="mt-1">
                  <div className="text-xs text-gray-400">Doanh thu chưa thuế:</div>
                  <div className="text-sm font-bold font-mono text-white">
                    {formatVND(syncState.chunks.reduce((s, c) => s + c.soldAmount, 0))}
                  </div>
                </div>
                <div className="mt-1">
                  <div className="text-xs text-gray-400">Thuế GTGT đầu ra:</div>
                  <div className="text-sm font-bold font-mono text-blue-400">
                    {formatVND(totalSoldTax)}
                  </div>
                </div>
              </div>

              {/* Net VAT Obligation */}
              <div className="p-3 bg-gray-900/90 rounded border border-gray-800">
                <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                  Nghĩa Vụ Thuế GTGT Toàn Kỳ
                </div>
                <div className="mt-1">
                  <div className="text-xs text-gray-400">Chênh lệch (Đầu ra - Đầu vào):</div>
                  <div className={`text-base font-extrabold font-mono mt-0.5 ${netVat >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {formatVND(netVat)}
                  </div>
                </div>
                <div className="mt-1 text-[11px] font-medium text-gray-300">
                  {netVat > 0 ? (
                    <span className="text-amber-300 font-bold">
                      → Thuế GTGT phải nộp Ngân sách Nhà nước
                    </span>
                  ) : netVat < 0 ? (
                    <span className="text-emerald-300 font-bold">
                      → Thuế GTGT còn được khấu trừ chuyển kỳ sau
                    </span>
                  ) : (
                    <span>Thuế GTGT cân bằng</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 border-t border-gray-800 bg-gray-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-gray-400 font-mono">
            {syncState.isCompleted ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Đã thu thập đầy đủ {syncState.totalInvoicesFound} hóa đơn cho toàn bộ {syncState.totalMonths} tháng!
              </span>
            ) : (
              <span>Đang lần lượt đồng bộ từng tháng từ Cổng Hóa đơn điện tử Tổng cục Thuế...</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-md transition-colors cursor-pointer"
            >
              {syncState.isCompleted ? 'Đóng & Xem trên bảng' : 'Chạy ngầm & Xem dữ liệu'}
            </button>

            <button
              onClick={handleExportAll}
              disabled={syncState.totalInvoicesFound === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md transition-colors cursor-pointer shadow-lg shadow-emerald-950"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất Báo Cáo Excel Đầy Đủ</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
