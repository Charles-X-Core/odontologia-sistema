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

## Fase 1 — Bugs Criticos 🔴
**Duracion estimada**: 1-2 dias
**Objetivo**: Eliminar bugs que pueden bloquear funcionalidad

### 1.1 PDF WhatsApp: unificar findChrome con openwaSetup

**Problema**:
- `backend/src/services/pdfTemplates/htmlToPdf.js:27` usa `findChrome()` que busca solo 3 rutas
- `electron/openwaSetup.js` usa busqueda en 6 rutas + winget fallback
- Cuando Chrome esta en ruta 4, 5 o 6, el PDF falla pero WhatsApp funciona

**Impacto**: Cuando se envia PDF por WhatsApp, falla con "Chrome not found for puppeteer".

**Solucion**:
1. Crear `backend/src/utils/chromeFinder.js` con las 6 rutas + winget
2. Exportar la misma logica que `electron/openwaSetup.js`
3. Refactorizar ambos para usar el modulo compartido
4. Mover logica a `shared/chromeFinder.js` si se puede compartir entre procesos

**Esfuerzo**: S
**Riesgo**: Bajo (es solo mover codigo)

---

### 1.2 Eliminar puppeteer-core duplicado

**Problema**:
- `puppeteer-core` esta en `node_modules/` (raiz)
- Y tambien en `backend/node_modules/`
- Esto causa confusion y aumenta el tamano del paquete

**Impacto**: Tamano del paquete +10 MB, posibles bugs por versiones diferentes

**Solucion**:
1. Decidir donde debe vivir puppeteer-core
2. Si es solo para backend → mover a `backend/package.json`
3. Eliminar del root
4. Rebuild y verificar

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 1.3 Unificar sistemas PDF (pdfkit vs puppeteer-core)

**Problema**:
- Algunos PDFs se generan con `pdfkit` (nativo, rapido)
- Otros con `puppeteer-core` (HTML→PDF, mas flexible)
- Codigo duplicado para logica comun (header, footer, logo, numeracion)

**Impacto**: Mantenimiento dificil, PDFs con estilo inconsistente

**Solucion**:
1. Identificar que PDFs usan cada sistema
2. Definir cuando usar uno u otro
3. Extraer logica comun a un helper (`backend/src/utils/pdfHelper.js`)
4. Documentar la decision en `ARQUITECTURA.md`

**Esfuerzo**: M
**Riesgo**: Medio (cambia logica critica)

---

### 1.4 Validar process.env (no asumir LOCALAPPDATA existe)

**Problema**:
- Codigo asume `process.env.LOCALAPPDATA` existe
- En algunos casos extremos (variables de entorno borradas), falla con `undefined`

**Impacto**: Crash raro en PCs mal configuradas

**Solucion**:
1. Crear helper `backend/src/utils/paths.js` con fallbacks:
   ```javascript
   function getLocalAppData() {
     return process.env.LOCALAPPDATA
       || path.join(process.env.USERPROFILE, 'AppData', 'Local')
       || process.env.TEMP;
   }
   ```
2. Reemplazar todos los usos directos de `process.env.LOCALAPPDATA`
3. Idem para `APPDATA`, `USERPROFILE`, `TEMP`

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 1.5 EADDRINUSE 18234 cleanup en restart

**Problema**:
- Si la app se cierra abruptamente, el backend node.exe puede quedar zombie
- Al reabrir, error "EADDRINUSE 18234"
- Usuario tiene que matar el proceso manualmente

**Impacto**: Mala experiencia en reinicios

**Solucion**:
1. En `electron/main.js` antes de `spawnBackend()`:
   ```javascript
   function killPort18234() {
     try {
       const { execSync } = require('child_process');
       execSync('netstat -ano | findstr :18234 | findstr LISTENING', { stdio: 'pipe' });
       // Si hay algo, matarlo
     } catch (e) {}
   }
   ```
2. O mejor: usar `proper-lockfile` o similar para evitar doble instancia
3. Mostrar mensaje al usuario: "Cerrando instancia previa..."

**Esfuerzo**: S
**Riesgo**: Bajo

---

## Fase 2 — Limpieza Ligera 🟡
**Duracion estimada**: 1-2 dias
**Objetivo**: Reducir deuda tecnica sin romper nada

### 2.1 Eliminar archivos no usados

**Candidatos a revisar** (verificar primero con grep):
- `backend/src/debug_docker.js` — usado en algun flow?
- `electron/dockerSetup.js` — idem
- `electron/diagnostico.js` — idem
- Scripts de test viejos en `/scripts/`

**Esfuerzo**: S
**Riesgo**: Bajo (verificar antes de borrar)

---

### 2.2 Extraer constantes a `config/`

**Problema**: Magic numbers esparcidos por el codigo:
- Puerto 18234 (backend)
- Puerto 3002 (runner)
- Puerto 5173 (dev frontend)
- Paths de auth, DB, logs

**Solucion**:
1. Crear `backend/src/config/constants.js`:
   ```javascript
   module.exports = {
     PORTS: { BACKEND: 18234, RUNNER: 3002, DEV_FRONTEND: 5173 },
     PATHS: { DB: '...', LOGS: '...', AUTH: '...' },
     LIMITS: { MAX_PACIENTES_PAGINA: 50, MAX_UPLOAD_MB: 10 }
   };
   ```
2. Reemplazar magic numbers en el codigo
3. Mismo para `electron/config.js`

**Esfuerzo**: M
**Riesgo**: Bajo

---

### 2.3 Refactorizar duplicacion SesionClinica/Historial

**Problema**:
- `SesionClinica.jsx` (53KB) y `Historial.jsx` (42KB) tienen codigo similar
- Logica de cargar paciente, validar campos, guardar consulta

**Solucion**:
1. Extraer hooks:
   - `usePaciente(id)` — carga paciente activo
   - `useConsulta(id)` — carga consulta
   - `useGuardarConsulta()` — POST con manejo de errores
2. Reemplazar en ambos componentes
3. Reducir ~30% de codigo

**Esfuerzo**: M
**Riesgo**: Medio (refactor sensible)

---

### 2.4 Reducir App.css (5,493 lineas en 1 archivo)

**Problema**:
- Un solo archivo CSS de 5,493 lineas
- Dificil de mantener
- No hay CSS modules ni styled-components

**Solucion**:
1. Dividir por dominio:
   - `components/Pacientes.css`
   - `components/SesionClinica.css`
   - `components/Odontograma.css`
   - `components/Dashboard.css`
   - `components/Auth.css`
   - `styles/variables.css` (colores, fuentes)
   - `styles/reset.css`
2. Importar desde `App.jsx` o desde cada componente
3. Verificar que no se rompen estilos (comparar visualmente)

**Esfuerzo**: M
**Riesgo**: Medio (cambios visuales posibles)

---

## Fase 3 — UI/UX 🟢
**Duracion estimada**: 3-5 dias
**Objetivo**: Mejorar la experiencia del usuario

### 3.1 Sistema de toasts (reemplazar alert())

**Problema**:
- `alert()` es feo y bloquea la UI
- No se puede personalizar
- No se apilan

**Solucion**:
1. Instalar `react-hot-toast` (~10 KB)
2. Reemplazar `alert()` con `toast.success()`, `toast.error()`, etc.
3. Reemplazar `window.confirm()` con modal estilizado

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 3.2 Skeleton loaders

**Problema**:
- Cuando carga una lista, se ve "Cargando..." estatico
- El usuario no sabe cuanto falta

**Solucion**:
1. Crear componente `<Skeleton />` (CSS animation)
2. Usar en Pacientes, Historial, Dashboard
3. Mostrar ~5-10 filas de skeleton mientras carga

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 3.3 Empty states

**Problema**:
- "No hay pacientes" se ve triste
- No guia al usuario sobre que hacer

**Solucion**:
1. Diseno de empty state con ilustracion + texto + boton de accion
2. Ejemplo: "No tienes pacientes. Click aqui para crear el primero."
3. Aplicar a todas las listas

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 3.4 Busqueda en tiempo real

**Problema**:
- Busqueda actual requiere escribir y luego click en "Buscar"
- O presiona Enter

**Solucion**:
1. Usar `useDebounce()` (300ms) en el input de busqueda
2. Mientras el usuario escribe, filtrar en backend
3. Mostrar resultados instantaneamente

**Esfuerzo**: S
**Riesgo**: Bajo

---

### 3.5 Modales de confirmacion estilizados

**Problema**:
- `confirm()` y `alert()` son del navegador
- Se ven inconsistentes

**Solucion**:
1. Crear componente `<Modal />` con overlay
2. Variantes: confirm, alert, form
3. Reemplazar todos los `window.confirm/alert`

**Esfuerzo**: M
**Riesgo**: Bajo

---

### 3.6 Dashboard con graficas

**Problema**:
- Dashboard actual tiene solo numeros
- No hay visualizacion de tendencias

**Solucion**:
1. Instalar `recharts` (~100 KB, vale la pena)
2. Agregar graficas:
   - Pacientes nuevos por mes (linea)
   - Ingresos por mes (barras)
   - Tratamientos mas comunes (pie)
3. Periodo selector (mes/ano/todo)

**Esfuerzo**: M
**Riesgo**: Bajo

---

### 3.7 Tema oscuro

**Problema**:
- Solo hay tema claro
- Algunos usuarios prefieren oscuro

**Solucion**:
1. Definir variables CSS en `:root` y `:root[data-theme="dark"]`
2. Boton de toggle en la configuracion
3. Persistir en localStorage
4. Auditar todos los colores hardcodeados

**Esfuerzo**: L
**Riesgo**: Medio

---

## Fase 4 — Features Nuevas 🟢
**Duracion estimada**: 1-2 semanas
**Objetivo**: Agregar funcionalidad valiosa

### 4.1 Calendario de citas

**Problema**:
- No hay gestion de citas
- El paciente llega sin hora asignada

**Solucion**:
1. Tabla nueva: `citas` (paciente_id, fecha, hora, duracion, motivo, estado)
2. Vista de calendario (mensual/semanal/diaria)
3. Crear/editar/cancelar citas
4. Notificacion en app cuando se acerca la cita
5. Integracion con WhatsApp para recordatorio (1 dia antes)

**Esfuerzo**: L
**Riesgo**: Alto (feature grande)

---

### 4.2 Busqueda global Ctrl+K

**Problema**:
- Para buscar un paciente hay que ir a la seccion Pacientes
- Para buscar un tratamiento hay que ir a Tratamientos

**Solucion**:
1. Atajo Ctrl+K abre un modal de busqueda
2. Busca en: pacientes, historias clinicas, tratamientos, recetas
3. Resultados agrupados con preview
4. Enter abre el detalle

**Esfuerzo**: M
**Riesgo**: Bajo

---

### 4.3 Audit log

**Problema**:
- No se sabe quien modifico que y cuando
- Importante para cumplir con regulaciones (HIPAA, etc.)

**Solucion**:
1. Tabla `audit_log` (timestamp, usuario_id, accion, tabla, registro_id, datos_antes, datos_despues)
2. Trigger en SQLite o middleware en Express
3. Vista en el admin panel
4. Filtros por usuario, fecha, tipo de cambio

**Esfuerzo**: M
**Riesgo**: Bajo

---

### 4.4 Reportes

**Problema**:
- No hay forma de ver "cuanto facture este mes"
- No hay "tratamientos mas comunes"

**Solucion**:
1. Reporte de ingresos (por mes, por tratamiento, por paciente)
2. Reporte de tratamientos (frecuencia, valor promedio)
3. Reporte de pacientes (nuevos vs recurrentes, antiguedad promedio)
4. Exportar a Excel/CSV

**Esfuerzo**: L
**Riesgo**: Bajo

---

### 4.5 Multi-usuario real con roles granulares

**Problema**:
- Roles actuales: admin, doctor
- No hay granularidad (que puede hacer cada uno?)

**Solucion**:
1. Tabla `roles` y `permisos`
2. Asignar permisos por usuario
3. Middleware que valide permisos por endpoint
4. UI para admin asignar roles

**Esfuerzo**: XL
**Riesgo**: Alto

---

## Mejoras de Transparencia (Fase 0) ✅

Estas mejoras se aplican ANTES de las fases de bugs, para dar mas claridad al usuario.

### C.1 — Seccion de seguridad en README.txt ✅
**Que**: Agregar al `portable/README.txt` una seccion "Que hace y que NO hace esta app" para que el usuario entienda que la app no toca drivers.

**Esfuerzo**: XS
**Status**: Pendiente

---

### C.2 — Logging mejorado en openwa-runner.js ✅
**Que**: Agregar timestamps mas visibles, niveles de log (INFO, WARN, ERROR), y un comando para "abrir log" desde la app.

**Esfuerzo**: S
**Status**: Pendiente

---

### C.3 — Modo --no-install en Iniciar.bat ✅
**Que**: Permitir que el usuario ejecute la app sin reinstalar dependencias (usar las que ya estan).

```batch
Iniciar Vita Mirabilis.bat --no-install
```

**Esfuerzo**: XS
**Status**: Pendiente

---

## Orden de Implementacion Recomendado

```
Fase 0 (Transparencia) ← ESTAMOS AQUI
    ↓
Fase 1 (Bugs Criticos) ← SIGUIENTE
    ↓
Fase 2 (Limpieza)
    ↓
Fase 3 (UI/UX)
    ↓
Fase 4 (Features Nuevas)
```

**Regla**: No empezar una fase hasta que la anterior este estable.

**Estimacion total**: 3-4 semanas de desarrollo full-time.

---

## Metricas de Exito

Despues de cada fase, medir:

### Fase 1
- [ ] Cero bugs criticos conocidos
- [ ] App inicia en <5 segundos
- [ ] PDF se genera en <3 segundos
- [ ] WhatsApp conecta en <10 segundos

### Fase 2
- [ ] `App.css` dividido en 5-7 archivos
- [ ] Magic numbers eliminados
- [ ] Codigo duplicado reducido 30%

### Fase 3
- [ ] Cero `alert()` o `confirm()` nativos
- [ ] Todas las listas tienen skeleton + empty state
- [ ] Busqueda en tiempo real

### Fase 4
- [ ] Calendario funcional
- [ ] Ctrl+K funciona
- [ ] Audit log captura todos los cambios
- [ ] 3+ reportes utiles

---

## Recursos

- **ROADMAP.md**: estado actual del proyecto
- **CHANGELOG.md**: que se ha hecho
- **ARQUITECTURA.md**: como esta organizado el codigo
- **GUIA_DESARROLLO.md**: como contribuir
- **SOLUCION_PROBLEMAS.md**: como resolver problemas comunes
