# Wizard de Sesion Clinica — Documentacion Completa

## Componente
`frontend/src/components/SesionClinica.jsx`

## Descripcion
Wizard de 8 pasos para registrar una consulta clinica completa. Se accede desde:
- **Recepcion** → "Iniciar Sesion" → seleccionar paciente
- **Historial** → "+ Nueva Consulta"

## Pasos del Wizard

### Paso 1: Paciente (solo lectura)
- Muestra datos del paciente: nombre, DNI, edad, telefono
- Muestra antecedentes clinicos (alergias, enfermedades, etc.)
- Permite editar antecedentes si se hace click en "Editar"
- **Campos obligatorios:** Ninguno (el paciente ya esta seleccionado)

### Paso 2: Enfermedad Actual
- **Campo obligatorio: `motivo`** (textarea)
- Acceso rapido: botones con motivos comunes (Dolor dental, Sangrado, Revision, etc.)
- Campos opcionales:
  - `tiempo_enfermedad` — Ej: "3 dias", "2 semanas"
  - `signos_sintomas` — Descripcion de sintomas
  - `relato_cronologico` — Evolucion temporal
  - `funciones_biologicas` — Sueno, apetito, evacuaciones
- **Validacion: El motivo NO puede estar vacio. Si esta vacio, muestra error y no avanza.**

### Paso 3: Diagnostico
- Lista de diagnosticos (se pueden agregar varios)
- Cada diagnostico tiene: `texto` (textarea) y `tipo` (clinico/odontologico)
- **Campos obligatorios:** Ninguno (se puede avanzar sin diagnosticos)

### Paso 4: Odontograma
- Componente interactivo de odontograma
- Seleccion de pieza dental + tipo de tratamiento
- **Campos obligatorios:** Ninguno (se puede avanzar sin odontograma)

### Paso 5: Evidencias (Fotos)
- Zona de drag & drop para imagenes
- Selector de tipo: foto, radiografia, panoramica, intraoral
- Descripcion por imagen
- **Campos obligatorios:** Ninguno (se puede avanzar sin evidencias)

### Paso 6: Recetas (opcional)
- Lista de recetas con medicamentos
- Cada receta tiene: nombre, dosis, frecuencia, duracion
- Indicaciones generales
- Plantillas predefinidas (Analgesico, Antibiotico, Periodontal)
- **Campos obligatorios:** Ninguno (si no se llena nada, no se genera receta)

### Paso 7: Tratamiento
- Lista de tratamientos propuestos
- Cada tratamiento tiene: procedimiento, pieza dental, costo, monto a cuenta
- Checkbox "Se realizo" (realizado/planificado)
- **Campos obligatorios:** Ninguno (se puede avanzar sin tratamientos)

### Paso 8: Resumen
- Resumen de todo lo registrado en los pasos anteriores
- Boton "Guardar Sesion Completa"

---

## Flujo de Guardado (`guardarSesion`)

```
1. Verificar si existe historia clinica
   └─ Si NO existe → crear con api.historias.crear()
2. Crear consulta con api.consultas.crear()
   └─ Requiere: historia_id + motivo
3. Guardar odontograma (si existe)
4. Guardar necesidades odontologicas (si hay valores > 0)
5. Guardar recetas (solo si tienen medicamentos o indicaciones)
6. Subir evidencias (imagenes)
7. Guardar tratamientos (solo si tienen procedimiento)
```

---

## Errores del Backend

| Error | Causa |
|---|---|
| `historia_id y motivo son obligatorios` | Falta historia_id o motivo esta vacio |
| `Historia clinica no encontrada` | historia_id no existe en la DB |
| `No se envio archivo` | Evidencia sin archivo adjunto |
| `paciente_id es obligatorio` | Falta paciente_id en subida de imagen |

---

## Validaciones del Frontend

| Validacion | Estado |
|---|---|
| Motivo obligatorio en paso 2 | ✅ Implementado |
| Historia auto-creada si no existe | ✅ Implementado |
| Error al guardar sesion | ⚠️ Muestra error generico |
| Campos obligatorios en otros pasos | ❌ No validados (son opcionales) |

---

## Endpoints Relacionados

| Endpoint | Metodo | Descripcion |
|---|---|---|
| `/api/pacientes/:id/historial` | GET | Carga historia + consultas |
| `/api/historias` | POST | Crea historia clinica |
| `/api/consultas` | POST | Crea consulta (requiere historia_id + motivo) |
| `/api/odontogramas` | POST | Crea odontograma |
| `/api/necesidades` | POST | Crea necesidades odontologicas |
| `/api/recetas` | POST | Crea receta |
| `/api/imagenes/upload` | POST | Sube evidencia |
| `/api/tratamientos` | POST | Crea tratamiento |

---

## Estados del Wizard

- `paso` (1-8): Paso actual
- `historia`: Historia clinica del paciente (null si no existe)
- `motivo`: Motivo de consulta (obligatorio)
- `diagnosticos`: Lista de diagnosticos
- `odontograma`: Datos del odontograma
- `evidencias`: Lista de imagenes a subir
- `recetas`: Lista de recetas
- `tratamientos`: Lista de tratamientos
- `guardando`: Flag de carga durante guardado
- `mensaje`: Mensaje de error/exito
