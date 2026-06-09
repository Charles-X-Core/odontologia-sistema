# Arquitectura de Vita Mirabilis

## Vision General

Vita Mirabilis es una aplicacion de escritorio para Windows construida con Electron. Sigue una arquitectura de 3 procesos con responsabilidades claramente separadas:

```
┌──────────────────────────────────────────────────────────────┐
│                    USUARIO (Windows PC)                        │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ click en "Vita Mirabilis.exe"
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  PROCESO PRINCIPAL (Electron Main)                            │
│  - electron/main.js                                           │
│  - electron/preload.js (IPC bridge)                           │
│  - Crea ventana, carga frontend, monitorea salud              │
└──────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
┌─────────────────────┐ ┌─────────────┐ ┌─────────────────────┐
│  FRONTEND           │ │  BACKEND    │ │  WHATSAPP RUNNER    │
│  (Renderer)         │ │  (Express)  │ │  (Node.js child)    │
│  React + Vite       │ │  Port 18234 │ │  Port 3002          │
│  localhost:5173     │ │             │ │  puerto interno     │
│  (dev) / asar       │ │             │ │                     │
│                     │ │             │ │  whatsapp-web.js    │
│  - UI               │ │  - API REST │ │  + puppeteer        │
│  - logica cliente   │ │  - SQLite   │ │  + Chrome           │
│  - estado React     │ │  - PDFs     │ │  - gestion QR       │
└─────────────────────┘ └─────────────┘ └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  SQLite Database    │
                    │  clinica.db         │
                    │  ~5 MB              │
                    │  win-unpacked/      │
                    │  resources/data/    │
                    └─────────────────────┘
```

---

## Los 3 Procesos

### 1. Proceso Principal (Electron Main)

**Archivo**: `electron/main.js`

**Responsabilidades**:
- Crear ventana principal del sistema operativo
- Verificar dependencias del sistema (VC++ Redist, Chrome, Node.js)
- Spawn del Backend como proceso hijo
- Spawn del WhatsApp Runner como proceso hijo
- Manejo de salud de procesos hijos (reinicio automatico)
- IPC con Frontend via preload (contextBridge)
- Manejo de errores no recuperables

**Archivos clave**:
- `electron/main.js` — orquestador principal
- `electron/preload.js` — puente seguro entre main y renderer
- `electron/openwaSetup.js` — deteccion/instalacion de Chrome y Node.js
- `electron/healthCheck.js` — verificacion periodica de procesos hijos

---

### 2. Frontend (Renderer Process)

**Stack**: React 18 + Vite + CSS3 (sin frameworks UI)

**Archivos clave**:
- `frontend/src/App.jsx` — router por estado (no usa react-router)
- `frontend/src/context/AuthContext.jsx` — estado de autenticacion global
- `frontend/src/components/` — 21 componentes
- `frontend/src/services/api.js` — cliente HTTP para backend
- `frontend/src/services/whatsapp.js` — cliente HTTP para runner

**Patron de navegacion**:
```javascript
// App.jsx
const [view, setView] = useState('dashboard');
// view puede ser: 'dashboard', 'pacientes', 'historia', 'sesion', etc.

return (
  <AuthProvider>
    {view === 'dashboard' && <Dashboard onNavigate={setView} />}
    {view === 'pacientes' && <Pacientes onNavigate={setView} />}
    {/* ... */}
  </AuthProvider>
);
```

**Comunicacion con backend**:
- `fetch()` directo a `http://localhost:18234/api/...`
- Token JWT en header `Authorization: Bearer ...`

**Comunicacion con WhatsApp**:
- `fetch()` directo a `http://localhost:3002/...` (proxy a runner)
- QR, status, sendMessage vienen del runner

---

### 3. Backend (Express API)

**Stack**: Node.js + Express + better-sqlite3

**Archivo entrada**: `backend/src/index.js`

**Puerto**: `18234` (configurable via `PORT`)

**Endpoints principales** (15 rutas):

| Path | Metodos | Descripcion |
|---|---|---|
| `/api/auth/login` | POST | Login con email + password |
| `/api/auth/verify` | GET | Validar token JWT |
| `/api/pacientes` | GET, POST | Listar y crear pacientes |
| `/api/pacientes/:id` | GET, PUT, DELETE | CRUD de un paciente |
| `/api/historias` | GET, POST | Listar y crear historias clinicas |
| `/api/historias/:id` | GET, PUT, DELETE | CRUD historia clinica |
| `/api/consultas` | GET, POST | Consultas medicas |
| `/api/odontogramas` | GET, POST, PUT | Odontograma de paciente |
| `/api/recetas` | GET, POST, PUT, DELETE | Recetas medicas |
| `/api/tratamientos` | GET, POST, PUT, DELETE | Tratamientos y abonos |
| `/api/pagos` | GET, POST, PUT | Pagos y comprobantes |
| `/api/imagenes` | GET, POST, DELETE | Imagenes de consultas |
| `/api/pdf/:tipo/:id` | GET | Generar PDF (historia, receta, pago) |
| `/api/whatsapp/*` | * | Proxy al runner |
| `/api/importar` | POST | Importar Excel/CSV |
| `/api/exportar` | GET | Exportar Excel/CSV |
| `/api/backup` | GET, POST | Backup completo SQLite |

**Controllers** (15 archivos):
- `authController.js` — JWT, hash passwords
- `pacienteController.js` — CRUD pacientes
- `historiaController.js` — historias clinicas
- `consultaController.js` — consultas
- `odontogramaController.js` — piezas dentales
- `recetaController.js` — recetas medicas
- `tratamientoController.js` — planes de tratamiento
- `pagoController.js` — pagos y abonos
- `imagenController.js` — archivos de imagen
- `pdfController.js` — generacion de PDFs
- `whatsappController.js` — proxy al runner
- `importacionController.js` — Excel/CSV
- `exportacionController.js` — Excel/CSV
- `backupController.js` — backup/restore SQLite
- `dashboardController.js` — metricas

**Base de datos**:

SQLite con `better-sqlite3` (sincronico, ~3x mas rapido que `sqlite3`).

**Tablas principales**:
- `usuarios` — login, roles
- `pacientes` — datos personales
- `historias_clinicas` — N°HCLX
- `consultas` — una por consulta medica
- `odontogramas` — por paciente
- `recetas` — medicamentos
- `tratamientos` — planes y abonos
- `pagos` — comprobantes
- `imagenes` — archivos adjuntos
- `necesidades` — diagnostico pendiente
- `audit_log` — cambios importantes

**Ubicacion DB**:
- Dev: `backend/data/clinica.db`
- Prod: `resources/data/clinica.db` (junto al asar)

**Migraciones**: Manuales en `backend/src/db/migrations/` si las hay.

---

### 4. WhatsApp Runner (Proceso Hijo)

**Archivo**: `electron/openwa-runner.js`

**Puerto**: `3002` (interno, no expuesto a Windows)

**Stack**: whatsapp-web.js 1.34.7 + puppeteer 24 + Express

**Responsabilidades**:
- Iniciar sesion de WhatsApp (QR + multi-device)
- Mantener sesion activa en `%APPDATA%\Vita Mirabilis\wwebjs_auth`
- Exponer API HTTP para que el backend consulte estado y envie mensajes
- Reintentar conexion ante caidas
- Matar procesos Chrome zombie antes de reintentar
- Logging detallado a archivo

**Endpoints** (proxy):
- `GET /` — health check
- `GET /status` — estado actual de la sesion
- `GET /qr` — QR actual en base64
- `POST /send` — enviar mensaje
- `POST /send-pdf` — enviar PDF adjunto
- `POST /logout` — cerrar sesion

**Patron de inicio**:
```javascript
// electron/openwa-runner.js
async function initWhatsApp() {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'vitamirabilis' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: getChromePath() // 6 rutas posibles
    }
  });

  client.on('qr', (qr) => qrData = qr);
  client.on('ready', () => isReady = true);
  client.on('auth_failure', () => killChromeProcesses().then(retry));
  client.on('disconnected', () => killChromeProcesses().then(retry));

  await client.initialize();
}
```

**Patch critico**: `patches/whatsapp-web.js+1.34.7.patch` (issue #5754)

**Retries**: `MAX_INIT_ATTEMPTS = 5` con backoff de 5 segundos

---

## Flujo de Datos: Ejemplo "Enviar PDF por WhatsApp"

```
[Usuario click "Enviar PDF" en UI]
        │
        ▼
[Frontend: services/whatsapp.js]
  POST http://localhost:18234/api/whatsapp/send-pdf
        │
        ▼
[Backend: routes/whatsapp.js → whatsappController.js]
  1. Genera PDF: pdfController → pdfTemplates/historiaHtmlPdf.js
  2. Genera PDF via puppeteer-core
        │
        ▼
[Backend llama a Runner]
  POST http://localhost:3002/send-pdf
  body: { telefono: "+54911...", pdfBase64: "...", filename: "..." }
        │
        ▼
[Runner: openwa-runner.js]
  1. Verifica isReady
  2. Convierte base64 a buffer
  3. WhatsApp client.sendMessage() con PDF como documento
        │
        ▼
[WhatsApp → Servidor WA → Telefono destino]
```

**Tiempos esperados**:
- Generar PDF: 1-3 segundos
- Llamar runner: <100ms
- Enviar a WhatsApp: 1-2 segundos
- Total: 3-6 segundos end-to-end

---

## Patrones de Diseno Utilizados

### Backend

- **MVC** clasico: rutas → controllers → servicios → DB
- **Repository** implicit: cada controller accede directo a SQLite
- **Middleware** para auth: `authMiddleware.js` valida JWT
- **Validacion** manual: `if (!req.body.email) return res.status(400)...`

### Frontend

- **Context** para estado global: `AuthContext`
- **Props** para estado de componente
- **Services** para llamadas HTTP
- **Hooks** personalizados: `useApi`, `useDebounce`, `useToast`

### Comunicacion entre procesos

- **Electron IPC** (preload + contextBridge) para Main ↔ Renderer
- **HTTP** (puerto fijo) para Main ↔ Backend ↔ Runner
- **Archivos compartidos** (`%APPDATA%\Vita Mirabilis\`) para estado persistente

---

## Seguridad

### Lo que esta implementado

- **JWT** con secret en variable de entorno (o constante)
- **Passwords hasheados** con bcrypt
- **Context Isolation** en Electron (`nodeIntegration: false`)
- **CORS** restrictivo (solo localhost)
- **Validacion de input** basica en controllers

### Lo que NO esta implementado (limitaciones conocidas)

- No hay HTTPS (es localhost, no expuesto)
- No hay rate limiting
- No hay CSRF tokens (no es web public)
- No hay sanitizacion XSS en PDFs (Puppeteer escapea)
- No hay 2FA
- No hay encriptacion at-rest de la DB

### Modelo de amenaza

La app corre en localhost, no esta expuesta a internet. La unica superficie de ataque es:
1. USB/CD que copie la carpeta del usuario
2. Otro usuario con acceso a la PC
3. Malware en la PC que lea `%APPDATA%\Vita Mirabilis\`

**No es un sistema de alto riesgo** (no maneja datos bancarios, no se expone online).

---

## Performance

### Bundle size

- **asar**: 9.7 MB (solo codigo de app)
- **asar.unpacked**: 383 MB (todas las deps)
- **win-unpacked total**: ~393 MB
- **7z comprimido**: 255 MB
- **SFX .exe**: 262 MB

### Tiempos

- **Empaquetado**: 2-3 minutos
- **Inicio de la app**: 5-10 segundos (incluye spawn de backend y runner)
- **Generar PDF**: 1-3 segundos
- **Enviar WhatsApp**: 1-2 segundos despues de PDF

### Optimizaciones implementadas

- `better-sqlite3` (sincronico, 3x mas rapido)
- Cache de paciente activo en memoria
- Reuse de puppeteer (no crea browser nuevo cada envio)
- Lazy load de modulos pesados (puppeteer solo en send-pdf)

### Optimizaciones pendientes

- Cache de PDFs frecuentes
- Indice en SQLite para busquedas por nombre
- Code splitting en frontend (vite ya lo hace parcialmente)
- Compression gzip en respuestas API (no critico en localhost)

---

## Estructura de Archivos

```
odontologia-sistema/
├── package.json                    # Root, scripts de build
├── package-lock.json
├── patches/
│   └── whatsapp-web.js+1.34.7.patch
├── scripts/
│   └── copy-portable.js            # postbuild hook
├── portable/
│   ├── Iniciar Vita Mirabilis.bat
│   ├── VERIFICAR.bat
│   └── README.txt
├── electron/
│   ├── main.js
│   ├── preload.js
│   ├── openwaSetup.js
│   ├── openwa-runner.js
│   └── ...
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.js                # Entry
│   │   ├── db/                     # SQLite setup
│   │   ├── controllers/            # 15 archivos
│   │   ├── routes/                 # 15 archivos
│   │   ├── services/
│   │   │   └── pdfTemplates/       # 11 archivos
│   │   ├── middleware/
│   │   └── utils/
│   └── data/                       # Dev DB
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── App.css                 # 5,493 lineas
│   │   ├── context/
│   │   ├── components/             # 21 archivos
│   │   └── services/
│   ├── public/
│   └── dist/                       # Build output
├── resources/                      # Prod: data + assets
├── dist-electron/                  # Build output Electron
└── documentacion/
    ├── ARQUITECTURA.md             # Este archivo
    ├── GUIA_DESARROLLO.md
    └── SOLUCION_PROBLEMAS.md
```

---

## Almacenamiento de Evidencias

### Estructura de Carpetas (Sprint 3)

```
resources/data/evidencias/
├── {paciente_id}/
│   ├── {consulta_id}/
│   │   ├── 2026-06-08_14-30_foto-diente-16.jpg
│   │   ├── 2026-06-08_14-32_radiografia-panoramica.png
│   │   └── ...
│   └── general/
│       └── foto-general.jpg
└── ...
```

### Métodos de Subida (Sprint 4)

| Método | Uso | Seguridad |
|---|---|---|
| **Drag & Drop** | Desktop — arrastrar imagen al wizard/galería | JWT auth |
| **QR Code** | Celular — escanea QR, sube desde página móvil | Token temporal (15min, single-use) |
| **WhatsApp** | Celular — envía foto al chat de la clínica | Auto-ingest por número conocido |
| **Web Upload** | Celular — login + upload vía navegador (WiFi local) | JWT auth |

### Seguridad de Imágenes

- **No express-static**: Las imágenes se sirven vía endpoint autenticado (Bearer JWT)
- **Hash SHA256**: Cada imagen tiene hash en tabla `imagenes` para verificar integridad
- **Backup incluido**: El backup completo incluye la carpeta `evidencias/`
- **Referencia DB**: La tabla `imagenes` referencia `paciente_id` + `consulta_id`

### Tabla `imagenes` (columnas nuevas en Sprint 3)

```sql
ALTER TABLE imagenes ADD COLUMN paciente_id INTEGER REFERENCES pacientes(id);
ALTER TABLE imagenes ADD COLUMN consulta_id INTEGER REFERENCES consultas(id);
ALTER TABLE imagenes ADD COLUMN hash_sha256 TEXT DEFAULT '';
ALTER TABLE imagenes ADD COLUMN tipo TEXT DEFAULT 'foto'; -- foto, radiografia, panorama, intraoral
ALTER TABLE imagenes ADD COLUMN descripcion TEXT DEFAULT '';
```

---

## Decisiones de Diseno Clave

### ¿Por que Express y no Fastify/Hapi?

Express es el mas conocido, mejor documentado, suficiente para localhost. Fastify seria mas rapido pero la ganancia es despreciable en una API local.

### ¿Por que better-sqlite3 y no Mongo/Postgres?

- La app es local-first, no necesita servidor de DB
- SQLite es perfecto para 1-2 PCs simultaneas
- better-sqlite3 es 3x mas rapido que sqlite3
- Backups son un solo archivo `.db`

### ¿Por que Vite y no CRA/Next.js?

- Vite es mas rapido (HMR instantaneo)
- Mas ligero (mejor para Electron)
- Soporta code splitting nativo
- CRA esta deprecado

### ¿Por que no usar react-router?

- Solo hay 10 vistas
- La navegacion es jerarquica (Sesion Clinica wizard, Importar pasos)
- Un `useState('view')` es mas simple que configurar rutas

### ¿Por que whatsapp-web.js y no Baileys/Capi?

- whatsapp-web.js es la mas mantenida
- API similar a la oficial de WhatsApp Business
- Soporta multi-device
- Mejor documentacion
