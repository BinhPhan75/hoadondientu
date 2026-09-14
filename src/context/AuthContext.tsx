import React, { createContext, useContext, useState, useEffect } from 'react';
import { WebUser, DbStatus } from '../types/auth';

interface AuthContextType {
  currentUser: WebUser | null;
  token: string | null;
  isLoading: boolean;
  dbStatus: DbStatus | null;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string; expired?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshDbStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'gdt_web_auth_token';
const USER_STORAGE_KEY = 'gdt_web_auth_user';

/**
 * Phân tích phản hồi an toàn từ server, tránh lỗi JSON.parse khi server trả về plain text / 500 HTML
 */
async function parseResponseSafe(res: Response): Promise<{ success: boolean; data?: any; errorText?: string }> {
  try {
    const rawText = await res.text();
    if (!rawText) {
      return { success: res.ok, data: {} };
    }
    try {
      const json = JSON.parse(rawText);
      return { success: res.ok && json.success !== false, data: json };
    } catch {
      // Server trả về plain text hoặc trang lỗi HTML (VD: 502/503/500 proxy)
      let message = 'Máy chủ đang phản hồi không đúng định dạng JSON.';
      if (res.status === 500 || res.status === 502 || res.status === 503 || rawText.includes('A server error')) {
        message = 'Máy chủ đang khởi động hoặc kết nối Database bị gián đoạn. Vui lòng bấm đăng nhập lại sau vài giây.';
      } else if (rawText.length > 0 && rawText.length < 120) {
        message = rawText;
      }
      return { success: false, errorText: message };
    }
  } catch (readErr: any) {
    return { success: false, errorText: readErr.message || 'Lỗi đọc phản hồi mạng.' };
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<WebUser | null>(() => {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);

  const refreshDbStatus = async () => {
    try {
      const res = await fetch('/api/admin/db-status');
      const parsed = await parseResponseSafe(res);
      if (parsed.data?.success) {
        setDbStatus(parsed.data);
      }
    } catch (err) {
      console.warn('[AuthContext] Lỗi kiểm tra trạng thái DB:', err);
    }
  };

  const refreshUser = async () => {
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!savedToken) {
      setCurrentUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${savedToken}`
        }
      });

      const parsed = await parseResponseSafe(res);
      if (parsed.success && parsed.data?.user) {
        setCurrentUser(parsed.data.user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(parsed.data.user));
        setToken(savedToken);
      } else {
        // Phiên không hợp lệ
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        setCurrentUser(null);
        setToken(null);
      }
    } catch (err) {
      console.warn('[AuthContext] Lỗi xác thực token hiện tại:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
    refreshDbStatus();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; message?: string; expired?: boolean }> => {
    try {
      const doRequest = async () => {
        return await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin',
          body: JSON.stringify({ username, password })
        });
      };

      let res = await doRequest();
      let parsed = await parseResponseSafe(res);

      // Nếu gặp lỗi server đang khởi động (502, 503, 504 hoặc warmup HTML), tự động thử lại sau 1.2s
      if (!parsed.data && (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 500 || parsed.errorText?.includes('khởi động'))) {
        console.log('[Auth] Máy chủ đang warmup, tự động thử lại sau 1.2 giây...');
        await new Promise((resolve) => setTimeout(resolve, 1200));
        res = await doRequest();
        parsed = await parseResponseSafe(res);
      }

      if (!parsed.success || !parsed.data) {
        const errorMsg = parsed.data?.message || parsed.errorText || 'Đăng nhập không thành công.';
        return {
          success: false,
          message: errorMsg,
          expired: parsed.data?.expired || false
        };
      }

      const data = parsed.data;

      // Lưu phiên đăng nhập
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      setToken(data.token);
      setCurrentUser(data.user);

      // Cập nhật trạng thái DB
      refreshDbStatus();

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Lỗi kết nối máy chủ. Vui lòng kiểm tra lại đường truyền mạng.'
      };
    }
  };

  const logout = async () => {
    const currentToken = token || localStorage.getItem(TOKEN_STORAGE_KEY);
    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`
          }
        });
      } catch {}
    }

    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        isLoading,
        dbStatus,
        login,
        logout,
        refreshUser,
        refreshDbStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
