import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface DialogAlertOptions {
  title?: string;
  message: string;
  type?: NotificationType;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  copyableText?: string;
  portalUrl?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface NotificationContextType {
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
    custom: (item: Omit<ToastItem, 'id'>) => void;
  };
  showAlert: (options: DialogAlertOptions | string) => Promise<boolean>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  closeAlert: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Singleton emitter for usage outside React components
type NotificationListener = {
  addToast: (item: Omit<ToastItem, 'id'>) => void;
  showDialog: (options: DialogAlertOptions) => Promise<boolean>;
};

let globalListener: NotificationListener | null = null;

export const notify = {
  success: (message: string, title?: string, duration = 4000) => {
    if (globalListener) {
      globalListener.addToast({ type: 'success', message, title, duration });
    } else {
      console.log('[Notify Success]:', message);
    }
  },
  error: (message: string, title?: string, duration = 6000) => {
    if (globalListener) {
      globalListener.addToast({ type: 'error', message, title, duration });
    } else {
      console.error('[Notify Error]:', message);
    }
  },
  warning: (message: string, title?: string, duration = 5000) => {
    if (globalListener) {
      globalListener.addToast({ type: 'warning', message, title, duration });
    } else {
      console.warn('[Notify Warning]:', message);
    }
  },
  info: (message: string, title?: string, duration = 4000) => {
    if (globalListener) {
      globalListener.addToast({ type: 'info', message, title, duration });
    } else {
      console.info('[Notify Info]:', message);
    }
  },
  alert: (options: DialogAlertOptions | string): Promise<boolean> => {
    const opts = typeof options === 'string' ? { message: options } : options;
    if (globalListener) {
      return globalListener.showDialog(opts);
    }
    // Fallback if not mounted
    window.alert(opts.message);
    return Promise.resolve(true);
  },
  confirm: (message: string, title?: string): Promise<boolean> => {
    if (globalListener) {
      return globalListener.showDialog({
        title: title || 'Xác nhận hành động',
        message,
        type: 'warning',
        showCancel: true,
        confirmText: 'Đồng ý',
        cancelText: 'Hủy bỏ'
      });
    }
    return Promise.resolve(window.confirm(message));
  }
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeDialog, setActiveDialog] = useState<DialogAlertOptions | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogResolverRef = useRef<((value: boolean) => void) | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const duration = item.duration ?? (item.type === 'error' ? 6000 : 4000);
    const newToast: ToastItem = { ...item, id, duration };

    setToasts(prev => [newToast, ...prev.slice(0, 4)]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const showDialog = useCallback((options: DialogAlertOptions): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      dialogResolverRef.current = resolve;
      setActiveDialog(options);
      setCopied(false);
    });
  }, []);

  // Connect singleton emitter
  globalListener = {
    addToast,
    showDialog
  };

  const handleConfirmDialog = () => {
    if (activeDialog?.onConfirm) activeDialog.onConfirm();
    if (dialogResolverRef.current) dialogResolverRef.current(true);
    setActiveDialog(null);
  };

  const handleCancelDialog = () => {
    if (activeDialog?.onCancel) activeDialog.onCancel();
    if (dialogResolverRef.current) dialogResolverRef.current(false);
    setActiveDialog(null);
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const toastMethods = {
    success: (message: string, title?: string, duration?: number) => {
      addToast({ type: 'success', message, title, duration });
    },
    error: (message: string, title?: string, duration?: number) => {
      addToast({ type: 'error', message, title, duration });
    },
    warning: (message: string, title?: string, duration?: number) => {
      addToast({ type: 'warning', message, title, duration });
    },
    info: (message: string, title?: string, duration?: number) => {
      addToast({ type: 'info', message, title, duration });
    },
    custom: (item: Omit<ToastItem, 'id'>) => {
      addToast(item);
    }
  };

  const showAlert = useCallback((options: DialogAlertOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return showDialog(opts);
  }, [showDialog]);

  const showConfirm = useCallback((message: string, title?: string) => {
    return showDialog({
      title: title || 'Xác nhận hành động',
      message,
      type: 'warning',
      showCancel: true,
      confirmText: 'Đồng ý',
      cancelText: 'Hủy bỏ'
    });
  }, [showDialog]);

  const closeAlert = useCallback(() => {
    if (dialogResolverRef.current) dialogResolverRef.current(false);
    setActiveDialog(null);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        toast: toastMethods,
        showAlert,
        showConfirm,
        closeAlert
      }}
    >
      {children}

      {/* Floating Toast Notification Stack (Top-Right) */}
      <div
        id="toast-notification-container"
        className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-2 sm:px-0"
      >
        {toasts.map(item => {
          const type = item.type;
          const isError = type === 'error';
          const isSuccess = type === 'success';
          const isWarning = type === 'warning';

          const iconColor = isSuccess
            ? 'text-emerald-400'
            : isError
            ? 'text-rose-400'
            : isWarning
            ? 'text-amber-400'
            : 'text-cyan-400';

          const bgBorder = isSuccess
            ? 'bg-slate-900/95 border-emerald-500/50 shadow-emerald-950/40'
            : isError
            ? 'bg-slate-900/95 border-rose-500/50 shadow-rose-950/40'
            : isWarning
            ? 'bg-slate-900/95 border-amber-500/50 shadow-amber-950/40'
            : 'bg-slate-900/95 border-cyan-500/50 shadow-cyan-950/40';

          return (
            <div
              key={item.id}
              id={`toast-item-${item.id}`}
              className={`pointer-events-auto rounded-xl p-3.5 shadow-xl border backdrop-blur-md transition-all duration-200 animate-in slide-in-from-top-3 fade-in flex items-start gap-3 text-white ${bgBorder}`}
            >
              <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                {isSuccess && <CheckCircle2 className="w-5 h-5" />}
                {isError && <AlertCircle className="w-5 h-5" />}
                {isWarning && <AlertTriangle className="w-5 h-5" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                {item.title && (
                  <h4 className="font-semibold text-xs text-gray-100 tracking-wide mb-0.5">
                    {item.title}
                  </h4>
                )}
                <p className="text-xs text-gray-300 leading-relaxed break-words whitespace-pre-line">
                  {item.message}
                </p>
                {item.action && (
                  <button
                    type="button"
                    onClick={item.action.onClick}
                    className="mt-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 cursor-pointer"
                  >
                    {item.action.label}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeToast(item.id)}
                className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                title="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Professional Dialog Frame Modal (Replaces browser alert/confirm) */}
      {activeDialog && (
        <div
          id="dialog-notification-overlay"
          className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={e => {
            if (e.target === e.currentTarget && !activeDialog.showCancel) {
              handleConfirmDialog();
            }
          }}
        >
          <div
            id="dialog-notification-card"
            className="bg-[#0f172a] border border-gray-700/80 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-5 pt-5 pb-3 flex items-start gap-3.5 border-b border-gray-800/60">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  activeDialog.type === 'error'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : activeDialog.type === 'warning'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : activeDialog.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                }`}
              >
                {activeDialog.type === 'error' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : activeDialog.type === 'warning' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : activeDialog.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  {activeDialog.title || (
                    activeDialog.type === 'error'
                      ? 'Thông Báo Lỗi'
                      : activeDialog.type === 'warning'
                      ? 'Cảnh Báo Hệ Thống'
                      : activeDialog.type === 'success'
                      ? 'Thực Hiện Thành Công'
                      : 'Thông Báo'
                  )}
                </h3>
                <span className="text-[11px] text-gray-400 font-mono block mt-0.5">
                  Hệ thống xử lý hóa đơn điện tử
                </span>
              </div>

              <button
                type="button"
                onClick={handleCancelDialog}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-3">
              <div className="text-xs sm:text-sm text-gray-200 leading-relaxed whitespace-pre-line break-words bg-slate-900/60 p-3.5 rounded-xl border border-gray-800">
                {activeDialog.message}
              </div>

              {/* Technical / copyable detail if available */}
              {activeDialog.copyableText && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>Chi tiết kỹ thuật:</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(activeDialog.copyableText!)}
                      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono bg-black/60 p-3 rounded-lg text-gray-300 overflow-x-auto border border-gray-800 max-h-32">
                    {activeDialog.copyableText}
                  </pre>
                </div>
              )}

              {/* Portal link if provided */}
              {activeDialog.portalUrl && (
                <div className="pt-1">
                  <a
                    href={activeDialog.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium bg-cyan-950/40 px-3 py-2 rounded-lg border border-cyan-800/60 hover:bg-cyan-950/70 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở cổng tra cứu trực tiếp của nhà cung cấp</span>
                  </a>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="px-5 py-3.5 bg-slate-900/90 border-t border-gray-800/80 flex items-center justify-end gap-2.5">
              {activeDialog.showCancel && (
                <button
                  type="button"
                  onClick={handleCancelDialog}
                  className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors cursor-pointer"
                >
                  {activeDialog.cancelText || 'Hủy bỏ'}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={handleConfirmDialog}
                className={`px-5 py-2 text-xs font-bold text-white rounded-lg transition-all shadow-md cursor-pointer ${
                  activeDialog.type === 'error'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                    : activeDialog.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/50'
                    : activeDialog.type === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/50'
                }`}
              >
                {activeDialog.confirmText || 'Đã hiểu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
