# Electron - App de Escritorio

## Arquitectura

```
┌─────────────────────────────────────────┐
│              Electron                   │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │  Main Process│  │ Renderer Process│  │
│  │  (main.js)  │  │  (React App)    │  │
│  │             │  │                 │  │
│  │ - Backend   │──│ - Frontend      │  │
│  │ - Ventana   │  │ - UI            │  │
│  │ - Sistema   │  │ - Componentes   │  │
│  └─────────────┘  └─────────────────┘  │
│         │                               │
│         │ preload.js                    │
│         │ (contextBridge)               │
└─────────────────────────────────────────┘
```

## Proceso Principal (main.js)

Responsabilidades:
1. Iniciar el backend Express automaticamente
2. Crear la ventana del navegador
3. Cargar el frontend compilado
4. Manejar rutas de archivos en modo empaquetado

### Configuracion de puertos
- Backend: 18234 (interno, no expuesto)
- Frontend: Cargado via `loadFile()` (sin puerto)

### Resolucion de rutas

| Modo | getFrontendPath() | getDataPath() |
|------|-------------------|---------------|
| Desarrollo | `__dirname/../frontend/dist` | `__dirname/../backend` |
| Empaquetado | `app.getAppPath()/frontend/dist` | `resources/data` |

## Preload.js

Puente seguro entre main y renderer:
```js
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
});
```

## Base de Datos en Electron

| Modo | Ubicacion |
|------|-----------|
| Desarrollo | `backend/clinica.db` |
| Empaquetado | `resources/data/clinica.db` |

La DB se crea automaticamente al primera ejecucion via `seed.js`.

## Build Configuration (package.json)

```json
{
  "build": {
    "appId": "com.clinicadentalpro.odontologia",
    "productName": "Clinica Dental Pro",
    "files": [
      "electron/**/*",
      "backend/src/**/*",
      "backend/package.json",
      "backend/node_modules/**/*",
      "frontend/dist/**/*"
    ],
    "extraResources": [
      {
        "from": "backend/clinica.db",
        "to": "data/clinica.db"
      }
    ],
    "win": {
      "target": "nsis"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true
    }
  }
}
```

## Comandos

| Comando | Descripcion |
|---------|-------------|
| `npm start` | Ejecutar en desarrollo |
| `npm run build` | Generar instalador .exe |
| `npm run pack` | Generar version sin instalador |

## Troubleshooting

### Pantalla blanca
- Verificar `base: './'` en `vite.config.js`
- Verificar `app.getAppPath()` en `main.js`
- Revisar consola del DevTools (F12)

### Backend no inicia
- Verificar que el puerto 18234 este libre
- Revisar logs en consola de Electron
- Verificar que `clinica.db` no este corrupto

### DB no se crea
- Verificar que `seed.js` ejecuta sin errores
- Verificar permisos de escritura en `resources/data/`
