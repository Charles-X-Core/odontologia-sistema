# AGENTS.md — Guia para agentes AI

## Arquitectura General

Clinica Dental Pro es una app de escritorio (Electron) con backend Node.js y frontend React.

```
electron/        → Proceso principal Electron (main.js, preload.js, openwa-runner.js)
backend/         → API REST (Express + SQLite)
  src/
    controllers/ → Logica de negocio (paciente, consulta, tratamiento, etc.)
    routes/      → Endpoints REST
    services/    → Servicios (pdfTemplates/, whatsapp/)
    utils/       → Utilidades (chromeFinder.js, helpers)
frontend/        → Interfaz de usuario (React + Vite)
  src/
    components/  → Componentes React
    utils/       → Helpers (formatters.js, pdfTemplates.js)
  public/        → Assets estaticos (logos, imagenes)
```

## Como ejecutar

```bash
# Backend
cd backend && npm install && npm run dev    # http://localhost:3001

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:5173

# Electron (en otra terminal)
npm start
```

## Como hacer build

```bash
npm run build:installer   # Instalador NSIS (~160 MB)
npm run build:portable    # Portable (~118 MB)
```

## Credenciales de prueba

| Usuario | Contrasena | Rol |
|---------|-----------|-----|
| admin | admin | Administrador |
| doctor | doctor | Odontologo |

## Archivos criticos

| Archivo | Funcion |
|---------|---------|
| `electron/main.js` | Proceso principal, ventanas, permisos admin |
| `electron/openwa-runner.js` | WhatsApp connection, anti-ban, auto-ingest |
| `backend/src/database.js` | Conexion SQLite, schema, migraciones |
| `backend/src/index.js` | Servidor Express, CORS, middleware |
| `backend/src/utils/chromeFinder.js` | Deteccion de Chrome para puppeteer |
| `backend/src/services/pdfTemplates/pdfHistoriaClinica.js` | PDF de historia clinica |
| `backend/src/services/pdfTemplates/pdfReceta.js` | PDF de receta medica |
| `frontend/src/App.jsx` | Router principal, LayoutAuth |
| `frontend/src/components/Pacientes.jsx` | CRUD pacientes + antecedentes |
| `frontend/src/components/SesionClinica.jsx` | Wizard 8 pasos |
| `frontend/src/components/Odontograma.jsx` | Odontograma SVG interactivo |
| `frontend/src/components/Paciente360.jsx` | Vista 360 del paciente |
| `frontend/src/components/Dashboard.jsx` | Dashboard con graficos |
| `frontend/src/components/FirmaDigital.jsx` | Firma del doctor (canvas/imagen/QR) |
| `frontend/src/utils/formatters.js` | Helpers: nombreCompleto, calcularEdad, etc. |

## Convenciones

- **Idioma**: Español en UI, commits, y documentacion
- **Componentes**: PascalCase en archivos React
- **Funciones**: camelCase
- **SQL**: snake_case en columnas
- **Commits**: Conventional Commits (feat:, fix:, docs:, chore:)

## Dependencias criticas

- **whatsapp-web.js**: Requiere patch (patch-package) para bug #5754
- **Chrome 146**: FORCED en chromeFinder.js (Chrome 149 tiene bugs)
- **patch-package**: Se ejecuta en postinstall para parchar whatsapp-web.js

## Testing manual obligatorio

Antes de cualquier cambio significativo, verificar:
1. Login funciona
2. Pacientes CRUD
3. Sesion clinica wizard (8 pasos)
4. Odontograma visual (guardado automatico)
5. PDF genera correctamente
6. WhatsApp conecta
7. Firma del doctor en PDFs
8. Dashboard carga estadisticas
9. Busqueda de pacientes funciona
10. Paciente360 carga datos

## Errores comunes

- **WhatsApp QR loop**: Chrome 149 tiene bug, usar Chrome 146
- **Cannot find module**: Ejecutar `npm run install:all`
- **EADDRINUSE 18234**: Cerrar instancias previas de la app
- **PDF sin firma**: Verificar que el usuario logueado tenga firma configurada
- **Imagenes no cargan**: Verificar JWT token en URL
