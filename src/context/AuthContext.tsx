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
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDbStatus(data);
        }
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

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
          setToken(savedToken);
        } else {
          // Phiên không hợp lệ
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(USER_STORAGE_KEY);
          setCurrentUser(null);
          setToken(null);
        }
      } else {
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Đăng nhập không thành công',
          expired: data.expired || false
        };
      }

      // Lưu phiên
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
        message: err.message || 'Lỗi kết nối máy chủ'
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
