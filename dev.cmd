@echo off
set PATH=C:\Program Files\nodejs;%PATH%
if "%PORT%"=="" set PORT=5173
"C:\Program Files\nodejs\npm.cmd" run dev -- --port %PORT% --strictPort
