@echo off
chcp 65001 >nul
title TOOL TAI HOA DON DIEN TU TONG CUC THUE - POWERSHELL NATIVE
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0gdt_crawler.ps1"
pause
