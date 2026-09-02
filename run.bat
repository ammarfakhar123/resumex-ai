@echo off
title ResumeX AI — Local Server
cd /d "%~dp0"
echo ========================================================
echo   Starting ResumeX AI Server...
echo ========================================================
echo.
echo Server will be available at: http://localhost:8000
echo Press Ctrl+C in this window to stop the server.
echo.
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
pause
