@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. See README.md.
  pause
  exit /b 1
)
start "Aneum local server" /D "%~dp0" node server/server.mjs
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8787/"
