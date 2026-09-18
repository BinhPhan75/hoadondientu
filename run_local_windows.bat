@echo off
chcp 65001 >nul
title HỆ THỐNG TRA CỨU HÓA ĐƠN THUẾ - CHẠY TRÊN MÁY TÍNH VIỆT NAM (LOCAL DESKTOP)
color 0A

echo ==============================================================================
echo    HỆ THỐNG TRA CỨU HÓA ĐƠN ĐIỆN TỬ TỔNG CỤC THUẾ (BẢN CHẠY CỤC BỘ WINDOWS)
echo    Chạy trực tiếp trên IP mạng Việt Nam - Bỏ qua hoàn toàn lỗi chặn Vercel!
echo    Tự động kết nối Neon Database quản lý tài khoản & phân quyền
echo ==============================================================================
echo.

:: 1. Kiểm tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [✗ LỖI]: Máy tính chưa cài đặt Node.js!
    echo Vui lòng tải Node.js (phiên bản LTS) từ: https://nodejs.org/
    echo Sau khi cài đặt xong, hãy mở lại file này.
    echo.
    pause
    exit /b 1
)

:: 2. Kiểm tra node_modules
if not exist "node_modules\" (
    echo [1/3] Đang cài đặt thư viện phụ thuộc lần đầu...
    call npm install
)

:: 3. Build ứng dụng nếu chưa có dist
if not exist "dist\server.cjs" (
    echo [2/3] Đang biên dịch ứng dụng sang bản chạy độc lập...
    call npm run build
)

echo.
echo [3/3] Đang khởi động máy chủ cục bộ trên cổng 3000...
echo Mở trình duyệt Web tại: http://localhost:3000
echo.

:: Mở trình duyệt mặc định sau 2 giây
start "" http://localhost:3000

:: Khởi chạy ứng dụng
node dist/server.cjs

pause
