@echo off
rem Launches JLPT Trainer. App code: app\   Data: %APPDATA%\N1Trainer (override with N1_DATA_DIR)
cd /d "%~dp0app"
node server.js %*
if errorlevel 1 pause
