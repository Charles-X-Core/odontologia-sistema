# Guia de Instalacion

## Requisitos

- Node.js 22+ (requerido para node:sqlite)
- npm
- Windows 10/11 (para build de Electron)

---

## Instalacion Local

### 1. Clonar repositorio
```bash
git clone https://github.com/Charles-X-Core/odontologia-sistema.git
cd odontologia-sistema
```

### 2. Instalar dependencias
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Electron (en la raiz)
cd ..
npm install
```

### 3. Sembrar datos de prueba
```bash
cd backend
npm run seed
```

### 4. Iniciar en modo desarrollo

**Backend (terminal 1):**
```bash
cd backend
npm start
# Servidor en http://localhost:3001
```

**Frontend (terminal 2):**
```bash
cd frontend
npm run dev
# App en http://localhost:5173
```

### 5. Credenciales
| Usuario | Contrasena | Rol |
|---------|-----------|-----|
| admin | admin | Administrador |
| doctor | doctor | Odontologo |

---

## Modo Electron (Escritorio)

### Ejecutar en desarrollo
```bash
npm start
```

### Generar instalador .exe
```bash
npm run build
```

El instalador se genera en `dist-electron/Clinica Dental Pro Setup 1.0.0.exe`

### Archivos generados
```
dist-electron/
├── Clinica Dental Pro Setup 1.0.0.exe  ← Instalador NSIS
├── win-unpacked/                    ← Version portable
└── builder-effective-config.yaml
```

---

## Deploy Web

### Backend en Render.com
1. Crear cuenta en render.com
2. New Web Service → Conectar GitHub
3. Configurar:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `node src/seed.js && node src/index.js`
4. Environment Variables:
   - `NODE_ENV=production`
   - `JWT_SECRET=tu-clave-secreta`
   - `FRONTEND_URL=https://tu-app.vercel.app`

### Frontend en Vercel
1. Crear cuenta en vercel.com
2. Import GitHub repo
3. Configurar:
   - Framework: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Environment Variables:
   - `VITE_API_URL=https://tu-backend.onrender.com/api`

---

## Solucion de Problemas

### Puerto en uso
```bash
# Matar procesos node
Get-Process -Name "node" | Stop-Process -Force
```

### DB corrupta
```bash
# Eliminar y recrear
cd backend
Remove-Item clinica.db*
npm run seed
```

### Electron no inicia
```bash
# Reinstalar electron
cd ..
Remove-Item -Recurse node_modules
npm install
```

### Pantalla blanca en Electron
Verificar que `vite.config.js` tenga `base: './'`
