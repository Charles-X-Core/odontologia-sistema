@echo off
chcp 65001 >nul
title Clinica Dental Pro - Iniciando
setlocal EnableExtensions
cd /d "%~dp0"

:: ============================================================
:: VITA MIRABILIS - INICIO PORTABLE
:: Verifica e instala Chrome + Node.js automaticamente
:: ============================================================
::
:: USO:
::   Iniciar Clinica Dental Pro.bat              (modo normal)
::   Iniciar Clinica Dental Pro.bat --no-install  (sin instalar nada)
::
::   --no-install:   No instala dependencias. Solo verifica que
::                   Chrome y Node.js esten en el sistema. Si
::                   falta alguno, avisa y sale. Usar este modo
::                   si ya tienes todo instalado o si prefieres
::                   gestionar las dependencias manualmente.
:: ============================================================

:: Detectar flag --no-install
set "NO_INSTALL=0"
for %%A in (%*) do (
    if /i "%%A"=="--no-install" set "NO_INSTALL=1"
    if /i "%%A"=="/no-install"  set "NO_INSTALL=1"
)

color 0B
echo.
echo ============================================================
echo         VITA MIRABILIS - INICIO PORTABLE
echo ============================================================
echo.
if "%NO_INSTALL%"=="1" (
    echo  MODO: --no-install
    echo  Este modo NO instalara nada. Solo verificara que
    echo  Chrome y Node.js ya esten en tu sistema.
    echo.
) else (
    echo  Este script verificara que tengas las dependencias
    echo  necesarias. Si falta Chrome o Node.js, los descargara
    echo  automaticamente desde internet.
    echo.
    echo  Requisito: conexion a internet la primera vez
    echo  Permiso:   administrador (solo primera vez)
    echo.
)
pause
echo.

:: ----------------------------------------------------------
:: Auto-elevar a administrador
:: ----------------------------------------------------------
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ELEVANDO] Solicitando permisos de administrador...
    powershell -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs"
    exit /b
)
echo [OK] Ejecutando con permisos de administrador
echo.

:: ----------------------------------------------------------
:: Helper: probar si winget esta disponible
:: ----------------------------------------------------------
set "HAS_WINGET=0"
where winget >nul 2>&1 && set "HAS_WINGET=1"

if "%HAS_WINGET%"=="0" (
    echo [AVISO] winget no esta disponible en este sistema.
    echo         Se instalaran las dependencias mediante descarga directa.
    echo.
)

:: ----------------------------------------------------------
:: [1/4] Verificar Visual C++ Runtime
:: ----------------------------------------------------------
echo [1/4] Verificando Visual C++ Runtime...
set "VC_OK=0"
if exist "%SystemRoot%\System32\vcruntime140.dll" if exist "%SystemRoot%\System32\msvcp140.dll" set "VC_OK=1"

if "%VC_OK%"=="1" (
    echo       [OK] vcruntime140.dll y msvcp140.dll encontrados
) else (
    if "%NO_INSTALL%"=="1" (
        echo       [X] VC++ Runtime no encontrado.
        echo           Modo --no-install activo: la app NO se instalara.
        echo           Descarga manual: https://aka.ms/vs/17/release/vc_redist.x64.exe
        echo.
        pause
        exit /b 1
    )
    echo       [!] VC++ Runtime no encontrado. Instalando...
    if "%HAS_WINGET%"=="1" (
        winget install Microsoft.VCRedist.2015+.x64 --accept-package-agreements --accept-source-agreements --silent
        if errorlevel 1 (
            echo       [X] Error instalando VC++ Runtime.
            echo           Descarga manual: https://aka.ms/vs/17/release/vc_redist.x64.exe
        ) else (
            echo       [OK] VC++ Runtime instalado
        )
    ) else (
        echo       [X] VC++ Runtime requerido pero winget no disponible.
        echo           Descarga manual: https://aka.ms/vs/17/release/vc_redist.x64.exe
        echo.
        echo           Presiona ENTER para abrir el navegador o CANCELAR para salir...
        pause >nul
        start https://aka.ms/vs/17/release/vc_redist.x64.exe
        pause
        exit /b 1
    )
)
echo.

:: ----------------------------------------------------------
:: [2/4] Verificar Google Chrome
:: ----------------------------------------------------------
echo [2/4] Verificando Google Chrome...
set "CHROME_PATH="
for %%P in (
    "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
    "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
    "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do (
    if exist "%%~P" if not defined CHROME_PATH set "CHROME_PATH=%%~P"
)

if defined CHROME_PATH (
    echo       [OK] Chrome: %CHROME_PATH%
) else (
    if "%NO_INSTALL%"=="1" (
        echo       [X] Google Chrome no encontrado.
        echo           Modo --no-install activo: la app NO se instalara.
        echo           Descarga manual: https://www.google.com/chrome/
        echo.
        pause
        exit /b 1
    )
    echo       [!] Google Chrome no encontrado. Instalando...
    if "%HAS_WINGET%"=="1" (
        winget install Google.Chrome --accept-package-agreements --accept-source-agreements --silent
        if errorlevel 1 (
            echo       [X] Error instalando Chrome.
            echo           Descarga manual: https://www.google.com/chrome/
        ) else (
            echo       [OK] Chrome instalado
            set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
        )
    ) else (
        echo       [X] Chrome requerido. Descarga desde: https://www.google.com/chrome/
        start https://www.google.com/chrome/
        pause
        exit /b 1
    )
)
echo.

:: ----------------------------------------------------------
:: [3/4] Verificar Node.js
:: ----------------------------------------------------------
echo [3/4] Verificando Node.js...
set "NODE_PATH="
for %%P in (
    "C:\Program Files\nodejs\node.exe"
    "C:\Program Files (x86)\nodejs\node.exe"
    "%LocalAppData%\nodejs\node.exe"
) do (
    if exist "%%~P" if not defined NODE_PATH set "NODE_PATH=%%~P"
)

if defined NODE_PATH (
    echo       [OK] Node.js: %NODE_PATH%
) else (
    if "%NO_INSTALL%"=="1" (
        echo       [X] Node.js no encontrado.
        echo           Modo --no-install activo: la app NO se instalara.
        echo           Descarga manual: https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
    echo       [!] Node.js no encontrado. Instalando...
    if "%HAS_WINGET%"=="1" (
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
        if errorlevel 1 (
            echo       [X] Error instalando Node.js.
            echo           Descarga manual: https://nodejs.org/
        ) else (
            echo       [OK] Node.js instalado
            set "NODE_PATH=C:\Program Files\nodejs\node.exe"
        )
    ) else (
        echo       [X] Node.js requerido. Descarga desde: https://nodejs.org/
        start https://nodejs.org/
        pause
        exit /b 1
    )
)
echo.

:: ----------------------------------------------------------
:: [4/4] Verificar espacio en disco
:: ----------------------------------------------------------
echo [4/4] Verificando espacio en disco...
set "FREE_MB=0"
for /f "tokens=3" %%a in ('dir /-c "%~dp0" 2^>nul ^| findstr /C:"bytes free"') do (
    set "FREE_BYTES=%%a"
    setlocal enabledelayedexpansion
    set "FREE_MB=!FREE_BYTES:~0,-3!"
    set /a "FREE_MB=FREE_MB/1024/1024" 2>nul
    if !FREE_MB! LSS 500 (
        echo       [AVISO] Poco espacio en disco: !FREE_MB! MB libres ^(se recomiendan 500+ MB^)
    ) else (
        echo       [OK] Espacio en disco: !FREE_MB! MB libres
    )
    endlocal
)
if "%FREE_MB%"=="0" echo       [OK] Verificacion de disco omitida
echo.

:: ----------------------------------------------------------
:: Iniciar la aplicacion
:: ----------------------------------------------------------
echo ============================================================
echo              TODO LISTO - INICIANDO APP
echo ============================================================
echo.

if exist "Clinica Dental Pro.exe" (
    :: Usar PowerShell para lanzar el exe y desligarse del proceso cmd
    powershell -Command "Start-Process -FilePath '.\Clinica Dental Pro.exe' -WorkingDirectory '%~dp0'"
) else (
    echo [X] ERROR: No se encontro "Clinica Dental Pro.exe" en esta carpeta
    echo     Asegurate de haber descomprimido TODO el contenido del .rar
    pause
    exit /b 1
)

endlocal
exit /b 0
