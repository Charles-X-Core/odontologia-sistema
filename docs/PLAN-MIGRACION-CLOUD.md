# Clinica Dental Pro - Migración a Cloud

## Resumen del Proyecto

Migrar la aplicación de escritorio (Electron + SQLite) a un sistema cloud con:
- **Base de datos**: Turso (SQLite en la nube)
- **API**: Vercel Serverless
- **Móvil**: APK con Capacitor
- **Desktop**: Electron con Embedded Replicas (offline + sync)
- **Email**: Gmail SMTP con App Password

---

## Arquitectura Final

```
┌──────────────────────────────────────────────────────────────┐
│                      TURSO (Cloud)                           │
│                    libsql://clinica-db                       │
└──────────────┬───────────────────┬───────────────────────────┘
               │                   │
               ▼                   ▼
┌──────────────────┐   ┌──────────────────────────────────────┐
│  VERCEL          │   │  ELECTRON (Desktop)                  │
│  ┌────────────┐  │   │  ┌────────────┐  ┌────────────────┐ │
│  │ API        │  │   │  │ React      │  │ Embedded       │ │
│  │ (serverless)│  │   │  │ Frontend   │  │ Replica        │ │
│  └────────────┘  │   │  └────────────┘  └────────────────┘ │
│  Acceso web      │   │  Online + Offline                   │
└──────────────────┘   └──────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│  ANDROID (APK - Capacitor)                                   │
│  ┌────────────┐                                              │
│  │ React      │                                              │
│  │ (embebido) │                                              │
│  └─────┬──────┘                                              │
│        │                                                     │
│        ▼                                                     │
│  Conecta a Vercel API                                        │
└──────────────────────────────────────────────────────────────┘
```

---

## FASE 1: Seguridad y Migración de Datos

### Objetivo
- Cambiar contraseña débil (admin/admin) por contraseña segura
- Migrar TODA la base de datos local a Turso

### Pasos

| # | Acción | Archivo | Detalle |
|---|--------|---------|---------|
| 1.1 | Cambiar contraseña admin | `scripts/change-password.js` | Genera hash bcrypt, actualiza en Turso |
| 1.2 | Migrar data a Turso | `scripts/migrate-full.js` | Lee `clinica.db` local, inserta en Turso |
| 1.3 | Verificar migración | - | Compara conteos: local vs Turso |

### Tablas a migrar (en orden)
1. `usuarios`
2. `pacientes`
3. `historias_clinicas`
4. `consultas`
5. `odontogramas`
6. `tratamientos`
7. `recetas`
8. `imagenes` (solo metadatos)
9. `pagos`
10. `necesidades_odontologicas`
11. `whatsapp_log`
12. `whatsapp_plantillas`
13. `whatsapp_cola`
14. `whatsapp_batch`
15. `whatsapp_config`
16. `citas`
17. `importaciones_historial`

### Criterio de éxito
- [ ] Contraseña admin cambiada
- [ ] Todas las tablas migradas
- [ ] Login funciona con nueva contraseña
- [ ] Pacientes, consultas, tratamientos visibles

---

## FASE 2: Backend API en Vercel

### Objetivo
- Deployar la API Express como serverless functions en Vercel
- API accesible desde internet para el APK

### Pasos

| # | Acción | Archivo | Detalle |
|---|--------|---------|---------|
| 2.1 | Configurar Vercel | `vercel.json` | Rewrites, builds, regions |
| 2.2 | Entry point | `api/index.js` | Exporta Express como serverless |
| 2.3 | Variables de entorno | Vercel Dashboard | `TURSO_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET` |
| 2.4 | Deploy | CLI | `vercel --prod` |
| 2.5 | Verificar API | Postman/curl | Login, pacientes, citas |

### Endpoints a verificar
- `POST /api/auth/login`
- `GET /api/pacientes`
- `GET /api/citas`
- `POST /api/citas`
- `GET /api/dashboard/stats`

### Criterio de éxito
- [ ] API deployada en Vercel
- [ ] Login funciona remotamente
- [ ] Pacientes se listan desde internet
- [ ] Citas se crean/editan

---

## FASE 3: Servicio de Email (Gmail SMTP)

### Objetivo
- Enviar emails transaccionales (recetas, recordatorios, etc.)
- Usar Gmail App Password (sin VPS, sin costo)

### Pasos

| # | Acción | Archivo | Detalle |
|---|--------|---------|---------|
| 3.1 | Instalar dependencia | `npm install nodemailer` | Cliente SMTP |
| 3.2 | Configurar SMTP | `services/emailService.js` | Gmail SMTP + App Password |
| 3.3 | Crear templates | `templates/email/` | Receta, recordatorio, confirmación |
| 3.4 | Endpoint envío | `routes/email.js` | `POST /api/email/enviar` |
| 3.5 | Integrar con módulos | Controllers | Al guardar receta → enviar email |

### Templates de email

| Template | Evento | Contenido |
|----------|--------|-----------|
| Receta médica | Al guardar receta | PDF adjunto con medicamentos |
| Recordatorio de cita | 24h antes | Fecha, hora, procedimiento |
| Confirmación de cita | Al crear/cancelar | Detalles de la cita |
| Estado de cuenta | Al solicitar | Saldo, pagos, tratamientos |

### Configuración Gmail
```
Servidor: smtp.gmail.com:587
Usuario: doctor@gmail.com
App Password: xxxx xxxx xxxx xxxx
```

### Criterio de éxito
- [ ] Email de receta se envía al guardar
- [ ] Recordatorios se envían automáticamente
- [ ] Templates se ven profesionales

---

## FASE 4: Capacitor + Android APK

### Objetivo
- Generar APK instalable en Android
- Distribuir directo (WhatsApp, email)

### Pasos

| # | Acción | Archivo | Detalle |
|---|--------|---------|---------|
| 4.1 | Instalar Capacitor | `package.json` | `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` |
| 4.2 | Inicializar | `capacitor.config.ts` | App name, package, URL backend |
| 4.3 | Agregar Android | `npx cap add android` | Genera proyecto Android |
| 4.4 | Configurar iconos | `android/app/src/main/res/` | Iconos por tamaño |
| 4.5 | Build React | `npm run build` | Genera `dist/` |
| 4.6 | Sync | `npx cap sync android` | Copia web a Android |
| 4.7 | Build APK | Android Studio | Build → Build APK |
| 4.8 | Probar | Celular | Instalar y probar |

### Configuración capacitor.config.ts
```typescript
const config: CapacitorConfig = {
  appId: 'com.clinica.dental',
  appName: 'Clinica Dental Pro',
  webDir: 'dist',
  server: {
    url: 'https://clinica-dental.vercel.app', // API URL
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};
```

### Criterio de éxito
- [ ] APK se genera sin errores
- [ ] Se instala en celular
- [ ] Login funciona
- [ ] Pacientes se listan
- [ ] Citas se crean/editan

---

## FASE 5: Desktop Electron con Turso

### Objetivo
- Desktop funcione online Y offline
- Sincronización automática con Turso

### Pasos

| # | Acción | Archivo | Detalle |
|---|--------|---------|---------|
| 5.1 | Configurar Embedded Replicas | `db.js` | `syncUrl`, `syncInterval` |
| 5.2 | Modo offline | `db.js` | Usa `clinica-local.db` cuando no hay internet |
| 5.3 | Sync automático | `db.js` | Cada 60 segundos |
| 5.4 | Resolver conflictos | `db.js` | Último en escribir gana |
| 5.5 | Verificar | Desktop | Funciona online y offline |

### Configuración Embedded Replicas
```javascript
if (isElectron && TURSO_URL) {
  client = createClient({
    url: 'file:clinica-local.db',
    syncUrl: TURSO_URL,
    syncInterval: 60,
    authToken: TURSO_AUTH_TOKEN,
  });
}
```

### Criterio de éxito
- [ ] Desktop usa Turso
- [ ] Offline funciona (usa .db local)
- [ ] Sync funciona (cambios se suben)
- [ ] Sin errores de conexión

---

## Checklist General

### Pre-deploy
- [ ] Contraseña admin cambiada
- [ ] Data migrada a Turso
- [ ] Login funciona con nueva contraseña

### Deploy
- [ ] Backend en Vercel
- [ ] Frontend en Vercel (opcional)
- [ ] API accesible desde internet

### APK
- [ ] Capacitor configurado
- [ ] APK generado
- [ ] Instalado en celular
- [ ] Funciona correctamente

### Desktop
- [ ] Embedded Replicas configurado
- [ ] Offline funciona
- [ ] Sync funciona

---

## Costos

| Servicio | Plan | Costo |
|----------|------|-------|
| Turso | Free | $0 (5GB) |
| Vercel | Free | $0 (100k requests) |
| Gmail SMTP | Free | $0 |
| Capacitor | Free | $0 |
| Android Studio | Free | $0 |
| **Total** | | **$0** |

---

## Tecnologías

| Capa | Tecnología | Versión |
|------|------------|---------|
| Base de datos | Turso (libSQL) | Latest |
| Backend | Express.js | 4.x |
| Frontend | React + Vite | Latest |
| Desktop | Electron | Latest |
| Móvil | Capacitor | 6.x |
| Email | Nodemailer | Latest |
| Auth | JWT + bcrypt | Latest |

---

## Notas

- **WhatsApp**: Sigue funcionando en desktop (no se mueve a cloud)
- **Imágenes**: Se guardan localmente, solo metadatos en Turso
- **PDFs**: Se generan localmente en desktop
- **Firma digital**: Se mantiene en desktop

---

*Última actualización: 2026-07-22*
