# Contribuir a Clinica Dental Pro

Gracias por tu interes en contribuir a Clinica Dental Pro. Este documento explica como participar en el desarrollo.

## Requisitos previos

- Node.js 22+ (usa `node:sqlite` integrado)
- npm
- Git
- Google Chrome (para WhatsApp web)
- Windows 10/11 (la app esta disenada para Windows)

## Configuracion del entorno de desarrollo

```bash
# 1. Clonar el repositorio
git clone https://github.com/Charles-X-Core/odontologia-sistema.git
cd odontologia-sistema

# 2. Instalar dependencias
npm run install:all

# 3. Cargar datos de prueba
npm run seed

# 4. Ejecutar backend (terminal 1)
cd backend
npm run dev

# 5. Ejecutar frontend (terminal 2)
cd frontend
npm run dev

# 6. Ejecutar Electron (terminal 3)
npm start
```

## Estructura del proyecto

```
Historias Clinica/
├── electron/          # App de escritorio (Electron)
├── backend/           # API REST (Node.js + Express + SQLite)
├── frontend/          # Interfaz (React + Vite)
├── portable/          # Scripts de distribucion
├── build/             # Configuracion de installer
├── scripts/           # Utilidades de build
├── patches/           # Parches para dependencias
├── documentacion/     # Documentacion tecnica
└── evidencias/        # Imagenes de pacientes (no incluido en git)
```

## Convenciones de codigo

### Backend
- Archivos en `backend/src/`
- Controllers: logica de negocio (pacienteController.js, consultaController.js, etc.)
- Routes: definicion de endpoints REST
- Services: servicios compartidos (pdfTemplates/, whatsapp/)
- Helpers: utilidades genericas

### Frontend
- Componentes en `frontend/src/components/`
- Estilos en `frontend/src/App.css`
- Formularios en `frontend/src/components/Pacientes.jsx`
- Wizards en `frontend/src/components/SesionClinica.jsx`

### Nomenclatura
- Archivos: camelCase (pacienteController.js)
- Componentes React: PascalCase (Paciente360.jsx)
- Funciones: camelCase (resolveHclx)
- Constantes: UPPER_SNAKE_CASE (MAX_FILE_SIZE)
- SQL: snake_case (historias_clinicas)

## Flujo de trabajo

1. Crear branch desde `master`:
   ```bash
   git checkout -b feat/nombre-descriptivo
   ```

2. Hacer cambios y probar localmente

3. Commit con mensaje descriptivo:
   ```
   feat: descripcion corta del cambio
   fix: descripcion del bug corregido
   docs: cambios en documentacion
   chore: tareas de mantenimiento
   ```

4. Push y crear Pull Request

## Pull Requests

- Titulo claro y descriptivo
- Describir que hace el cambio
- Incluir capturas de pantalla si hay cambios UI
- Referenciar issues si aplica

## Reglas importantes

- **NO commitear credenciales** (tokens, passwords, API keys)
- **NO commitear archivos de sesion** (wwebjs_auth/)
- **NO commitear archivos grandes** (>10MB)
- **Los PDFs deben generar correctamente** antes de commitear
- **WhatsApp debe conectar** en modo desarrollo antes de commitear

## Testing manual

Antes de un PR, verificar:
- [ ] Login funciona (admin/admin y doctor/doctor)
- [ ] Pacientes CRUD funciona
- [ ] Sesion clinica wizard completa (8 pasos)
- [ ] Odontograma guarda correctamente
- [ ] PDF genera sin errores
- [ ] WhatsApp conecta y recibe mensajes
- [ ] Firma del doctor aparece en PDFs
- [ ] Dashboard carga estadisticas

## Licencia

Al contribuir, aceptas que tus contribuciones se licencien bajo MIT License.
