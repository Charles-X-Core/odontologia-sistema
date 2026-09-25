/**
 * Push por batch: 1 round-trip por lote (BATCH_SIZE) en vez de 1 por fila,
 * con fallback secuencial de semántica idéntica si el batch aborta.
 *
 * batch() es transaccional: ante un statement fallido se revierte el lote
 * y se reintentan sus filas una por una (errores/colisiones/stale iguales).
 * Sin red real, sin PROD. Solo SQLite :memory: a ambos lados.
 */

const { DatabaseSync } = require('node:sqlite');

jest.mock('../database', () => ({
  prepare: (sql) => {
    const d = globalThis.__PB_LOCAL_DB;
    if (!d) throw new Error('local test db not ready');
    return d.prepare(sql);
  },
  exec: (sql) => {
    const d = globalThis.__PB_LOCAL_DB;
    if (!d) throw new Error('local test db not ready');
    return d.exec(sql);
  },
}));

jest.mock('../cloudClient', () => ({
  isConfigured: () => true,
  execute: async (stmt) => {
    const s = typeof stmt === 'string' ? { sql: stmt, args: [] } : { sql: stmt.sql, args: stmt.args || [] };
    globalThis.__PB_EXEC_CALLS.push(s.sql);
    if (JSON.stringify(s.args || []).includes('__FAIL__')) {
      throw new Error('upsert fallido (simulado)');
    }
    const d = globalThis.__PB_REMOTE_DB;
    if (!d) throw new Error('remote test db not ready');
    const upper = s.sql.trim().toUpperCase();
    if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA')) {
      return { rows: d.prepare(s.sql).all(...s.args), rowsAffected: 0, lastInsertRowid: 0 };
    }
    const info = d.prepare(s.sql).run(...s.args);
    return { rows: [], rowsAffected: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
  },
  getClient: () => {
    if (globalThis.__PB_NO_BATCH) return {};
    return {
      batch: async (stmts) => {
        globalThis.__PB_BATCH_CALLS.push(stmts.length);
        if (stmts.some((st) => JSON.stringify(st.args || []).includes('__FAIL__'))) {
          throw new Error('batch abortado (simulado)');
        }
        const d = globalThis.__PB_REMOTE_DB;
        if (!d) throw new Error('remote test db not ready');
        return stmts.map((st) => {
          const info = d.prepare(st.sql).run(...(st.args || []));
          return { rows: [], rowsAffected: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
        });
      },
    };
  },
}));

const SYNC_TABLES = [
  'pacientes', 'historias_clinicas', 'consultas', 'odontogramas',
  'tratamientos', 'recetas', 'citas', 'pagos',
  'necesidades_odontologicas', 'imagenes'
];

function createSchema(db) {
  db.exec(`
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

function setup({ noBatch = false } = {}) {
  const local = new DatabaseSync(':memory:');
  const remote = new DatabaseSync(':memory:');
  createSchema(local);
  createSchema(remote);
  globalThis.__PB_LOCAL_DB = local;
  globalThis.__PB_REMOTE_DB = remote;
  globalThis.__PB_EXEC_CALLS = [];
  globalThis.__PB_BATCH_CALLS = [];
  globalThis.__PB_NO_BATCH = noBatch;
  jest.resetModules();
  return { local, remote, sync: require('../sync/syncService') };
}

afterEach(() => {
  globalThis.__PB_LOCAL_DB = null;
  globalThis.__PB_REMOTE_DB = null;
  globalThis.__PB_EXEC_CALLS = [];
  globalThis.__PB_BATCH_CALLS = [];
  globalThis.__PB_NO_BATCH = false;
  jest.resetModules();
  jest.restoreAllMocks();
});

function individualUpserts() {
  return globalThis.__PB_EXEC_CALLS.filter((sql) => {
    const u = sql.trim().toUpperCase();
    return u.startsWith('INSERT') && !u.includes('SYNC_TOMBSTONES');
  });
}

function seedLocalRows(local, table, n, base = {}) {
  for (let i = 1; i <= n; i++) {
    local.prepare(
      `INSERT INTO ${table} (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)`
    ).run(i, base.nombre || `fila-${i}`, base.created_at || '2026-01-01T10:00:00', base.updated_at || '2026-01-01T10:00:00');
  }
}

describe('push por batch — menos round-trips, misma semántica', () => {
  test('120 filas → 3 batches (50/50/20), sin upserts individuales, sin pérdida', async () => {
    const { local, remote, sync } = setup();
    seedLocalRows(local, 'pacientes', 120);

    const result = await sync.pushToTurso(null);

    expect(result.success).toBe(true);
    expect(result.pushed.pacientes).toBe(120);
    expect(result.errors).toEqual([]);
    expect(globalThis.__PB_BATCH_CALLS).toEqual([50, 50, 20]);
    expect(individualUpserts()).toHaveLength(0);
    // Sin pérdida: contenido espejo.
    expect(remote.prepare('SELECT COUNT(*) AS c FROM pacientes').get().c).toBe(120);
    expect(remote.prepare('SELECT nombre FROM pacientes WHERE id = 77').get().nombre).toBe('fila-77');
    expect(local.prepare('SELECT COUNT(*) AS c FROM pacientes').get().c).toBe(120);
  });

  test('idempotencia: segunda ejecución con mismo resultado y sin duplicados', async () => {
    const { remote, sync } = setup();
    const local = globalThis.__PB_LOCAL_DB;
    seedLocalRows(local, 'pacientes', 60);
    seedLocalRows(local, 'consultas', 5);

    const first = await sync.pushToTurso(null);
    const second = await sync.pushToTurso(null);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.pushed).toEqual(first.pushed);
    expect(remote.prepare('SELECT COUNT(*) AS c FROM pacientes').get().c).toBe(60);
    expect(remote.prepare('SELECT COUNT(*) AS c FROM consultas').get().c).toBe(5);
  });

  test('reglas intactas: colisión, stale y delete-wins por vía batch', async () => {
    const { local, remote, sync } = setup();
    // Colisión: mismo id, created_at distinto.
    local.prepare("INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (1, 'l', '2026-01-01T10:00:00', '2026-03-01T10:00:00')").run();
    remote.prepare("INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (1, 'r', '2020-01-01T10:00:00', '2020-01-01T10:00:00')").run();
    // Stale: mismo created_at, remoto más nuevo.
    local.prepare("INSERT INTO recetas (id, nombre, created_at, updated_at) VALUES (1, 'l', '2026-01-01T10:00:00', '2026-01-01T10:00:00')").run();
    remote.prepare("INSERT INTO recetas (id, nombre, created_at, updated_at) VALUES (1, 'r', '2026-01-01T10:00:00', '2026-06-01T10:00:00')").run();
    // Delete-wins: tombstone remoto previo.
    local.prepare("INSERT INTO pagos (id, nombre, created_at, updated_at) VALUES (1, 'l', '2026-01-01T10:00:00', '2026-01-01T10:00:00')").run();
    remote.prepare("INSERT INTO pagos (id, nombre, created_at, updated_at) VALUES (1, 'r', '2026-01-01T10:00:00', '2026-01-01T10:00:00')").run();
    remote.prepare("INSERT INTO sync_tombstones (table_name, record_id, deleted_at, source, synced_to_turso, created_at) VALUES ('pagos', 1, '2026-02-01T10:00:00', 'user', 1, '2026-02-01T10:00:00')").run();

    const result = await sync.pushToTurso(null);

    expect(result.success).toBe(false);
    expect(result.idCollisions).toEqual(
      expect.arrayContaining([expect.objectContaining({ table: 'pacientes', id: 1, direction: 'push' })])
    );
    expect(result.skippedStale).toBe(1);
    expect(result.skippedByRemoteTombstone).toBe(1);
    expect(remote.prepare('SELECT nombre FROM pacientes WHERE id = 1').get().nombre).toBe('r');
    expect(remote.prepare('SELECT nombre FROM pagos WHERE id = 1').get().nombre).toBe('r');
  });

  test('error dentro de un batch: fallback por fila, resto intacto, error registrado', async () => {
    const { local, remote, sync } = setup();
    seedLocalRows(local, 'pacientes', 3);
    local.prepare("INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (99, '__FAIL__', '2026-01-01T10:00:00', '2026-01-01T10:00:00')").run();

    const result = await sync.pushToTurso(null);

    expect(result.success).toBe(false);
    // El batch abortó (1 intento) y el fallback secuencial aplicó el resto.
    expect(globalThis.__PB_BATCH_CALLS).toEqual([4]);
    expect(result.pushed.pacientes).toBe(3);
    expect(result.errors.some((e) => e.table === 'pacientes' && e.id === 99)).toBe(true);
    expect(remote.prepare('SELECT COUNT(*) AS c FROM pacientes').get().c).toBe(3);
    expect(remote.prepare('SELECT id FROM pacientes WHERE id = 99').get()).toBeFalsy();
  });

  test('usuario_id: huérfano → NULL, existente → conserva, local intacto', async () => {
    const { local, remote, sync } = setup();
    local.prepare("INSERT INTO citas (id, nombre, created_at, updated_at, usuario_id) VALUES (1, 'huerfana', '2026-01-01T10:00:00', '2026-01-01T10:00:00', 9)").run();
    local.prepare("INSERT INTO citas (id, nombre, created_at, updated_at, usuario_id) VALUES (2, 'ok', '2026-01-01T10:00:00', '2026-01-01T10:00:00', 1)").run();
    remote.prepare("INSERT INTO usuarios (id, nombre) VALUES (1, 'R')").run();

    const result = await sync.pushToTurso(null);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(remote.prepare('SELECT usuario_id FROM citas WHERE id = 1').get().usuario_id).toBeNull();
    expect(remote.prepare('SELECT usuario_id FROM citas WHERE id = 2').get().usuario_id).toBe(1);
    expect(local.prepare('SELECT usuario_id FROM citas WHERE id = 1').get().usuario_id).toBe(9);
  });

  test('sin registros: batch jamás invocado, resultado limpio', async () => {
    const { sync } = setup();

    const result = await sync.pushToTurso(null);

    expect(result.success).toBe(true);
    expect(result.pushed).toEqual({});
    expect(globalThis.__PB_BATCH_CALLS).toEqual([]);
  });

  test('sin driver batch: vía secuencial idéntica, sin regresión', async () => {
    const { local, remote, sync } = setup({ noBatch: true });
    seedLocalRows(local, 'pacientes', 3);

    const result = await sync.pushToTurso(null);

    expect(result.success).toBe(true);
    expect(result.pushed.pacientes).toBe(3);
    expect(globalThis.__PB_BATCH_CALLS).toEqual([]);
    expect(individualUpserts()).toHaveLength(3);
    expect(remote.prepare('SELECT COUNT(*) AS c FROM pacientes').get().c).toBe(3);
  });
});
