@echo off
chcp 65001 >nul
setlocal EnableExtensions

:: ============================================================
:: VITA MIRABILIS - Post-Install Setup
:: Charles-X RedFlame Systems
:: ============================================================
:: This script runs automatically after installation.
:: It verifies and installs required dependencies.
:: ============================================================

set "INSTDIR=%~1"
if "%INSTDIR%"=="" set "INSTDIR=%~dp0"

echo.
echo ========================================
echo   Clinica Dental Pro - Configuracion
echo   Charles-X RedFlame Systems
echo ========================================
echo.

:: --- Check winget ---
set "HAS_WINGET=0"
where winget >nul 2>&1 && set "HAS_WINGET=1"

:: --- [1/3] Visual C++ Runtime ---
echo [1/3] Verificando Visual C++ Runtime...
set "VC_OK=0"
if exist "%SystemRoot%\System32\vcruntime140.dll" if exist "%SystemRoot%\System32\msvcp140.dll" set "VC_OK=1"

if "%VC_OK%"=="1" (
    echo       OK: VC++ Runtime encontrado
) else (
    if "%HAS_WINGET%"=="1" (
        echo       Instalando VC++ Runtime via winget...
        winget install Microsoft.VCRedist.2015+.x64 --accept-package-agreements --accept-source-agreements --silent --no-upgrade
        if errorlevel 1 (
            echo       AVISO: No se pudo instalar automaticamente.
            echo       Descarga manual: https://aka.ms/vs/17/release/vc_redist.x64.exe
        ) else (
            echo       OK: VC++ Runtime instalado
        )
    ) else (
        echo       AVISO: VC++ Runtime no encontrado y winget no disponible.
        echo       Descarga manual: https://aka.ms/vs/17/release/vc_redist.x64.exe
    )
)
echo.

:: --- [2/3] Google Chrome ---
echo [2/3] Verificando Google Chrome...
set "CHROME_OK=0"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_OK=1"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_OK=1"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_OK=1"

if "%CHROME_OK%"=="1" (
    echo       OK: Google Chrome encontrado
) else (
    if "%HAS_WINGET%"=="1" (
        echo       Instalando Google Chrome via winget...
        winget install Google.Chrome --accept-package-agreements --accept-source-agreements --silent --no-upgrade
        if errorlevel 1 (
            echo       AVISO: No se pudo instalar automaticamente.
            echo       Descarga manual: https://www.google.com/chrome/
        ) else (
            echo       OK: Google Chrome instalado
        )
    ) else (
        echo       AVISO: Chrome no encontrado y winget no disponible.
        echo       Descarga manual: https://www.google.com/chrome/
    )
)
echo.

:: --- [3/3] Node.js ---
echo [3/3] Verificando Node.js...
set "NODE_OK=0"
if exist "C:\Program Files\nodejs\node.exe" set "NODE_OK=1"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_OK=1"
if exist "%LocalAppData%\nodejs\node.exe" set "NODE_OK=1"

if "%NODE_OK%"=="1" (
    echo       OK: Node.js encontrado
) else (
    if "%HAS_WINGET%"=="1" (
        echo       Instalando Node.js via winget...
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent --no-upgrade
        if errorlevel 1 (
            echo       AVISO: No se pudo instalar automaticamente.
            echo       Descarga manual: https://nodejs.org/
        ) else (
            echo       OK: Node.js instalado
        )
    ) else (
        echo       AVISO: Node.js no encontrado y winget no disponible.
        echo       Descarga manual: https://nodejs.org/
    )
)
echo.

:: --- Summary ---
echo ========================================
echo   Configuracion completada
echo ========================================
echo.
echo   Clinica Dental Pro esta listo para usar.
echo   Abra la aplicacion desde el acceso directo
echo   del escritorio o del menu inicio.
echo.
echo   Si alguna dependencia fallo, puede ejecutar
echo   "Iniciar Clinica Dental Pro.bat" desde la
echo   carpeta de instalacion para reintentar.
echo.

endlocal
