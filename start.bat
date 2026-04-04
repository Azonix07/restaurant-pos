@echo off
title Restaurant POS System
color 0B
cls

echo ============================================================
echo     Restaurant POS System - Starting...
echo ============================================================
echo.

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: Check MongoDB is running
sc query MongoDB >nul 2>&1
if %errorLevel% neq 0 (
    echo [i] Starting MongoDB...
    net start MongoDB >nul 2>&1
    if %errorLevel% neq 0 (
        if not exist "%PROJECT_DIR%data\db" mkdir "%PROJECT_DIR%data\db"
        start /min "MongoDB" mongod --dbpath "%PROJECT_DIR%data\db"
        timeout /t 3 /nobreak >nul
    )
)

:: Start backend server
echo [i] Starting POS server...
cd /d "%PROJECT_DIR%backend"
start /min "POS-Backend" node src/server.js

:: Wait for server to be ready
echo [i] Waiting for server to start...
timeout /t 4 /nobreak >nul

:: Get the LAN IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4 Address"') do (
    set "LAN_IP=%%a"
    goto :found_ip
)
:found_ip
set "LAN_IP=%LAN_IP: =%"

echo.
echo ============================================================
echo.
echo     POS System is running!
echo.
echo     Open in browser:
echo         http://localhost:5001
echo.
if defined LAN_IP (
echo     Other devices on WiFi:
echo         http://%LAN_IP%:5001
echo.
)
echo     Login:
echo         Email:    admin@restaurant.com
echo         Password: admin123
echo.
echo     Close this window to stop the server.
echo.
echo ============================================================
echo.

:: Open browser
start http://localhost:5001

:: Keep window open (closing it stops the server)
echo Press Ctrl+C or close this window to stop the server.
:loop
timeout /t 60 /nobreak >nul
goto :loop
