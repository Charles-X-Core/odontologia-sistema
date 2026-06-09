# Plan de Mejoras — Vita Mirabilis

Plan detallado de mejoras a implementar, organizado por fases, con estimacion de esfuerzo y prioridad.

---

## Como Leer Este Documento

**Simbologia**:
- 🔴 = Critico (bug que afecta funcionalidad principal)
- 🟡 = Importante (mejora significativa)
- 🟢 = Deseable (nice-to-have)

**Esfuerzo**: S (1-2 horas), M (3-8 horas), L (1-3 dias), XL (1+ semana)

---

## Sprint 1: UI + Componentes + Login
**Duracion estimada**: 1-2 dias
**Objetivo**: Mejorar la experiencia visual y crear componentes reutilizables

### 1.1 Login — nombre de usuario + rediseño

**Problema**:
- Login actual pide "Email" pero el sistema usa "nombre de usuario"
- Credenciales de prueba visibles en el UI
- Layout basico sin diseno profesional

**Archivos a modificar**:
- `frontend/src/components/Login.jsx`
- `backend/src/controllers/authController.js` (ya soporta nombre)
- `backend/src/database.js` (email opcional)
- `frontend/src/App.css` (nuevos estilos)

**Solucion**:
1. Cambiar label "Email" por "Usuario" en el formulario
2. Quitar credenciales de prueba visibles
3. Layout dividido: lado izquierdo branding, lado derecho formulario
4. Animaciones suaves de entrada
5. Hacer email opcional en DB (migracion)

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 1.2 Dashboard Rediseño

**Problema**:
- Dashboard actual: 5 stats basicos + tabla
- Sin tendencias ni graficas
- Sin accesos rapidos

**Archivos a modificar**:
- `frontend/src/components/Dashboard.jsx`
- `frontend/src/App.css`

**Solucion**:
1. Stats con indicadores de tendencia (↑↓ vs mes anterior)
2. Accesos rapidos (Nueva Consulta, Buscar Paciente, Ver Agenda)
3. Actividad reciente (ultimas consultas)
4. Grafica simple de pacientes por mes (sin libreria externa, SVG)

**Esfuerzo**: M
**Riesgo**: Bajo

---

### 1.3 Componentes Reutilizables

**Problema**:
- No hay libreria de componentes base
- Cada componente reimplementa botones, modales, etc.
- UI inconsistente

**Archivos a crear**:
- `frontend/src/components/ui/Button.jsx`
- `frontend/src/components/ui/Card.jsx`
- `frontend/src/components/ui/FormField.jsx`
- `frontend/src/components/ui/Modal.jsx`
- `frontend/src/components/ui/Badge.jsx`
- `frontend/src/components/ui/Avatar.jsx`
- `frontend/src/components/ui/Spinner.jsx`
- `frontend/src/components/ui/EmptyState.jsx`
- `frontend/src/components/ui/Table.jsx`
- `frontend/src/components/ui/index.js` (barrel export)

**Solucion**:
1. Crear carpeta `components/ui/`
2. Implementar 9 componentes base con variantes
3. Documentar props en cada componente
4. Refactorizar Login y Dashboard para usarlos

**Esfuerzo**: M
**Riesgo**: Bajo

---

## Sprint 2: Wizard + Navegacion
**Duracion estimada**: 1-2 dias
**Objetivo**: Mejorar wizard de sesion clinica y navegacion

### 2.1 Wizard — Paso 5 Evidencias

**Problema**:
- Evidencias (fotos) estan mezcladas con recetas
- No hay forma de subir fotos durante la consulta
- Las fotos son evidencia clinica, no recetas

**Archivos a modificar**:
- `frontend/src/components/SesionClinica.jsx` (nuevo paso 5)
- `backend/src/controllers/imagenController.js`
- `frontend/src/App.css`

**Solucion**:
1. Nuevo paso 5 "Evidencias" despues del odontograma
2. Drag & Drop para subir imagenes
3. Preview de imagenes subidas
4. Campo de descripcion por imagen
5. Tipos: foto, radiografia, panorama, intraoral

**Esfuerzo**: M
**Riesgo**: Medio

---

### 2.2 Wizard — Paso 6 Recetas opcional

**Problema**:
- Recetas siempre se crean aunque esten vacias
- Genera registros vacios en la DB

**Archivos a modificar**:
- `frontend/src/components/SesionClinica.jsx`

**Solucion**:
1. Si no hay contenido en recetas, no crear registro
2. Label "Recetas (opcional)" en el paso
3. Guardar solo si hay al menos un medicamento

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 2.3 Historial — eliminar modal wizard

**Problema**:
- Historial.jsx contiene un modal WizardConsulta (280 lineas)
- Duplica SesionClinica.jsx
- Mantenimiento dificil

**Archivos a modificar**:
- `frontend/src/components/Historial.jsx`
- `frontend/src/App.jsx`

**Solucion**:
1. Eliminar WizardConsulta de Historial
2. Cambiar boton "Nueva Consulta" para redirigir a SesionClinica
3. Pasar paciente_id como prop

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 2.4 Fix Galería URL

**Problema**:
- Galeria.jsx usa `localhost:3001` hardcoded
- No funciona en produccion

**Archivos a modificar**:
- `frontend/src/components/Galeria.jsx`

**Solucion**:
1. Usar variable de entorno o detectar URL base
2. `const API_URL = import.meta.env.VITE_API_URL || window.location.origin`

**Esfuerzo**: S
**Riesgo**: Bajo

---

## Sprint 3: Evidencias — Almacenamiento + Seguridad
**Duracion estimada**: 1-2 dias
**Objetivo**: Organizar evidencias y mejorar seguridad

### 3.1 Estructura de carpetas

**Problema**:
- Imagenes en `uploads/` sin organizacion
- Nombres aleatorios (Date.now()-random.ext)
- Sin backup

**Archivos a modificar**:
- `backend/src/controllers/imagenController.js`
- `backend/src/database.js`
- `backend/src/routes/imagenes.js`

**Solucion**:
1. Nueva estructura: `evidencias/{paciente_id}/{consulta_id}/`
2. Nombres legibles: `2026-06-08_14-30_foto-diente-16.jpg`
3. Campo `hash_sha256` en tabla `imagenes`
4. Campo `paciente_id` y `consulta_id` en tabla `imagenes`

**Esfuerzo**: M
**Riesgo**: Medio

---

### 3.2 Backup de evidencias

**Problema**:
- Backup actual solo incluye DB
- Si se pierde la carpeta uploads, se pierden las fotos

**Archivos a modificar**:
- `backend/src/controllers/exportacionController.js`

**Solucion**:
1. Incluir `evidencias/` en backup completo
2. Comprimir con la DB
3. Restaurar incluyendo evidencias

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 3.3 Seguridad uploads

**Problema**:
- Archivos servidos via `express.static`
- Sin autenticacion para ver imagenes
- Sin validacion de hash

**Archivos a modificar**:
- `backend/src/routes/imagenes.js`
- `backend/src/index.js`

**Solucion**:
1. Servir imagenes via endpoint con JWT
2. No usar `express-static` para uploads
3. Validar hash SHA256 al descargar
4. Rate limiting en uploads

**Esfuerzo**: M
**Riesgo**: Bajo

---

### 3.4 Migracion uploads existentes

**Problema**:
- Archivos actuales en `uploads/` sin estructura
- Referencias en DB con paths incorrectos

**Archivos a crear**:
- `backend/src/db/migrate-evidencias.js`

**Solucion**:
1. Script que mueve archivos a nueva estructura
2. Actualiza referencias en DB
3. Backup antes de migrar
4. Verificar integridad con hash

**Esfuerzo**: S
**Riesgo**: Medio

---

## Sprint 4: Evidencias desde Celular
**Duracion estimada**: 2-3 dias
**Objetivo**: Permitir subir fotos desde el celular

### 4.1 QR Code upload

**Problema**:
- No hay forma rapida de subir fotos desde celular
- Doctor tiene que transferir fotos manualmente

**Archivos a modificar**:
- `backend/src/controllers/imagenController.js` (nuevo endpoint)
- `frontend/src/components/Galeria.jsx` (mostrar QR)
- Nuevo: `frontend/src/components/UploadMovil.jsx` (pagina movil)

**Solucion**:
1. Endpoint `POST /api/imagenes/qr-upload` genera QR
2. QR contiene URL con token temporal (15 min, single-use)
3. Pagina movil optimizada para upload
4. Camera capture o seleccion de galeria
5. Auto-vincula a paciente

**Esfuerzo**: M
**Riesgo**: Bajo

---

### 4.2 WhatsApp auto-ingest

**Problema**:
- WhatsApp solo envia mensajes salientes
- No recibe fotos automaticamente

**Archivos a modificar**:
- `electron/openwa-runner.js`
- `backend/src/controllers/imagenController.js`

**Solucion**:
1. Escuchar eventos `message` entrantes
2. Detectar imagenes de numeros conocidos
3. Auto-descargar y guardar en `evidencias/`
4. Vincular a paciente por numero de telefono
5. Notificar al desktop

**Esfuerzo**: L
**Riesgo**: Medio

---

### 4.3 Web Upload celular

**Problema**:
- No hay interfaz movil para upload
- Solo funciona en desktop

**Archivos a crear**:
- `frontend/src/components/UploadMovil.jsx`

**Solucion**:
1. Pagina responsiva para celular
2. Login simplificado
3. Buscar paciente
4. Upload con camera o galeria
5. Funciona en WiFi local

**Esfuerzo**: M
**Riesgo**: Bajo

---

### 4.4 Notificaciones

**Problema**:
- No hay aviso cuando llega foto nueva
- Doctor no sabe si la foto llego

**Archivos a modificar**:
- `frontend/src/components/Galeria.jsx`
- `frontend/src/components/Paciente360.jsx`

**Solucion**:
1. Polling cada 30 segundos
2. Badge con contador de fotos nuevas
3. Sonido opcional

**Esfuerzo**: S
**Riesgo**: Bajo

---

## Sprint 5: Firma + Seguridad
**Duracion estimada**: 1-2 dias
**Objetivo**: Agregar firma del doctor y mejorar seguridad

### 5.1 Firma del doctor

**Problema**:
- No hay firma del doctor en PDFs
- Requerido para documentos legales

**Archivos a modificar**:
- `backend/src/database.js` (nueva columna)
- `backend/src/controllers/authController.js`
- `frontend/src/components/Configuracion.jsx`
- `frontend/src/services/api.js`
- PDF templates (usar firma)

**Solucion**:
1. Nueva columna `firma_imagen` en `usuarios`
2. Canvas dibujable en Configuracion
3. Upload de imagen de firma
4. Incluir firma en PDFs de historia clinica

**Esfuerzo**: M
**Riesgo**: Bajo

---

### 5.2 Rate limiting login

**Problema**:
- Sin limite de intentos de login
- Fuerza bruta posible

**Archivos a crear/modificar**:
- `backend/src/middleware/rateLimit.js`
- `backend/src/index.js`

**Solucion**:
1. Max 5 intentos por minuto
2. Bloquear 10 intentos fallidos (15 min)
3. Log de intentos fallidos

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 5.3 Roles activos

**Problema**:
- `requireRole()` definido pero nunca usado
- Cualquier usuario puede acceder a todo

**Archivos a modificar**:
- `backend/src/middleware/auth.js`
- `backend/src/routes/*.js`
- `frontend/src/components/Configuracion.jsx`

**Solucion**:
1. Aplicar `requireRole('admin')` en endpoints criticos
2. UI para admin gestionar usuarios
3. Endpoints de admin: devReset, eliminar usuario

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 5.4 CORS estricto

**Problema**:
- CORS permite cualquier origen
- `callback(null, true)` para cualquier request

**Archivos a modificar**:
- `backend/src/index.js`

**Solucion**:
1. Whitelist de origenes permitidos
2. Solo localhost + IP local
3. Headers de seguridad (helmet)

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 5.5 Tab Seguridad admin

**Problema**:
- No hay forma de ver intentos fallidos
- No hay control de sesiones activas

**Archivos a modificar**:
- `frontend/src/components/Configuracion.jsx`
- `backend/src/controllers/authController.js`

**Solucion**:
1. Nuevo tab "Seguridad" en Configuracion
2. Ver intentos fallidos recientes
3. Cerrar sesiones activas
4. Configurar JWT timeout

**Esfuerzo**: M
**Riesgo**: Bajo

---

### 5.6 Password policy

**Problema**:
- Password minimo 4 caracteres (debil)
- Sin requisitos de complejidad

**Archivos a modificar**:
- `backend/src/controllers/authController.js`
- `frontend/src/components/Login.jsx`

**Solucion**:
1. Minimo 6 caracteres
2. 1 mayuscula + 1 numero
3. Mensaje de error claro
4. Indicador de fortaleza

**Esfuerzo**: S
**Riesgo**: Bajo

---

## Sprint 6: Paciente 360 + Codigo Muerto
**Duracion estimada**: 1 dia
**Objetivo**: Completar vista 360 y eliminar codigo duplicado

### 6.1 Paciente360 Tab Evidencias

**Problema**:
- Paciente360 no tiene tab de evidencias
- Galeria existe pero no se usa ahi

**Archivos a modificar**:
- `frontend/src/components/Paciente360.jsx`
- `frontend/src/components/Galeria.jsx`

**Solucion**:
1. Nuevo tab "Evidencias" en Paciente360
2. Integrar Galeria.jsx
3. Filtrar por paciente actual

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 6.2 Eliminar codigo duplicado

**Problema**:
- `nombreCompleto()` duplicado en 5 archivos
- WizardConsulta duplica SesionClinica
- Defaults duplicados

**Archivos a modificar**:
- Multiples componentes

**Solucion**:
1. Extraer `nombreCompleto()` a shared utility
2. Eliminar WizardConsulta (ya hecho en 2.3)
3. Consolidar defaults de formularios
4. Crear `frontend/src/utils/formatters.js`

**Esfuerzo**: S
**Riesgo**: Bajo

---

## Orden de Implementacion

```
Sprint 1 (UI + Componentes) ← ACTUAL
    ↓
Sprint 2 (Wizard + Navegacion)
    ↓
Sprint 3 (Evidencias — Almacenamiento)
    ↓
Sprint 4 (Evidencias desde Celular)
    ↓
Sprint 5 (Firma + Seguridad)
    ↓
Sprint 6 (Paciente 360 + Codigo Muerto)
```

**Regla**: Commit + test despues de cada cambio.

**Estimacion total**: 1-2 semanas de desarrollo full-time.

---

## Metricas de Exito

Despues de cada sprint, medir:

### Sprint 1
- [ ] Login funciona con nombre de usuario
- [ ] Dashboard muestra tendencias
- [ ] 9+ componentes UI creados
- [ ] Sin errores en consola

### Sprint 2
- [ ] Wizard tiene 8 pasos (con evidencias)
- [ ] Recetas opcionales funcionan
- [ ] Historial no tiene modal duplicado
- [ ] Galeria funciona en produccion

### Sprint 3
- [ ] Evidencias en carpetas organizadas
- [ ] Backup incluye evidencias
- [ ] Imagenes requieren JWT
- [ ] Migracion exitosa

### Sprint 4
- [ ] QR genera upload movil
- [ ] WhatsApp recibe fotos
- [ ] Web upload funciona
- [ ] Notificaciones llegan

### Sprint 5
- [ ] Firma aparece en PDFs
- [ ] Rate limiting activo
- [ ] Roles funcionan
- [ ] CORS estricto

### Sprint 6
- [ ] Paciente360 tiene tab Evidencias
- [ ] Codigo duplicado eliminado
- [ ] Sin warnings en build

---

## Archivos a Modificar por Sprint

| Sprint | Archivos Principales |
|---|---|
| 1 | Login.jsx, Dashboard.jsx, components/ui/*, App.css |
| 2 | SesionClinica.jsx, Historial.jsx, Galeria.jsx, App.jsx |
| 3 | imagenController.js, database.js, routes/imagenes.js |
| 4 | openwa-runner.js, imagenController.js, Galeria.jsx, UploadMovil.jsx |
| 5 | authController.js, Configuracion.jsx, index.js, middleware/* |
| 6 | Paciente360.jsx, Galeria.jsx, formatters.js |

---

## Recursos

- **ROADMAP.md**: estado actual del proyecto
- **CHANGELOG.md**: que se ha hecho
- **ARQUITECTURA.md**: como esta organizado el codigo
- **GUIA_DESARROLLO.md**: como contribuir
- **SOLUCION_PROBLEMAS.md**: como resolver problemas comunes
