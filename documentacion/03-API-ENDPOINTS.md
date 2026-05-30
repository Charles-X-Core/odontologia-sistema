# API Endpoints

**Base URL:** `http://localhost:3001/api` (desarrollo) o `http://localhost:18234/api` (Electron)

**Autenticacion:** Bearer token JWT en header `Authorization`

---

## Auth

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | /auth/login | No | Iniciar sesion |
| POST | /auth/register | No | Registrar usuario |
| GET | /auth/me | Si | Obtener usuario actual |
| GET | /auth | Si | Listar usuarios |
| DELETE | /auth/:id | Si | Eliminar usuario |

### POST /auth/login
```json
// Request
{ "email": "admin", "password": "admin" }

// Response 200
{
  "token": "eyJhbGciOi...",
  "usuario": {
    "id": 1,
    "nombre": "Admin",
    "email": "admin",
    "rol": "admin"
  }
}
```

---

## Pacientes

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | /pacientes | Si | Listar pacientes |
| POST | /pacientes | Si | Crear paciente |
| GET | /pacientes/:id | Si | Obtener paciente |
| GET | /pacientes/:id/historial | Si | Historial completo |
| PUT | /pacientes/:id | Si | Actualizar paciente |
| DELETE | /pacientes/:id | Si | Eliminar paciente |

### GET /pacientes/:id/historial
```json
// Response 200
{
  "paciente": { "id": 1, "nombre": "Maria Garcia", ... },
  "historia": { "id": 1, "antecedentes": "...", ... },
  "consultas": [
    {
      "id": 1,
      "motivo": "Dolor molar",
      "diagnostico": "Caries profunda",
      "tratamiento": "Endodoncia",
      "odontograma": { "dientes": { "16": { "estado": "endodoncia" } } }
    }
  ]
}
```

---

## Historias Clinicas

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | /historias | Si | Crear historia |
| GET | /historias/paciente/:id | Si | Obtener historia por paciente |
| PUT | /historias/:id | Si | Actualizar historia |

---

## Consultas

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | /consultas | Si | Crear consulta |
| GET | /consultas/historia/:id | Si | Consultas de una historia |
| GET | /consultas/:id | Si | Obtener consulta |

### POST /consultas
```json
// Request
{
  "historia_id": 1,
  "motivo": "Dolor molar derecho",
  "diagnostico": "Caries profunda molar 16",
  "tratamiento": "Endodoncia y corona",
  "notas": "Programar segunda sesion"
}
```

---

## Odontogramas

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | /odontogramas | Si | Guardar odontograma |
| GET | /odontogramas/consulta/:id | Si | Odontograma de una consulta |
| GET | /odontogramas/historia/:id | Si | Odontogramas de una historia |

### Estructura del odontograma
```json
{
  "datos_json": {
    "version": 1,
    "dientes": {
      "16": {
        "estado": "endodoncia",
        "color": "azul",
        "siglas": "TC",
        "material": null,
        "tipo_corona": null,
        "superficies": []
      }
    }
  }
}
```

---

## Tratamientos

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | /tratamientos | Si | Crear tratamiento |
| GET | /tratamientos/paciente/:id | Si | Tratamientos de un paciente |
| PUT | /tratamientos/:id | Si | Actualizar tratamiento |
| DELETE | /tratamientos/:id | Si | Eliminar tratamiento |

### Estados del tratamiento
- `pendiente` - Amarillo
- `en_proceso` - Azul
- `completado` - Verde

---

## Recetas

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | /recetas | Si | Crear receta |
| GET | /recetas/consulta/:id | Si | Recetas de una consulta |
| GET | /recetas/paciente/:id | Si | Recetas de un paciente |
| GET | /recetas/:id | Si | Obtener receta completa |
| DELETE | /recetas/:id | Si | Eliminar receta |

### Estructura de receta
```json
{
  "consulta_id": 1,
  "paciente_id": 1,
  "medicamentos": [
    {
      "nombre": "Ibuprofeno",
      "dosis": "600mg",
      "frecuencia": "Cada 8 horas",
      "duracion": "5 dias"
    }
  ],
  "indicaciones": "Tomar con alimentos"
}
```

---

## Imagenes

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | /imagenes/upload | Si | Subir imagen (multipart) |
| GET | /imagenes/paciente/:id | Si | Galeria del paciente |
| DELETE | /imagenes/:id | Si | Eliminar imagen |

---

## Health Check

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | /health | No | Estado del servidor |

```json
// Response 200
{ "status": "ok", "timestamp": "2026-05-30T00:00:00.000Z" }
```
