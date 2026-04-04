@echo off
title Restaurant POS - Desktop App
color 0B
cls

echo ============================================================
echo     Restaurant POS - Desktop Application
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

echo [i] Launching Restaurant POS Desktop App...
echo.

cd /d "%PROJECT_DIR%electron"
call npx electron .

echo.
echo Application closed.
