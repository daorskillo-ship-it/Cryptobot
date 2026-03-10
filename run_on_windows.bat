@echo off
SETLOCAL
title Paradice Bot - Windows Runner

echo ==========================================
echo    Paradice Bot - Windows Starter
echo ==========================================

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please download and install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b
)

:: Check if node_modules exists, if not install
if not exist "node_modules\" (
    echo [INFO] First time setup: Installing dependencies...
    echo This may take a minute or two...
    call npm install
)

:: Check if dist exists, if not build
if not exist "dist\" (
    echo [INFO] Building frontend...
    call npm run build
)

echo.
echo [SUCCESS] Starting the bot...
echo [INFO] Open your browser at: http://localhost:3000
echo ==========================================
echo.

:: Start the bot
call npm start

pause
