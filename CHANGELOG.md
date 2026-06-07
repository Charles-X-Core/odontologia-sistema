# Changelog

Todos los cambios notables de Vita Mirabilis seran documentados en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.0.0] — 2025-XX-XX

### Primera version publica portable

### Agregado
- Sistema completo de gestion odontologica (pacientes, consultas, tratamientos, pagos, recetas)
- Historias clinicas con odontograma interactivo (SVG, 52 piezas)
- Sesion clinica wizard de 7 pasos
- Importar/Exportar Excel/CSV + backup completo de SQLite
- Envio de PDF historia clinica por WhatsApp
- Autenticacion JWT con sesion persistente
- 3 paquetes portables: `.7z` (255 MB), `.rar`, `.exe` SFX
- Auto-instalacion de VC++ Redist, Google Chrome, Node.js via `winget`
- Auto-elevacion a administrador
- Diagnostico read-only (`VERIFICAR.bat`)

### Bugs Resueltos
- **whatsapp-web.js #5754**: Race condition en `appState.hasSynced` → patch via `patch-package`
- **@puppeteer/browsers no encontrado**: dep agregada a `dependencies` + asarUnpack completo
- **Chrome zombie processes**: `taskkill /F /IM chrome.exe /T` en cada retry
- **Logging en dist**: file logging a `%APPDATA%\Vita Mirabilis\runner.log`
- **asar bloated (393 MB)**: cambio a `**/node_modules/**` (asar 9.7 MB)

### Configuracion
- asarUnpack: `**/node_modules/** + **/electron/**`
- postbuild: `node scripts/copy-portable.js`
- postinstall: `patch-package`
- electron-builder: appId `com.vitamirabilis.odontologia`, productName `Vita Mirabilis`

### Stack Tecnologico
- Frontend: React 18 + Vite
- Backend: Node.js + Express + better-sqlite3
- Desktop: Electron 35
- PDF: pdfkit (directo) + puppeteer-core (WhatsApp)
- WhatsApp: whatsapp-web.js 1.34.7 + puppeteer 24
- Empaquetado: electron-builder 25

---

## [0.9.0] — Pre-portable (no publicado)

### En desarrollo interno
- Migracion de sqlite3 → better-sqlite3 (mejora ~3x en velocidad)
- Refactorizacion del sistema de PDF (preparacion para puppeteer)
- Creacion de la estacion de datos unificada
- Mejoras en el wizard de sesion clinica

---

## Leyenda de tipos de cambios

- `Agregado` — para nuevas funcionalidades
- `Cambiado` — para cambios en funcionalidades existentes
- `Deprecado` — para funcionalidades que seran removidas pronto
- `Removido` — para funcionalidades removidas
- `Arreglado` — para bug fixes
- `Seguridad` — en caso de vulnerabilidades

---

## Versionado

Dada una version MAJOR.MINOR.PATCH:

- **MAJOR** se incrementa cuando hay cambios incompatibles en la API
- **MINOR** se incrementa cuando se agrega funcionalidad compatible
- **PATCH** se incrementa cuando se hacen arreglos de bugs compatibles

---

## Historial de Decisiones Tecnicas (ADR simplificado)

### 2025-Q4: asarUnpack completo

**Contexto**: El empaquetado inicial de asar no incluyo varias dependencias transitivas de puppeteer (@puppeteer/browsers, semver, agent-base), causando errores en runtime al ejecutar la app portable.

**Decision**: Cambiar `asarUnpack` a `**/node_modules/**` (unpackear TODO node_modules).

**Consecuencias**:
- asar queda pequeno (9.7 MB) y rapido de cargar
- asar.unpacked crece (383 MB) pero se comprime muy bien en 7z
- Tamaño final del 7z: 255 MB (aceptable para una app completa)
- Tiempo de empaque: ~2-3 minutos
- Mas fiable que mantener lista de patrones

**Alternativas consideradas**:
- Lista de patrones especificos → 30+ patrones, facil de olvidar uno
- asar CLI repack → asar 393 MB sin compresion, no viable
- Mejorar electron-builder → no soporta unpack selectivo
