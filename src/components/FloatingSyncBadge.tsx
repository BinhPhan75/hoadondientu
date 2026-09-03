import React from 'react';
import { Layers, RefreshCw, CheckCircle2, ChevronRight, X, FileSpreadsheet } from 'lucide-react';
import { MultiMonthSyncState } from '../types';

interface FloatingSyncBadgeProps {
  syncState: MultiMonthSyncState;
  onOpenModal: () => void;
  onDismiss?: () => void;
}

export const FloatingSyncBadge: React.FC<FloatingSyncBadgeProps> = ({
  syncState,
  onOpenModal,
  onDismiss
}) => {
  if (!syncState.isActive && !syncState.isCompleted) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 z-40 bg-[#111827] text-white border border-gray-700 shadow-2xl rounded-lg p-3 max-w-sm w-full animate-in slide-in-from-bottom-4 duration-200 cursor-pointer hover:border-gray-500 transition-all"
      onClick={onOpenModal}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {syncState.isCompleted ? (
            <div className="p-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="p-1 rounded bg-amber-950 text-amber-400 border border-amber-800">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            </div>
          )}
          <span className="text-xs font-bold text-gray-200">
            {syncState.isCompleted ? 'Hoàn tất đồng bộ toàn kỳ' : 'Đang lấy dữ liệu từng tháng...'}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-mono text-gray-400">
          <span className="text-white font-bold">{syncState.completedMonths}/{syncState.totalMonths}</span>
          <span>tháng</span>
          {onDismiss && syncState.isCompleted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="p-1 text-gray-500 hover:text-white rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-300 ${
            syncState.isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, syncState.progressPercent))}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
        <div className="truncate max-w-[180px]">
          {syncState.isCompleted ? (
            <span className="text-emerald-400">Đã gộp {syncState.totalInvoicesFound} hóa đơn</span>
          ) : (
            <span className="text-amber-300 truncate">Đang xử lý: {syncState.currentMonthLabel}</span>
          )}
        </div>

        <div className="flex items-center gap-1 text-blue-400 font-semibold text-[10px] hover:underline">
          <span>Xem tiến trình</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
};
