@echo off
REM Restart Backend Server with Port Cleanup
REM Kills any process on port 3000 before starting

echo ====================================
echo   BDMS Backend Server - Restart
echo ====================================
echo.

REM Kill any process using port 3000
echo Checking for existing backend on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Found process %%a on port 3000
    echo Stopping process...
    taskkill /F /PID %%a >nul 2>&1
)

echo Waiting for port to be released...
timeout /t 2 /nobreak >nul

echo.
cd backend
echo Starting backend on port 3000...
node server.js

pause
