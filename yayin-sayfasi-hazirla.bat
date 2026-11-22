@echo off
chcp 65001 >nul
title Cephe Kapismasi - Yayin sayfasi
cd /d "%~dp0"
node araclar\yayin-sayfasi.mjs
if errorlevel 1 goto :hata
explorer "%~dp0yayin-sayfasi"
start "" https://app.netlify.com/drop
pause
exit /b 0
:hata
echo Yayin sayfasi hazirlanamadi.
pause
exit /b 1
