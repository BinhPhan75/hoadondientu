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
}

export const ConsoleDock: React.FC<ConsoleDockProps> = ({
  logs,
  isRunning,
  onClearLogs,
  onRunCrawler,
  taxCode
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="shrink-0 bg-black text-[#10b981] font-mono border-t-4 border-gray-700 z-20">
      {/* Console Title Bar */}
      <div className="bg-[#111827] px-4 py-1.5 flex items-center justify-between border-b border-gray-800 text-[11px]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#ef4444]" />
          <span className="text-white font-bold tracking-wide">
            LIVE SELENIUM CONSOLE
          </span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400 font-mono text-[10px]">
            python3 gdt_selenium_crawler.py --mst {taxCode || '0316892345'}
          </span>
          {isRunning && (
            <span className="flex items-center gap-1 text-purple-400 text-[10px] ml-2">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>RUNNING...</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLogs}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
            title="Sao chép toàn bộ nhật ký"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            onClick={onClearLogs}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
            title="Xóa nhật ký terminal"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors flex items-center gap-1 font-sans text-[10px]"
          >
            <span>{isCollapsed ? 'Mở rộng' : 'Thu gọn'}</span>
            {isCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Console Log Area */}
      {!isCollapsed && (
        <div className="h-36 overflow-y-auto p-3 text-[11px] leading-relaxed select-text space-y-1">
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
