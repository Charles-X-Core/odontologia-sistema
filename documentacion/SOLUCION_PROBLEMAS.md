# Solucion de Problemas

Guia detallada para resolver los problemas mas comunes de Clinica Dental Pro.

---

## Indice

1. [La app no inicia](#1-la-app-no-inicia)
2. [WhatsApp no se conecta](#2-whatsapp-no-se-conecta)
3. [PDF no se genera](#3-pdf-no-se-genera)
4. [Error "Chrome not found"](#4-error-chrome-not-found)
5. [Mi PC tiene problemas despues de instalar](#5-mi-pc-tiene-problemas-despues-de-instalar)
6. [Drivers de sonido o camara no funcionan](#6-drivers-de-sonido-o-camara-no-funcionan)
7. [Base de datos corrupta](#7-base-de-datos-corrupta)
8. [Puerto 18234 ya en uso](#8-puerto-18234-ya-en-uso)
9. [La app va muy lenta](#9-la-app-va-muy-lenta)
10. [Como desinstalar completamente](#10-como-desinstalar-completamente)

---

## 1. La app no inicia

### Sintomas
- Doble click en "Clinica Dental Pro.exe" y no pasa nada
- La ventana aparece y se cierra inmediatamente
- Mensaje "Error: ENOENT" o "Cannot find module"

### Diagnostico

**Paso 1**: Abrir una terminal PowerShell en la carpeta de la app:
```powershell
# En la carpeta donde esta el .exe
cd "C:\Users\TU_USUARIO\Desktop\Clinica Dental Pro"
.\"Clinica Dental Pro.exe"
```

**Paso 2**: Leer el mensaje de error que aparece.

**Paso 3**: Si dice "Cannot find module 'X'", ver [Seccion 8](#8-puerto-18234-ya-en-uso).

### Causas comunes

#### a) Faltan dependencias del sistema (VC++ Redist, Chrome, Node.js)

**Solucion**:
1. Ejecutar `VERIFICAR.bat` (incluido en la carpeta)
2. Si dice "Falta X", abrir PowerShell como admin y correr:
   ```powershell
   winget install Microsoft.VCRedist.2015+.x64
   winget install Google.Chrome
   winget install OpenJS.NodeJS.LTS
   ```
3. Reintentar

#### b) El archivo se descargo de internet y Windows lo bloqueo

**Sintoma**: doble click muestra "Este archivo proviene de un equipo de la red" o "SmartScreen"

**Solucion**:
1. Click derecho en el `.exe` → Propiedades
2. Tildar "Desbloquear"
3. Aplicar
4. Reintentar

#### c) Antivirus bloqueo la app

**Sintoma**: el antivirus (Defender, Avast, etc.) mostro una alerta y movio el archivo a cuarentena

**Solucion**:
1. Abrir el antivirus
2. Buscar en "Cuarentena" o "Elementos en cuarentena"
3. Restaurar el archivo
4. Agregar la carpeta a exclusiones del antivirus
5. Reintentar

#### d) El archivo esta corrupto (descarga incompleta)

**Sintoma**: mensaje "Archivo dañado" o "La firma es invalida"

**Solucion**: Volver a descargar el `.7z` y verificar el tamano (debe ser ~255 MB).

---

## 2. WhatsApp no se conecta

### Sintomas
- El QR no aparece
- El QR aparece pero al escanearlo dice "reiniciar"
- Despues de escanear, no llega el evento "ready"
- Mensaje "auth_failure" en el log

### Diagnostico

**Paso 1**: Ver el log del runner:
```powershell
# Ver las ultimas 50 lineas
Get-Content "$env:APPDATA\Clinica Dental Pro\runner.log" -Tail 50
```

**Paso 2**: Buscar palabras clave: `error`, `fail`, `disconnect`, `auth_failure`.

### Soluciones

#### a) El QR expiro (2 minutos)

**Causa**: No se escaneo el QR dentro del tiempo limite.

**Solucion**:
1. Click en "Reiniciar WhatsApp" en la app
2. Escanear el NUEVO QR inmediatamente
3. Si vuelve a expirar, ver seccion [Chrome zombie](#c-chrome-zombie-processes)

#### b) Chrome zombie processes

**Causa**: La app se cerro abruptamente y quedaron procesos Chrome bloqueando el puerto de debug.

**Solucion**:
```powershell
# Abrir PowerShell como admin
taskkill /F /IM chrome.exe /T
```

Despues reabrir la app.

#### c) Sesion previa corrupta

**Causa**: La sesion guardada esta danada (despues de una actualizacion de WhatsApp, por ejemplo).

**Solucion**:
```powershell
# Borrar la sesion guardada
Remove-Item -Recurse -Force "$env:APPDATA\Clinica Dental Pro\wwebjs_auth"

# Reabrir la app y escanear QR de nuevo
```

#### d) WhatsApp Web cambio y la version no es compatible

**Causa**: WhatsApp actualiza su servidor y la version de `whatsapp-web.js` no lo soporta.

**Solucion**:
1. Verificar version de whatsapp-web.js: `cat node_modules/whatsapp-web.js/package.json | grep version`
2. Buscar en GitHub si hay issues: https://github.com/pedroslopez/whatsapp-web.js/issues
3. Si es un problema conocido, esperar release o actualizar manualmente

#### e) Internet inestable

**Causa**: WhatsApp requiere conexion constante. Si se cae a cada rato, la sesion no se mantiene.

**Solucion**: Mejorar la conexion a internet (o usar cable de red).

---

## 3. PDF no se genera

### Sintomas
- Click en "Generar PDF" no hace nada
- Mensaje "Chrome not found for puppeteer"
- PDF se genera pero esta vacio o corrupto

### Diagnostico

**Paso 1**: Verificar que Chrome esta instalado:
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --version
```

Si dice "no se reconoce", ver [Seccion 4](#4-error-chrome-not-found).

**Paso 2**: Probar generar PDF simple desde la terminal:
```powershell
cd "C:\Users\TU_USUARIO\Desktop\Clinica Dental Pro\resources\app.asar.unpacked\node_modules\puppeteer"
node -e "const puppeteer = require('puppeteer'); puppeteer.launch({headless:true}).then(async b => { const p = await b.newPage(); await p.setContent('<h1>Test</h1>'); await p.pdf({path:'test.pdf'}); await b.close(); console.log('OK'); });"
```

Si esto funciona pero la app no, hay un problema de path.

### Soluciones

#### a) Chrome esta en una ruta no estandar

Ver [Seccion 4](#4-error-chrome-not-found).

#### b) Permisos de escritura

**Causa**: La carpeta donde se quiere escribir el PDF no es escribible.

**Solucion**: Verificar que la carpeta destino es escribible:
```powershell
# Probar crear un archivo
"test" | Out-File "$env:TEMP\test.txt"
```

Si falla, ver permisos de la carpeta.

#### c) Puppeteer no encuentra Chrome portable

**Causa**: La app intenta usar el Chrome de puppeteer cache (`~/.cache/puppeteer`) pero ese no existe.

**Solucion**:
```powershell
# Verificar cache de puppeteer
Get-ChildItem "$env:LOCALAPPDATA\puppeteer" -ErrorAction SilentlyContinue
Get-ChildItem "$env:USERPROFILE\.cache\puppeteer" -ErrorAction SilentlyContinue
```

Si no hay nada, descargar Chrome portable:
```powershell
# (la app deberia hacerlo, pero si falla, manual)
npx @puppeteer/browsers install chrome
```

---

## 4. Error "Chrome not found for puppeteer"

### Causa
El sistema no encuentra Google Chrome en ninguna de las 6 rutas que la app consulta.

### Las 6 rutas que la app busca

1. `C:\Program Files\Google\Chrome\Application\chrome.exe`
2. `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
3. `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`
4. `%LOCALAPPDATA%\puppeteer\chrome\chrome.exe`
5. `%USERPROFILE%\.cache\puppeteer\chrome\chrome.exe`
6. Donde indique `puppeteer.executablePath` o `PUPPETEER_EXECUTABLE_PATH`

### Soluciones

#### a) Instalar Chrome via winget

```powershell
# Abrir PowerShell como admin
winget install Google.Chrome
```

#### b) Si Chrome portable (descarga manual)

Si descargaste Chrome portable (`.zip`), extraer a:
- `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe` (recomendado)
- O cualquier otra ruta, pero despues setear variable de entorno:
  ```powershell
  [System.Environment]::SetEnvironmentVariable("PUPPETEER_EXECUTABLE_PATH", "C:\mi\ruta\chrome.exe", "User")
  ```
  Reiniciar la app.

#### c) Instalar Chrome via puppeteer

```powershell
# En la carpeta de la app
cd "C:\Users\TU_USUARIO\Desktop\Clinica Dental Pro"
node node_modules\@puppeteer\browsers\bin\init.js install chrome
```

Esto descarga Chrome a `%LOCALAPPDATA%\puppeteer\chrome`.

---

## 5. Mi PC tiene problemas despues de instalar

### Preguntas frecuentes

> "¿La app rompio mis drivers de sonido?"

**Respuesta corta**: NO. La app no toca drivers.

**Explicacion detallada**: Ver [Seccion 6](#6-drivers-de-sonido-o-camara-no-funcionan).

> "¿La app puede haber danado Windows?"

**Respuesta corta**: NO. La app solo:
- Extrae archivos a una carpeta
- Instala paquetes oficiales de Microsoft, Google y OpenJS via `winget`
- Lee/escribe archivos en `%APPDATA%\Clinica Dental Pro\`
- Lee/escribe la base de datos SQLite
- Abre Chrome y WhatsApp Web

**Explicacion**: ver `ROADMAP.md` seccion "ANALISIS DE SEGURIDAD".

> "¿Como puedo estar seguro?"

1. Abrir PowerShell como admin
2. Correr:
   ```powershell
   # Verificar que la app no modifico el registro
   reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" | findstr "Clinica Dental Pro"
   ```
   Si NO aparece, la app no se "instalo" en el sentido tradicional.

3. Verificar que el unico directorio nuevo es el de la app:
   ```powershell
   Get-ChildItem "C:\Users\TU_USUARIO\AppData\Roaming" | Where-Object Name -eq "Clinica Dental Pro"
   ```
   Esto muestra que la app creo su carpeta en AppData (normal para apps Electron).

4. Verificar que no se crearon servicios de Windows:
   ```powershell
   Get-Service | Where-Object Name -like "*Vita*"
   Get-Service | Where-Object Name -like "*Mirabilis*"
   ```
   Si NO aparece nada, no hay servicio creado.

---

## 6. Drivers de sonido o camara no funcionan

### Esto NO es culpa de Clinica Dental Pro

Clinica Dental Pro **NO**:
- Instala drivers
- Modifica drivers existentes
- Accede a `pnputil`, `devcon`, `reg.exe`
- Toca el kernel de Windows
- Modifica servicios del sistema

### Causas probables

#### a) Windows Update reemplazo drivers genericos

**Causa**: Despues de una actualizacion automatica, Windows puede reemplazar el driver especifico de tu tarjeta de sonido o camara por uno generico que funciona peor.

**Solucion**:
1. Abrir "Administrador de dispositivos" (`devmgmt.msc`)
2. Buscar el dispositivo con problema (ej: "Realtek Audio")
3. Click derecho → "Actualizar controlador"
4. "Buscar en mi equipo" → "Elegir de una lista"
5. Seleccionar el driver especifico (no el generico)

#### b) Otro software se actualizo

Candidatos comunes:
- **Zoom** (instala drivers de audio virtual)
- **Discord** (similar)
- **OBS Studio**
- **Skype**
- **Windows Update**

**Solucion**: Revisar que se actualizo cerca de la fecha del problema:
```powershell
# Ver actualizaciones instaladas recientes
Get-WmiObject -Class Win32_QuickFixEngineering | Sort-Object InstalledOn -Descending | Select-Object -First 10
```

#### c) Malware

**Solucion**: Escanear con Windows Defender (analisis completo) y Malwarebytes.

#### d) Problema fisico

Si el problema empeora con el tiempo, puede ser el hardware (cable suelto, microfono danado, etc.).

### Como probar que la app no es la causa

1. **Desinstalar la app** completamente (ver [Seccion 10](#10-como-desinstalar-completamente))
2. **Reiniciar** la PC
3. **Probar audio/camara** (grabar con la app de Camara de Windows, reproducir musica)
4. Si el problema persiste, NO era la app
5. Si el problema se soluciono, restaurar sistema o buscar otra causa

---

## 7. Base de datos corrupta

### Sintomas
- La app abre pero no muestra pacientes
- Mensaje "database disk image is malformed"
- Mensaje "no such table: pacientes"

### Causas
- Apagado forzado de la PC durante escritura
- Disco duro con sectores danados
- Antivirus que bloqueo un archivo

### Soluciones

#### a) Restaurar desde backup

Si la app tiene la funcionalidad de backup (Fase 4), restaurar el ultimo `.db` valido.

Si no, buscar en:
```powershell
# Backups automaticos de Windows
Get-ChildItem "$env:APPDATA\Clinica Dental Pro\backups" -ErrorAction SilentlyContinue
```

#### b) Intentar reparar SQLite

```powershell
# Descargar sqlite3 CLI desde https://www.sqlite.org/download.html
# Luego:
sqlite3 clinica.db ".dump" | sqlite3 clinica_reparada.db
```

Si funciona, reemplazar `clinica.db` con `clinica_reparada.db`.

#### c) Empezar de cero

Ultimo recurso: borrar `clinica.db` y dejar que la app la regenere.

⚠️ **CUIDADO**: Esto borra TODOS los datos. Hacer backup antes.

```powershell
# Backup primero
Copy-Item "$env:APPDATA\Clinica Dental Pro\clinica.db" "$env:DESKTOP\backup_$(Get-Date -Format 'yyyyMMdd').db"

# Borrar
Remove-Item "$env:APPDATA\Clinica Dental Pro\clinica.db*"
```

---

## 8. Puerto 18234 ya en uso

### Sintoma
Mensaje: `Error: listen EADDRINUSE: address already in use 0.0.0.0:18234`

### Causa
Otra instancia de la app (o un node.exe zombie) esta usando el puerto.

### Solucion

```powershell
# Ver que proceso lo usa
netstat -ano | findstr :18234

# Salida: TCP    0.0.0.0:18234    0.0.0.0:0    LISTENING    1234
#                                                          ^^^^ ese es el PID

# Matarlo
taskkill /F /PID 1234
```

Si no sabes que es, matar todos los `node.exe`:
```powershell
taskkill /F /IM node.exe
```

⚠️ Esto puede cerrar otras apps que uses (VSCode con debugger, etc.).

---

## 9. La app va muy lenta

### Posibles causas

#### a) Muchos datos en la DB

Si tienes +10,000 pacientes o +50,000 consultas, la app puede ir lenta porque carga todo en memoria.

**Solucion pendiente**: implementar paginacion en backend (Fase 1).

#### b) Chrome consume mucha RAM

WhatsApp Web + puppeteer usa ~500 MB de RAM. En PCs con poca RAM (<8 GB) puede ir lento.

**Solucion**:
- Cerrar otras apps pesadas (Chrome, Photoshop, etc.)
- Agregar mas RAM
- Reducir el tamano de las imagenes adjuntas

#### c) Disco duro HDD lento

Las SSDs son 5-10x mas rapidas que los HDD. Si usas HDD, la app ira lenta.

**Solucion**: Migrar a SSD (o instalar la app en el SSD si tienes uno + HDD).

#### d) Antivirus escaneando

Si el antivirus esta escaneando constantemente la carpeta de la app, relentiza todo.

**Solucion**: Agregar la carpeta de la app a exclusiones del antivirus.

---

## 10. Como desinstalar completamente

### Paso a paso

#### a) Cerrar la app

Click derecho en el icono de la app en la bandeja del sistema (system tray) → "Cerrar".

Si no aparece, abrir Administrador de tareas (Ctrl+Shift+Esc) y cerrar:
- `Clinica Dental Pro.exe`
- `electron.exe`
- `chrome.exe` (los que no sean tu Chrome normal)
- `openwa-runner.exe` o `node.exe` (si lo ves)

#### b) Borrar la carpeta de la app

```powershell
# Ajustar la ruta a donde tengas la app
Remove-Item -Recurse -Force "C:\Users\TU_USUARIO\Desktop\Clinica Dental Pro"
```

#### c) Borrar los datos de usuario

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\Clinica Dental Pro"
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Clinica Dental Pro"
```

#### d) (Opcional) Desinstalar Chrome, Node.js, VC++

⚠️ **CUIDADO**: estos pueden ser usados por otras apps. Solo desinstalar si sabes que no los necesitas.

```powershell
winget uninstall Google.Chrome
winget uninstall OpenJS.NodeJS.LTS
winget uninstall Microsoft.VCRedist.2015+.x64
```

#### e) Verificar que no quedan rastros

```powershell
# Buscar archivos relacionados
Get-ChildItem "C:\" -Recurse -Filter "*clinicadentalpro*" -ErrorAction SilentlyContinue -Depth 3
Get-ChildItem "C:\" -Recurse -Filter "*Clinica Dental Pro*" -ErrorAction SilentlyContinue -Depth 3
```

Si no aparece nada, desinstalacion completa.

---

## Logs Utiles

### Ubicacion de logs

| Log | Path |
|---|---|
| WhatsApp Runner | `%APPDATA%\Clinica Dental Pro\runner.log` |
| Sesion WhatsApp | `%APPDATA%\Clinica Dental Pro\wwebjs_auth\` |
| Electron Main | Solo visible en terminal donde se ejecuto |
| Backend | Solo visible en terminal donde se ejecuto |

### Ver log en tiempo real

```powershell
Get-Content "$env:APPDATA\Clinica Dental Pro\runner.log" -Wait
```

(Ctrl+C para salir)

### Borrar logs para empezar limpio

```powershell
Remove-Item "$env:APPDATA\Clinica Dental Pro\runner.log"
```

---

## 11. Problemas con Evidencias

### Imágenes no aparecen en la galería

**Diagnóstico**:
```powershell
# Verificar estructura de carpetas
Get-ChildItem "resources\data\evidencias" -Recurse -ErrorAction SilentlyContinue

# Verificar permisos
icacls "resources\data\evidencias"
```

**Soluciones**:
1. Verificar que la estructura es `evidencias/{paciente_id}/{consulta_id}/`
2. Verificar permisos de escritura en la carpeta
3. Verificar que el hash SHA256 en tabla `imagenes` coincide con el archivo
4. Verificar que el endpoint retorna las imágenes (no express-static)

### QR Code no funciona

**Causas**:
1. Token expiró (15 minutos)
2. Token ya fue usado (single-use)
3. No está en la misma red WiFi

**Solución**:
1. Generar nuevo QR desde el desktop
2. Verificar conexión WiFi del celular
3. Verificar que el URL del QR apunta a la IP correcta

### WhatsApp no recibe fotos

**Diagnóstico**:
```powershell
# Ver log del runner
Get-Content "$env:APPDATA\Clinica Dental Pro\runner.log" -Tail 50 | Select-String "message|image|media"
```

**Causas**:
1. openwa-runner.js no está escuchando mensajes entrantes
2. Número del doctor no está en la lista de contactos conocidos
3. Formo de imagen no soportado (solo jpg/png/webp)

**Solución**:
1. Verificar que el runner tiene listener de `message` activo
2. Verificar que el número del doctor está registrado en la DB
3. Revisar logs para errores de descarga de media

### Upload falla desde celular

**Causas**:
1. Celular no está en la misma red WiFi
2. Puerto 18234 bloqueado por firewall
3. Token JWT expiró

**Solución**:
1. Verificar que ambos dispositivos están en la misma red
2. Verificar que el firewall permite tráfico en puerto 18234
3. Hacer login nuevemente para obtener nuevo token

### Backup no incluye evidencias

**Causa**: Backup configurado solo para DB

**Solución**:
1. Verificar que `exportacionController.js` incluye `evidencias/`
2. Verificar espacio en disco (imágenes pueden ser pesadas)
3. Probar backup manual: comprimir `resources/data/` completo

---

## Contacto y Soporte

Si ninguna de estas soluciones funciono:

1. **Recopilar info del sistema**:
   ```powershell
   systeminfo | Out-File "$env:DESKTOP\info_sistema.txt"
   Get-ChildItem "$env:APPDATA\Clinica Dental Pro" -Recurse -ErrorAction SilentlyContinue | Out-File "$env:DESKTOP\info_app.txt"
   ```

2. **Recopilar log del runner**:
   ```powershell
   Copy-Item "$env:APPDATA\Clinica Dental Pro\runner.log" "$env:DESKTOP\"
   ```

3. **Reportar el issue** en:
   https://github.com/Charles-X-Core/odontologia-sistema/issues

   Incluir:
   - Descripcion del problema
   - Pasos para reproducirlo
   - Info del sistema (Windows version, RAM, etc.)
   - Log del runner (si es relevante)
