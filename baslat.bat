@echo off
chcp 65001 >nul
title Cephe Kapismasi - Sunucu
cd /d "%~dp0"
if not exist node_modules (
  echo Once kurulum.bat dosyasini calistir.
  pause
  exit /b 1
)
start "" http://localhost:5077
node server.js
pause
