import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

export interface WebUserRecord {
  id: number | string;
  username: string; // Mã số thuế (hoặc tài khoản quản trị)
  password: string; // Mật khẩu tài khoản
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

const CONFIG_FILE = path.join(process.cwd(), 'neon_config.json');

let pool: Pool | null = null;
let currentPoolUrl: string | null = null;
let isPostgresConnected = false;
let isTableInitialized = false;
let lastPostgresError: string | null = null;

function cleanDatabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim().replace(/^["']|["']$/g, '').trim();
  // Loại bỏ channel_binding nếu có để tránh lỗi SCRAM của node-postgres
  url = url.replace(/([?&])channel_binding=[^&]*(&|$)/gi, (_m, p1, p2) => (p2 ? p1 : ''));
  return url;
}

function getStoredDatabaseUrl(): string {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data.databaseUrl === 'string' && data.databaseUrl.trim()) {
        return cleanDatabaseUrl(data.databaseUrl);
      }
    }
  } catch {
    // Ignore read error
  }
  return '';
}

function getDatabaseConfig(): { url: string; source: string } {
  // Đọc lại biến môi trường từ .env nếu có
  try {
    dotenv.config({ override: true });
  } catch {
    // Ignore dotenv error
  }

  // Ưu tiên 1: Cấu hình lưu trữ cục bộ nếu có
  const storedUrl = getStoredDatabaseUrl();
  if (storedUrl) {
    return {
      source: 'CONFIG_FILE',
      url: storedUrl
    };
  }

  // Ưu tiên 2: Biến môi trường hệ thống
  const candidates: Array<[string, string | undefined]> = [
    ['POSTGRES_URL', process.env.POSTGRES_URL],
    ['DATABASE_URL', process.env.DATABASE_URL],
    ['POSTGRES_PRISMA_URL', process.env.POSTGRES_PRISMA_URL],
    ['POSTGRES_URL_NON_POOLING', process.env.POSTGRES_URL_NON_POOLING],
    ['DATABASE_URL_UNPOOLED', process.env.DATABASE_URL_UNPOOLED],
    ['NEON_DATABASE_URL', process.env.NEON_DATABASE_URL]
  ];
  const selected = candidates.find(([, value]) => value && value.trim());
  let url = cleanDatabaseUrl(selected?.[1] || '');

  // Kiểm tra nếu hệ thống cung cấp các biến thành phần riêng biệt
  if (!url && process.env.POSTGRES_HOST && process.env.POSTGRES_USER) {
    const user = encodeURIComponent(process.env.POSTGRES_USER || '');
    const pass = encodeURIComponent(process.env.POSTGRES_PASSWORD || '');
    const host = process.env.POSTGRES_HOST;
    const db = process.env.POSTGRES_DATABASE || 'postgres';
    url = `postgresql://${user}:${pass}@${host}/${db}?sslmode=require`;
    return {
      source: 'POSTGRES_HOST_CONFIG',
      url
    };
  }

  return {
    source: selected ? selected[0] : 'NONE',
    url
  };
}

export function getDatabaseUrl(): string {
  return getDatabaseConfig().url;
}

export function getMaskedDatabaseUrl(): string {
  const url = getDatabaseUrl();
  if (!url) return '';
  try {
    const u = new URL(url);
    const pass = u.password ? '***' : '';
    return `${u.protocol}//${u.username}:${pass}@${u.host}${u.pathname}`;
  } catch {
    return url.replace(/:([^:@]+)@/, ':***@');
  }
}

function safeDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgresql://[redacted]')
    .replace(/password=[^&\s]+/gi, 'password=[redacted]');
}

/**
 * Lấy hoặc khởi tạo kết nối PostgreSQL
 */
export function getPostgresPool(): Pool | null {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  // Tự động giải phóng và kết nối lại nếu chuỗi kết nối DATABASE_URL thay đổi
  if (pool && currentPoolUrl !== databaseUrl) {
    try {
      pool.end();
    } catch {
      // Ignore
    }
    pool = null;
    isPostgresConnected = false;
    isTableInitialized = false;
  }

  if (!pool) {
    try {
      const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
      pool = new Pool({
        connectionString: databaseUrl,
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        max: process.env.VERCEL ? 3 : 10,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 15000
      });

      currentPoolUrl = databaseUrl;

      pool.on('error', (err) => {
        isPostgresConnected = false;
        lastPostgresError = safeDatabaseError(err);
      });
    } catch (err: any) {
      lastPostgresError = safeDatabaseError(err);
      return null;
    }
  }

  return pool;
}

/**
 * Đặt lại Pool kết nối khi thay đổi chuỗi kết nối
 */
export async function resetPostgresPool(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
    } catch {
      // Ignore end error
    }
    pool = null;
  }
  currentPoolUrl = null;
  isPostgresConnected = false;
  isTableInitialized = false;
  lastPostgresError = null;
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
 * Bổ sung các thông số tính toán thời hạn sử dụng
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
 * Khởi tạo cơ sở dữ liệu:
 * - Kiểm tra kết nối tới Database
 * - Tạo bảng web_users và index nếu chưa tồn tại
 */
export async function initDatabase(): Promise<{ success: boolean; type: 'neon_postgres'; message: string }> {
  const databaseConfig = getDatabaseConfig();
  const databaseUrl = databaseConfig.url;

  if (!databaseUrl) {
    isPostgresConnected = false;
    lastPostgresError = 'Chưa cấu hình DATABASE_URL';
    return {
      success: false,
      type: 'neon_postgres',
      message: 'Chưa cấu hình biến môi trường DATABASE_URL.'
    };
  }

  const p = getPostgresPool();
  if (!p) {
    isPostgresConnected = false;
    return {
      success: false,
      type: 'neon_postgres',
      message: `Khởi tạo kết nối cơ sở dữ liệu thất bại: ${lastPostgresError || 'Lỗi không xác định'}`
    };
  }

  try {
    // 1. Kiểm tra truy vấn cơ bản
    await p.query('SELECT 1;');

    // 2. Tạo bảng web_users nếu chưa tồn tại
    if (!isTableInitialized) {
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

      // Nếu quản trị viên cung cấp thông tin tài khoản khởi tạo qua biến môi trường
      const initialAdminUser = (process.env.ADMIN_INITIAL_USERNAME || '').trim();
      const initialAdminPass = (process.env.ADMIN_INITIAL_PASSWORD || '').trim();
      if (initialAdminUser && initialAdminPass) {
        try {
          const countRes = await p.query('SELECT COUNT(*) as count FROM web_users;');
          const count = parseInt(countRes.rows[0]?.count || '0', 10);
          if (count === 0) {
            const adminExpiry = calculateExpiryDate(new Date(), 120);
            await p.query(`
              INSERT INTO web_users (username, password, full_name, role, duration_months, created_at, expires_at, is_active, notes)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (username) DO NOTHING;
            `, [
              initialAdminUser,
              initialAdminPass,
              process.env.ADMIN_INITIAL_FULLNAME || 'Quản trị viên',
              'admin',
              120,
              new Date().toISOString(),
              adminExpiry.toISOString(),
              true,
              'Tài khoản khởi tạo từ cấu hình ban đầu'
            ]);
          }
        } catch {
          // Silent catch for initial admin check
        }
      }

      isTableInitialized = true;
    }

    isPostgresConnected = true;
    lastPostgresError = null;
    return {
      success: true,
      type: 'neon_postgres',
      message: `Đã kết nối thành công tới cơ sở dữ liệu.`
    };
  } catch (err: any) {
    const safeErr = safeDatabaseError(err);
    lastPostgresError = safeErr;
    isPostgresConnected = false;

    let friendlyMsg = safeErr;
    if (safeErr.includes('password authentication failed')) {
      friendlyMsg = 'Mật khẩu xác thực cơ sở dữ liệu trong DATABASE_URL không chính xác hoặc đã bị thay đổi.';
    } else if (safeErr.includes('ENOTFOUND') || safeErr.includes('getaddrinfo')) {
      friendlyMsg = 'Không tìm thấy máy chủ cơ sở dữ liệu. Vui lòng kiểm tra lại cấu hình DATABASE_URL.';
    }

    return {
      success: false,
      type: 'neon_postgres',
      message: `Lỗi kết nối cơ sở dữ liệu: ${friendlyMsg}`
    };
  }
}

/**
 * Kiểm tra trạng thái Database
 */
export async function getDatabaseStatus(): Promise<{
  connected: boolean;
  type: 'neon_postgres';
  message: string;
  totalUsers: number;
  databaseUrlConfigured: boolean;
  connectionSource?: string;
  maskedUrl?: string;
}> {
  const databaseConfig = getDatabaseConfig();
  const dbConfigured = Boolean(databaseConfig.url);

  if (!dbConfigured) {
    return {
      connected: false,
      type: 'neon_postgres',
      message: 'Chưa cấu hình chuỗi kết nối DATABASE_URL.',
      totalUsers: 0,
      databaseUrlConfigured: false,
      connectionSource: '',
      maskedUrl: ''
    };
  }

  const p = getPostgresPool();
  if (p) {
    try {
      await p.query('SELECT 1;');
      const res = await p.query('SELECT COUNT(*) as count FROM web_users;');
      const totalUsers = parseInt(res.rows[0]?.count || '0', 10);
      isPostgresConnected = true;
      lastPostgresError = null;
      return {
        connected: true,
        type: 'neon_postgres',
        message: 'Cơ sở dữ liệu đang hoạt động ổn định',
        totalUsers,
        databaseUrlConfigured: true,
        connectionSource: databaseConfig.source,
        maskedUrl: getMaskedDatabaseUrl()
      };
    } catch (err: any) {
      const message = safeDatabaseError(err);
      isPostgresConnected = false;
      lastPostgresError = message;

      let friendlyMsg = message;
      if (message.includes('password authentication failed')) {
        friendlyMsg = 'Mật khẩu xác thực trong chuỗi kết nối không chính xác hoặc đã bị thay đổi.';
      }

      return {
        connected: false,
        type: 'neon_postgres',
        message: `Lỗi kết nối cơ sở dữ liệu: ${friendlyMsg}`,
        totalUsers: 0,
        databaseUrlConfigured: true,
        connectionSource: databaseConfig.source,
        maskedUrl: getMaskedDatabaseUrl()
      };
    }
  }

  return {
    connected: false,
    type: 'neon_postgres',
    message: `Không thể tạo pool kết nối cơ sở dữ liệu: ${lastPostgresError || 'Lỗi không xác định'}`,
    totalUsers: 0,
    databaseUrlConfigured: true,
    connectionSource: databaseConfig.source,
    maskedUrl: getMaskedDatabaseUrl()
  };
}

/**
 * Kiểm tra và lưu chuỗi kết nối mới
 */
export async function saveNeonDatabaseUrl(
  rawUrl: string,
  initialAdmin?: { username?: string; password?: string; fullName?: string }
): Promise<{ success: boolean; message: string; connected?: boolean }> {
  const cleaned = cleanDatabaseUrl(rawUrl);
  if (!cleaned) {
    return { success: false, message: 'Chuỗi kết nối không được để trống.' };
  }

  // 1. Thử nghiệm kết nối trước khi lưu
  const testPool = new Pool({
    connectionString: cleaned,
    ssl: cleaned.includes('localhost') ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 7000
  });

  try {
    await testPool.query('SELECT 1;');
  } catch (err: any) {
    try {
      await testPool.end();
    } catch {
      // Ignore
    }
    const safeErr = safeDatabaseError(err);
    let friendly = safeErr;
    if (safeErr.includes('password authentication failed')) {
      friendly = 'Mật khẩu xác thực cơ sở dữ liệu không chính xác.';
    }
    return {
      success: false,
      message: `Kết nối cơ sở dữ liệu thất bại: ${friendly}`
    };
  }

  // 2. Tạo bảng web_users trên database mới nếu chưa có
  try {
    await testPool.query(`
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

    // Tạo admin khởi tạo nếu được cung cấp
    if (initialAdmin?.username && initialAdmin?.password) {
      const adminExpiry = calculateExpiryDate(new Date(), 120);
      await testPool.query(`
        INSERT INTO web_users (username, password, full_name, role, duration_months, created_at, expires_at, is_active, notes)
        VALUES ($1, $2, $3, 'admin', 120, $4, $5, true, $6)
        ON CONFLICT (username) DO NOTHING;
      `, [
        initialAdmin.username.trim(),
        initialAdmin.password.trim(),
        initialAdmin.fullName || 'Quản trị viên',
        new Date().toISOString(),
        adminExpiry.toISOString(),
        'Khởi tạo qua cấu hình'
      ]);
    }
  } catch {
    // Silent catch
  } finally {
    try {
      await testPool.end();
    } catch {
      // Ignore
    }
  }

  // 3. Ghi vào tệp cấu hình
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(
        {
          databaseUrl: cleaned,
          updatedAt: new Date().toISOString()
        },
        null,
        2
      ),
      'utf-8'
    );

    await resetPostgresPool();
    await initDatabase();

    return {
      success: true,
      connected: true,
      message: 'Đã kết nối và lưu cấu hình cơ sở dữ liệu thành công!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Không thể lưu cấu hình: ${err.message}`
    };
  }
}

/**
 * Tìm người dùng theo tên đăng nhập (Mã số thuế hoặc quản trị)
 */
export async function findUserByUsername(username: string): Promise<WebUserView | null> {
  const cleanUsername = (username || '').trim();
  if (!cleanUsername) return null;

  const p = getPostgresPool();
  if (!p) {
    throw new Error('Chưa kết nối cơ sở dữ liệu. Vui lòng cấu hình biến môi trường DATABASE_URL.');
  }

  try {
    const res = await p.query(
      'SELECT * FROM web_users WHERE LOWER(username) = LOWER($1) LIMIT 1;',
      [cleanUsername]
    );
    if (res.rows.length > 0) {
      return enrichUserWithStatus(res.rows[0]);
    }
    return null;
  } catch (err: any) {
    throw new Error(`Lỗi truy vấn dữ liệu: ${safeDatabaseError(err)}`);
  }
}

/**
 * Lấy danh sách tất cả người dùng (Dành cho Quản trị viên)
 */
export async function getAllUsers(): Promise<WebUserView[]> {
  const p = getPostgresPool();
  if (!p) {
    throw new Error('Chưa kết nối cơ sở dữ liệu.');
  }

  try {
    const res = await p.query('SELECT * FROM web_users ORDER BY id DESC;');
    return res.rows.map(enrichUserWithStatus);
  } catch (err: any) {
    throw new Error(`Lỗi lấy danh sách tài khoản: ${safeDatabaseError(err)}`);
  }
}

/**
 * Thêm người dùng mới
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
  if (!p) {
    return { success: false, error: 'Không thể kết nối cơ sở dữ liệu.' };
  }

  try {
    const checkRes = await p.query('SELECT id FROM web_users WHERE LOWER(username) = LOWER($1);', [cleanUsername]);
    if (checkRes.rows.length > 0) {
      return { success: false, error: `Tài khoản / Mã số thuế "${cleanUsername}" đã tồn tại trong hệ thống.` };
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
    return { success: false, error: `Lỗi lưu người dùng: ${safeDatabaseError(err)}` };
  }
}

/**
 * Cập nhật thông tin / gia hạn / đổi mật khẩu người dùng
 */
export async function updateUser(
  id: number | string,
  params: {
    password?: string;
    fullName?: string;
    extendMonths?: number;
    newExpiresAt?: string;
    isActive?: boolean;
    notes?: string;
  }
): Promise<{ success: boolean; user?: WebUserView; error?: string }> {
  const p = getPostgresPool();
  if (!p) {
    return { success: false, error: 'Không thể kết nối cơ sở dữ liệu.' };
  }

  try {
    const curRes = await p.query('SELECT * FROM web_users WHERE id = $1;', [id]);
    if (curRes.rows.length === 0) {
      return { success: false, error: 'Không tìm thấy tài khoản người dùng.' };
    }

    const current = curRes.rows[0];
    let expiresAt = new Date(current.expires_at);

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
    return { success: false, error: `Lỗi cập nhật: ${safeDatabaseError(err)}` };
  }
}

/**
 * Xóa người dùng (Không cho phép xóa admin master)
 */
export async function deleteUser(id: number | string): Promise<{ success: boolean; error?: string }> {
  const p = getPostgresPool();
  if (!p) {
    return { success: false, error: 'Không thể kết nối cơ sở dữ liệu.' };
  }

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
    return { success: false, error: `Lỗi xóa người dùng: ${safeDatabaseError(err)}` };
  }
}
