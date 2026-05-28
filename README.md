# Sistema de Historial Clinico Odontologico

Sistema completo para gestionar historiales clinicos odontologicos con autenticacion, panel profesional y odontograma visual.

## Requisitos

- Node.js 25+ (usa `node:sqlite` integrado - sin compilacion nativa)
- npm

## Estructura

```
Historias Clinica/
├── backend/                  # API REST - Node.js + Express + SQLite
│   ├── src/
│   │   ├── index.js          # Servidor principal
│   │   ├── database.js       # Conexion SQLite + schema
│   │   ├── controllers/      # Logica de negocio
│   │   ├── routes/           # Endpoints REST
│   │   └── middleware/       # Auth JWT
│   └── clinica.db            # Base de datos (se crea automaticamente)
├── frontend/                 # React + Vite
│   └── src/
│       ├── App.jsx           # App principal
│       ├── components/       # Login, Sidebar, Dashboard, Pacientes, Historial
│       ├── context/          # AuthContext (JWT)
│       └── services/         # API client con token
└── README.md
```

## Instalacion y Ejecucion

### 1. Backend

```bash
cd backend
npm install
npm run seed    # Carga datos de prueba + usuario admin
npm start       # http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
```

### 3. Credenciales de prueba

| Email | Contrasena | Rol |
|-------|-----------|-----|
| admin@clinica.com | admin123 | Administrador |
| doctor@clinica.com | doctor123 | Odontologo |

## Endpoints API

### Auth (publicos)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /api/auth/login | Iniciar sesion |
| POST | /api/auth/register | Registrar usuario |

### Auth (requieren token)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | /api/auth/me | Usuario actual |
| GET | /api/auth | Listar usuarios |

### Pacientes
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | /api/pacientes | Listar pacientes |
| POST | /api/pacientes | Crear paciente |
| GET | /api/pacientes/:id | Obtener paciente |
| GET | /api/pacientes/:id/historial | Historial completo |
| PUT | /api/pacientes/:id | Actualizar paciente |
| DELETE | /api/pacientes/:id | Eliminar paciente |

### Historias Clinicas
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /api/historias | Crear historia |
| GET | /api/historias/paciente/:id | Obtener historia |
| PUT | /api/historias/:id | Actualizar historia |

### Consultas
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /api/consultas | Crear consulta |
| GET | /api/consultas/historia/:id | Consultas de una historia |

### Odontogramas
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /api/odontogramas | Guardar odontograma |
| GET | /api/odontogramas/historia/:id | Odontogramas de una historia |

## Modelo de Datos

- **Usuarios**: autenticacion con roles (admin/odontologo)
- **Paciente**: datos personales (nombre, DNI, telefono, etc.)
- **HistoriaClinica**: antecedentes, alergias (una por paciente)
- **Consulta**: motivo, diagnostico, tratamiento (inmutables)
- **Odontograma**: estado de 32 dientes en JSON por consulta

## Funcionalidades

- Login con JWT (tokens de 24h)
- Dashboard con estadisticas
- CRUD completo de pacientes
- Historial clinico cronologico
- Editor de odontograma visual (32 dientes, 8 estados)
- Timeline de consultas
- Busqueda de pacientes
- Roles: admin y odontologo

## Reglas de Negocio

- Cada paciente tiene una sola historia clinica
- Las consultas son inmutables (no se editan)
- El historial se muestra en orden cronologico
- El odontograma se versiona por consulta

## Tecnologias

- **Backend**: Node.js, Express, node:sqlite, JWT, bcryptjs
- **Frontend**: React, Vite
- **Base de datos**: SQLite (archivo local)
