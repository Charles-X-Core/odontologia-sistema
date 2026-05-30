# Estructura del Proyecto

## Arquitectura General

```
Historias Clinica/
├── electron/                 # Electron (app de escritorio)
│   ├── main.js              # Proceso principal
│   ├── preload.js           # Puente seguro
│   └── icon.ico             # Icono de la app
├── backend/                  # API REST
│   ├── src/
│   │   ├── index.js         # Servidor Express
│   │   ├── database.js      # Conexion SQLite
│   │   ├── seed.js          # Datos de prueba
│   │   ├── controllers/     # Logica de negocio
│   │   │   ├── authController.js
│   │   │   ├── pacienteController.js
│   │   │   ├── historiaController.js
│   │   │   ├── consultaController.js
│   │   │   ├── odontogramaController.js
│   │   │   ├── tratamientoController.js
│   │   │   ├── recetaController.js
│   │   │   └── imagenController.js
│   │   ├── routes/          # Endpoints REST
│   │   │   ├── auth.js
│   │   │   ├── pacientes.js
│   │   │   ├── historias.js
│   │   │   ├── consultas.js
│   │   │   ├── odontogramas.js
│   │   │   ├── tratamientos.js
│   │   │   ├── recetas.js
│   │   │   └── imagenes.js
│   │   └── middleware/
│   │       └── auth.js      # JWT middleware
│   ├── package.json
│   └── clinica.db           # Base de datos SQLite
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── App.jsx          # Componente principal
│   │   ├── App.css          # Estilos
│   │   ├── main.jsx         # Entry point
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Pacientes.jsx
│   │   │   ├── Historial.jsx
│   │   │   ├── OdontogramaSVG.jsx
│   │   │   ├── Tratamientos.jsx
│   │   │   ├── Recetas.jsx
│   │   │   └── Galeria.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   └── services/
│   │       └── api.js       # Cliente HTTP
│   ├── package.json
│   └── vite.config.js
├── documentacion/            # Documentacion
├── package.json             # Electron + electron-builder
└── README.md
```

## Flujo de Datos

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Frontend │────▶│ Backend  │────▶│ SQLite   │
│ React    │◀────│ Express  │◀────│ Database │
└──────────┘     └──────────┘     └──────────┘
     │
     │ (Electron)
     ▼
┌──────────┐
│ Main.js  │
│ Electron │
└──────────┘
```

## Dependencias

### Backend
- express - Servidor HTTP
- cors - Cross-Origin Resource Sharing
- jsonwebtoken - Autenticacion JWT
- bcryptjs - Hash de contrasenas
- multer - Subida de archivos

### Frontend
- react - UI library
- react-dom - React DOM renderer
- vite - Build tool

### Desktop
- electron - Framework de escritorio
- electron-builder - Empaquetador
