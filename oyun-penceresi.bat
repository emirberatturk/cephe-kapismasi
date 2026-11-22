@echo off
chcp 65001 >nul
title Cephe Kapismasi - Oyun penceresi
cd /d "%~dp0"
set "ADRES=http://127.0.0.1:5077/oyun"
curl -s -o nul --max-time 2 %ADRES%
if errorlevel 1 goto :sunucu_yok
set "TARAYICI=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%TARAYICI%" set "TARAYICI=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%TARAYICI%" set "TARAYICI=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%TARAYICI%" goto :tarayici_yok
rem Ayri profil: ana tarayicina dokunmaz. Arka planda kalsa da oyun yavaslamasin diye kisitlamalar kapali.
start "" "%TARAYICI%" --app=%ADRES% --user-data-dir="%~dp0data\oyun-penceresi" --window-size=580,1032 --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --no-first-run --no-default-browser-check
exit /b 0

:sunucu_yok
echo.
echo  Oyun sunucusu kapali. Once baslat.bat ile oyunu baslat, sonra bu dosyayi ac.
echo.
pause
exit /b 1

:tarayici_yok
echo.
echo  Edge ya da Chrome bulunamadi.
echo.
pause
exit /b 1
