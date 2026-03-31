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

%PYTHON_LAUNCHER% sync_paldb.py

echo.
if %errorlevel%==0 (
  echo Sync finished. Reopen index.html to see the latest paldb.cc cache.
) else (
  echo Sync failed. Please check whether Python is installed and the network is available.
)
pause
