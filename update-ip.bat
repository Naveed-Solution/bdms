@echo off
echo.
echo ========================================
echo    IP Address Update Helper
echo ========================================
echo.

:: Get current IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set "IP=%%a"
    goto :found
)

:found
:: Remove leading spaces
set IP=%IP: =%

echo Current IP Address: %IP%
echo.

:: Show current API URL
echo Current API URL in code:
findstr "API_BASE_URL = " src\services\api.ts
echo.

:: Ask if user wants to update
set /p CONFIRM="Update API URL to http://%IP%:3000/api? (Y/N): "

if /i "%CONFIRM%"=="Y" (
    echo.
    echo Updating API URL in src\services\api.ts...
    
    :: Create a temporary PowerShell script to do the replacement
    powershell -Command "(Get-Content src\services\api.ts) -replace 'const API_BASE_URL = ''http://[^''/]*', 'const API_BASE_URL = ''http://%IP%:3000' | Set-Content src\services\api.ts"
    
    echo.
    echo ✅ Updated! New API URL:
    findstr "API_BASE_URL = " src\services\api.ts
    echo.
    echo 🔄 Please restart your app (Ctrl+C and npm start)
) else (
    echo.
    echo ❌ Update cancelled.
)

echo.
echo ========================================
echo.
pause

