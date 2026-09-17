@echo off
chcp 65001 >nul
title TOOL TỰ ĐỘNG HÓA TẢI HÓA ĐƠN ĐIỆN TỬ TỔNG CỤC THUẾ (GDT V3.0)
echo ==============================================================================
echo  KHOI DONG TOOL TAI HOA DON DIEN TU TONG CUC THUE GDT (NATIVE V3.0)
echo  Ho tro moi phien ban Python (Python 3.9.11, 3.10, 3.11, 3.12+)
echo ==============================================================================
echo.

:: 1. Kiem tra lenh python trong PATH
set PYTHON_CMD=
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=python
    goto :FOUND_PYTHON
)

:: 2. Kiem tra py launcher tren Windows
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=py
    goto :FOUND_PYTHON
)

:: 3. Tim trong thu muc cai dat mac dinh cua Windows (bao gom Python 3.9)
for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do (
    if exist "%%D\python.exe" (
        set PYTHON_CMD="%%D\python.exe"
        goto :FOUND_PYTHON
    )
)
for /d %%D in ("C:\Program Files\Python3*") do (
    if exist "%%D\python.exe" (
        set PYTHON_CMD="%%D\python.exe"
        goto :FOUND_PYTHON
    )
)
for /d %%D in ("C:\Python3*") do (
    if exist "%%D\python.exe" (
        set PYTHON_CMD="%%D\python.exe"
        goto :FOUND_PYTHON
    )
)

:: 4. Neu khong tim thay Python: Cho phep chay ngay bang PowerShell
cls
echo ==============================================================================
echo  THONG BAO: KHONG TIM THAY PYTHON TRONG SYSTEM PATH
echo ==============================================================================
echo.
echo He thong khong tim thay lenh python. Ban co the chon chay truc tiep:
echo.
echo   [1] Chay ngay bang Windows PowerShell (100%% Native - Khong can Python)
echo   [2] Tu dong cai dat Python 3 qua Windows winget
echo   [3] Thoat
echo.
set /p USER_CHOICE="Nhap lua chon cua ban (1/2/3) [Mac dinh: 1]: "
if "%USER_CHOICE%"=="" set USER_CHOICE=1

if "%USER_CHOICE%"=="1" (
    echo.
    echo Dang khoi dong tool truc tiep qua Windows PowerShell...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0gdt_crawler.ps1"
    goto :END
)

if "%USER_CHOICE%"=="2" (
    echo.
    echo Dang tu dong cai dat Python qua winget...
    winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    echo Cai dat hoan tat! Vui long dong va chay lai file nay.
    goto :END
)

goto :END

:FOUND_PYTHON
echo [OK] Da tim thay trinh thuc thi Python tren may: %PYTHON_CMD%
echo Dang ket noi Cổng Tong cuc Thue...
echo.
%PYTHON_CMD% "%~dp0gdt_selenium_crawler.py"

:END
echo.
echo ==============================================================================
echo  CHUONG TRINH DA DUNG. CUA SO NAY DUOC GIU LAI DE BAN DOC KET QUA.
echo ==============================================================================
echo.
pause
