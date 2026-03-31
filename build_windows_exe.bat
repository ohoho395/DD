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

%PYTHON_LAUNCHER% -m pip install --user pyinstaller pillow
%PYTHON_LAUNCHER% build_native.py

echo.
if %errorlevel%==0 (
  echo Build finished. Check the dist-native folder for the .exe package.
) else (
  echo Build failed. Please review the error messages above.
)
pause
