============================================================
          VITA MIRABILIS - Edición Portable v1.0.0
============================================================

SISTEMA DE GESTIÓN ODONTOLÓGICA


------------------------------------------------------------
1. INSTRUCCIONES RÁPIDAS
------------------------------------------------------------

  1. Descomprime esta carpeta donde quieras (ej: C:\Vita)
     IMPORTANTE: descomprime TODO el contenido, no solo
     algunos archivos
  2. Doble-click en "Iniciar Clinica Dental Pro.bat"
  3. Acepta la elevación de administrador (solo 1ra vez)
  4. Espera a que verifique/instale Chrome y Node.js
     (solo 1ra vez, ~5 minutos con internet)
  5. La ventana de Clinica Dental Pro aparecerá automáticamente


------------------------------------------------------------
2. REQUISITOS
------------------------------------------------------------

  - Windows 10 (1809 o superior) o Windows 11 - 64 bits
  - Permisos de administrador (solo primera vez)
  - Conexión a internet (solo primera vez, ~300 MB)
  - ~600 MB de espacio en disco libre

  Después de la primera instalación, NO necesitas internet.


------------------------------------------------------------
3. USO NORMAL
------------------------------------------------------------

  - La próxima vez, basta con doble-click en
    "Clinica Dental Pro.exe" directamente
  - O seguir usando "Iniciar Clinica Dental Pro.bat" (es
    más seguro porque verifica dependencias)


------------------------------------------------------------
4. LOGIN POR DEFECTO
------------------------------------------------------------

  Email:     admin@clinicadentalpro.com
  Password:  admin123

  (Se recomienda cambiar la contraseña al primer ingreso
  desde Configuración → Mi Perfil)


------------------------------------------------------------
5. UBICACIÓN DE TUS DATOS
------------------------------------------------------------

  Base de datos (pacientes, historias, etc.):
    → resources\data\clinica.db

  Imágenes y PDFs generados:
    → resources\data\uploads\

  Sesión de WhatsApp (NO borrar si quieres mantener
  la sesión activa):
    → %APPDATA%\Clinica Dental Pro\wwebjs_auth\

  Logs de diagnóstico (si hay problemas):
    → %APPDATA%\Clinica Dental Pro\runner.log


------------------------------------------------------------
6. BACKUP
------------------------------------------------------------

  Para hacer backup de toda tu información:
    1. Cierra la aplicación completamente
    2. Copia la carpeta resources\data\ a un lugar seguro
    3. (Opcional) Copia %APPDATA%\Clinica Dental Pro\wwebjs_auth\
       si quieres conservar la sesión de WhatsApp

  Para restaurar:
    1. Descomprime la app en una nueva carpeta
    2. Reemplaza resources\data\ con tu backup
    3. Reemplaza %APPDATA%\Clinica Dental Pro\wwebjs_auth\
       con tu backup de sesión


------------------------------------------------------------
7. WHATSAPP
------------------------------------------------------------

  Para conectar WhatsApp la primera vez:
    1. Abre la app e inicia sesión
    2. Ve a Configuración → WhatsApp
    3. Aparecerá un código QR
    4. Desde tu celular: WhatsApp → ⋮ → Dispositivos
       vinculados → Vincular dispositivo
    5. Escanea el QR

  La próxima vez que abras la app, la sesión se mantiene
  automáticamente. Si cambias de PC, debes escanear el
  QR de nuevo.


------------------------------------------------------------
8. SOLUCIÓN DE PROBLEMAS
------------------------------------------------------------

  "La app no abre"
    → Ejecuta "VERIFICAR.bat" para ver qué falta
    → Ejecuta "Iniciar Clinica Dental Pro.bat" para que
      instale/repare dependencias

  "WhatsApp no conecta"
    → Ve a Configuración → WhatsApp y escanea el QR
    → Revisa el log en %APPDATA%\Clinica Dental Pro\runner.log

  "La app se cierra sola al abrir"
    → Revisa el log en %APPDATA%\Clinica Dental Pro\runner.log
    → Borra la carpeta %APPDATA%\Clinica Dental Pro\wwebjs_auth\
      y reintenta (esto resetea la sesión de WhatsApp)

  "Error: puerto 18234 ocupado"
    → Cierra otras instancias de Clinica Dental Pro
    → O reinicia la PC

  "Antivirus bloquea la app"
    → Agrega excepción para esta carpeta completa
    → Esto es un falso positivo común con apps Electron


------------------------------------------------------------
9. COMPATIBILIDAD
------------------------------------------------------------

  ✅ Windows 10 64-bit (1809+):  Totalmente compatible
  ✅ Windows 11 64-bit:           Totalmente compatible
  ❌ Windows 8/8.1/7:             No soportado
  ❌ Windows 10 32-bit:           No soportado
  ⚠️  Windows Server 2019+:       Compatible pero no probado


------------------------------------------------------------
10. INFORMACIÓN TÉCNICA
------------------------------------------------------------

  Tamaño:                ~540 MB descomprimido
  Tamaño comprimido:     ~200-250 MB (.rar / .7z)
  Backend:               Node.js + Express en puerto 18234
  WhatsApp runner:       Node.js en puerto 3002
  Base de datos:         SQLite (clinica.db)
  Chrome requerido:      v100+ (se descarga automáticamente)


------------------------------------------------------------
11. TRANSPARENCIA: ¿QUÉ HACE ESTA APP?
------------------------------------------------------------

Esta sección es para que sepas exactamente qué hace (y qué NO)
la app en tu PC, sin tecnicismos.

✅ LO QUE SÍ HACE:

  • Crea una carpeta con los archivos del programa
    (donde descomprimiste el .rar / .7z / .exe)
  • Crea una carpeta con tus datos en:
        %APPDATA%\Clinica Dental Pro\
    Ahí se guardan: la base de datos, sesión de WhatsApp
    y logs de diagnóstico.
  • La primera vez, instala 3 cosas oficiales:
      - Microsoft Visual C++ Redistributable (de Microsoft)
      - Google Chrome (de Google)
      - Node.js LTS (de OpenJS Foundation)
    Se instalan vía "winget" (el instalador oficial de Windows)
  • Abre Google Chrome para conectarse a WhatsApp Web
  • Lee y guarda archivos en su propia carpeta
    (nada fuera de %APPDATA%\Clinica Dental Pro\ y donde la
    descomprimiste)

❌ LO QUE NO HACE (verificado por el código fuente):

  • NO instala ni modifica drivers de tu PC
    (los drivers son los que controlan tu sonido, cámara,
     gráficos, etc.)
  • NO modifica el registro de Windows
  • NO crea servicios de Windows
  • NO accede a C:\Windows\ ni a carpetas de sistema
  • NO se conecta a internet salvo para:
      - Descargar Chrome/Node.js/VC++ la primera vez
      - Conectarse a WhatsApp Web (solo si tú lo activas)
  • NO envía tus datos a servidores externos
    (toda la información queda en tu PC)
  • NO modifica tu firewall, antivirus, ni políticas
    de seguridad
  • NO se inicia automáticamente con Windows

🔍 SI TU PC TIENE PROBLEMAS DESPUÉS DE INSTALAR:

  Si notas que algo dejó de funcionar (sonido, cámara, etc.):

  1. Abre "Configuración" → "Aplicaciones" → busca
     "Clinica Dental Pro". Si NO aparece listada, la app
     no se "instaló" en el sentido tradicional.
  2. La app solo agrega 3 cosas oficiales de Microsoft,
     Google y OpenJS. Ninguna de ellas toca drivers.
  3. Las causas más comunes de problemas de drivers
     son: Windows Update, actualizaciones de otros
     programas (Zoom, Teams, etc.), o malware.
  4. Para verificar, abre PowerShell como admin y corre:
        Get-Service | Where-Object Name -like "*Vita*"
     Si no muestra nada, la app no creó servicios.

  Si quieres estar 100% seguro, desinstala la app
  (borrar la carpeta + %APPDATA%\Clinica Dental Pro\)
  y reinicia la PC. Si el problema persiste, NO era
  la app.


------------------------------------------------------------
12. AVISO DE WINGET (instalador de Windows)
------------------------------------------------------------

  La primera vez, el "Iniciar.bat" usa "winget"
  (el instalador de línea de comandos de Windows) para
  instalar Chrome, Node.js y VC++ Redistributable.

  • "winget" es una herramienta oficial de Microsoft
    incluida en Windows 10 (1809+) y Windows 11.
  • Los paquetes que instala son las versiones oficiales
    publicadas por Google, OpenJS Foundation y Microsoft.
  • Si tu PC tiene "winget" deshabilitado por política
    corporativa, la app te lo dirá y puedes instalarlos
    manualmente descargándolos de las webs oficiales.

  Si prefieres instalar tú mismo las dependencias (sin
  que la app lo haga automáticamente), ejecuta:

      Iniciar Clinica Dental Pro.bat --no-install

  Este modo asume que ya tienes Chrome y Node.js
  instalados en tu sistema.


============================================================
   ¿Más ayuda? Revisa el log en:
   %APPDATA%\Clinica Dental Pro\runner.log
============================================================
