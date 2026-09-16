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
    <div className="shrink-0 bg-black text-[#10b981] font-mono border-t-4 border-gray-700 z-20 transition-all duration-300">
      {/* Console Title Bar */}
      <div 
        onClick={(e) => {
          // If collapsed, clicking anywhere on the bar (except interactive buttons) expands it
          if (isCollapsed && !(e.target as HTMLElement).closest('button')) {
            handleToggleCollapse();
          }
        }}
        className={`bg-[#111827] px-4 py-1.5 flex items-center justify-between border-b border-gray-800 text-[11px] ${
          isCollapsed ? 'cursor-pointer hover:bg-gray-900 transition-colors' : ''
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Terminal className="w-3.5 h-3.5 text-[#ef4444] shrink-0" />
          <span className="text-white font-bold tracking-wide shrink-0">
            LIVE SELENIUM CONSOLE
          </span>
          <span className="text-gray-500 shrink-0">|</span>
          <span className="text-amber-300 font-semibold text-[11px] tracking-wide shrink-0">
            Bản quyền thuộc về BinhPhan@2026
          </span>
          <span className="text-gray-500 hidden sm:inline shrink-0">|</span>
          <span className="text-gray-400 font-mono text-[10px] hidden md:inline truncate max-w-[200px]">
            Zalo: 0949 539 969
          </span>
          {isRunning && (
            <span className="flex items-center gap-1 text-purple-400 text-[10px] ml-2 shrink-0">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>RUNNING...</span>
            </span>
          )}
          {isCollapsed && !isRunning && logs.length > 0 && (
            <>
              <span className="text-gray-600 hidden xl:inline shrink-0">|</span>
              <span className="text-emerald-400 text-[10px] font-mono truncate max-w-sm hidden xl:inline">
                {logs[logs.length - 1].message}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyLogs}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors cursor-pointer"
            title="Sao chép toàn bộ nhật ký"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            onClick={onClearLogs}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors cursor-pointer"
            title="Xóa nhật ký terminal"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          <button
            onClick={handleToggleCollapse}
            className="p-1 text-gray-300 hover:text-white rounded hover:bg-gray-800 transition-colors flex items-center gap-1 font-sans text-[10px] cursor-pointer bg-gray-800/80 px-2"
            title={isCollapsed ? "Mở rộng bảng Live Console" : "Thu gọn bảng Live Console"}
          >
            <span>{isCollapsed ? 'Mở rộng' : 'Thu gọn'}</span>
            {isCollapsed ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Console Log Area */}
      {!isCollapsed && (
        <div ref={scrollRef} className="h-36 overflow-y-auto p-3 text-[11px] leading-relaxed select-text space-y-1">
          {logs.length === 0 ? (
            <div className="text-gray-500 flex items-center gap-2">
              <span>&gt; GDT Automation Engine sẵn sàng. Nhấn &quot;BẮT ĐẦU TRUY XUẤT&quot; để thực thi Selenium.</span>
              <span className="w-2 h-3.5 bg-emerald-400 animate-pulse inline-block"></span>
            </div>
          ) : (
            logs.map((log) => {
              let color = 'text-[#10b981]';
              if (log.level === 'step') color = 'text-purple-400 font-bold';
              if (log.level === 'warning') color = 'text-amber-400';
              if (log.level === 'error') color = 'text-red-400 font-bold';
              if (log.level === 'success') color = 'text-emerald-300 font-semibold';

              return (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-gray-500 select-none">[{log.timestamp}]</span>
                  <span className={color}>{log.message}</span>
                </div>
              );
            })
          )}
          {isRunning && (
            <div className="flex items-center gap-2 text-purple-400 animate-pulse">
              <span>&gt; Đang xử lý tự động hóa luồng kết nối Cổng Thuế...</span>
              <span className="w-2 h-3.5 bg-purple-400 animate-pulse inline-block"></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
