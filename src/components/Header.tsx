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
  UserCheck
} from 'lucide-react';
import { GDTAccountConfig, GDTInvoice } from '../types';
import { SupabaseUser } from '../services/supabaseClient';

interface HeaderProps {
  account: GDTAccountConfig;
  selectedInvoices: GDTInvoice[];
  totalInvoicesCount: number;
  dataSourceType?: 'live_gdt' | 'imported_xml';
  onOpenConfig: () => void;
  onOpenBatchDownload: () => void;
  onExportExcel: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  onLogout: () => void;
  currentUser?: SupabaseUser | null;
  onOpenUserManagement?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  account,
  selectedInvoices,
  totalInvoicesCount,
  onOpenConfig,
  onOpenBatchDownload,
  onExportExcel,
  onRefreshData,
  isRefreshing,
  onLogout,
  currentUser,
  onOpenUserManagement,
  isSidebarCollapsed,
  onToggleSidebar
}) => {
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
                MST: {account.taxCode || '(Chưa nhập)'}
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

          {/* Account Settings GDT (Local) */}
          <button
            onClick={onOpenConfig}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Cấu hình tài khoản Cổng Tổng cục Thuế"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Supabase User Management (Admin / User) */}
          {onOpenUserManagement && (
            <button
              onClick={onOpenUserManagement}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Quản lý tài khoản người dùng lưu trên Supabase"
            >
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden lg:inline">Quản lý User</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                {currentUser?.role === 'admin' ? 'Admin' : currentUser?.role === 'accountant' ? 'Kế toán' : 'User'}
              </span>
            </button>
          )}

          {/* Logout Button (Supabase session) */}
          <button
            onClick={onLogout}
            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Đăng xuất tài khoản hệ thống (Supabase)"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
