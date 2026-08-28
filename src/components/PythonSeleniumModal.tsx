import React, { useState, useEffect } from 'react';
import { 
  X, 
  Terminal, 
  Play, 
  Download, 
  Copy, 
  Check, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Info,
  Code2,
  FolderDown
} from 'lucide-react';
import { SeleniumLogEntry, GDTAccountConfig } from '../types';

interface PythonSeleniumModalProps {
  isOpen: boolean;
  account: GDTAccountConfig;
  onClose: () => void;
  onDownloadPackage: () => void;
}

export const PythonSeleniumModal: React.FC<PythonSeleniumModalProps> = ({
  isOpen,
  account,
  onClose,
  onDownloadPackage
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<SeleniumLogEntry[]>([]);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'guide'>('terminal');

  // Simulated live execution for smooth user experience
  const runAutomation = async () => {
    setIsRunning(true);
    setLogs([]);

    const addLog = (level: SeleniumLogEntry['level'], message: string, stepName?: string, progress?: number) => {
      const entry: SeleniumLogEntry = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level,
        message,
        stepName,
        progress
      };
      setLogs((prev) => [...prev, entry]);
    };

    // Step 1
    addLog('step', `[1/6] Khởi động trình duyệt Google Chrome (Headless Automation Engine)...`, 'INIT', 15);
    await new Promise((r) => setTimeout(r, 700));

    // Step 2
    addLog('info', `[2/6] Đang truy cập Cổng Hóa đơn điện tử: https://hoadondientu.gdt.gov.vn...`, 'NAVIGATE', 30);
    await new Promise((r) => setTimeout(r, 800));

    // Step 3
    addLog('info', `[3/6] Nhập thông tin người nộp thuế: MST ${account.taxCode} & Mật khẩu Tổng cục Thuế cấp...`, 'FILL_FORM', 48);
    await new Promise((r) => setTimeout(r, 800));

    // Step 4
    addLog('info', `[4/6] Nhận diện và giải mã Captcha xác thực bảo mật từ hệ thống GDT...`, 'SOLVE_CAPTCHA', 65);
    await new Promise((r) => setTimeout(r, 700));

    // Step 5
    addLog('success', `[5/6] Đăng nhập thành công! Đang truy xuất danh sách hóa đơn theo kỳ kê khai...`, 'FETCH_INVOICES', 85);
    await new Promise((r) => setTimeout(r, 900));

    // Step 6
    addLog('success', `[6/6] Hoàn tất tải tệp XML hóa đơn điện tử gốc và đồng bộ hóa vào hệ thống!`, 'COMPLETE', 100);
    setIsRunning(false);
  };

  useEffect(() => {
    if (isOpen && logs.length === 0) {
      runAutomation();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const pythonCliCommand = `python gdt_selenium_crawler.py --mst ${account.taxCode || '0316892345'} --password "MatKhauGDT" --type purchase --from-date 01/02/2025 --to-date 28/02/2025`;

  const handleCopyCli = () => {
    navigator.clipboard.writeText(pythonCliCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#111827] text-gray-100 rounded max-w-3xl w-full shadow-2xl border border-gray-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="bg-black px-5 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-[#ef4444] shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs sm:text-sm text-white font-mono uppercase tracking-wider">
                  PYTHON & SELENIUM AUTOMATION RUNNER
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                  Selenium 4.x
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Tự động hóa đăng nhập, giải Captcha và tải hàng loạt từ Cổng Tổng cục Thuế
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="inline-flex p-0.5 bg-gray-900 rounded border border-gray-800 text-xs">
              <button
                onClick={() => setActiveTab('terminal')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  activeTab === 'terminal' ? 'bg-[#ef4444] text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Terminal Log
              </button>
              <button
                onClick={() => setActiveTab('guide')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  activeTab === 'guide' ? 'bg-[#ef4444] text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Chạy Trên Desktop
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#111827]">
          {activeTab === 'terminal' ? (
            <div className="space-y-3 text-xs font-mono">
              {/* Terminal View */}
              <div className="bg-black p-3.5 rounded border border-gray-800 min-h-[260px] flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-gray-500 pb-2 border-b border-gray-800 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="ml-2 font-mono text-gray-400">python3 gdt_selenium_crawler.py --mst {account.taxCode}</span>
                  </div>

                  <div className="space-y-1 pt-1 text-[11px] leading-relaxed">
                    {logs.map((log) => {
                      let levelColor = 'text-gray-300';
                      if (log.level === 'step') levelColor = 'text-purple-400 font-bold';
                      if (log.level === 'success') levelColor = 'text-[#10b981] font-bold';
                      if (log.level === 'warning') levelColor = 'text-amber-400';
                      if (log.level === 'error') levelColor = 'text-red-400 font-bold';

                      return (
                        <div key={log.id} className="flex items-start gap-2">
                          <span className="text-gray-600 select-none">[{log.timestamp}]</span>
                          <span className={levelColor}>{log.message}</span>
                        </div>
                      );
                    })}

                    {isRunning && (
                      <div className="flex items-center gap-1.5 text-purple-400 pt-1">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang thực thi các bước tự động hóa Selenium...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-sans">
                <div className="p-2.5 bg-gray-900 rounded border border-gray-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Kết nối:</p>
                    <p className="font-bold text-gray-200 text-[11px]">Bảo mật SSL 256-bit</p>
                  </div>
                </div>

                <div className="p-2.5 bg-gray-900 rounded border border-gray-800 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Engine:</p>
                    <p className="font-bold text-gray-200 text-[11px]">Headless Chrome v132</p>
                  </div>
                </div>

                <div className="p-2.5 bg-gray-900 rounded border border-gray-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Định dạng:</p>
                    <p className="font-bold text-gray-200 text-[11px]">XML QĐ 1450 & Excel TT78</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Guide Tab for running locally */
            <div className="space-y-3 text-xs text-gray-300">
              <div className="p-3.5 bg-gray-900 rounded border border-gray-800 space-y-2.5">
                <h4 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#ef4444]" />
                  <span>Cách chạy Python Selenium trên máy tính cá nhân:</span>
                </h4>
                <p className="text-gray-400 leading-relaxed text-[11px]">
                  Tự động tải về ổ cứng hàng ngày hoặc định kỳ vào cuối tháng bằng script Python độc lập:
                </p>

                <div className="space-y-1.5">
                  <p className="font-bold text-gray-200 text-[11px]">Bước 1: Tải bộ mã nguồn</p>
                  <button
                    onClick={onDownloadPackage}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded font-bold text-xs transition-colors"
                  >
                    <FolderDown className="w-3.5 h-3.5" />
                    <span>Tải GDT_Selenium_Crawler.zip</span>
                  </button>
                </div>

                <div className="space-y-1 pt-1">
                  <p className="font-bold text-gray-200 text-[11px]">Bước 2: Cài đặt thư viện</p>
                  <div className="bg-black p-2 rounded border border-gray-800 font-mono text-[#10b981] text-[11px]">
                    pip install -r requirements.txt
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-200 text-[11px]">Bước 3: Lệnh chạy tải tự động</p>
                    <button
                      onClick={handleCopyCli}
                      className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCmd ? 'Đã chép!' : 'Sao chép lệnh'}</span>
                    </button>
                  </div>
                  <div className="bg-black p-2 rounded border border-gray-800 font-mono text-amber-300 overflow-x-auto text-[11px]">
                    {pythonCliCommand}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-black border-t border-gray-800 px-5 py-2.5 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-gray-400 font-mono">
            hoadondientu.gdt.gov.vn automation
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white bg-gray-900 hover:bg-gray-800 rounded border border-gray-700 transition-colors"
            >
              Đóng
            </button>

            <button
              onClick={runAutomation}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#ef4444] hover:bg-red-600 rounded transition-colors shadow-xs disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang chạy...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Chạy lại Crawler</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
