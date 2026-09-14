import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users, UserPlus, Database, Search, Copy, Check, RefreshCw, X,
  Shield, Calendar, Clock, AlertTriangle, CheckCircle2, Lock,
  Building2, Trash2, KeyRound, Sparkles, Send, ExternalLink, Power
} from 'lucide-react';
import { WebUser } from '../types/auth';

interface AdminUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AdminUserRow extends WebUser {
  password?: string;
}

const DURATION_OPTIONS = [
  { months: 1, label: '1 Tháng' },
  { months: 3, label: '3 Tháng' },
  { months: 6, label: '6 Tháng' },
  { months: 9, label: '9 Tháng' },
  { months: 12, label: '12 Tháng (1 Năm)' },
];

export const AdminUserModal: React.FC<AdminUserModalProps> = ({ isOpen, onClose }) => {
  const { token, dbStatus, refreshDbStatus } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'expired'>('all');

  // Form State
  const [isCreating, setIsCreating] = useState(false);
  const [newMst, setNewMst] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDurationMonths, setNewDurationMonths] = useState<number>(3);
  const [newNotes, setNewNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | number | null>(null);

  // Extend duration state
  const [extendingUserId, setExtendingUserId] = useState<string | number | null>(null);

  const fetchUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          setUsers(data.users);
        }
      }
    } catch (err) {
      console.error('[AdminUserModal] Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      refreshDbStatus();
    }
  }, [isOpen]);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'HD';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    result += '@' + Math.floor(100 + Math.random() * 900);
    setNewPassword(result);
  };

  const calculatePreviewExpiry = (months: number): string => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toLocaleDateString('vi-VN');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanMst = newMst.trim();
    if (!cleanMst) {
      setFormError('Vui lòng nhập Mã số thuế.');
      return;
    }
    if (!newPassword) {
      setFormError('Vui lòng nhập mật khẩu cho người dùng.');
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: cleanMst,
          password: newPassword,
          fullName: newFullName.trim(),
          durationMonths: newDurationMonths,
          notes: newNotes.trim(),
          role: 'user'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.message || 'Không thể tạo tài khoản');
        return;
      }

      setFormSuccess(`Đã tạo thành công tài khoản MST ${cleanMst} (Hạn dùng ${newDurationMonths} tháng)!`);
      setNewMst('');
      setNewFullName('');
      setNewPassword('');
      setNewNotes('');
      setIsCreating(false);
      fetchUsers();
      refreshDbStatus();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi gửi yêu cầu lên máy chủ');
    }
  };

  const handleToggleActive = async (user: AdminUserRow) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          isActive: !user.isActive
        })
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Error toggling active:', err);
    }
  };

  const handleExtendDuration = async (userId: number | string, extendMonths: number) => {
    setExtendingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          extendMonths,
          isActive: true
        })
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Error extending duration:', err);
    } finally {
      setExtendingUserId(null);
    }
  };

  const handleDeleteUser = async (user: AdminUserRow) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản MST: ${user.username} (${user.fullName || 'Người dùng'})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchUsers();
        refreshDbStatus();
      } else {
        const d = await res.json();
        alert(d.message || 'Không thể xóa tài khoản');
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi kết nối máy chủ');
    }
  };

  const copyToClipboard = (text: string, id: number | string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyClientMessage = (user: AdminUserRow) => {
    const appUrl = window.location.origin;
    const expiryDate = new Date(user.expiresAt).toLocaleDateString('vi-VN');
    const msg = `Kính gửi Quý khách,
Thông tin tài khoản đăng nhập Tool Tra Cứu Hóa Đơn Mua Vào:
• Link truy cập: ${appUrl}
• Tên đăng nhập (MST): ${user.username}
• Mật khẩu: ${user.password || '(Liên hệ Admin)'}
• Thời hạn sử dụng đến: ${expiryDate} (${user.daysRemaining} ngày)

* Ghi chú: Thông tin tài khoản Cổng Thuế Tổng cục Thuế được lưu an toàn riêng tại máy tính của Quý khách.`;

    navigator.clipboard.writeText(msg);
    setCopiedMessageId(user.id);
    setTimeout(() => setCopiedMessageId(null), 2500);
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    const matchSearch =
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.fullName && u.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.notes && u.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchSearch) return false;

    if (statusFilter === 'active') return u.isActive && !u.isExpired;
    if (statusFilter === 'expiring_soon') return u.isActive && u.status === 'expiring_soon';
    if (statusFilter === 'expired') return u.isExpired || !u.isActive;
    return true;
  });

  // Statistics
  const totalCount = users.length;
  const activeCount = users.filter(u => u.isActive && !u.isExpired).length;
  const expiringSoonCount = users.filter(u => u.isActive && u.status === 'expiring_soon').length;
  const expiredCount = users.filter(u => u.isExpired || !u.isActive).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Quản Lý Tài Khoản & Gói Cước Người Dùng
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Admin Panel
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tạo MST, cấp mật khẩu và thiết lập thời hạn truy cập (1, 3, 6, 9, 12 tháng)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Database status indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Database:</span>
              {dbStatus?.connected ? (
                <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Neon PostgreSQL
                </span>
              ) : (
                <span className="text-cyan-300 font-semibold inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" /> Local Store
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div className="text-xs text-slate-400 font-medium">Tổng người dùng</div>
              <div className="text-2xl font-black text-white mt-1">{totalCount}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
              <div className="text-xs text-emerald-300 font-medium">Đang hoạt động</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40">
              <div className="text-xs text-amber-300 font-medium">Sắp hết hạn (≤ 7 ngày)</div>
              <div className="text-2xl font-black text-amber-400 mt-1">{expiringSoonCount}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40">
              <div className="text-xs text-rose-300 font-medium">Đã hết hạn / Đã khóa</div>
              <div className="text-2xl font-black text-rose-400 mt-1">{expiredCount}</div>
            </div>
          </div>

          {/* ACTION BAR: SEARCH & CREATE BUTTON */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo MST, tên đơn vị..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="expiring_soon">Sắp hết hạn</option>
                <option value="expired">Đã hết hạn</option>
              </select>

              <button
                onClick={fetchUsers}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Làm mới danh sách"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <button
              onClick={() => {
                setIsCreating(!isCreating);
                if (!newPassword) generateRandomPassword();
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isCreating ? 'Đóng form' : '+ Cấp tài khoản mới'}</span>
            </button>
          </div>

          {/* CREATE USER FORM */}
          {isCreating && (
            <form
              onSubmit={handleCreateUser}
              className="bg-slate-800/80 border border-cyan-500/40 rounded-2xl p-5 space-y-4 shadow-xl animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                  <UserPlus className="w-4 h-4" />
                  <span>Khởi tạo tài khoản người dùng mới (Cấp cho khách hàng)</span>
                </div>
                <div className="text-xs text-slate-400">
                  Hạn sử dụng dự kiến đến: <span className="text-emerald-400 font-bold">{calculatePreviewExpiry(newDurationMonths)}</span>
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Tax Code / Username */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mã số thuế (Tên đăng nhập) *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Ví dụ: 0315897123"
                      value={newMst}
                      onChange={(e) => setNewMst(e.target.value.trim())}
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white font-mono placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tên doanh nghiệp / Người sử dụng
                  </label>
                  <input
                    type="text"
                    placeholder="Công ty TNHH Giải Pháp ABC..."
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Password with generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Mật khẩu cấp cho khách *
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Tạo ngẫu nhiên</span>
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Nhập hoặc tạo ngẫu nhiên"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white font-mono placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Duration Options */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Thời hạn sử dụng (Gói cước theo yêu cầu) *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.months}
                      onClick={() => setNewDurationMonths(opt.months)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                        newDurationMonths === opt.months
                          ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 border-cyan-400 text-white shadow-md'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div>{opt.label}</div>
                      <div className="text-[10px] opacity-75 font-normal mt-0.5">
                        {calculatePreviewExpiry(opt.months)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ghi chú nội bộ
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Khách chị Mai kế toán trưởng, thanh toán đợt 1..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác nhận khởi tạo tài khoản</span>
                </button>
              </div>
            </form>
          )}

          {/* USERS TABLE */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/90 text-slate-400 font-semibold border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Mã số thuế (Username)</th>
                    <th className="py-3 px-4">Doanh nghiệp / Ghi chú</th>
                    <th className="py-3 px-4">Mật khẩu cấp</th>
                    <th className="py-3 px-4">Thời hạn gói</th>
                    <th className="py-3 px-4">Hạn sử dụng</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        {loading ? 'Đang tải danh sách người dùng...' : 'Không tìm thấy tài khoản người dùng phù hợp'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isMasterAdmin = user.role === 'admin' || user.username === 'admin';
                      const expiryFormatted = new Date(user.expiresAt).toLocaleDateString('vi-VN');

                      return (
                        <tr
                          key={user.id}
                          className={`hover:bg-slate-800/50 transition-colors ${
                            user.isExpired ? 'opacity-70 bg-rose-950/10' : ''
                          }`}
                        >
                          {/* Tax Code */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-sm">
                                {user.username}
                              </span>
                              {isMasterAdmin && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  MASTER
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Company Name / Notes */}
                          <td className="py-3 px-4 max-w-[200px]">
                            <div className="font-medium text-slate-200 truncate" title={user.fullName}>
                              {user.fullName || '—'}
                            </div>
                            {user.notes && (
                              <div className="text-[11px] text-slate-500 truncate" title={user.notes}>
                                {user.notes}
                              </div>
                            )}
                          </td>

                          {/* Password */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-cyan-300 font-semibold text-xs">
                                {user.password || '••••••••'}
                              </span>
                              {user.password && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(user.password!, user.id)}
                                  className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                                  title="Sao chép mật khẩu"
                                >
                                  {copiedId === user.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Duration */}
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-300">
                              {isMasterAdmin ? 'Vĩnh viễn' : `${user.durationMonths} tháng`}
                            </span>
                          </td>

                          {/* Expiry Date & Remaining */}
                          <td className="py-3 px-4">
                            {isMasterAdmin ? (
                              <span className="text-emerald-400 font-medium">Không giới hạn</span>
                            ) : (
                              <div>
                                <div className="font-medium text-white flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  <span>{expiryFormatted}</span>
                                </div>
                                <div className="mt-0.5">
                                  {user.isExpired ? (
                                    <span className="text-rose-400 font-bold text-[11px]">
                                      Đã hết hạn
                                    </span>
                                  ) : user.status === 'expiring_soon' ? (
                                    <span className="text-amber-400 font-bold text-[11px]">
                                      Còn {user.daysRemaining} ngày
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400 text-[11px]">
                                      Còn {user.daysRemaining} ngày
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            {!user.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                <Power className="w-2.5 h-2.5" /> Đã khóa
                              </span>
                            ) : user.isExpired ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950 text-rose-400 border border-rose-800">
                                <Clock className="w-2.5 h-2.5" /> Hết hạn
                              </span>
                            ) : user.status === 'expiring_soon' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-400 border border-amber-800">
                                <Clock className="w-2.5 h-2.5" /> Sắp hết hạn
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Hoạt động
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Copy message for client */}
                              {!isMasterAdmin && (
                                <button
                                  type="button"
                                  onClick={() => copyClientMessage(user)}
                                  className="px-2 py-1 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 text-[11px] font-medium transition-colors flex items-center gap-1"
                                  title="Sao chép toàn bộ thông tin tài khoản để gửi tin nhắn cho khách"
                                >
                                  {copiedMessageId === user.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400">Đã chép!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-3 h-3" />
                                      <span>Gửi khách</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Quick Extend dropdown / button */}
                              {!isMasterAdmin && (
                                <div className="relative group inline-block">
                                  <button
                                    type="button"
                                    disabled={extendingUserId === user.id}
                                    className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-[11px] font-medium transition-colors"
                                    title="Gia hạn thêm thời gian sử dụng"
                                  >
                                    + Gia hạn
                                  </button>
                                  <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 py-1 min-w-[120px]">
                                    {DURATION_OPTIONS.map((opt) => (
                                      <button
                                        key={opt.months}
                                        type="button"
                                        onClick={() => handleExtendDuration(user.id, opt.months)}
                                        className="px-3 py-1.5 text-left text-xs hover:bg-slate-700 text-slate-200"
                                      >
                                        +{opt.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Toggle Active status */}
                              {!isMasterAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(user)}
                                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                                    user.isActive
                                      ? 'border-slate-700 text-slate-400 hover:text-amber-400 hover:bg-amber-950/30'
                                      : 'border-emerald-800 text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900'
                                  }`}
                                  title={user.isActive ? 'Khóa tài khoản này' : 'Mở khóa tài khoản'}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete button */}
                              {!isMasterAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user)}
                                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-800 hover:bg-rose-950/30 transition-colors"
                                  title="Xóa tài khoản"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* NEON DATABASE CONFIGURATION INFO */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Kết nối Neon Database (PostgreSQL):</span>
                <p className="mt-0.5 text-slate-400">
                  {dbStatus?.connected ? (
                    <span>Hệ thống đang kết nối trực tiếp đến cụm máy chủ Neon Serverless Postgres. Mọi tài khoản và gói cước được đồng bộ vĩnh viễn trên đám mây.</span>
                  ) : (
                    <span>Dữ liệu đang được bảo lưu tại Local Store. Khi bạn thêm biến <code className="text-cyan-300">DATABASE_URL</code> trong Settings / môi trường, hệ thống sẽ tự động chuyển sang lưu trữ trên Neon PostgreSQL.</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={refreshDbStatus}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs shrink-0 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Kiểm tra kết nối</span>
            </button>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-500">
          <div>
            Thông tin đăng nhập tài khoản Cổng Thuế của từng doanh nghiệp được lưu tại máy tính của họ.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
