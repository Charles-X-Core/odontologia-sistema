; ============================================================
; Vita Mirabilis - Custom NSIS Installer Script
; Charles-X RedFlame Systems
; ============================================================

!include "MUI2.nsh"
!include "LogicLib.nsh"

; --- Branding ---
!macro customHeader
  RequestExecutionLevel admin
  BrandingText "Charles-X RedFlame Systems"
!macroend

; --- Custom Welcome Page ---
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Bienvenido a Vita Mirabilis"
  !define MUI_WELCOMEPAGE_TEXT "Este asistente le guiara a traves de la instalacion de Vita Mirabilis.$\r$\n$\r$\nSistema de Gestion de Historias Clinicas Dentales.$\r$\n$\r$\nDesarrollado por Charles-X RedFlame Systems.$\r$\n$\r$\nPresione Siguiente para continuar."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; --- Custom Finish Page ---
!macro customFinishPage
  Function StartApp
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" ""
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "Instalacion Completada"
  !define MUI_FINISHPAGE_TEXT "Vita Mirabilis ha sido instalado correctamente.$\r$\n$\r$\nPresione Finalizar para cerrar el asistente."
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Ejecutar Vita Mirabilis"
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !insertmacro MUI_PAGE_FINISH
!macroend

; --- Post-install: run dependency checker ---
!macro customInstall
  ${ifNot} ${isUpdated}
    ; Copy the dependency checker bat to plugins dir
    SetOutPath $PLUGINSDIR
    File /oname=VitaSetup.bat "${PROJECT_DIR}\scripts\VitaSetup.bat"

    DetailPrint ""
    DetailPrint "========================================"
    DetailPrint "  Configuracion post-instalacion"
    DetailPrint "  Charles-X RedFlame Systems"
    DetailPrint "========================================"
    DetailPrint ""
    DetailPrint "Verificando dependencias del sistema..."

    ; Run the bat file with admin privileges, pass install dir
    nsExec::ExecToLog '"$sysdir\cmd.exe" /C "$PLUGINSDIR\VitaSetup.bat" "$INSTDIR"'

    DetailPrint ""
    DetailPrint "Configuracion completada."
  ${endIf}
!macroend

; --- Custom Uninstaller Welcome ---
!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Desinstalar Vita Mirabilis"
  !define MUI_WELCOMEPAGE_TEXT "Este asistente eliminara Vita Mirabilis de su sistema.$\r$\n$\r$\nSus datos clinicos NO seran eliminados a menos que lo seleccione.$\r$\n$\r$\nPresione Siguiente para continuar."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
