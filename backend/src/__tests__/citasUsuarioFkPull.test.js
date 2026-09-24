/**
 * C4.3 — pull de citas con usuario_id huérfano (bootstrap A1, local vacío).
 *
 * citas.usuario_id REFERENCES usuarios(id) ON DELETE SET NULL; usuarios está
 * deliberadamente fuera de SYNC_TABLES. Sin la guarda, el pull de la cita
 * PROD id=1 (usuario_id=1) falla con FOREIGN KEY constraint failed.
 *
 * Demuestra:
 *  1. usuario existente → se conserva usuario_id;
 *  2. usuario inexistente → se inserta con usuario_id NULL (solo esa FK);
 *  3. PRAGMA foreign_keys sigue activo (inserto directo huérfano lanza).
 *
 * NO toca PROD. Solo SQLite :memory: a ambos lados.
 */

const { DatabaseSync } = require('node:sqlite');

jest.mock('../database', () => ({
  prepare: (sql) => {
    const d = globalThis.__FK_LOCAL_DB;
    if (!d) throw new Error('local test db not ready');
    return d.prepare(sql);
  },
  exec: (sql) => {
    const d = globalThis.__FK_LOCAL_DB;
    if (!d) throw new Error('local test db not ready');
    return d.exec(sql);
  },
}));

jest.mock('../cloudClient', () => ({
  isConfigured: () => true,
  execute: async (stmt) => {
    const d = globalThis.__FK_REMOTE_DB;
    if (!d) throw new Error('remote test db not ready');
    const s = typeof stmt === 'string' ? { sql: stmt, args: [] } : { sql: stmt.sql, args: stmt.args || [] };
    const upper = s.sql.trim().toUpperCase();
    if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA')) {
      return { rows: d.prepare(s.sql).all(...s.args), rowsAffected: 0, lastInsertRowid: 0 };
    }
    const info = d.prepare(s.sql).run(...s.args);
    return { rows: [], rowsAffected: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
  },
}));

const CITA_COLS = '(id, paciente_id, usuario_id, fecha, hora, motivo, created_at, updated_at)';

function createSchema(db, { fkOn } = {}) {
  if (fkOn) db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'odontologo',
      created_at TEXT
    );
    CREATE TABLE pacientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apellido_paterno TEXT NOT NULL, nombres TEXT NOT NULL,
      dni TEXT UNIQUE NOT NULL, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE citas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paciente_id INTEGER NOT NULL,
      usuario_id INTEGER,
      fecha TEXT NOT NULL, hora TEXT NOT NULL, motivo TEXT NOT NULL DEFAULT '',
      created_at TEXT, updated_at TEXT,
      FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );
    CREATE TABLE sync_tombstones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL, record_id INTEGER NOT NULL,
      deleted_at TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'user',
      synced_to_turso INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
      UNIQUE(table_name, record_id)
    );
  `);
  // Resto de SYNC_TABLES como stubs (pullFromTurso itera las 10).
  for (const t of [
    'historias_clinicas', 'consultas', 'odontogramas', 'tratamientos',
    'recetas', 'pagos', 'necesidades_odontologicas', 'imagenes',
  ]) {
    db.exec(`CREATE TABLE ${t} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT, created_at TEXT, updated_at TEXT
    )`);
  }
}

function freshPair() {
  const local = new DatabaseSync(':memory:');
  const remote = new DatabaseSync(':memory:');
  createSchema(local, { fkOn: true });
  createSchema(remote, { fkOn: true });
  // Paciente espejo en ambos lados (FK paciente_id siempre satisfacible).
  for (const d of [local, remote]) {
    d.prepare(
      "INSERT INTO pacientes (id, apellido_paterno, nombres, dni) VALUES (1, 'P', 'Test', '00000001')"
    ).run();
  }
  // Usuario solo en remoto (como en PROD); el local parte vacío (A1).
  remote
    .prepare("INSERT INTO usuarios (id, nombre, email, password, rol) VALUES (1, 'Doc', 'd@x.pe', 'h', 'odontologo')")
    .run();
  // Cita PROD id=1 con usuario_id=1 solo en remoto (bootstrap A1: local vacío).
  remote
    .prepare(
      `INSERT INTO citas ${CITA_COLS} VALUES (1, 1, 1, '2026-09-22', '07:26', 'control', NULL, '2026-09-22T07:26:22')`
    )
    .run();
  globalThis.__FK_LOCAL_DB = local;
  globalThis.__FK_REMOTE_DB = remote;
  jest.resetModules();
  return { local, remote, sync: require('../sync/syncService') };
}

afterEach(() => {
  globalThis.__FK_LOCAL_DB = null;
  globalThis.__FK_REMOTE_DB = null;
  jest.resetModules();
});

describe('pull citas.usuario_id con usuarios fuera de SYNC_TABLES', () => {
  test('usuario existente en local → se conserva usuario_id', async () => {
    const { local, sync } = freshPair();
    local
      .prepare("INSERT INTO usuarios (id, nombre, email, password, rol) VALUES (1, 'Doc', 'd@x.pe', 'h', 'odontologo')")
      .run();

    const result = await sync.pullFromTurso(null);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    const row = local.prepare('SELECT usuario_id FROM citas WHERE id = 1').get();
    expect(row.usuario_id).toBe(1);
  });

  test('usuario inexistente en local → se inserta con usuario_id NULL', async () => {
    const { local, sync } = freshPair();

    const result = await sync.pullFromTurso(null);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.pulled.citas).toBe(1);
    const row = local.prepare('SELECT usuario_id, paciente_id FROM citas WHERE id = 1').get();
    expect(row.usuario_id).toBeNull();
    expect(row.paciente_id).toBe(1);
  });

  test('PRAGMA foreign_keys sigue activo en local', () => {
    const { local } = freshPair();
    expect(() =>
      local
        .prepare(`INSERT INTO citas ${CITA_COLS} VALUES (99, 1, 999, '2026-09-22', '08:00', 'x', NULL, NULL)`)
        .run()
    ).toThrow(/FOREIGN KEY/i);
  });
});
