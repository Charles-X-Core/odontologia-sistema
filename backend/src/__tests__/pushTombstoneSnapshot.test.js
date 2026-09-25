/**
 * Push: snapshot único de tombstones remotos (anti N+1).
 *
 * pushToTurso() debe leer sync_tombstones remoto UNA vez por ejecución
 * (Set en memoria) en vez de un SELECT por fila. Semántica delete-wins
 * intacta. Sin red real, sin PROD. Solo SQLite :memory: a ambos lados.
 */

const { DatabaseSync } = require('node:sqlite');

jest.mock('../database', () => ({
  prepare: (sql) => {
    const d = globalThis.__TS_LOCAL_DB;
    if (!d) throw new Error('local test db not ready');
    return d.prepare(sql);
  },
  exec: (sql) => {
    const d = globalThis.__TS_LOCAL_DB;
    if (!d) throw new Error('local test db not ready');
    return d.exec(sql);
  },
}));

jest.mock('../cloudClient', () => ({
  isConfigured: () => true,
  execute: async (stmt) => {
    const s = typeof stmt === 'string' ? { sql: stmt, args: [] } : { sql: stmt.sql, args: stmt.args || [] };
    globalThis.__TS_CLOUD_CALLS.push(s.sql);
    const d = globalThis.__TS_REMOTE_DB;
    if (!d) throw new Error('remote test db not ready');
    const upper = s.sql.trim().toUpperCase();
    if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA')) {
      return { rows: d.prepare(s.sql).all(...s.args), rowsAffected: 0, lastInsertRowid: 0 };
    }
    const info = d.prepare(s.sql).run(...s.args);
    return { rows: [], rowsAffected: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
  },
}));

const SYNC_TABLES = [
  'pacientes', 'historias_clinicas', 'consultas', 'odontogramas',
  'tratamientos', 'recetas', 'citas', 'pagos',
  'necesidades_odontologicas', 'imagenes'
];

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_sync_at TEXT, device_id TEXT, bootstrap_completed_at TEXT,
      created_at TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_tombstones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL, record_id INTEGER NOT NULL,
      deleted_at TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'user',
      synced_to_turso INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
      UNIQUE(table_name, record_id)
    );
    CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT);
  `);
  for (const t of SYNC_TABLES) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${t} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT, created_at TEXT, updated_at TEXT
      ${t === 'citas' ? ', usuario_id INTEGER' : ''}
    )`);
  }
}

function setup() {
  const local = new DatabaseSync(':memory:');
  const remote = new DatabaseSync(':memory:');
  createSchema(local);
  createSchema(remote);
  globalThis.__TS_LOCAL_DB = local;
  globalThis.__TS_REMOTE_DB = remote;
  globalThis.__TS_CLOUD_CALLS = [];
  jest.resetModules();
  return { local, remote, sync: require('../sync/syncService') };
}

afterEach(() => {
  globalThis.__TS_LOCAL_DB = null;
  globalThis.__TS_REMOTE_DB = null;
  globalThis.__TS_CLOUD_CALLS = [];
  jest.resetModules();
  jest.restoreAllMocks();
});

function tombstoneSelects() {
  return globalThis.__TS_CLOUD_CALLS.filter((sql) => /FROM\s+sync_tombstones/i.test(sql));
}

function perRowTombstoneChecks() {
  return globalThis.__TS_CLOUD_CALLS.filter((sql) => /table_name\s*=\s*\?/i.test(sql));
}

function seedLocalRows(local, table, n, base = {}) {
  for (let i = 1; i <= n; i++) {
    local.prepare(
      `INSERT INTO ${table} (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)`
    ).run(i, base.nombre || `fila-${i}`, base.created_at || '2026-01-01T10:00:00', base.updated_at || '2026-01-01T10:00:00');
  }
}

describe('push tombstone snapshot — delete-wins sin N+1', () => {
  test('1. tombstone remoto existente: la fila NO se upsertea, contador correcto', async () => {
    const { local, remote, sync } = setup();
    seedLocalRows(local, 'pacientes', 1, { nombre: 'local-nuevo' });
    remote.prepare(
      "INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (1, 'remoto-viejo', '2026-01-01T10:00:00', '2026-01-01T10:00:00')"
    ).run();
    remote.prepare(
      "INSERT INTO sync_tombstones (table_name, record_id, deleted_at, source, synced_to_turso, created_at) VALUES ('pacientes', 1, '2026-02-01T10:00:00', 'user', 1, '2026-02-01T10:00:00')"
    ).run();

    const result = await sync.pushToTurso(null);

    expect(result.success).toBe(true);
    expect(result.skippedByRemoteTombstone).toBe(1);
    expect(result.errors).toEqual([]);
    // delete-wins: el valor remoto se conserva intacto.
    expect(remote.prepare('SELECT nombre FROM pacientes WHERE id = 1').get().nombre).toBe('remoto-viejo');
    expect(tombstoneSelects()).toHaveLength(1);
  });

  test('2 y 3. sin tombstones: UN solo SELECT aunque haya N filas en varias tablas', async () => {
    const { sync } = setup();
    const local = globalThis.__TS_LOCAL_DB;
    seedLocalRows(local, 'pacientes', 5);
    seedLocalRows(local, 'consultas', 3);

    const result = await sync.pushToTurso(null);

    expect(result.success).toBe(true);
    expect(result.pushed.pacientes).toBe(5);
    expect(result.pushed.consultas).toBe(3);
    // El snapshot se consulta una sola vez por ejecución completa.
    expect(tombstoneSelects()).toHaveLength(1);
    // Cero checks individuales por fila (el N+1 eliminado).
    expect(perRowTombstoneChecks()).toHaveLength(0);
  });

  test('4a. pushed cuenta correctamente y errors reporta fallo real', async () => {
    const { local, remote, sync } = setup();
    seedLocalRows(local, 'pacientes', 2);
    remote.exec('DROP TABLE pagos');
    local.prepare("INSERT INTO pagos (id, nombre, created_at, updated_at) VALUES (1, 'p', '2026-01-01T10:00:00', '2026-01-01T10:00:00')").run();

    const result = await sync.pushToTurso(null);

    expect(result.success).toBe(false);
    expect(result.pushed.pacientes).toBe(2);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.table === 'pagos')).toBe(true);
  });

  test('4b. idCollisions y skippedStale siguen funcionando', async () => {
    const { local, remote, sync } = setup();
    // Colisión: mismo id, created_at distinto.
    local.prepare("INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (1, 'l', '2026-01-01T10:00:00', '2026-03-01T10:00:00')").run();
    remote.prepare("INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (1, 'r', '2020-01-01T10:00:00', '2020-01-01T10:00:00')").run();
    // Stale: mismo created_at, remoto más nuevo.
    local.prepare("INSERT INTO recetas (id, nombre, created_at, updated_at) VALUES (1, 'l', '2026-01-01T10:00:00', '2026-01-01T10:00:00')").run();
    remote.prepare("INSERT INTO recetas (id, nombre, created_at, updated_at) VALUES (1, 'r', '2026-01-01T10:00:00', '2026-06-01T10:00:00')").run();

    const result = await sync.pushToTurso(null);

    expect(result.success).toBe(false);
    expect(result.idCollisions).toEqual(
      expect.arrayContaining([expect.objectContaining({ table: 'pacientes', id: 1, direction: 'push' })])
    );
    expect(result.skippedStale).toBe(1);
    expect(remote.prepare('SELECT nombre FROM pacientes WHERE id = 1').get().nombre).toBe('r');
  });

  test('4c. usuario_id de citas sigue degradándose a NULL si el usuario no existe remoto', async () => {
    const { local, remote, sync } = setup();
    local.prepare("INSERT INTO citas (id, nombre, created_at, updated_at, usuario_id) VALUES (1, 'c', '2026-01-01T10:00:00', '2026-01-01T10:00:00', 9)").run();

    const result = await sync.pushToTurso(null);

    expect(result.success).toBe(true);
    expect(remote.prepare('SELECT usuario_id FROM citas WHERE id = 1').get().usuario_id).toBeNull();
    expect(local.prepare('SELECT usuario_id FROM citas WHERE id = 1').get().usuario_id).toBe(9);
  });
});
