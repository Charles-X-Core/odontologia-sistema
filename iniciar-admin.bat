@echo off
echo ========================================
echo  Clinica Dental Pro - Modo Administrador
echo ========================================
echo.
echo Solicitando permisos de administrador...
echo.

:: Re-ejecutar como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Permisos de administrador requeridos para habilitar WSL 2.
    echo.
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d \"%~dp0\" && \"%~f0\"' -Verb RunAs"
    exit /b
)

echo ========================================
echo  Ejecutando como Administrador
echo ========================================
echo.

:: Habilitar WSL 2
echo Habilitando WSL 2...
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
wsl --set-default-version 2

echo.
echo WSL 2 habilitado correctamente.
echo.

:: Iniciar el backend
echo Iniciando backend...
cd /d "%~dp0backend"
start /b node src/index.js

:: Esperar a que el backend arranque
timeout /t 3 /nobreak >nul

:: Iniciar Electron
echo Iniciando Clinica Dental Pro...
cd /d "%~dp0"
start /b node node_modules/electron/cli.js .

echo.
echo App iniciada. Puede cerrar esta ventana.
echo.
pause
