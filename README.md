# Clinica Dental Pro

<div align="center">

**Sistema de Historial Clinico Odontologico para escritorio**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](./CHANGELOG.md)
[![Electron](https://img.shields.io/badge/Electron-35-9feaf9)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57)](https://www.sqlite.org/)

</div>

---

## Sobre el Proyecto

Clinica Dental Pro es una aplicacion de escritorio para Windows disenada para clinicas odontologicas pequenas y medianas. Permite gestionar historiales clinicos, odontogramas interactivos, tratamientos, pagos, recetas medicas y comunicacion con pacientes via WhatsApp - todo desde una sola interfaz.

El sistema funciona completamente offline, sin necesidad de conexion a internet, y se distribuye como un instalador automatico o version portable.

---

## Por que "Clinica Dental Pro"?

El proyecto fue originalmente desarrollado bajo el nombre "Vita Mirabilis". Sin embargo, durante la preparacion para su publicacion en GitHub, se descubrio que **"Vita Mirabilis" es una marca registrada perteneciente a un tercero**. Para evitar conflictos legales y respetar la propiedad intelectual, el proyecto fue renombrado a **"Clinica Dental Pro"** - un nombre descriptivo que refleja claramente la naturaleza del sistema.

Este cambio no afecta la funcionalidad del software. Todos los archivos fuente, scripts de instalacion y documentacion han sido actualizados para usar el nuevo nombre.

---

## Para Quien Fue Dirigido

- **Clinicas odontologicas pequenas/medianas** que buscan una solucion sin costo de licencia
- **Doctores odontologos independientes** que necesitan gestionar sus pacientes de forma digital
- **Estudiantes de odontologia** que requieren un sistema de practica
- **Equipos medicos** que buscan una alternativa accesible a sistemas comerciales costosos

---

## Por Que Es Importante

La gestion digital de historiales clinicos odontologicos es esencial para:

- **Eficiencia**: Reducir tiempo administrativo vs. sistemas en papel
- **PrecISION**: Minimizar errores en diagnostico y tratamiento
- **Comunicacion**: Enviar recetas y planes de tratamiento directamente por WhatsApp
- **Seguridad**: Firma digital del doctor en todos los documentos
- **Accesibilidad**: Funciona sin internet, sin cuotas mensuales

---

## Verificado por Experto

Este sistema fue **disenado y verificado en conjunto con un doctor odontologo aprobado**, asegurando que:

- El odontograma cumple la **norma FDI (ISO 3950)** con 32 piezas permanentes y 20 temporales
- Los campos clinicos son los requeridos por la legislacion sanitaria vigente
- El flujo de trabajo del wizard de 8 pasos es practico y eficiente
- Los PDFs generados cumplen con los formatos estandar del sector
- La validacion de documentos (DNI, CE, Pasaporte) sigue las tablas SUNAT

---

## Caracteristicas Principales

| Modulo | Descripcion |
|--------|-------------|
| **Pacientes** | CRUD completo con busqueda inteligente multi-palabra |
| **Historias Clinicas** | N HCL unico por paciente, antecedentes medicos (11 campos Si/No) |
| **Sesion Clinica** | Wizard de 8 pasos (motivo, examen, odontograma, evidencias, recetas, tratamiento, resumen) |
| **Odontograma** | SVG interactivo, 52 piezas, 5 superficies, colores por estado |
| **Tratamientos** | Plan con costos, estados (realizado/planificado), abonos parciales |
| **Pagos** | Registro de pagos con comprobantes PDF |
| **Recetas** | Medicamentos con dosis, frecuencia, duracion. PDF generado |
| **Evidencias** | Fotos de pacientes via drag-and-drop, QR, WhatsApp auto-ingest |
| **WhatsApp** | Envio de mensajes, recetas, planes de tratamiento. Anti-ban (20 msgs/hora) |
| **Firma Digital** | 3 modos: dibujar, importar imagen, subir desde celular |
| **Dashboard** | 4 graficos + 6 stat cards + banner WhatsApp |
| **Paciente 360** | Vista completa: clinico, odontograma, tratamientos, pagos, galeria, antecedentes |
| **PDFs** | Historia clinica, recetas, tratamientos, pagos - todos con firma del doctor |
| **Backup** | Exportar/importar datos en Excel/CSV + backup completo SQLite |
| **Instalador** | NSIS con instalacion automatica de VC++, Chrome, Node.js via winget |

---

## Instalacion Rapida

### Opcion 1: Instalador (Recomendado)

1. Descargar `Clinica Dental Pro Setup 1.2.0.exe` desde [Releases](https://github.com/Charles-X-Core/odontologia-sistema/releases)
2. Ejecutar el instalador
3. Seguir el asistente (instala VC++, Chrome, Node.js automaticamente)
4. Listo - el icono aparece en el escritorio y menu inicio

### Opcion 2: Portable

1. Descargar `Clinica Dental Pro-1.2.0 Portable.zip` desde [Releases](https://github.com/Charles-X-Core/odontologia-sistema/releases)
2. Extraer a cualquier carpeta
3. Ejecutar `Iniciar Clinica Dental Pro.bat`
4. Seleccionar "Instalar dependencias" en la primera ejecucion

### Opcion 3: Desarrollo

```bash
# Clonar repositorio
git clone https://github.com/Charles-X-Core/odontologia-sistema.git
cd odontologia-sistema

# Instalar dependencias
npm run install:all

# Cargar datos de prueba
npm run seed

# Ejecutar backend (terminal 1)
cd backend && npm run dev

# Ejecutar frontend (terminal 2)
cd frontend && npm run dev

# Ejecutar Electron (terminal 3)
npm start
```

---

## Credenciales de Prueba

| Usuario | Contrasena | Rol |
|---------|-----------|-----|
| admin | admin | Administrador |
| doctor | doctor | Odontologo |

---

## Requisitos del Sistema

- **SO**: Windows 10/11 (64-bit)
- **RAM**: 4 GB minimo
- **Disco**: 500 MB (incluyendo dependencias)
- **Chrome**: Necesario para WhatsApp web (se instala automaticamente)

---

## Stack Tecnico

| Componente | Tecnologia | Hosting |
|------------|-----------|---------|
| Frontend | React 19 + Vite | - |
| Backend | Node.js 22+ + Express | - |
| Base de datos | SQLite (node:sqlite) | - |
| Desktop | Electron 35 | - |
| PDF | pdfmake + puppeteer-core | - |
| WhatsApp | whatsapp-web.js 1.34.7 | - |
| Build | electron-builder 26 | - |
| Auth | JWT + bcryptjs | - |

---

## Desarrollo Local

### Estructura del Proyecto

```
Historias Clinica/
+-- electron/          # App de escritorio (Electron)
+-- backend/           # API REST (Node.js + Express + SQLite)
+-- frontend/          # Interfaz (React + Vite)
+-- portable/          # Scripts de distribucion
+-- build/             # Configuracion de installer
+-- scripts/           # Utilidades de build
+-- patches/           # Parches para dependencias
+-- documentacion/     # Documentacion tecnica
```

### Scripts Disponibles

```bash
npm run dev              # Ejecutar en modo desarrollo
npm run build            # Build completo
npm run build:installer  # Generar instalador NSIS (~160 MB)
npm run build:portable   # Generar portable (~118 MB)
npm run seed             # Cargar datos de prueba
npm run install:all      # Instalar todas las dependencias
```

---

## API Reference

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
| GET | /api/dashboard/stats | Si | Estadisticas dashboard |
| GET | /api/health | No | Health check |

---

## Documentacion

| Archivo | Contenido |
|---------|-----------|
| [00-RESUMEN.md](documentacion/00-RESUMEN.md) | Vista general del sistema |
| [01-NORMA-ODONTOGRAMA.md](documentacion/01-NORMA-ODONTOGRAMA.md) | Norma tecnica FDI |
| [02-ESTRUCTURA-PROYECTO.md](documentacion/02-ESTRUCTURA-PROYECTO.md) | Arquitectura y carpetas |
| [03-API-ENDPOINTS.md](documentacion/03-API-ENDPOINTS.md) | Documentacion de endpoints |
| [04-MODELO-DATOS.md](documentacion/04-MODELO-DATOS.md) | Schema de base de datos |
| [05-INSTALACION.md](documentacion/05-INSTALACION.md) | Guia de instalacion |
| [06-ELECTRON.md](documentacion/06-ELECTRON.md) | Configuracion de Electron |
| [ARQUITECTURA.md](documentacion/ARQUITECTURA.md) | Diagrama de arquitectura |
| [GUIA_DESARROLLO.md](documentacion/GUIA_DESARROLLO.md) | Guia para desarrolladores |
| [SOLUCION_PROBLEMAS.md](documentacion/SOLUCION_PROBLEMAS.md) | Troubleshooting |
| [WIZARD_SESION_CLINICA.md](documentacion/WIZARD_SESION_CLINICA.md) | Documentacion del wizard |

---

## Roadmap

### Completado

- [x] Autenticacion JWT con sesion persistente
- [x] CRUD completo de pacientes
- [x] Historias clinicas inmutables
- [x] Odontograma interactivo (SVG, 52 piezas)
- [x] Sesion clinica wizard de 8 pasos
- [x] Tratamientos con estados y costos
- [x] Pagos con comprobantes PDF
- [x] Recetas medicas con PDF
- [x] WhatsApp envio de mensajes y PDFs
- [x] Firma digital del doctor
- [x] Dashboard con graficos
- [x] Paciente 360
- [x] Busqueda inteligente multi-palabra
- [x] Instalador NSIS con dependencias automaticas
- [x] Version portable
- [x] Rebranding a Clinica Dental Pro

### Pendiente

- [ ] Calendario de citas
- [ ] Reportes (mensual ingresos, tratamientos comunes)
- [ ] Multi-usuario real con roles granulares
- [ ] Audit log
- [ ] Tema oscuro

Ver [ROADMAP.md](ROADMAP.md) para la lista completa.

---

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para guias de contribucion.

---

## Problemas Conocidos

- **WhatsApp QR loop**: Chrome 149 tiene bugs, se fuerza Chrome 146
- **QR solo funciona en misma red**: telefono y PC deben estar en la misma red local
- **Windows Defender**: puede marcar el portable como "no comun" (es normal para apps Electron)

---

## Licencia

MIT License - Ver [LICENSE](LICENSE)

---

## Creditos

- **Desarrollo**: Charles-X RedFlame Systems
- **Verificacion clinica**: Doctor odontologo aprobado
- **Tecnologias**: [Electron](https://www.electronjs.org/), [React](https://react.dev/), [Node.js](https://nodejs.org/), [SQLite](https://www.sqlite.org/)
- **WhatsApp**: [whatsapp-web.js](https://wwebjs.dev/)
- **PDFs**: [pdfmake](http://pdfmake.org/), [puppeteer](https://pptr.dev/)

---

<div align="center">

**Clinica Dental Pro** - Sistema de Historial Clinico Odontologico

Desarrollado con dedicacion para la comunidad odontologica

</div>
