@echo off
REM Start Backend Server
REM Simple startup script for BDMS backend

echo ====================================
echo   BDMS Backend Server - Starting
echo ====================================
echo.

cd backend
echo Starting backend on port 3000...
node server.js

pause
