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
    <header className="bg-white border-b border-[#d1d5db] sticky top-0 z-30 shrink-0 shadow-2xs">
      {/* Main Header */}
      <div className="px-3 sm:px-5 py-2 flex items-center justify-between gap-3">
        {/* Left Side: Company & MST Info + Sidebar Toggle */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
              title={isSidebarCollapsed ? "Hiện menu bên trái" : "Ẩn menu bên trái để mở rộng bảng dữ liệu"}
            >
              {isSidebarCollapsed ? (
                <>
                  <PanelLeftOpen className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-700 hidden sm:inline">Hiện menu</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 text-gray-600" />
                  <span className="text-xs font-semibold text-gray-700 hidden sm:inline">Ẩn menu</span>
                </>
              )}
            </button>
          )}

          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                Tool tra cứu hóa đơn mua vào
              </span>
              <span className="text-xs font-mono font-bold text-gray-900 shrink-0">
                MST: {account.taxCode || currentUser?.username || '(Chưa nhập)'}
              </span>
            </div>
            {account.taxpayerName && (
              <p className="text-xs text-gray-600 font-medium mt-0.5 truncate max-w-[240px] sm:max-w-md">
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-[#d1d5db] rounded transition-colors disabled:opacity-50 cursor-pointer"
            title="Đồng bộ lại từ Tổng cục Thuế"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Làm mới</span>
          </button>

          {/* Export Excel Button */}
          <button
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition-colors cursor-pointer"
            title="Xuất bảng kê Excel Thông tư 78"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden md:inline">Xuất Excel</span>
            <span className="font-mono font-bold">({totalInvoicesCount})</span>
          </button>

          {/* Batch Download ZIP */}
          <button
            onClick={onOpenBatchDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#ef4444] hover:bg-red-600 rounded transition-colors shadow-xs cursor-pointer"
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
            className="p-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-[#d1d5db] rounded transition-colors cursor-pointer"
            title="Cấu hình tài khoản Tổng cục Thuế (Lưu riêng tại máy này)"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Vertical Divider */}
          <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block" />

          {/* WEB USER & ADMIN STATUS */}
          {currentUser && (
            <div className="flex items-center gap-2">
              {isAdmin ? (
                /* Admin Management Button */
                <button
                  onClick={onOpenAdminUsers}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                  title="Mở bảng Quản trị Người dùng & Quản lý Neon DB"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Quản lý User</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-200 text-indigo-800">Admin</span>
                </button>
              ) : (
                /* Subscription Plan / Expiry Badge for User */
                <div
                  className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border font-medium ${
                    currentUser.daysRemaining <= 7
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}
                  title={`Gói cước MST ${currentUser.username} có thời hạn đến ngày ${expiryFormatted}`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Hạn dùng:</span>
                  <span className="font-bold">{currentUser.daysRemaining} ngày</span>
                  <span className="text-[10px] opacity-75 hidden lg:inline">({expiryFormatted})</span>
                </div>
              )}

              {/* Web Logout Button */}
              {onLogoutWeb && (
                <button
                  onClick={onLogoutWeb}
                  className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-gray-300 hover:border-rose-200 rounded transition-colors cursor-pointer"
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

