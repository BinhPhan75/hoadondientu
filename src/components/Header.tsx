import React from 'react';
import { 
  Building2, 
  Download, 
  FileSpreadsheet, 
  Settings, 
  RefreshCw, 
  FolderArchive, 
  Menu, 
  PanelLeftClose, 
  PanelLeftOpen,
  Users,
  LogOut,
  Clock,
  ShieldCheck,
  Database
} from 'lucide-react';
import { GDTAccountConfig, GDTInvoice } from '../types';
import { WebUser } from '../types/auth';

interface HeaderProps {
  account: GDTAccountConfig;
  selectedInvoices: GDTInvoice[];
  totalInvoicesCount: number;
  dataSourceType?: 'live_gdt' | 'imported_xml';
  currentUser?: WebUser | null;
  onOpenConfig: () => void;
  onOpenBatchDownload: () => void;
  onExportExcel: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  onLogout: () => void;
  onOpenAdminUsers?: () => void;
  onLogoutWeb?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  account,
  selectedInvoices,
  totalInvoicesCount,
  currentUser,
  onOpenConfig,
  onOpenBatchDownload,
  onExportExcel,
  onRefreshData,
  isRefreshing,
  onOpenAdminUsers,
  onLogoutWeb,
  isSidebarCollapsed,
  onToggleSidebar
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const expiryFormatted = currentUser?.expiresAt 
    ? new Date(currentUser.expiresAt).toLocaleDateString('vi-VN') 
    : '';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shrink-0 shadow-2xs">
      {/* Main Header */}
      <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Left Side: Company & MST Info + Sidebar Toggle */}
        <div className="flex items-center gap-3 min-w-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
              title={isSidebarCollapsed ? "Hiện menu bên trái" : "Ẩn menu bên trái để mở rộng bảng dữ liệu"}
            >
              {isSidebarCollapsed ? (
                <>
                  <PanelLeftOpen className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-700 hidden sm:inline">Hiện menu</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600 hidden sm:inline">Ẩn menu</span>
                </>
              )}
            </button>
          )}

          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 shrink-0">
                Hóa đơn mua vào
              </span>
              <span className="text-xs font-mono font-semibold text-slate-900 shrink-0">
                MST: {account.taxCode || currentUser?.username || '(Chưa nhập)'}
              </span>
            </div>
            {account.taxpayerName && (
              <p className="text-xs text-slate-500 font-normal mt-0.5 truncate max-w-[260px] sm:max-w-md">
                {account.taxpayerName}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Essential Action Toolbar + Web User Management */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Refresh Button */}
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Đồng bộ lại từ Tổng cục Thuế"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Làm mới</span>
          </button>

          {/* Export Excel Button */}
          <button
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Xuất bảng kê Excel Thông tư 78"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden md:inline">Xuất Excel</span>
            <span className="font-mono font-semibold">({totalInvoicesCount})</span>
          </button>

          {/* Batch Download ZIP */}
          <button
            onClick={onOpenBatchDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
            title="Tải gói tệp XML & PDF hàng loạt"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>
              Tải ZIP {selectedInvoices.length > 0 ? `(${selectedInvoices.length})` : `(${totalInvoicesCount})`}
            </span>
          </button>

          {/* Account Settings GDT (Local) */}
          <button
            onClick={onOpenConfig}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Cấu hình tài khoản Tổng cục Thuế (Lưu riêng tại máy này)"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Vertical Divider */}
          <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* WEB USER & ADMIN STATUS */}
          {currentUser && (
            <div className="flex items-center gap-2">
              {isAdmin ? (
                /* Admin Management Button */
                <button
                  onClick={onOpenAdminUsers}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                  title="Mở bảng Quản trị Người dùng & Quản lý Neon DB"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Quản lý User</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-200/80 text-indigo-800 font-semibold">Admin</span>
                </button>
              ) : (
                /* Subscription Plan / Expiry Badge for User */
                <div
                  className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border font-medium ${
                    currentUser.daysRemaining <= 7
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                  title={`Gói cước MST ${currentUser.username} có thời hạn đến ngày ${expiryFormatted}`}
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Hạn dùng:</span>
                  <span className="font-semibold text-slate-900">{currentUser.daysRemaining} ngày</span>
                  <span className="text-[11px] text-slate-500 hidden lg:inline">({expiryFormatted})</span>
                </div>
              )}

              {/* Web Logout Button */}
              {onLogoutWeb && (
                <button
                  onClick={onLogoutWeb}
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title={`Đăng xuất khỏi tài khoản web (${currentUser.username})`}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

