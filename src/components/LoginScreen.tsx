import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Database, 
  Settings, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight,
  ExternalLink,
  Server
} from 'lucide-react';
import { 
  loginWithSupabase, 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  clearSupabaseConfig, 
  SupabaseUser 
} from '../services/supabaseClient';

interface LoginScreenProps {
  onLoginSuccess: (user: SupabaseUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Supabase Configuration Modal State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [configStatus, setConfigStatus] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const config = getSupabaseConfig();
    setIsConfigured(config.isConfigured);
    setSupabaseUrl(config.url.includes('default-tax-einvoice') ? '' : config.url);
    setSupabaseAnonKey(config.anonKey.includes('placeholder') ? '' : config.anonKey);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!usernameOrEmail.trim()) {
      setErrorMessage('Vui lòng nhập Tên đăng nhập hoặc Email.');
      return;
    }
    if (!password) {
      setErrorMessage('Vui lòng nhập Mật khẩu.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await loginWithSupabase(usernameOrEmail, password, rememberMe);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMessage(result.error || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi kết nối máy chủ Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim()) {
      setConfigStatus('Vui lòng nhập Supabase Project URL (VD: https://xyz.supabase.co)');
      return;
    }
    if (!supabaseAnonKey.trim()) {
      setConfigStatus('Vui lòng nhập Supabase Anon Key.');
      return;
    }

    saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
    setIsConfigured(true);
    setConfigStatus('Đã lưu cấu hình kết nối Supabase thành công!');
    setTimeout(() => {
      setShowConfigModal(false);
      setConfigStatus(null);
    }, 1200);
  };

  const handleResetConfig = () => {
    clearSupabaseConfig();
    setSupabaseUrl('');
    setSupabaseAnonKey('');
    setIsConfigured(false);
    setConfigStatus('Đã xóa cấu hình riêng. Sử dụng kết nối mặc định.');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background decoration grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Decorative ambient glowing orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 backdrop-blur-xl">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 px-6 py-6 text-white relative">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-emerald-300" />
            </div>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-black/25 hover:bg-black/40 text-slate-200 hover:text-white rounded-lg border border-white/10 transition-all cursor-pointer"
              title="Cấu hình kết nối Supabase Database"
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>{isConfigured ? 'Supabase: Đã kết nối' : 'Cấu hình Supabase'}</span>
            </button>
          </div>

          <h1 className="text-lg font-bold tracking-tight text-white font-mono">
            TRA CỨU HÓA ĐƠN ĐIỆN TỬ
          </h1>
          <p className="text-xs text-blue-100/80 mt-0.5">
            Xác thực tài khoản người dùng lưu trữ trên Supabase
          </p>
        </div>

        {/* Form Container */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username or Email Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Tài khoản / Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="Nhập tên đăng nhập hoặc email..."
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Mật khẩu
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu tài khoản..."
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                  required
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

            {/* Remember Login Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500 focus:ring-offset-slate-900"
                />
                <span className="text-xs text-slate-300 font-medium">Ghi nhớ đăng nhập trên máy này</span>
              </label>

              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Cấu hình Supabase
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang xác thực tài khoản Supabase...</span>
                </>
              ) : (
                <>
                  <span>Đăng Nhập Hệ Thống</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>


        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800/60 text-center">
          <p className="text-[11px] text-slate-500 font-mono">
            Bản quyền thuộc về Bình Phan @ 2026 • Hỗ trợ Zalo: 0949 539 969
          </p>
        </div>
      </div>

      {/* Supabase Connection Setup Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    Cấu Hình Kết Nối Supabase
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Nhập thông tin kết nối Database lưu trữ tài khoản người dùng
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowConfigModal(false);
                  setConfigStatus(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-4 text-xs">
              {configStatus && (
                <div className={`p-3 rounded-xl flex items-center gap-2 text-xs ${
                  configStatus.includes('thành công') 
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                    : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{configStatus}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project-id.supabase.co"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-600 focus:outline-hidden focus:border-blue-500"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Lấy từ Supabase Dashboard: Project Settings &rarr; API &rarr; Project URL
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider">
                  Supabase Anon Public Key
                </label>
                <textarea
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs placeholder-slate-600 focus:outline-hidden focus:border-blue-500"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Lấy từ Supabase Dashboard: Project Settings &rarr; API &rarr; Project API keys (anon public)
                </p>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-blue-400" />
                  Cấu trúc bảng tài khoản trên Supabase:
                </p>
                <p>
                  Hệ thống hỗ trợ cả <strong>Supabase Auth</strong> mặc định hoặc bảng <code>users</code> với các cột: <code>username</code>, <code>email</code>, <code>password</code>, <code>role</code>, <code>status</code>.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResetConfig}
                  className="px-3 py-2 text-rose-400 hover:text-rose-300 text-xs hover:bg-rose-500/10 rounded-xl transition-colors"
                >
                  Khôi phục mặc định
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition-colors"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    Lưu cấu hình
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
