import express, { Request, Response, Router } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import {
  initDatabase,
  getDatabaseStatus,
  findUserByUsername,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  WebUserView
} from '../src/db/neonDb.js';

const app = express();
const apiRouter = Router();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Interface & Type Definitions
interface GDTSession {
  token: string;
  cookieHeader: string;
  taxCode: string;
  taxpayerName: string;
  address: string;
  isRealGDT: boolean;
  createdAt: string;
}

interface WebSessionInfo {
  token: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: number;
}

// In-Memory Session Store
let currentSession: GDTSession | null = null;
const webSessions = new Map<string, WebSessionInfo>();

function formatUserForClient(user: WebUserView) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name || '',
    role: user.role,
    durationMonths: user.duration_months,
    createdAt: user.created_at,
    expiresAt: user.expires_at,
    isActive: user.is_active,
    notes: user.notes || '',
    daysRemaining: user.days_remaining,
    isExpired: user.is_expired,
    status: user.status
  };
}

function formatUserForAdmin(user: WebUserView) {
  return {
    ...formatUserForClient(user),
    password: user.password
  };
}

async function authenticateWebUser(req: Request, res: Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập hệ thống.' });
  }

  const token = authHeader.substring(7).trim();
  const session = webSessions.get(token);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
  }

  const user = await findUserByUsername(session.username);
  if (!user || !user.is_active) {
    webSessions.delete(token);
    return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa.' });
  }

  if (user.is_expired && user.role !== 'admin') {
    webSessions.delete(token);
    return res.status(403).json({
      success: false,
      expired: true,
      message: `Tài khoản của bạn đã hết hạn sử dụng (${new Date(user.expires_at).toLocaleDateString('vi-VN')}). Vui lòng liên hệ quản trị viên để gia hạn.`
    });
  }

  (req as any).webUser = user;
  next();
}

function requireAdmin(req: Request, res: Response, next: express.NextFunction) {
  const user = (req as any).webUser;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền quản trị viên.' });
  }
  next();
}

// ==========================================
// ROUTES API GDT
// ==========================================

// 1. Root & Healthcheck
apiRouter.get('/', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'GDT Express API Service is running' });
});

// 2. Login / Connect GDT
apiRouter.post('/gdt/login', (req: Request, res: Response) => {
  const { taxCode, password } = req.body;

  if (!taxCode || !password) {
    return res.status(400).json({ error: 'Mã số thuế và mật khẩu không được để trống' });
  }

  currentSession = {
    token: `mock-token-${Date.now()}`,
    cookieHeader: `session_id=${Date.now()}`,
    taxCode,
    taxpayerName: 'Doanh Nghiệp Demo',
    address: 'Việt Nam',
    isRealGDT: false,
    createdAt: new Date().toISOString()
  };

  return res.json({
    success: true,
    message: 'Đăng nhập GDT thành công',
    session: currentSession
  });
});

// 3. Logout / Clear Session
apiRouter.post('/gdt/logout', (req: Request, res: Response) => {
  currentSession = null;
  return res.json({ success: true, message: 'Đã xóa phiên đăng nhập GDT' });
});

// 4. Get Invoices List
apiRouter.get('/gdt/invoices', (req: Request, res: Response) => {
  if (!currentSession) {
    return res.status(401).json({ error: 'Chưa kết nối với hệ thống GDT' });
  }

  const { fromDate, toDate, type = 'sold' } = req.query;

  return res.json({
    success: true,
    filter: { fromDate, toDate, type },
    total: 0,
    data: []
  });
});

// 5. Sync Invoices Data
apiRouter.post('/gdt/sync', (req: Request, res: Response) => {
  if (!currentSession) {
    return res.status(401).json({ error: 'Chưa kết nối với hệ thống GDT' });
  }

  return res.json({
    success: true,
    message: 'Đã hoàn tất đồng bộ dữ liệu hóa đơn',
    syncedAt: new Date().toISOString()
  });
});

// 6. Get Current Status
apiRouter.get('/gdt/status', (req: Request, res: Response) => {
  res.json({
    isConnected: !!currentSession,
    isRealGDT: currentSession?.isRealGDT ?? false,
    session: currentSession
      ? {
          taxCode: currentSession.taxCode,
          taxpayerName: currentSession.taxpayerName,
          address: currentSession.address,
          createdAt: currentSession.createdAt
        }
      : null
  });
});

// ==========================================
// WEB AUTHENTICATION & NEON DATABASE
// ==========================================

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const dbInit = await initDatabase();
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã số thuế và mật khẩu.' });
    }

    if (!dbInit.success) {
      return res.status(503).json({
        success: false,
        message: dbInit.message || 'Hệ thống chưa kết nối tới Neon Database. Vui lòng cấu hình DATABASE_URL/NEON_DATABASE_URL trước khi đăng nhập.'
      });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Tên đăng nhập (Mã số thuế) hoặc mật khẩu không đúng.' });
    }

    if (user.password !== String(password).trim()) {
      return res.status(401).json({ success: false, message: 'Mật khẩu không chính xác.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Tài khoản này đang bị tạm khóa. Vui lòng liên hệ quản trị viên.' });
    }

    if (user.is_expired && user.role !== 'admin') {
      const expiryFormatted = new Date(user.expires_at).toLocaleDateString('vi-VN');
      return res.status(403).json({
        success: false,
        expired: true,
        message: `Tài khoản của bạn đã hết hạn sử dụng vào ngày ${expiryFormatted}. Vui lòng liên hệ quản trị viên để gia hạn gói cước.`
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    webSessions.set(token, {
      token,
      username: user.username,
      role: user.role,
      createdAt: Date.now()
    });

    res.json({
      success: true,
      token,
      user: formatUserForClient(user)
    });
  } catch (err: any) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ success: false, message: err.message || 'Lỗi xử lý đăng nhập' });
  }
});

apiRouter.get('/auth/me', authenticateWebUser, async (req: Request, res: Response) => {
  res.json({
    success: true,
    user: formatUserForClient((req as any).webUser)
  });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    webSessions.delete(token);
  }
  res.json({ success: true });
});

apiRouter.get('/admin/users', authenticateWebUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await getAllUsers();
    res.json({
      success: true,
      users: users.map(formatUserForAdmin)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/admin/users', authenticateWebUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { username, password, fullName, durationMonths, notes, role } = req.body || {};
    const result = await createUser({
      username,
      password,
      fullName,
      durationMonths: Number(durationMonths) || 1,
      notes,
      role: role === 'admin' ? 'admin' : 'user'
    });

    if (!result.success || !result.user) {
      return res.status(400).json({ success: false, message: result.error || 'Không thể tạo người dùng' });
    }

    res.json({
      success: true,
      user: formatUserForAdmin(result.user)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.put('/admin/users/:id', authenticateWebUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { password, fullName, extendMonths, newExpiresAt, isActive, notes } = req.body || {};
    const result = await updateUser(req.params.id, {
      password,
      fullName,
      extendMonths: extendMonths ? Number(extendMonths) : undefined,
      newExpiresAt,
      isActive,
      notes
    });

    if (!result.success || !result.user) {
      return res.status(400).json({ success: false, message: result.error || 'Cập nhật thất bại' });
    }

    res.json({
      success: true,
      user: formatUserForAdmin(result.user)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.delete('/admin/users/:id', authenticateWebUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await deleteUser(req.params.id);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/admin/db-status', async (req: Request, res: Response) => {
  try {
    const status = await getDatabaseStatus();
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// SERVER INITIALIZATION & EXPORT
// ==========================================

app.use('/api', apiRouter);
app.use(apiRouter);

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Server] Express App đang chạy tại http://localhost:${PORT}`);
  });
}

export default app;
