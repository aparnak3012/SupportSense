@echo off
title SupportSense Launcher
color 0B

echo =======================================================================
echo                     SUPPORTSENSE - LAUNCHER
echo =======================================================================
echo.
echo Starting SupportSense services on Windows...
echo.

:: 1. Check for .env file
if not exist "%~dp0.env" (
    echo [WARNING] .env file not found in root! Creating one from .env.example...
    copy "%~dp0.env.example" "%~dp0.env" >nul
    echo [OK] Created .env file.
)

:: 2. Launch AI Service (Python FastAPI on port 8000)
echo [1/2] Starting Python AI Service on http://127.0.0.1:8000 ...
start "SupportSense - AI Service (:8000)" cmd /k "cd /d "%~dp0ai-service" && echo Starting FastAPI server... && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

:: Brief pause to let AI service bind port
timeout /t 3 /nobreak >nul

:: 3. Launch Backend Service (Node.js Express on port 3000)
echo [2/2] Starting Node.js Backend & Dashboard on http://localhost:3000 ...
start "SupportSense - Backend Dashboard (:3000)" cmd /k "cd /d "%~dp0backend" && echo Starting Express server... && node dist/server.js"

:: Brief pause before opening browser
timeout /t 2 /nobreak >nul

echo.
echo =======================================================================
echo                    ALL SERVICES ARE RUNNING!
echo =======================================================================
echo.
echo   - Web Dashboard:     http://localhost:3000
echo   - AI Service API:    http://127.0.0.1:8000/health
echo   - API Documentation: http://127.0.0.1:8000/docs
echo.
echo Opening dashboard in your default browser...
start http://localhost:3000

echo.
echo To stop the servers, simply close the two opened command windows.
echo =======================================================================
pause
