@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_LAUNCHER="
where py >nul 2>nul
if %errorlevel%==0 set "PYTHON_LAUNCHER=py -3"
if not defined PYTHON_LAUNCHER (
  where python >nul 2>nul
  if %errorlevel%==0 set "PYTHON_LAUNCHER=python"
)

if not defined PYTHON_LAUNCHER (
  echo.
  echo [Error] Python 3 was not found.
  echo Please install Python 3 and then run this file again.
  pause
  exit /b 1
)

start "" cmd /c "ping -n 3 127.0.0.1 >nul && start \"\" http://127.0.0.1:8765/"
%PYTHON_LAUNCHER% serve_helper.py --no-open

pause
