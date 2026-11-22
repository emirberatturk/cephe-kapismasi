@echo off
chcp 65001 >nul
title Cephe Kapismasi - Kurulum
cd /d "%~dp0"
echo.
echo  ==========================================
echo    CEPHE KAPISMASI - KURULUM
echo  ==========================================
echo.
where node >nul 2>nul
if errorlevel 1 goto :node_yok
for /f "tokens=1 delims=." %%v in ('node -v') do set "SURUM=%%v"
set "SURUM=%SURUM:v=%"
if %SURUM% LSS 20 goto :node_eski
echo  Node.js bulundu:
node -v
echo.
echo  Paketler kuruluyor (sabit surumler, kurulum betikleri kapali)...
call npm ci --ignore-scripts --no-fund --no-audit
if errorlevel 1 goto :npm_hata
echo.
echo  ==========================================
echo    KURULUM TAMAM
echo  ==========================================
echo.
echo  Simdi baslat.bat dosyasini cift tikla. Kontrol paneli tarayicida acilir.
echo  Panelin en ustundeki "Yayin oncesi kontrol" listesi neyin eksik oldugunu gosterir.
echo.
pause
exit /b 0

:node_yok
echo  Node.js bulunamadi. Indirme sayfasi aciliyor: "LTS" surumunu kur,
echo  kurulumda varsayilan secenekleri birak, sonra bu dosyayi tekrar calistir.
start "" https://nodejs.org/tr/download
pause
exit /b 1

:node_eski
echo  Node.js surumun eski (en az 20 gerekli). Yeni surumu kur, sonra tekrar dene.
start "" https://nodejs.org/tr/download
pause
exit /b 1

:npm_hata
echo  Paketler kurulamadi. Internet baglantini kontrol edip tekrar dene.
pause
exit /b 1
