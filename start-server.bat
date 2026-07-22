@echo off
title Portfolio World Server

echo.
echo ======================================================
echo =      Portfolio World Development Server
echo ======================================================
echo.

set PORT=8000
echo Checking for any process already using port %PORT%...

REM The "tokens=5" is crucial to grab the PID from the netstat output
FOR /F "tokens=5" %%i IN ('netstat -aon ^| findstr ":%PORT%"') DO (
    set PID=%%i
    goto kill_process
)

echo No existing process found.
goto start_server

:kill_process
if "%PID%"=="" goto start_server
echo Found existing process with PID %PID%. Terminating...
taskkill /F /PID %PID%
echo.
timeout /t 1 /nobreak > nul

:start_server
echo Starting new server on http://localhost:%PORT%...

start "Portfolio World Server" python -m http.server %PORT% --bind 0.0.0.0

echo.
echo Waiting a moment for the server to initialize...
timeout /t 2 /nobreak > nul

echo Opening http://localhost:%PORT% in your default browser.
start http://localhost:%PORT%
