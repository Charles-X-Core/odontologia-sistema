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
  2. Doble-click en "Iniciar Vita Mirabilis.bat"
  3. Acepta la elevación de administrador (solo 1ra vez)
  4. Espera a que verifique/instale Chrome y Node.js
     (solo 1ra vez, ~5 minutos con internet)
  5. La ventana de Vita Mirabilis aparecerá automáticamente


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
    "Vita Mirabilis.exe" directamente
  - O seguir usando "Iniciar Vita Mirabilis.bat" (es
    más seguro porque verifica dependencias)


------------------------------------------------------------
4. LOGIN POR DEFECTO
------------------------------------------------------------

  Email:     admin@vitamirabilis.com
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
    → %APPDATA%\Vita Mirabilis\wwebjs_auth\

  Logs de diagnóstico (si hay problemas):
    → %APPDATA%\Vita Mirabilis\runner.log


------------------------------------------------------------
6. BACKUP
------------------------------------------------------------

  Para hacer backup de toda tu información:
    1. Cierra la aplicación completamente
    2. Copia la carpeta resources\data\ a un lugar seguro
    3. (Opcional) Copia %APPDATA%\Vita Mirabilis\wwebjs_auth\
       si quieres conservar la sesión de WhatsApp

  Para restaurar:
    1. Descomprime la app en una nueva carpeta
    2. Reemplaza resources\data\ con tu backup
    3. Reemplaza %APPDATA%\Vita Mirabilis\wwebjs_auth\
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
    → Ejecuta "Iniciar Vita Mirabilis.bat" para que
      instale/repare dependencias

  "WhatsApp no conecta"
    → Ve a Configuración → WhatsApp y escanea el QR
    → Revisa el log en %APPDATA%\Vita Mirabilis\runner.log

  "La app se cierra sola al abrir"
    → Revisa el log en %APPDATA%\Vita Mirabilis\runner.log
    → Borra la carpeta %APPDATA%\Vita Mirabilis\wwebjs_auth\
      y reintenta (esto resetea la sesión de WhatsApp)

  "Error: puerto 18234 ocupado"
    → Cierra otras instancias de Vita Mirabilis
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


============================================================
   ¿Más ayuda? Revisa el log en:
   %APPDATA%\Vita Mirabilis\runner.log
============================================================
