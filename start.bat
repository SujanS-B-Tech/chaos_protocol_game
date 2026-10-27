@echo off
setlocal EnableExtensions
title CHAOS PROTOCOL - Server Launcher

:: Ensure working directory is the folder containing this batch script
cd /d "%~dp0"

echo ====================================================
echo           C H A O S   P R O T O C O L
echo       Asymmetric 3D Multiplayer Puzzle Game
echo ====================================================
echo.

:: 1. Verify Node.js installation
where node >nul 2>nul
if errorlevel 1 goto :err_no_node

:: 2. Check if node_modules exists, install if missing
if not exist "node_modules\" goto :install_deps
goto :check_port

:install_deps
echo [INIT] node_modules folder not found.
echo [INIT] Installing project dependencies via npm install...
echo.
call npm install
if errorlevel 1 goto :err_npm_fail
echo.
echo [OK] Dependencies installed successfully.
echo.

:check_port
if "%PORT%"=="" set PORT=3000

echo Choose Connection Mode:
echo   [1] ONLINE PUBLIC MODE (Phones on 4G/5G or different Wi-Fi - Recommended)
echo   [2] LOCAL WI-FI MODE   (Laptop and phones on the EXACT same Wi-Fi router)
echo.
set /p NET_CHOICE="Select mode [1 or 2, press ENTER for 1]: "
if "%NET_CHOICE%"=="" set NET_CHOICE=1
if "%NET_CHOICE%"=="1" (
  set ONLINE_FLAG=--online
  echo.
  echo [MODE] Initializing with Automated Public Online Tunnel for mobile data / 4G...
) else (
  set ONLINE_FLAG=
  echo.
  echo [MODE] Initializing in Local Wi-Fi network mode...
)
echo.

:: 3. Launch browser in background after 2 second delay
echo [LAUNCH] Initializing Chaos Protocol server on port %PORT%...
echo [INFO] Host screen will open automatically at http://localhost:%PORT%
echo.
start "" powershell -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 2000; Start-Process 'http://localhost:%PORT%'"

:: 4. Start the authoritative game server
call node server.js %ONLINE_FLAG%
if errorlevel 1 goto :server_err

echo.
echo [INFO] Chaos Protocol server stopped cleanly.
goto :end

:server_err
echo.
echo [WARNING] Game server terminated with an error.
goto :end

:err_no_node
echo.
echo [ERROR] Node.js was not found in your system PATH.
echo Please download and install Node.js v18 or newer from:
echo https://nodejs.org/
echo.
goto :end

:err_npm_fail
echo.
echo [ERROR] Failed to install npm dependencies.
echo Please check your network connection and npm configuration.
echo.
goto :end

:end
echo.
pause
