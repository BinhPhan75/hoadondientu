@echo off
chcp 65001 >nul
title ĐÓNG GÓI TOOL TRA CỨU HÓA ĐƠN THUẾ SANG FILE EXE (WINDOWS)
color 0A

echo ==============================================================================
echo    CÔNG CỤ ĐÓNG GÓI TOOL HÓA ĐƠN ĐIỆN TỬ SANG FILE CHẠY TRỰC TIẾP (.EXE)
echo    Tự động kết nối Neon Database - Không bị Cổng Thuế chặn IP nước ngoài!
echo ==============================================================================
echo.

:: 1. Kiểm tra Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [✗ LỖI]: Máy tính của bạn chưa cài đặt Python!
    echo Vui lòng tải và cài đặt Python 3.10+ từ https://www.python.org/
    echo Lưu ý: Khi cài đặt, hãy tích chọn vào ô [Add Python to PATH].
    echo.
    pause
    exit /b 1
)

echo [1/3] Đang cài đặt / cập nhật các thư viện phụ thuộc (PyInstaller, pg8000, requests, selenium)...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller

if %errorlevel% neq 0 (
    color 0C
    echo [✗ CẢNH BÁO]: Cài đặt một số gói phụ thuộc gặp lỗi, vẫn tiếp tục đóng gói...
    echo.
)

echo.
echo [2/3] Bắt đầu đóng gói mã nguồn sang tệp độc lập Tool_TraCuu_HoaDon_GDT.exe...
echo Quá trình này có thể mất 1 - 2 phút, vui lòng đợi...
echo.

:: Tạo file EXE độc lập (onefile)
pyinstaller --noconfirm --clean --onefile --console ^
    --name "Tool_TraCuu_HoaDon_GDT" ^
    --hidden-import="pg8000" ^
    --hidden-import="pg8000.native" ^
    --hidden-import="scramp" ^
    --hidden-import="requests" ^
    --hidden-import="urllib3" ^
    --hidden-import="selenium" ^
    --hidden-import="openpyxl" ^
    gdt_selenium_crawler.py

if %errorlevel% neq 0 (
    color 0C
    echo [✗ LỖI]: Quá trình đóng gói EXE bằng PyInstaller thất bại.
    echo Vui lòng kiểm tra lại log hiển thị ở trên.
    pause
    exit /b 1
)

echo.
echo [3/3] Hoàn tất đóng gói thành công!
echo Tệp thực thi EXE đã được tạo tại thư mục: dist\Tool_TraCuu_HoaDon_GDT.exe
echo.
if exist "dist\Tool_TraCuu_HoaDon_GDT.exe" (
    copy /Y "dist\Tool_TraCuu_HoaDon_GDT.exe" ".\Tool_TraCuu_HoaDon_GDT.exe" >nul
    echo [✓] Đã sao chép tệp ra thư mục hiện tại: Tool_TraCuu_HoaDon_GDT.exe
)

echo ==============================================================================
echo HƯỚNG DẪN SỬ DỤNG:
echo 1. Nhấp đúp chuột trực tiếp vào file "Tool_TraCuu_HoaDon_GDT.exe" để chạy.
echo 2. Nhập Mã số thuế / Tên đăng nhập và Mật khẩu phần mềm (được tạo trong Admin Neon).
echo 3. Phần mềm sẽ tự động xác thực hạn dùng với Neon Database và tải hóa đơn Cổng Thuế!
echo ==============================================================================
echo.
pause
