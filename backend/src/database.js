const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'clinica.db');

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'odontologo',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pacientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    dni TEXT UNIQUE NOT NULL,
    telefono TEXT,
    email TEXT,
    fecha_nacimiento TEXT,
    sexo TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS historias_clinicas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER UNIQUE NOT NULL,
    antecedentes TEXT DEFAULT '',
    alergias TEXT DEFAULT '',
    observaciones TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS consultas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    historia_id INTEGER NOT NULL,
    fecha TEXT DEFAULT (datetime('now')),
    motivo TEXT NOT NULL,
    diagnostico TEXT NOT NULL,
    tratamiento TEXT NOT NULL,
    notas TEXT DEFAULT '',
    FOREIGN KEY (historia_id) REFERENCES historias_clinicas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS odontogramas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consulta_id INTEGER NOT NULL,
    datos_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tratamientos (
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

  CREATE TABLE IF NOT EXISTS recetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consulta_id INTEGER NOT NULL,
    paciente_id INTEGER NOT NULL,
    medicamentos TEXT NOT NULL DEFAULT '[]',
    indicaciones TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE CASCADE,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS imagenes (
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

  CREATE TABLE IF NOT EXISTS necesidades_odontologicas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consulta_id INTEGER UNIQUE NOT NULL,
    cariados INTEGER DEFAULT 0,
    curados INTEGER DEFAULT 0,
    por_extraer INTEGER DEFAULT 0,
    endodoncia INTEGER DEFAULT 0,
    ortodoncia INTEGER DEFAULT 0,
    protesis INTEGER DEFAULT 0,
    extraidos INTEGER DEFAULT 0,
    destartraje INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE CASCADE
  );
`);

try { db.exec("ALTER TABLE historias_clinicas ADD COLUMN numero_historia TEXT"); } catch {}
try { db.exec("ALTER TABLE historias_clinicas ADD COLUMN motivo_consulta TEXT"); } catch {}

module.exports = db;
