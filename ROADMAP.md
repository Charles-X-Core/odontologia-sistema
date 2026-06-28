# Clinica Dental Pro — Roadmap

Documento vivo del estado del proyecto, errores resueltos y trabajo pendiente.

---

## ✅ HITOS COMPLETADOS

### v1.0.0 — Base del Sistema

- [x] **Autenticacion JWT** con sesion persistente (localStorage)
- [x] **CRUD Pacientes** con busqueda, ordenamiento y paginacion
- [x] **Historias Clinicas** con N°HCLX unico por paciente
- [x] **Consultas** con odontograma, signos vitales, diagnostico
- [x] **Odontograma interactivo** (SVG, 52 piezas dentales, 5 superficies por pieza)
- [x] **Recetas** con medicamentos, dosis, frecuencia, duracion
- [x] **Tratamientos** con plan, presupuesto, abonos
- [x] **Pagos** con comprobantes y seguimiento
- [x] **Necesidades** odontologicas por paciente
- [x] **Imagenes** adjuntas a consultas
- [x] **PDF Historia Clinica** con N°HCLX por consulta
- [x] **Importar/Exportar datos** (Excel/CSV) + backup SQLite completo
- [x] **WhatsApp** envio de mensajes y PDFs adjuntos
- [x] **Dashboard** con metricas basicas
- [x] **Sesion Clinica** wizard de 7 pasos
- [x] **Estacion de Datos** unified import/export
- [x] **Configuracion** del sistema

**Stack**:
- Frontend: React 18 + Vite
- Backend: Node.js + Express + SQLite (better-sqlite3)
- Desktop: Electron 35
- PDF: pdfkit (directo) + puppeteer-core (WhatsApp)
- WhatsApp: whatsapp-web.js 1.34.7

**Metricas v1.0.0**:
- Backend: 5,770 lineas JS (15 controllers, 15 routes, 11 PDF templates)
- Frontend: 7,214 lineas JSX (21 componentes)
- Electron: 1,643 lineas JS (8 archivos)
- CSS: 5,493 lineas en App.css

---

### v1.0.0-portable — Distribucion Portable

- [x] **Build con electron-builder** (`--dir` para portable)
- [x] **asarUnpack completo** de `node_modules/` y `electron/`
- [x] **postbuild hook** (`scripts/copy-portable.js`)
- [x] **Iniciar Clinica Dental Pro.bat** con:
  - Auto-elevacion a administrador
  - Verificacion de VC++ Redist, Chrome, Node.js, espacio
  - Instalacion automatica via `winget` con `--silent`
- [x] **VERIFICAR.bat** read-only (diagnostico sin instalar)
- [x] **README.txt** documentacion para usuario final
- [x] **3 paquetes generados**:
  - `.7z` — 255 MB (recomendado)
  - `.rar` — 262 MB
  - `.exe` SFX — 262 MB (autoextrae, sin instalar WinRAR)

**Verificado end-to-end** en PC de desarrollo y otra PC:
- WhatsApp conecta y recibe mensajes
- Multiples ready events confirmados
- QR scan funciona

---

## BUGS RESUELTOS (catalogo completo)

### 1. WhatsApp se queda en "Desconectado" / QR no avanza

**Sintoma**: Cliente se conecta pero `appState.hasSynced` nunca se emite.

**Causa**: Race condition entre `appState.hasSynced` (que ya es `true` cuando el evento se dispara por primera vez) y el listener `change:hasSynced` (que solo se activa en cambios).

**Fix** (en `node_modules/whatsapp-web.js/src/Client.js`, lineas 404-416):
```js
// ANTES del listener
if (appState.hasSynced) {
    window.onAppStateHasSyncedEvent();
}

// Listener para cambios futuros
appState.on('change:hasSynced', (_AppState, hasSynced) => {
    if (hasSynced) {
        window.onAppStateHasSyncedEvent();
    }
});
```

**Issue referenciado**: whatsapp-web.js #5754

**Verificado**: log muestra `UNPAIRED → OPENING → PAIRING → UNPAIRED_IDLE → ready` al escanear QR.

**Mantenimiento**: Patch via `patch-package` en `patches/whatsapp-web.js+1.34.7.patch`. Se aplica automaticamente en `npm install` via `postinstall`.

---

### 2. "Cannot find module '@puppeteer/browsers'"

**Sintoma**: Al ejecutar la app portable, runner falla con este error al cargar `puppeteer`.

**Causa**: asarUnpack no incluia `@puppeteer/browsers` (dep transitiva de puppeteer).

**Fix**:
- Agregado `@puppeteer/browsers ^2.10.0` a `dependencies` en `package.json`
- Expandido asarUnpack a `**/node_modules/**`

**Resuelto**: confirmado en log del runner.

---

### 3. "Cannot find module 'semver'" / "'agent-base'"

**Sintoma**: Despues de fix #2, el runner falla con error similar para otras deps transitivas.

**Causa**: deps transitivas de `@puppeteer/browsers` (semver) y `proxy-agent` (agent-base) tampoco estaban en asar.unpacked.

**Fix**: Cambiar asarUnpack a `**/node_modules/**` (unpack TODO node_modules).

**Resultado**:
- asar: 9.7 MB (solo codigo de app)
- asar.unpacked: 383 MB (todo node_modules)
- 7z final: 255 MB (comprime muy bien)

---

### 4. Chrome zombie processes

**Sintoma**: Al reintentar conexion WhatsApp, falla con "browser is already running for ..."

**Causa**: Retry del runner no mata Chrome previo, queda zombie bloqueando nuevo puppeteer.launch.

**Fix** (en `electron/openwa-runner.js`):
```js
function killChromeProcesses() {
  try {
    const { execSync } = require('child_process');
    execSync('taskkill /F /IM chrome.exe /T 2>nul', { stdio: 'ignore' });
  } catch (e) {}
}
```

Llamada en cada retry: `auth_failure`, `disconnected`, `initialize error`.

---

### 5. File logging en dist (stderr se pierde)

**Sintoma**: En produccion (Electron empaquetado), `console.log` no se ve porque stdout/stderr no van a una terminal visible.

**Causa**: Electron app no tiene consola adjunta en Windows.

**Fix** (en `electron/openwa-runner.js`):
```js
const logFile = path.join(process.env.APPDATA || process.env.TEMP, 'Clinica Dental Pro', 'runner.log');
function fileLog(msg) { /* append con timestamp ISO */ }
// Override console.* y process.stderr.write
```

**Log path**: `%APPDATA%\Clinica Dental Pro\runner.log`

---

### 6. EADDRINUSE puerto 18234

**Sintoma**: "address already in use 0.0.0.0:18234" al iniciar la app por segunda vez.

**Causa**: Backend anterior no se cerro limpiamente, proceso node.exe zombie mantiene el puerto.

**Fix**: Antes de iniciar, `startBackend()` valida que el puerto este libre. Si no, mata el proceso.

**Status**: PENDIENTE Fase 1.

---

### 7. PDF WhatsApp: "Chrome not found for puppeteer"

**Sintoma**: Error al enviar PDF por WhatsApp.

**Causa**: `findChrome()` en `backend/src/services/pdfTemplates/htmlToPdf.js` solo busca 3 rutas, no consulta `C:\Program Files\Google\Chrome\`.

**Fix planeado**: Crear `backend/src/utils/chromeFinder.js` con 6 rutas (igual que `openwaSetup.js`) y reusar en ambos lugares.

**Status**: 🔴 PENDIENTE Fase 1.

---

## ANALISIS DE SEGURIDAD

### ¿Que hace la app a nivel sistema?

| Accion | Toca drivers? | Detalle |
|---|---|---|
| Extraer SFX a carpeta del usuario | No | Solo archivos locales |
| `winget install VC++ Redist` | No | Solo DLLs de runtime C++ |
| `winget install Google Chrome` | No | Solo navegador |
| `winget install Node.js LTS` | No | Solo runtime JS |
| `taskkill chrome.exe` | No | Mata procesos, no drivers |
| `fs.rmSync wwebjs_auth` | No | Solo carpeta de sesion |
| `fs.appendFileSync runner.log` | No | Solo archivo de log |
| `puppeteer.launch()` con Chrome | No | Chrome usa drivers existentes |

### Lo que la app **NO** hace (verificado por grep)

- NO usa `reg.exe` (modificar registro)
- NO usa `pnputil` (instalar drivers)
- NO usa `devcon` (manipular devices)
- NO usa `sc.exe` (instalar servicios)
- NO accede a `C:\Windows\System32\drivers\`
- NO modifica el kernel de Windows
- NO toca dispositivos de hardware

### Conclusion

**Clinica Dental Pro NO puede danar drivers de sonido o camara.**

Si una PC donde se instalo tiene problemas de drivers, las causas probables son:

1. **Windows Update** (causa #1): drivers genericos que reemplazan especificos
2. **Otro software** que se actualizo cerca de esa fecha (Zoom, Teams, etc.)
3. **Malware** que bloqueo drivers
4. **Problema electrico/hardware** no relacionado con software
5. **Confusion temporal**: el driver ya estaba danado antes de instalar

Ver `documentacion/SOLUCION_PROBLEMAS.md` seccion "Mi PC tiene problemas despues de instalar" para diagnostico paso a paso.

---

## PENDIENTES POR FASE

### Fase 1 — Bugs Criticos
- [ ] PDF WhatsApp: unificar `findChrome()` con `openwaSetup` (6 rutas + winget)
- [ ] Eliminar `puppeteer-core` duplicado (raiz + `backend/`)
- [ ] Unificar sistemas PDF (pdfkit vs puppeteer-core)
- [ ] Validar `process.env` (no asumir `LOCALAPPDATA` existe)
- [ ] EADDRINUSE 18234 cleanup en restart

### Fase 2 — Limpieza ligera
- [ ] Eliminar archivos no usados (`debug_docker.js`, `dockerSetup.js`, `diagnostico.js`)
- [ ] Extraer constantes a `config/` (puertos 18234, 3002, paths)
- [ ] Refactorizar duplicacion `SesionClinica/Historial` (extraer hooks)
- [ ] Reducir `App.css` (5,493 lineas en 1 archivo, dividir por componente)

### Fase 3 — UI/UX
- [ ] Sistema de toasts (reemplazar `alert()` con `react-hot-toast`)
- [ ] Skeleton loaders en Pacientes, Historial, Dashboard
- [ ] Empty states ("No hay pacientes" + ilustracion)
- [ ] Busqueda en tiempo real
- [ ] Modales de confirmacion estilizados
- [ ] Dashboard con graficas (Chart.js o Recharts)
- [ ] Tema oscuro

### Fase 4 — Features nuevas
- [ ] Calendario de citas (mensual/semanal/diaria)
- [ ] Busqueda global Ctrl+K
- [ ] Audit log (quien modifico que y cuando)
- [ ] Reportes (mensual ingresos, tratamientos comunes)
- [ ] Multi-usuario real con roles granulares

---

## METRICAS DEL PROYECTO

| Componente | Cantidad |
|---|---|
| Backend JS | 5,770 lineas |
| Backend archivos | 15 controllers + 15 routes + 11 PDF templates + 3 services |
| Frontend JSX | 7,214 lineas |
| Frontend componentes | 21 |
| Electron JS | 1,643 lineas |
| Electron archivos | 8 |
| CSS | 5,493 lineas (1 solo archivo `App.css`) |
| Total estimado | ~18,100 lineas |

---

## GIT WORKFLOW

### Branches principales
- `master` — branch principal, codigo de produccion
- `backup/v1.0.0-portable-whatsapp-working` — respaldo del estado estable
- `mejoras/documentacion-y-transparencia` — trabajo de Fase 0

### Convenciones
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- Mensajes en espanol
- Branchs descriptivos con prefijo de categoria

---

## RECURSOS EXTERNOS

- **Repo GitHub**: https://github.com/Charles-X-Core/odontologia-sistema
- **whatsapp-web.js docs**: https://wwebjs.dev/
- **Electron docs**: https://www.electronjs.org/docs
- **electron-builder**: https://www.electron.build/
- **patch-package**: https://www.npmjs.com/package/patch-package
