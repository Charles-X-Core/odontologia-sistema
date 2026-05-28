# Sistema de Historial Clinico Odontologico

Sistema completo para gestionar historiales clinicos odontologicos con autenticacion, panel profesional y odontograma visual.

## Credenciales de acceso

| Usuario | Contrasena | Rol |
|---------|-----------|-----|
| admin | admin | Administrador |
| doctor | doctor | Odontologo |

## Requisitos

- Node.js 22+ (usa `node:sqlite` integrado)
- npm

## Ejecucion local

```bash
# Backend
cd backend
npm install
npm run seed    # Carga datos de prueba
npm start       # http://localhost:3001

# Frontend (otra terminal)
cd frontend
npm install
npm run dev     # http://localhost:5173
```

## Deploy Gratuito

### Backend en Render.com

1. Ir a [render.com](https://render.com) → Create Web Service
2. Conectar repositorio `odontologia-sistema`
3. Configurar:
   - **Name**: `odontologia-backend`
   - **Runtime**: Node
   - **Region**: Oregon (o la mas cercana)
   - **Branch**: master
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/seed.js && node src/index.js`
   - **Plan**: Free
4. Environment Variables:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = `una-clave-secreta-larga`
   - `FRONTEND_URL` = `https://tu-app.vercel.app`
5. Create Web Service
6. Esperar deploy (~2 min)
7. URL: `https://odontologia-backend.onrender.com`

### Frontend en Vercel

1. Ir a [vercel.com](https://vercel.com) → New Project
2. Importar repositorio `odontologia-sistema`
3. Configurar:
   - **Framework**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Environment Variables:
   - `VITE_API_URL` = `https://odontologia-backend.onrender.com/api`
5. Deploy
6. URL: `https://odontologia-frontend.vercel.app`

### Notas importantes

- Render free tier duerme despues de 15min sin trafico
- El primer request tarda ~30seg (cold start)
- La DB SQLite se reinicia al redeploy (es demo, no produccion)
- Para datos persistentes, usar Turso o Supabase

## Stack Tecnico

| Componente | Tecnologia | Hosting |
|------------|-----------|---------|
| Backend | Node.js + Express | Render.com (gratis) |
| Frontend | React + Vite | Vercel (gratis) |
| Base de datos | SQLite | Archivo local |
| Auth | JWT + bcrypt | - |

## API Endpoints

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | /api/auth/login | No | Iniciar sesion |
| POST | /api/auth/register | No | Registrar usuario |
| GET | /api/auth/me | Si | Usuario actual |
| GET | /api/pacientes | Si | Listar pacientes |
| POST | /api/pacientes | Si | Crear paciente |
| GET | /api/pacientes/:id | Si | Obtener paciente |
| GET | /api/pacientes/:id/historial | Si | Historial completo |
| PUT | /api/pacientes/:id | Si | Actualizar paciente |
| DELETE | /api/pacientes/:id | Si | Eliminar paciente |
| POST | /api/historias | Si | Crear historia |
| PUT | /api/historias/:id | Si | Actualizar historia |
| POST | /api/consultas | Si | Crear consulta |
| GET | /api/consultas/historia/:id | Si | Consultas de historia |
| POST | /api/odontogramas | Si | Guardar odontograma |
| GET | /api/odontogramas/historia/:id | Si | Odontogramas |
| GET | /api/health | No | Health check |

## Modelo de Datos

- **Usuarios**: autenticacion con roles (admin/odontologo)
- **Pacientes**: datos personales
- **Historias Clinicas**: antecedentes, alergias (una por paciente)
- **Consultas**: motivo, diagnostico, tratamiento (inmutables)
- **Odontogramas**: estado de 32 dientes en JSON por consulta
