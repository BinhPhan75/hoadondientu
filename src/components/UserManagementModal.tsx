import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  ShieldCheck, 
  RefreshCw, 
  Trash2, 
  Lock, 
  Unlock, 
  Key, 
  CheckCircle2, 
  AlertCircle,
  Database
} from 'lucide-react';
import { 
  SupabaseUser, 
  listSupabaseUsers, 
  createSupabaseUser, 
  updateSupabaseUser,
  getSupabaseConfig
} from '../services/supabaseClient';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SupabaseUser | null;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [users, setUsers] = useState<SupabaseUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'accountant' | 'user'>('accountant');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await listSupabaseUsers();
      setUsers(data);
    } catch {
      setStatusMessage({ type: 'error', text: 'Không thể tải danh sách tài khoản từ Supabase.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setStatusMessage(null);
      setShowAddForm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập Tên đăng nhập.' });
      return;
    }
    if (!newPassword.trim()) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập Mật khẩu.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await createSupabaseUser({
      username: newUsername.trim(),
      email: newEmail.trim() || `${newUsername.trim()}@hoadondientu.vn`,
      fullName: newFullName.trim() || newUsername.trim(),
      password: newPassword.trim(),
      role: newRole,
      status: 'active',
    });

    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: `Tạo tài khoản "${newUsername}" trên Supabase thành công!` });
      setNewUsername('');
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setShowAddForm(false);
      fetchUsers();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Lỗi khi tạo tài khoản trên Supabase.' });
    }
  };

  const handleToggleStatus = async (user: SupabaseUser) => {
    const nextStatus = user.status === 'locked' ? 'active' : 'locked';
    const res = await updateSupabaseUser(user.id, { status: nextStatus });
    if (res.success) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: nextStatus } : u));
      setStatusMessage({ 
        type: 'success', 
        text: `Đã ${nextStatus === 'locked' ? 'khóa' : 'mở khóa'} tài khoản ${user.username}.` 
      });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Cập nhật trạng thái thất bại.' });
    }
  };

  const isConfigured = getSupabaseConfig().isConfigured;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <span>QUẢN LÝ NGƯỜI DÙNG HỆ THỐNG</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 font-sans">
                  Supabase Auth
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Quản lý phân quyền và danh sách tài khoản truy cập hệ thống tra cứu hóa đơn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {statusMessage && (
            <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium' 
                : 'bg-rose-50 border border-rose-200 text-rose-800 font-medium'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="flex-1">{statusMessage.text}</span>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-600 font-medium">
              Tổng số tài khoản: <strong className="text-slate-900">{users.length}</strong>
              {!isConfigured && (
                <span className="ml-2 text-amber-600 text-[11px] font-normal">
                  (Đang chạy chế độ tài khoản cục bộ / cấu hình Supabase qua màn hình đăng nhập)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchUsers}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{showAddForm ? 'Đóng biểu mẫu' : 'Thêm người dùng mới'}</span>
              </button>
            </div>
          </div>

          {/* New User Form Accordion */}
          {showAddForm && (
            <form onSubmit={handleCreateUser} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="font-semibold text-xs text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>Tạo tài khoản người dùng mới trên Supabase</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Tên đăng nhập <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="VD: ketoan_kho1"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Mật khẩu khởi tạo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Phân quyền (Role)
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-blue-500 font-medium"
                  >
                    <option value="accountant">Kế toán viên (Tra cứu & Tải hóa đơn)</option>
                    <option value="user">Người dùng (Chỉ xem)</option>
                    <option value="admin">Quản trị viên (Toàn quyền Admin)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs rounded-lg border border-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>Lưu tài khoản vào Supabase</span>
                </button>
              </div>
            </form>
          )}

          {/* Users Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/80 text-slate-700 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Tài khoản / Họ tên</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Phân quyền</th>
                  <th className="px-4 py-2.5">Trạng thái</th>
                  <th className="px-4 py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      Chưa có tài khoản nào được lưu trên Supabase.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isAdmin = u.role === 'admin';
                    const isSelf = currentUser?.username === u.username || currentUser?.email === u.email;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 font-mono">{u.username}</div>
                          {u.fullName && <div className="text-[11px] text-slate-500">{u.fullName}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                          {u.email || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isAdmin 
                              ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                              : u.role === 'accountant'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {isAdmin ? 'Admin' : u.role === 'accountant' ? 'Kế toán' : 'Người dùng'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                            u.status === 'locked'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'locked' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            {u.status === 'locked' ? 'Đã khóa' : 'Hoạt động'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(u)}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                u.status === 'locked'
                                  ? 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                                  : 'text-amber-700 border-amber-300 hover:bg-amber-50'
                              }`}
                              title={u.status === 'locked' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                            >
                              {u.status === 'locked' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {isSelf && (
                            <span className="text-[10px] text-slate-400 font-medium italic">
                              (Đang đăng nhập)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
