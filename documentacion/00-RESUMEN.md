# Clinica Dental Pro - Documentacion del Sistema

## Sistema de Historial Clinico Odontologico

**Version:** 1.0.0
**Plataforma:** Electron (escritorio) + Web (Vercel/Render)
**Base de datos:** SQLite
**Backend:** Node.js + Express
**Frontend:** React + Vite

---

## Indice de Documentacion

| Archivo | Contenido |
|---------|-----------|
| `00-RESUMEN.md` | Vista general del sistema |
| `01-NORMA-ODONTOGRAMA.md` | Norma tecnica FDI del odontograma |
| `02-ESTRUCTURA-PROYECTO.md` | Arquitectura y carpetas del proyecto |
| `03-API-ENDPOINTS.md` | Documentacion de endpoints REST |
| `04-MODELO-DATOS.md` | Schema de base de datos |
| `05-INSTALACION.md` | Guia de instalacion y ejecucion |
| `06-ELECTRON.md` | Configuracion de Electron |

---

## Credenciales de Acceso

| Usuario | Contrasena | Rol |
|---------|-----------|-----|
| admin | admin | Administrador |
| doctor | doctor | Odontologo |

---

## Funcionalidades

- CRUD completo de pacientes
- Historias clinicas inmutables
- Consultas cronologicas
- Odontograma SVG a norma FDI
- Tratamientos con estados y costos
- Recetas medicas con PDF
- Galeria de imagenes (mockup)
- Auth JWT con roles
- App de escritorio Electron

---

## Tecnologias

| Componente | Tecnologia |
|------------|-----------|
| Backend | Node.js 22+, Express |
| Frontend | React 19, Vite |
| Base de datos | SQLite (node:sqlite) |
| Auth | JWT + bcryptjs |
| Desktop | Electron 35 |
| Build | electron-builder |
