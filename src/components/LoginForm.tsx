import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, KeyRound, Building2, Eye, EyeOff, AlertCircle, CheckCircle2, Database, Clock, Sparkles } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { login, dbStatus } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpiredError, setIsExpiredError] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsExpiredError(false);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMessage('Vui lòng nhập Mã số thuế (Tên đăng nhập).');
      return;
    }
    if (!password) {
      setErrorMessage('Vui lòng nhập Mật khẩu truy cập.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(cleanUsername, password);
      if (result.success) {
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(result.message || 'Đăng nhập không thành công.');
        if (result.expired) {
          setIsExpiredError(true);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillAdmin = () => {
    setUsername('admin');
    setPassword('admin@2026');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Background decoration elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20 mb-3">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <Shield className="w-7 h-7 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">
            Tool Tra Cứu Hóa Đơn Mua Vào
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Đăng nhập hệ thống bằng Mã Số Thuế doanh nghiệp
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {/* Error Banner */}
          {errorMessage && (
            <div
              className={`mb-5 p-4 rounded-xl border flex items-start gap-3 text-sm animate-in fade-in duration-200 ${
                isExpiredError
                  ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
                  : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
              }`}
            >
              {isExpiredError ? (
                <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-semibold">{isExpiredError ? 'Tài khoản hết hạn' : 'Đăng nhập thất bại'}</div>
                <div className="mt-0.5 leading-relaxed">{errorMessage}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Tax Code Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Mã số thuế (Tên đăng nhập)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.trim())}
                  placeholder="Ví dụ: 0315897123"
                  autoComplete="username"
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm font-medium transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Mật khẩu truy cập
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu do Quản trị cấp"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm font-medium transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Đang xác thực tài khoản...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đăng nhập hệ thống</span>
                </>
              )}
            </button>
          </form>

          {/* Tax Credentials Safety Notice */}
          <div className="mt-6 pt-4 border-t border-slate-700/60 text-xs text-slate-400 leading-relaxed flex items-start gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300">Bảo mật đa tầng:</span> Thông tin đăng nhập Cổng Tổng cục Thuế (Mật khẩu Thuế) được lưu trữ riêng tại trình duyệt máy tính cá nhân của Quý khách.
            </div>
          </div>

          {/* Admin shortcut for first setup */}
          <div className="mt-4 pt-3 border-t border-slate-700/30 flex items-center justify-between text-xs text-slate-500">
            <span>Tài khoản Quản trị mặc định:</span>
            <button
              type="button"
              onClick={handleFillAdmin}
              className="text-cyan-400 hover:text-cyan-300 font-mono hover:underline flex items-center gap-1 cursor-pointer"
              title="Điền nhanh thông tin tài khoản Quản trị viên Master"
            >
              <Sparkles className="w-3 h-3" />
              <span>admin / admin@2026</span>
            </button>
          </div>
        </div>

        {/* Database Status Indicator */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-400 shadow-sm">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Database:</span>
            {dbStatus?.connected ? (
              <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Neon PostgreSQL ({dbStatus.totalUsers} tài khoản)
              </span>
            ) : (
              <span className="text-cyan-300 font-medium inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Local Store ({dbStatus?.totalUsers || 1} tài khoản)
              </span>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500 mt-4">
          Bản quyền thuộc về BinhPhan@2026 • Hỗ trợ gia hạn qua Zalo/Hotline
        </div>
      </div>
    </div>
  );
};
