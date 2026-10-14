@echo off
title App TOEIC Moon 550+ Pro with Cloudflare
chcp 65001 > nul
echo ========================================================
echo  🚀 KHOI DONG APP TOEIC MOON.VN & CLOUDFLARE TUNNEL
echo ========================================================
echo.

taskkill /f /im node.exe > nul 2>&1
timeout /t 1 > nul

start "TOEIC Server" /min cmd /c "node server.js"
echo [1/2] Node.js Server da chay tai: http://localhost:3000
echo.
echo [2/2] Dang tao duong link Cloudflare cong khai de hoc tren dien thoai...
echo.
npx -y cloudflared tunnel --url http://localhost:3000
pause
