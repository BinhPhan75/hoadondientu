import express, { Request, Response, Router } from 'express';
import cors from 'cors';

const app = express();
const apiRouter = Router();

// Middleware
app.use(cors());
app.use(express.json());

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

// In-Memory Session Store
let currentSession: GDTSession | null = null;

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

  // Giả lập lưu Session (Có thể thay bằng logic gọi API GDT thực tế)
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

  // Trả về dữ liệu hóa đơn mẫu
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
// SERVER INITIALIZATION & EXPORT
// ==========================================

// Đăng ký Router cho cả đường dẫn gốc và tiền tố /api
app.use('/api', apiRouter);
app.use(apiRouter);

// Khởi chạy HTTP Server trên Local / VPS
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Server] Express App đang chạy tại http://localhost:${PORT}`);
  });
}

// Export default app cho Vercel Serverless Functions
export default app;
