@echo off
chcp 65001 >nul
title Tắt Máy Chủ TOEIC Moon Pro
cd /d "%~dp0"
echo =======================================================
echo   Đang tắt máy chủ TOEIC Moon Pro (localhost:3000)...
echo =======================================================
powershell -NoProfile -Command "Get-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"
echo.
echo [OK] Đã tắt máy chủ localhost:3000 thành công!
timeout /t 2 >nul
exit
