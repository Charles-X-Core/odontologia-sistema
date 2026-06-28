@echo off
chcp 65001 >nul
title Clinica Dental Pro - Diagnostico
setlocal EnableExtensions
cd /d "%~dp0"

:: ============================================================
:: VITA MIRABILIS - DIAGNOSTICO (no instala nada)
:: Solo verifica el estado del sistema
:: ============================================================

color 0E
echo.
echo ============================================================
echo      VITA MIRABILIS - DIAGNOSTICO DEL SISTEMA
echo ============================================================
echo.
echo  Este script NO instala nada, solo revisa el estado
echo  de tu PC para diagnosticar problemas.
echo.
echo  Resultado: [OK] = disponible, [!] = falta, [X] = error
echo.
echo -----------------------------------------------------------
echo.
echo [1/5] Sistema Operativo
echo -----------------------------------------------------------
ver
echo.

echo [2/5] Visual C++ Runtime
echo -----------------------------------------------------------
if exist "%SystemRoot%\System32\vcruntime140.dll" (
    echo       [OK] vcruntime140.dll - encontrado
) else (
    echo       [X]  vcruntime140.dll - NO ENCONTRADO
)
if exist "%SystemRoot%\System32\msvcp140.dll" (
    echo       [OK] msvcp140.dll - encontrado
) else (
    echo       [X]  msvcp140.dll - NO ENCONTRADO
)
echo.

echo [3/5] Google Chrome
echo -----------------------------------------------------------
set "CHROME_FOUND=0"
for %%P in (
    "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
    "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
    "%LocalAppData%\Google\Chrome\Application\chrome.exe"
    "%UserProfile%\.cache\puppeteer"
) do (
    if exist "%%~P" (
        echo       [OK] %%~P
        set "CHROME_FOUND=1"
    )
)
if "%CHROME_FOUND%"=="0" echo       [!]  Google Chrome NO INSTALADO
echo.

echo [4/5] Node.js
echo -----------------------------------------------------------
set "NODE_FOUND=0"
for %%P in (
    "C:\Program Files\nodejs\node.exe"
    "C:\Program Files (x86)\nodejs\node.exe"
    "%LocalAppData%\nodejs\node.exe"
) do (
    if exist "%%~P" (
        echo       [OK] %%~P
        set "NODE_FOUND=1"
    )
)
if "%NODE_FOUND%"=="0" echo       [!]  Node.js NO INSTALADO
echo.

echo [5/5] winget (instalador de Windows)
echo -----------------------------------------------------------
where winget >nul 2>&1
if %errorLevel% equ 0 (
    echo       [OK] winget disponible
) else (
    echo       [!]  winget NO disponible
    echo            (necesario para auto-instalar dependencias)
)
echo.

echo -----------------------------------------------------------
echo                      ARCHIVOS DE LA APP
echo -----------------------------------------------------------
echo.
if exist "Clinica Dental Pro.exe" (
    echo       [OK] Clinica Dental Pro.exe - presente
) else (
    echo       [X]  Clinica Dental Pro.exe - NO ENCONTRADO
)

if exist "resources\app.asar" (
    echo       [OK] resources\app.asar - presente
) else (
    echo       [X]  resources\app.asar - NO ENCONTRADO
)

if exist "resources\data\clinica.db" (
    echo       [OK] resources\data\clinica.db - presente ^(base de datos^)
) else (
    echo       [X]  resources\data\clinica.db - NO ENCONTRADO
)

if exist "resources\app.asar.unpacked" (
    echo       [OK] resources\app.asar.unpacked - presente
) else (
    echo       [X]  resources\app.asar.unpacked - NO ENCONTRADO
)
echo.

echo -----------------------------------------------------------
echo                    DATOS DEL USUARIO
echo -----------------------------------------------------------
echo.
set "APPDATA_DIR=%APPDATA%\Clinica Dental Pro"
if exist "%APPDATA_DIR%\wwebjs_auth" (
    echo       [OK] Sesion WhatsApp: %APPDATA_DIR%\wwebjs_auth
) else (
    echo       [i]  Sesion WhatsApp: no existe ^(se creara al escanear QR^)
)
if exist "%APPDATA_DIR%\runner.log" (
    for %%A in ("%APPDATA_DIR%\runner.log") do echo       [i]  runner.log: %%~zA bytes
)
echo.

echo ============================================================
echo.
echo Si todo aparece [OK] excepto los [!], ejecuta
echo "Iniciar Clinica Dental Pro.bat" para instalar lo que falta.
echo.
echo Si hay [X] en archivos de la app, descarga nuevamente
echo el archivo .rar y descomprime TODO el contenido.
echo.
pause
endlocal
exit /b 0
