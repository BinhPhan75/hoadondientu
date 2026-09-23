import React, { useState } from 'react';
import { 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Maximize2, 
  Play, 
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { SeleniumLogEntry } from '../types';

interface ConsoleDockProps {
  logs: SeleniumLogEntry[];
  isRunning: boolean;
  onClearLogs: () => void;
  onRunCrawler: () => void;
  taxCode: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ConsoleDock: React.FC<ConsoleDockProps> = ({
  logs,
  isRunning,
  onClearLogs,
  onRunCrawler,
  taxCode,
  isCollapsed: controlledCollapsed,
  onToggleCollapse
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  // Auto scroll to bottom of logs on update when open
  React.useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isRunning, isCollapsed]);

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="shrink-0 bg-slate-950 text-slate-300 border-t border-slate-800 z-20 transition-all duration-300">
      {/* Console Title Bar */}
      <div 
        onClick={(e) => {
          // If collapsed, clicking anywhere on the bar (except interactive buttons) expands it
          if (isCollapsed && !(e.target as HTMLElement).closest('button')) {
            handleToggleCollapse();
          }
        }}
        className={`bg-slate-900 px-4 py-2 flex items-center justify-between border-b border-slate-800 text-xs ${
          isCollapsed ? 'cursor-pointer hover:bg-slate-800/80 transition-colors' : ''
        }`}
      >
        <div className="flex items-center gap-2.5 flex-wrap min-w-0 font-sans">
          <Terminal className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-slate-200 font-semibold tracking-tight shrink-0">
            Nhật ký hệ thống
          </span>
          <span className="text-slate-700 shrink-0">|</span>
          <span className="text-slate-400 font-normal text-xs shrink-0">
            Bản quyền thuộc về BinhPhan@2026
          </span>
          <span className="text-slate-700 hidden sm:inline shrink-0">|</span>
          <span className="text-slate-400 text-xs hidden md:inline truncate max-w-[200px]">
            Zalo: 0949 539 969
          </span>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-[11px] font-medium ml-1.5 shrink-0">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Đang xử lý...</span>
            </span>
          )}
          {isCollapsed && !isRunning && logs.length > 0 && (
            <>
              <span className="text-slate-700 hidden xl:inline shrink-0">|</span>
              <span className="text-slate-400 text-xs font-mono truncate max-w-sm hidden xl:inline">
                {logs[logs.length - 1].message}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopyLogs}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
            title="Sao chép toàn bộ nhật ký"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClearLogs}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
            title="Xóa nhật ký terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleToggleCollapse}
            className="p-1 text-slate-300 hover:text-white rounded-md hover:bg-slate-800 transition-colors flex items-center gap-1.5 font-sans text-xs cursor-pointer bg-slate-800/80 px-2.5 py-1"
            title={isCollapsed ? "Mở rộng bảng Live Console" : "Thu gọn bảng Live Console"}
          >
            <span>{isCollapsed ? 'Mở rộng' : 'Thu gọn'}</span>
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5 text-blue-400" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Console Log Area */}
      {!isCollapsed && (
        <div ref={scrollRef} className="h-36 overflow-y-auto p-3.5 text-xs font-mono leading-relaxed select-text space-y-1.5 bg-slate-950/95">
          {logs.length === 0 ? (
            <div className="text-slate-500 flex items-center gap-2">
              <span>&gt; GDT Automation Engine sẵn sàng. Nhấn &quot;BẮT ĐẦU TRUY XUẤT&quot; để thực thi.</span>
              <span className="w-2 h-3.5 bg-blue-500 animate-pulse inline-block"></span>
            </div>
          ) : (
            logs.map((log) => {
              let color = 'text-slate-300';
              if (log.level === 'step') color = 'text-blue-400 font-medium';
              if (log.level === 'warning') color = 'text-amber-400';
              if (log.level === 'error') color = 'text-rose-400 font-medium';
              if (log.level === 'success') color = 'text-emerald-400 font-medium';

              return (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-slate-600 select-none">[{log.timestamp}]</span>
                  <span className={color}>{log.message}</span>
                </div>
              );
            })
          )}
          {isRunning && (
            <div className="flex items-center gap-2 text-blue-400 animate-pulse">
              <span>&gt; Đang xử lý tự động hóa luồng kết nối Cổng Thuế...</span>
              <span className="w-2 h-3.5 bg-blue-400 animate-pulse inline-block"></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
