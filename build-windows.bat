@echo off
title Restaurant POS - Windows Installer Builder
echo ============================================
echo   Restaurant POS - Build Windows Installer
echo ============================================
echo.

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

echo [1/5] Installing backend dependencies...
cd /d "%~dp0backend"
call npm install --omit=dev
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend install failed
    pause
    exit /b 1
)

echo [2/5] Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend install failed
    pause
    exit /b 1
)

echo [3/5] Building frontend...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend build failed
    pause
    exit /b 1
)

echo [4/5] Installing Electron dependencies...
cd /d "%~dp0electron"
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Electron install failed
    pause
    exit /b 1
)

echo [5/5] Building Windows installer...
call npx electron-builder --win --x64
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Installer build failed
    pause
    exit /b 1
)

echo.
echo ============================================
echo   BUILD COMPLETE!
echo ============================================
echo.
echo Your installer is at:
echo   electron\dist\Restaurant-POS-Setup-1.0.0.exe
echo.
echo Share this .exe file - users just double-click to install!
echo.

:: Open the dist folder
explorer "%~dp0electron\dist"
pause
