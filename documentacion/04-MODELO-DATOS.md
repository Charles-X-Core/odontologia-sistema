# Modelo de Datos - SQLite

## Schema Completo

```sql
-- Usuarios (autenticacion)
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'odontologo',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Pacientes
CREATE TABLE pacientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  dni TEXT UNIQUE NOT NULL,
  telefono TEXT,
  email TEXT,
  fecha_nacimiento TEXT,
  sexo TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Historias Clinicas (1:1 con paciente)
CREATE TABLE historias_clinicas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER UNIQUE NOT NULL,
  antecedentes TEXT DEFAULT '',
  alergias TEXT DEFAULT '',
  observaciones TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- Consultas (1:N con historia)
CREATE TABLE consultas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  historia_id INTEGER NOT NULL,
  fecha TEXT DEFAULT (datetime('now')),
  motivo TEXT NOT NULL,
  diagnostico TEXT NOT NULL,
  tratamiento TEXT NOT NULL,
  notas TEXT DEFAULT '',
  FOREIGN KEY (historia_id) REFERENCES historias_clinicas(id) ON DELETE CASCADE
);

-- Odontogramas (1:1 con consulta)
CREATE TABLE odontogramas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consulta_id INTEGER NOT NULL,
  datos_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE CASCADE
);

-- Tratamientos (1:N con paciente)
CREATE TABLE tratamientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  estado TEXT DEFAULT 'pendiente',
  costo REAL DEFAULT 0,
  diente_numero INTEGER,
  fecha_inicio TEXT,
  fecha_fin TEXT,
  notas TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- Recetas (1:N con consulta y paciente)
CREATE TABLE recetas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consulta_id INTEGER NOT NULL,
  paciente_id INTEGER NOT NULL,
  medicamentos TEXT NOT NULL DEFAULT '[]',
  indicaciones TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- Imagenes (1:N con paciente, N:1 con consulta)
CREATE TABLE imagenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL,
  consulta_id INTEGER,
  archivo_nombre TEXT NOT NULL,
  archivo_original TEXT NOT NULL,
  tipo TEXT DEFAULT 'foto',
  descripcion TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE SET NULL
);
```

## Diagrama de Relaciones

```
usuarios (standalone)

pacientes
  └── 1:1 ──> historias_clinicas
                  └── 1:N ──> consultas
                                  ├── 1:1 ──> odontogramas
                                  └── 1:N ──> recetas
  └── 1:N ──> tratamientos
  └── 1:N ──> imagenes
```

## Cascada de Eliminacion

- Eliminar **paciente** → elimina historia, consultas, odontogramas, recetas, tratamientos, imagenes
- Eliminar **historia** → elimina consultas, odontogramas, recetas
- Eliminar **consulta** → elimina odontograma, recetas (imagenes se desvinculan)

## Indices

```sql
CREATE UNIQUE INDEX idx_pacientes_dni ON pacientes(dni);
CREATE UNIQUE INDEX idx_usuarios_email ON usuarios(email);
CREATE UNIQUE INDEX idx_historias_paciente ON historias_clinicas(paciente_id);
CREATE INDEX idx_consultas_historia ON consultas(historia_id);
CREATE INDEX idx_odontogramas_consulta ON odontogramas(consulta_id);
CREATE INDEX idx_tratamientos_paciente ON tratamientos(paciente_id);
CREATE INDEX idx_recetas_consulta ON recetas(consulta_id);
CREATE INDEX idx_recetas_paciente ON recetas(paciente_id);
CREATE INDEX idx_imagenes_paciente ON imagenes(paciente_id);
```

## Ubicacion de la DB

| Entorno | Ruta |
|---------|------|
| Desarrollo | `backend/clinica.db` |
| Electron (dev) | `backend/clinica.db` |
| Electron (empaquetado) | `resources/data/clinica.db` |
| Render.com | `/var/data/clinica.db` |
