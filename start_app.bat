@echo off
chcp 65001 >nul
title TOEIC Moon Pro Launcher
cd /d "%~dp0"
wscript.exe "%~dp0start_app.vbs"
exit
