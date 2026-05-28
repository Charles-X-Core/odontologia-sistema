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
`);

module.exports = db;
