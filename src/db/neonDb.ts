import 'dotenv/config';
import { Pool, QueryResult } from 'pg';
import fs from 'fs';
import path from 'path';

export interface WebUserRecord {
  id: number | string;
  username: string; // Mã số thuế (hoặc admin)
  password: string; // Mật khẩu do Admin cấp
  full_name?: string; // Tên công ty / Tên người dùng
  role: 'admin' | 'user';
  duration_months: number; // 1, 3, 6, 9, 12
  created_at: string; // ISO string
  expires_at: string; // ISO string
  is_active: boolean;
  notes?: string;
}

export interface WebUserView extends WebUserRecord {
  days_remaining: number;
  is_expired: boolean;
  status: 'active' | 'expiring_soon' | 'expired' | 'disabled';
}

// Fallback JSON data directory for local/offline dev or if Neon URL not yet provided
const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_USERS_FILE = path.join(DATA_DIR, 'web_users.json');

let pool: Pool | null = null;
let isPostgresConnected = false;
let isTableInitialized = false;

function getDatabaseConfig(): { url: string; source: string } {
  const candidates: Array<[string, string | undefined]> = [
    ['POSTGRES_URL', process.env.POSTGRES_URL],
    ['DATABASE_URL', process.env.DATABASE_URL],
    ['NEON_DATABASE_URL', process.env.NEON_DATABASE_URL],
    ['POSTGRES_PRISMA_URL', process.env.POSTGRES_PRISMA_URL],
    ['POSTGRES_URL_NON_POOLING', process.env.POSTGRES_URL_NON_POOLING],
    ['DATABASE_URL_UNPOOLED', process.env.DATABASE_URL_UNPOOLED]
  ];
  const selected = candidates.find(([, value]) => value && value.trim());
  let url = (selected?.[1] || '').trim().replace(/^["']|["']$/g, '').trim();

  // Kiểm tra nếu Vercel cung cấp các biến thành phần riêng biệt
  if (!url && process.env.POSTGRES_HOST && process.env.POSTGRES_USER) {
    const user = encodeURIComponent(process.env.POSTGRES_USER || '');
    const pass = encodeURIComponent(process.env.POSTGRES_PASSWORD || '');
    const host = process.env.POSTGRES_HOST;
    const db = process.env.POSTGRES_DATABASE || 'neondb';
    url = `postgresql://${user}:${pass}@${host}/${db}?sslmode=require`;
    return {
      source: 'POSTGRES_HOST_CONFIG',
      url
    };
  }

  return {
    source: selected?.[0] || '',
    url
  };
}

function getDatabaseUrl(): string {
  return getDatabaseConfig().url;
}

function safeDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgresql://[redacted]')
    .replace(/password=[^&\s]+/gi, 'password=[redacted]');
}

/**
 * Lấy hoặc khởi tạo kết nối PostgreSQL (Neon Serverless hoặc tiêu chuẩn)
 */
export function getPostgresPool(): Pool | null {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  if (!pool) {
    try {
      const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
      pool = new Pool({
        connectionString: databaseUrl,
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        max: process.env.VERCEL ? 3 : 10,
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 20000
      });

      pool.on('error', (err) => {
        console.warn('[Neon PostgreSQL] Pool background error:', err.message);
        isPostgresConnected = false;
      });
    } catch (err: any) {
      console.error('[Neon PostgreSQL] Khởi tạo pool thất bại:', err.message);
      return null;
    }
  }

  return pool;
}

/**
 * Tính toán ngày hết hạn dựa trên ngày bắt đầu và số tháng được cấp
 */
export function calculateExpiryDate(startDate: Date, durationMonths: number): Date {
  const expiry = new Date(startDate);
  expiry.setMonth(expiry.getMonth() + Number(durationMonths || 1));
  expiry.setHours(23, 59, 59, 999);
  return expiry;
}

/**
 * Bổ sung các thông số tính toán thời hạn sử dụng (còn lại bao nhiêu ngày, đã hết hạn chưa)
 */
export function enrichUserWithStatus(user: WebUserRecord): WebUserView {
  const now = new Date();
  const expiresAt = new Date(user.expires_at);
  const diffTime = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isExpired = daysRemaining < 0 || !user.is_active;

  let status: 'active' | 'expiring_soon' | 'expired' | 'disabled' = 'active';
  if (!user.is_active) {
    status = 'disabled';
  } else if (daysRemaining < 0) {
    status = 'expired';
  } else if (daysRemaining <= 7) {
    status = 'expiring_soon';
  }

  return {
    ...user,
    days_remaining: Math.max(0, daysRemaining),
    is_expired: isExpired,
    status
  };
}

/**
 * Khởi tạo bảng dữ liệu và tài khoản Admin mặc định
 */
export async function initDatabase(): Promise<{ success: boolean; type: 'neon_postgres' | 'local_file'; message: string }> {
  const databaseConfig = getDatabaseConfig();
  const databaseUrl = databaseConfig.url;
  if (!databaseUrl) {
    isPostgresConnected = false;
    return {
      success: false,
      type: 'local_file',
      message: 'Chưa cấu hình connection string Neon trên Vercel (POSTGRES_URL, DATABASE_URL hoặc NEON_DATABASE_URL).'
    };
  }

  const p = getPostgresPool();

  if (p) {
    try {
      if (!isTableInitialized) {
        // Kiểm tra nhanh bảng web_users có tồn tại không
        let tableExists = false;
        try {
          await p.query('SELECT 1 FROM web_users LIMIT 1;');
          tableExists = true;
        } catch {
          tableExists = false;
        }

        if (!tableExists) {
          await p.query(`
            CREATE TABLE IF NOT EXISTS web_users (
              id SERIAL PRIMARY KEY,
              username VARCHAR(50) UNIQUE NOT NULL,
              password VARCHAR(255) NOT NULL,
              full_name VARCHAR(255),
              role VARCHAR(20) DEFAULT 'user',
              duration_months INTEGER DEFAULT 1,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
              is_active BOOLEAN DEFAULT TRUE,
              notes TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_web_users_username ON web_users(username);
          `);
          console.log('[Neon PostgreSQL] ✓ Đã khởi tạo bảng web_users trên Neon.');
        }

        // Tự động kiểm tra và tạo tài khoản Admin mặc định nếu chưa có tài khoản nào
        try {
          const countRes = await p.query('SELECT COUNT(*) as count FROM web_users;');
          const count = parseInt(countRes.rows[0]?.count || '0', 10);
          if (count === 0) {
            const defaultAdminExpiry = calculateExpiryDate(new Date(), 120);
            await p.query(`
              INSERT INTO web_users (username, password, full_name, role, duration_months, created_at, expires_at, is_active, notes)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (username) DO NOTHING;
            `, [
              'admin',
              process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123',
              'Quản trị viên hệ thống',
              'admin',
              120,
              new Date().toISOString(),
              defaultAdminExpiry.toISOString(),
              true,
              'Tài khoản Quản trị viên khởi tạo tự động từ Neon DB'
            ]);
            console.log('[Neon PostgreSQL] ✓ Đã tạo tài khoản Admin mặc định (admin / Admin@123)');
          }
        } catch (seedErr) {
          console.warn('[Neon PostgreSQL] Kiểm tra admin seed:', seedErr);
        }

        isTableInitialized = true;
      }

      isPostgresConnected = true;
      return {
        success: true,
        type: 'neon_postgres',
        message: `Đã kết nối thành công tới Neon PostgreSQL (${databaseConfig.source}).`
      };
    } catch (err: any) {
      const safeErr = safeDatabaseError(err);
      console.warn('[Neon PostgreSQL] Không thể kết nối tới Neon:', safeErr);
      isPostgresConnected = false;
      return {
        success: false,
        type: 'local_file',
        message: `Lỗi kết nối Neon PostgreSQL (${databaseConfig.source}): ${safeErr}`
      };
    }
  }

  return {
    success: false,
    type: 'local_file',
    message: `Không thể khởi tạo pool PostgreSQL (${databaseConfig.source}). Vui lòng kiểm tra connection string.`
  };
}

/**
 * Đảm bảo file JSON cục bộ tồn tại
 */
function ensureLocalUsersFile(): WebUserRecord[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(LOCAL_USERS_FILE)) {
    const initialUsers: WebUserRecord[] = [];
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
    return initialUsers;
  }

  try {
    const raw = fs.readFileSync(LOCAL_USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {}

  return [];
}

function saveLocalUsers(users: WebUserRecord[]) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

/**
 * Kiểm tra trạng thái Database
 */
export async function getDatabaseStatus(): Promise<{
  connected: boolean;
  type: 'neon_postgres' | 'local_file';
  message: string;
  totalUsers: number;
  databaseUrlConfigured: boolean;
  connectionSource?: string;
}> {
  const p = getPostgresPool();
  const databaseConfig = getDatabaseConfig();
  const dbConfigured = Boolean(databaseConfig.url);

  if (p) {
    try {
      await p.query('SELECT 1;');
      const res = await p.query('SELECT COUNT(*) as count FROM web_users;');
      const totalUsers = parseInt(res.rows[0]?.count || '0', 10);
      return {
        connected: true,
        type: 'neon_postgres',
        message: 'Neon PostgreSQL đang hoạt động ổn định',
        totalUsers,
        databaseUrlConfigured: true,
        connectionSource: databaseConfig.source
      };
    } catch (err: any) {
      const message = safeDatabaseError(err);
      console.warn('[DB Status] Error checking Postgres:', message);
      return {
        connected: false,
        type: 'neon_postgres',
        message: `Neon PostgreSQL lỗi (${message})`,
        totalUsers: 0,
        databaseUrlConfigured: true,
        connectionSource: databaseConfig.source
      };
    }
  }

  return {
    connected: false,
    type: 'neon_postgres',
    message: dbConfigured 
      ? 'Không thể truy vấn Neon PostgreSQL. Không sử dụng dữ liệu local.'
      : 'Chưa cấu hình connection string cho Neon',
    totalUsers: 0,
    databaseUrlConfigured: dbConfigured,
    connectionSource: databaseConfig.source
  };
}

/**
 * Tìm người dùng theo tên đăng nhập (Mã số thuế hoặc admin)
 */
export async function findUserByUsername(username: string): Promise<WebUserView | null> {
  const cleanUsername = (username || '').trim().toLowerCase();
  if (!cleanUsername) return null;

  const dbConfigured = Boolean(getDatabaseUrl());
  if (!dbConfigured) {
    return null;
  }

  const p = getPostgresPool();
  if (p) {
    try {
      const res = await p.query(
        'SELECT * FROM web_users WHERE LOWER(username) = LOWER($1) LIMIT 1;',
        [cleanUsername]
      );
      if (res.rows.length > 0) {
        return enrichUserWithStatus(res.rows[0]);
      }
    } catch (err: any) {
      console.warn('[findUserByUsername] PostgreSQL error:', err.message);
    }
  }

  return null;
}

/**
 * Lấy danh sách tất cả người dùng (Dành cho Quản trị viên)
 */
export async function getAllUsers(): Promise<WebUserView[]> {
  const dbConfigured = Boolean(getDatabaseUrl());
  if (!dbConfigured) {
    return [];
  }

  const p = getPostgresPool();
  if (p) {
    try {
      const res = await p.query('SELECT * FROM web_users ORDER BY id DESC;');
      return res.rows.map(enrichUserWithStatus);
    } catch (err: any) {
      console.warn('[getAllUsers] PostgreSQL error:', err.message);
    }
  }

  return [];
}

/**
 * Thêm người dùng mới (Do Admin tạo)
 */
export async function createUser(params: {
  username: string; // Mã số thuế
  password: string; // Mật khẩu
  fullName?: string;
  durationMonths: number; // 1, 3, 6, 9, 12
  notes?: string;
  role?: 'admin' | 'user';
}): Promise<{ success: boolean; user?: WebUserView; error?: string }> {
  const cleanUsername = (params.username || '').trim();
  const cleanPassword = (params.password || '').trim();

  if (!cleanUsername) {
    return { success: false, error: 'Mã số thuế (Tên đăng nhập) không được để trống' };
  }
  if (!cleanPassword) {
    return { success: false, error: 'Mật khẩu không được để trống' };
  }

  const durationMonths = Number(params.durationMonths) || 1;
  const now = new Date();
  const expiresAt = calculateExpiryDate(now, durationMonths);
  const role = params.role || 'user';

  const p = getPostgresPool();
  if (p) {
    try {
      // Kiểm tra trùng lặp
      const checkRes = await p.query('SELECT id FROM web_users WHERE LOWER(username) = LOWER($1);', [cleanUsername]);
      if (checkRes.rows.length > 0) {
        return { success: false, error: `Mã số thuế "${cleanUsername}" đã tồn tại trên hệ thống.` };
      }

      const insertRes = await p.query(`
        INSERT INTO web_users (username, password, full_name, role, duration_months, expires_at, is_active, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `, [
        cleanUsername,
        cleanPassword,
        params.fullName || '',
        role,
        durationMonths,
        expiresAt.toISOString(),
        true,
        params.notes || ''
      ]);

      const newUser = enrichUserWithStatus(insertRes.rows[0]);
      return { success: true, user: newUser };
    } catch (err: any) {
      console.error('[createUser] PostgreSQL insert error:', err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'Không thể kết nối Neon PostgreSQL để tạo người dùng.' };
}

/**
 * Cập nhật thông tin / gia hạn / đổi mật khẩu người dùng
 */
export async function updateUser(
  id: number | string,
  params: {
    password?: string;
    fullName?: string;
    extendMonths?: number; // Gia hạn thêm 1, 3, 6, 9, 12 tháng
    newExpiresAt?: string;
    isActive?: boolean;
    notes?: string;
  }
): Promise<{ success: boolean; user?: WebUserView; error?: string }> {
  const p = getPostgresPool();

  if (p) {
    try {
      const curRes = await p.query('SELECT * FROM web_users WHERE id = $1;', [id]);
      if (curRes.rows.length === 0) {
        return { success: false, error: 'Không tìm thấy người dùng cần cập nhật.' };
      }

      const current = curRes.rows[0];
      let expiresAt = new Date(current.expires_at);

      // Nếu có yêu cầu gia hạn thêm tháng
      if (params.extendMonths) {
        const baseDate = expiresAt.getTime() < Date.now() ? new Date() : expiresAt;
        expiresAt = calculateExpiryDate(baseDate, params.extendMonths);
      } else if (params.newExpiresAt) {
        expiresAt = new Date(params.newExpiresAt);
      }

      const password = params.password !== undefined && params.password.trim() !== '' 
        ? params.password.trim() 
        : current.password;
      const fullName = params.fullName !== undefined ? params.fullName : current.full_name;
      const isActive = params.isActive !== undefined ? params.isActive : current.is_active;
      const notes = params.notes !== undefined ? params.notes : current.notes;

      const updateRes = await p.query(`
        UPDATE web_users
        SET password = $1, full_name = $2, expires_at = $3, is_active = $4, notes = $5
        WHERE id = $6
        RETURNING *;
      `, [password, fullName, expiresAt.toISOString(), isActive, notes, id]);

      return { success: true, user: enrichUserWithStatus(updateRes.rows[0]) };
    } catch (err: any) {
      console.error('[updateUser] PostgreSQL update error:', err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'Không thể kết nối Neon PostgreSQL để cập nhật người dùng.' };
}

/**
 * Xóa người dùng (Không cho phép xóa admin master)
 */
export async function deleteUser(id: number | string): Promise<{ success: boolean; error?: string }> {
  const p = getPostgresPool();

  if (p) {
    try {
      const curRes = await p.query('SELECT role, username FROM web_users WHERE id = $1;', [id]);
      if (curRes.rows.length === 0) {
        return { success: false, error: 'Không tìm thấy người dùng' };
      }
      if (curRes.rows[0].role === 'admin' || curRes.rows[0].username === 'admin') {
        return { success: false, error: 'Không thể xóa tài khoản Quản trị viên Master.' };
      }

      await p.query('DELETE FROM web_users WHERE id = $1;', [id]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'Không thể kết nối Neon PostgreSQL để xóa người dùng.' };
}
