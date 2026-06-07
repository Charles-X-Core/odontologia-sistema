# Guia de Desarrollo

Como configurar el entorno, hacer cambios y construir Vita Mirabilis.

---

## Requisitos

- **Node.js 20.x** o superior
- **npm 10.x** o superior
- **Git 2.30+**
- **Windows 10/11** (la app solo se ejecuta en Windows)
- **Google Chrome** (para WhatsApp)
- **Visual Studio Code** (recomendado) + extensiones:
  - ESLint
  - Prettier
  - SQLite Viewer

---

## Setup Inicial

### 1. Clonar el repositorio

```bash
git clone https://github.com/Charles-X-Core/odontologia-sistema.git
cd odontologia-sistema
```

### 2. Instalar dependencias

```bash
# Dependencias del root (electron, electron-builder, patch-package)
npm install

# Dependencias del backend
cd backend
npm install
cd ..

# Dependencias del frontend
cd frontend
npm install
cd ..
```

### 3. Verificar patch

Despues de `npm install`, verificar que el patch se aplico:

```bash
ls patches/
# whatsapp-web.js+1.34.7.patch
```

Si por algun motivo el patch no se aplico:

```bash
npx patch-package
```

---

## Estructura de Ramas

- `master` — codigo de produccion, no se hace commit directo
- `backup/*` — branches de respaldo de hitos importantes
- `mejoras/*` — trabajo en nuevas features
- `fix/*` — correcciones de bugs
- `docs/*` — solo documentacion

**Workflow**:

1. Crear branch desde `master`:
   ```bash
   git checkout master
   git pull origin master
   git checkout -b fix/mi-bug
   ```

2. Hacer commits pequenos y descriptivos:
   ```bash
   git add .
   git commit -m "fix(whatsapp): unificar findChrome con openwaSetup"
   ```

3. Push y crear Pull Request:
   ```bash
   git push -u origin fix/mi-bug
   ```

---

## Comandos Utiles

### Desarrollo

```bash
# Iniciar backend (puerto 18234)
cd backend && npm run dev

# Iniciar frontend con HMR (puerto 5173)
cd frontend && npm run dev

# Iniciar Electron (conecta a backend y frontend en dev)
npm start
```

### Build

```bash
# Build completo (frontend + electron)
npm run build

# Solo frontend
cd frontend && npm run build

# Solo empaquetar (sin instalador)
npm run pack
```

### Distribucion Portable

```bash
# 1. Build completo
npm run build

# 2. Empaquetar
npm run pack

# 3. Comprimir en 7z (recomendado)
cd dist-electron
"C:\Program Files\7-Zip\7z.exe" a "Vita Mirabilis v1.0.0.7z" "win-unpacked\*"

# 4. SFX autoextraible (requiere WinRAR)
"C:\Program Files\WinRAR\Rar.exe" a -sfx -r -m5 "Vita Mirabilis v1.0.0.exe" "win-unpacked\"
```

### Linting

```bash
# ESLint en backend
cd backend && npm run lint

# ESLint en frontend
cd frontend && npm run lint

# Lint en todo
npm run lint
```

---

## Donde Hacer Cambios Comunes

### Agregar un campo nuevo a Paciente

1. **DB**: agregar columna en `backend/src/db/schema.sql` y migracion
2. **Backend controller**: actualizar `backend/src/controllers/pacienteController.js`
3. **Frontend componente**: actualizar `frontend/src/components/Pacientes.jsx`
4. **PDF template**: actualizar `backend/src/services/pdfTemplates/historiaTemplate.js`
5. **Test**: agregar paciente con el nuevo campo y verificar

### Agregar un endpoint nuevo

1. Crear/actualizar controller en `backend/src/controllers/`
2. Agregar ruta en `backend/src/routes/`
3. Registrar ruta en `backend/src/index.js`:
   ```javascript
   app.use('/api/mi-recurso', require('./routes/mi-recurso'));
   ```
4. Documentar en Swagger (si existe) o en este README
5. Consumir en `frontend/src/services/api.js`

### Cambiar el flujo de Sesion Clinica

1. Editar `frontend/src/components/SesionClinica.jsx`
2. El wizard tiene 7 pasos: paciente, motivo, examen, odontograma, diagnostico, tratamiento, receta
3. Cada paso es un componente hijo o una seccion condicional
4. Actualizar validaciones y orden de guardado en backend

### Modificar el Odontograma

1. **Estados**: definidos en `frontend/src/components/Odontograma.jsx` (ESTADOS_SIMBOLOS):
   ```javascript
   sano='', caries='■ CA', obturado='◆ OB', endodoncia='● EN',
   corona='▲ CR', extraccion='✕ EX', ausente='○ AU', provisional='△ PR',
   implante='T IM', puente='═ PU'
   ```
2. **Orden de dientes**: 18-11 | 21-28 (superior) / 48-41 | 31-38 (inferior)
3. **SVG**: en `frontend/public/odontograma-svg/`
4. **Backend**: `backend/src/controllers/odontogramaController.js`

### Cambiar el PDF de Historia Clinica

1. **HTML template**: `backend/src/services/pdfTemplates/historia-clinica-template.html`
2. **PDF directo (pdfkit)**: `backend/src/services/pdfTemplates/historiaTemplate.js`
3. **PDF via Puppeteer (HTML→PDF)**: `backend/src/services/pdfTemplates/historiaHtmlPdf.js`
4. **Controller**: `backend/src/controllers/pdfController.js`

---

## Debugging

### Ver logs de Electron main

```bash
# Windows PowerShell
$env:DEBUG = "electron*"
npm start
```

O agregar en `electron/main.js`:
```javascript
console.log('[main]', msg);
// Visible en terminal donde se ejecuto npm start
```

### Ver logs del Backend

```bash
cd backend
DEBUG=* npm run dev
```

### Ver logs del WhatsApp Runner

**En desarrollo**: aparecen en la terminal donde se ejecuto `npm start`

**En produccion**: archivo en `%APPDATA%\Vita Mirabilis\runner.log`

```powershell
# Ver en tiempo real
Get-Content "$env:APPDATA\Vita Mirabilis\runner.log" -Wait
```

### DevTools en la app empaquetada

En `electron/main.js`, agregar antes de `mainWindow.loadURL(...)`:

```javascript
if (process.env.NODE_ENV === 'development' || process.argv.includes('--devtools')) {
  mainWindow.webContents.openDevTools();
}
```

Luego ejecutar:
```bash
"Vita Mirabilis.exe" --devtools
```

### Inspecionar SQLite

Descargar [DB Browser for SQLite](https://sqlitebrowser.org/) o usar extension de VSCode.

**Dev**: `backend/data/clinica.db`
**Prod**: `resources/data/clinica.db` (dentro de la app instalada)

---

## Testing

**Estado actual**: No hay tests automatizados. Pendiente Fase 4.

**Para testear manualmente**:
1. Crear paciente de prueba
2. Crear historia clinica
3. Agregar consulta
4. Generar PDF
5. Enviar por WhatsApp
6. Verificar que llego

**Test de regresion rapido**:
- Login con admin/admin
- Crear paciente
- Ver odontograma (debe cargar las 52 piezas)
- Generar PDF (debe abrir Chrome via puppeteer)
- Conectar WhatsApp (debe mostrar QR)

---

## Convenciones de Codigo

### Estilo

- **Indentacion**: 2 espacios
- **Comillas**: dobles para JS/JSX, simples para SQL
- **Punto y coma**: SI (obligatorio)
- **Lineas**: maximo 120 caracteres (warning), 200 (error)
- **ESLint**: configuracion Airbnb con ajustes

### Naming

- **Variables/Funciones**: `camelCase`
- **Componentes React**: `PascalCase`
- **Constantes globales**: `UPPER_SNAKE_CASE`
- **Archivos JS**: `camelCase.js`
- **Archivos JSX**: `PascalCase.jsx` (componentes), `camelCase.jsx` (utilidades)
- **CSS**: `kebab-case.css`
- **Tablas DB**: `snake_case`

### Estructura de un componente React

```jsx
import React, { useState, useEffect } from 'react';
import { pacienteService } from '../services/api';
import './Pacientes.css';

function Pacientes({ onNavigate, onSelectPaciente }) {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    cargarPacientes();
  }, []);

  const cargarPacientes = async () => {
    try {
      setLoading(true);
      const data = await pacienteService.listar();
      setPacientes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="pacientes-container">
      <h1>Pacientes</h1>
      <input
        type="text"
        placeholder="Buscar..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
      />
      <ul>
        {pacientes
          .filter(p => p.nombre.toLowerCase().includes(filtro.toLowerCase()))
          .map(p => (
            <li key={p.id} onClick={() => onSelectPaciente(p)}>
              {p.nombre} - {p.telefono}
            </li>
          ))}
      </ul>
    </div>
  );
}

export default Pacientes;
```

### Estructura de un controller

```javascript
const db = require('../db');
const { hashPassword, comparePassword } = require('../utils/auth');

const authController = {
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email y password requeridos' });
      }

      const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
      if (!user) {
        return res.status(401).json({ error: 'Credenciales invalidas' });
      }

      const valid = await comparePassword(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Credenciales invalidas' });
      }

      const token = generateToken({ id: user.id, email: user.email, rol: user.rol });
      res.json({ token, user: { id: user.id, nombre: user.nombre, rol: user.rol } });
    } catch (err) {
      console.error('[auth] login error:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  }
};

module.exports = authController;
```

---

## Troubleshooting Comun

### "Cannot find module 'X'"

```bash
# Reinstalar todo
rm -rf node_modules backend/node_modules frontend/node_modules
npm install
cd backend && npm install
cd ../frontend && npm install
```

### "Port 18234 already in use"

```powershell
# Ver que lo usa
netstat -ano | findstr :18234

# Matarlo (reemplazar PID)
taskkill /F /PID <PID>
```

### "Puppeteer Chrome not found"

Verificar que Chrome esta instalado:

```powershell
# Verificar version
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --version

# Si no esta, instalarlo
winget install Google.Chrome
```

### "Patch no se aplica"

```bash
# Forzar reaplicacion
npx patch-package

# Si falla, restaurar node_modules y reinstalar
rm -rf node_modules
npm install
```

### "asar no contiene mi cambio"

El build de Electron cachea el asar. Forzar rebuild:

```bash
rm -rf dist-electron
npm run build
npm run pack
```

### "WhatsApp QR no aparece"

1. Verificar que el runner esta corriendo: `http://localhost:3002/` debe responder
2. Ver log: `Get-Content "$env:APPDATA\Vita Mirabilis\runner.log"`
3. Si dice "Chrome not found", instalar Chrome
4. Si dice "auth_failure", borrar `%APPDATA%\Vita Mirabilis\wwebjs_auth` y reintentar

---

## Recursos

- **Repositorio**: https://github.com/Charles-X-Core/odontologia-sistema
- **ARQUITECTURA.md**: estructura del proyecto
- **SOLUCION_PROBLEMAS.md**: guia detallada de problemas
- **ROADMAP.md**: estado del proyecto y pendientes
- **CHANGELOG.md**: historial de versiones
