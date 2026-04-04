@echo off
title Restaurant POS - One Click Installer
color 0A
cls

echo ============================================================
echo     Restaurant POS System - Windows Installer
echo ============================================================
echo.
echo  This will install everything needed to run the POS system:
echo    - Node.js (if not installed)
echo    - MongoDB (if not installed)
echo    - All application dependencies
echo    - Demo data (sample menu, tables, users)
echo.
echo ============================================================
echo.
pause

:: ─── Check Administrator privileges ──────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Some installations may need Admin rights.
    echo [!] If anything fails, right-click this file and "Run as Administrator"
    echo.
)

:: ─── Set project directory ──────────────────────────────────
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: ─── STEP 1: Check Node.js ─────────────────────────────────
echo [1/6] Checking Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Node.js not found. Installing...
    echo.

    :: Try winget first (Windows 10/11 built-in)
    where winget >nul 2>&1
    if %errorLevel% equ 0 (
        echo     Installing Node.js via winget...
        winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
        if %errorLevel% equ 0 (
            echo     [OK] Node.js installed via winget
            :: Refresh PATH
            set "PATH=%PATH%;C:\Program Files\nodejs"
        ) else (
            goto :manual_node
        )
    ) else (
        goto :manual_node
    )
) else (
    for /f "tokens=*" %%v in ('node --version') do echo     [OK] Node.js %%v found
)
goto :check_npm

:manual_node
echo.
echo ============================================================
echo  Node.js could not be installed automatically.
echo  Please install it manually:
echo.
echo  1. Open: https://nodejs.org
echo  2. Download the LTS version (.msi installer)
echo  3. Run the installer (keep all defaults)
echo  4. RESTART this installer after Node.js is installed
echo ============================================================
echo.
start https://nodejs.org
pause
exit /b 1

:check_npm
:: Verify npm is available
where npm >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] npm not found. Please restart this installer after Node.js installation.
    pause
    exit /b 1
)

:: ─── STEP 2: Check MongoDB ──────────────────────────────────
echo.
echo [2/6] Checking MongoDB...

:: Check if mongod is running or available
where mongod >nul 2>&1
if %errorLevel% neq 0 (
    :: Check common install paths
    if exist "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" (
        echo     [OK] MongoDB found at default path
        set "PATH=%PATH%;C:\Program Files\MongoDB\Server\7.0\bin"
        goto :mongo_ok
    )
    if exist "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" (
        echo     [OK] MongoDB found at default path
        set "PATH=%PATH%;C:\Program Files\MongoDB\Server\6.0\bin"
        goto :mongo_ok
    )

    echo [!] MongoDB not found. Installing...
    echo.

    :: Try winget
    where winget >nul 2>&1
    if %errorLevel% equ 0 (
        echo     Installing MongoDB via winget...
        winget install MongoDB.Server --silent --accept-source-agreements --accept-package-agreements
        if %errorLevel% equ 0 (
            echo     [OK] MongoDB installed via winget
            goto :mongo_ok
        )
    )

    echo.
    echo ============================================================
    echo  MongoDB could not be installed automatically.
    echo  Please install it manually:
    echo.
    echo  1. Open: https://www.mongodb.com/try/download/community
    echo  2. Download MongoDB Community Server (.msi)
    echo  3. During install, CHECK "Install as Windows Service"
    echo  4. RESTART this installer after MongoDB is installed
    echo ============================================================
    echo.
    start https://www.mongodb.com/try/download/community
    pause
    exit /b 1
) else (
    echo     [OK] MongoDB found
)
:mongo_ok

:: Check if MongoDB service is running
sc query MongoDB >nul 2>&1
if %errorLevel% neq 0 (
    echo     [i] Starting MongoDB service...
    net start MongoDB >nul 2>&1
    if %errorLevel% neq 0 (
        echo     [i] MongoDB service not registered. Trying to start mongod directly...
        if not exist "%PROJECT_DIR%data\db" mkdir "%PROJECT_DIR%data\db"
        start /min "MongoDB" mongod --dbpath "%PROJECT_DIR%data\db"
        timeout /t 3 /nobreak >nul
    )
) else (
    echo     [OK] MongoDB service is running
)

:: ─── STEP 3: Create .env file ───────────────────────────────
echo.
echo [3/6] Setting up configuration...
if not exist "%PROJECT_DIR%.env" (
    echo PORT=5001> "%PROJECT_DIR%.env"
    echo MONGODB_URI=mongodb://127.0.0.1:27017/restaurant_pos>> "%PROJECT_DIR%.env"
    echo JWT_SECRET=pos_secret_%RANDOM%%RANDOM%%RANDOM%>> "%PROJECT_DIR%.env"
    echo JWT_EXPIRES_IN=24h>> "%PROJECT_DIR%.env"
    echo     [OK] Configuration file created
) else (
    echo     [OK] Configuration file already exists
)

:: ─── STEP 4: Install dependencies ───────────────────────────
echo.
echo [4/6] Installing dependencies (this may take a few minutes)...
echo.

echo     Installing backend dependencies...
cd /d "%PROJECT_DIR%backend"
call npm install --loglevel=error
if %errorLevel% neq 0 (
    echo [!] Backend install failed. Retrying...
    call npm install
)

echo     Installing frontend dependencies...
cd /d "%PROJECT_DIR%frontend"
call npm install --loglevel=error
if %errorLevel% neq 0 (
    echo [!] Frontend install failed. Retrying...
    call npm install
)

echo     Installing desktop app dependencies...
cd /d "%PROJECT_DIR%electron"
call npm install --loglevel=error

cd /d "%PROJECT_DIR%"
echo     [OK] All dependencies installed

:: ─── STEP 5: Seed database ──────────────────────────────────
echo.
echo [5/6] Setting up database with demo data...
cd /d "%PROJECT_DIR%backend"
call node src/seed.js
cd /d "%PROJECT_DIR%"
echo     [OK] Database seeded

:: ─── STEP 6: Build frontend ─────────────────────────────────
echo.
echo [6/6] Building the application (this may take 1-2 minutes)...
cd /d "%PROJECT_DIR%frontend"
call npx react-scripts build
cd /d "%PROJECT_DIR%"
echo     [OK] Application built

:: ─── DONE ────────────────────────────────────────────────────
echo.
echo ============================================================
echo.
echo     Installation Complete!
echo.
echo     To start the POS system, double-click:
echo         start.bat
echo.
echo     Or run as desktop app:
echo         start-desktop.bat
echo.
echo     Demo Login:
echo         Email:    admin@restaurant.com
echo         Password: admin123
echo.
echo ============================================================
echo.
echo Starting the application now...
echo.
timeout /t 3 /nobreak >nul

:: Auto-launch
call "%PROJECT_DIR%start.bat"
