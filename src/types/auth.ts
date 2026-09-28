export interface WebUser {
  id: number | string;
  username: string; // Mã số thuế (MST) hoặc admin
  fullName?: string;
  role: 'admin' | 'user';
  durationMonths: number;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  notes?: string;
  daysRemaining: number;
  isExpired: boolean;
  status: 'active' | 'expiring_soon' | 'expired' | 'disabled';
}

export interface AuthSession {
  token: string;
  user: WebUser;
}

export interface DbStatus {
  connected: boolean;
  type: 'neon_postgres' | 'local_file' | 'in_memory_mock' | 'remote_webapp';
  message: string;
  totalUsers: number;
  databaseUrlConfigured: boolean;
  connectionSource?: string;
  maskedUrl?: string;
}
