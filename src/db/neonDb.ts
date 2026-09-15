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

function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  ).trim().replace(/^["']|["']$/g, '').trim();
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
        max: 10,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000
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
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    isPostgresConnected = false;
    return {
      success: false,
      type: 'local_file',
      message: 'Chưa cấu hình connection string Neon (DATABASE_URL, NEON_DATABASE_URL hoặc POSTGRES_URL).'
    };
  }

  const p = getPostgresPool();

  if (p) {
    try {
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

      console.log('[Neon PostgreSQL] ✓ Kết nối Neon thành công, bảng web_users đã sẵn sàng.');

      isPostgresConnected = true;
      return {
        success: true,
        type: 'neon_postgres',
        message: 'Đã kết nối thành công tới Database Neon PostgreSQL.'
      };
    } catch (err: any) {
      console.warn('[Neon PostgreSQL] Không thể kết nối hoặc khởi tạo bảng trên Neon:', err.message);
      isPostgresConnected = false;
      return {
        success: false,
        type: 'local_file',
        message: 'Không thể kết nối tới Neon PostgreSQL. Vui lòng kiểm tra connection string và quyền truy cập.'
      };
    }
  }

  return {
    success: false,
    type: 'local_file',
    message: 'Không thể khởi tạo pool PostgreSQL. Vui lòng kiểm tra connection string và cấu hình Neon.'
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
}> {
  const p = getPostgresPool();
  const dbConfigured = Boolean(getDatabaseUrl());

  if (p) {
    try {
      const res = await p.query('SELECT COUNT(*) as count FROM web_users;');
      const totalUsers = parseInt(res.rows[0]?.count || '0', 10);
      return {
        connected: true,
        type: 'neon_postgres',
        message: 'Neon PostgreSQL đang hoạt động ổn định',
        totalUsers,
        databaseUrlConfigured: true
      };
    } catch (err: any) {
      console.warn('[DB Status] Error checking Postgres:', err.message);
    }
  }

  return {
    connected: false,
    type: 'neon_postgres',
    message: dbConfigured 
      ? 'Không thể truy vấn Neon PostgreSQL. Không sử dụng dữ liệu local.'
      : 'Chưa cấu hình connection string cho Neon',
    totalUsers: 0,
    databaseUrlConfigured: dbConfigured
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
