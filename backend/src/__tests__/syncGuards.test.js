/**
 * C1 — Guards de upsert (created_at linaje + updated_at LWW) y bootstrap,
 * con SQLite real a ambos lados (local mockeado vía database.js, nube vía cloudClient
 * apuntando a un segundo DatabaseSync en memoria).
 *
 * La guarda de linaje es barrera anti-corrupción, NO identidad multi-dispositivo definitiva.
 */

const { DatabaseSync } = require('node:sqlite');

jest.mock('../database', () => ({
  prepare: (sql) => {
    const d = globalThis.__C1_LOCAL_DB;
    if (!d) throw new Error('local test db not ready');
    return d.prepare(sql);
  },
}));

jest.mock('../cloudClient', () => ({
  isConfigured: () => globalThis.__C1_CLOUD_CONFIGURED !== false,
  execute: async (stmt) => {
    const d = globalThis.__C1_REMOTE_DB;
    if (!d) throw new Error('remote test db not ready');
    const s = typeof stmt === 'string' ? { sql: stmt, args: [] } : { sql: stmt.sql, args: stmt.args || [] };
    const upper = s.sql.trim().toUpperCase();
    if (upper.startsWith('SELECT')) {
      const rows = d.prepare(s.sql).all(...s.args);
      return { rows, rowsAffected: 0, lastInsertRowid: 0 };
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
      last_sync_at TEXT, last_push_at TEXT, last_pull_at TEXT,
      device_id TEXT, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_tombstones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL, record_id INTEGER NOT NULL,
      deleted_at TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'user',
      synced_to_turso INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
      UNIQUE(table_name, record_id)
    );
  `);
  for (const t of SYNC_TABLES) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${t} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      created_at TEXT,
      updated_at TEXT
    )`);
  }
}

function freshPair({ lastSyncAt } = {}) {
  const local = new DatabaseSync(':memory:');
  const remote = new DatabaseSync(':memory:');
  createSchema(local);
  createSchema(remote);
  if (lastSyncAt !== undefined) {
    local.prepare('INSERT INTO sync_state (id, last_sync_at) VALUES (1, ?)').run(lastSyncAt);
  }
  globalThis.__C1_LOCAL_DB = local;
  globalThis.__C1_REMOTE_DB = remote;
  globalThis.__C1_CLOUD_CONFIGURED = true;
  jest.resetModules();
  return { local, remote, sync: require('../sync/syncService') };
}

afterEach(() => {
  globalThis.__C1_LOCAL_DB = null;
  globalThis.__C1_REMOTE_DB = null;
  globalThis.__C1_CLOUD_CONFIGURED = true;
});

describe('IDs — misma fila (created_at) permite update; colisión reportada sin overwrite', () => {
  test('push: mismo id + mismo created_at + updated_at mayor → update permitido', async () => {
    const { local, remote, sync } = freshPair({ lastSyncAt: '2026-01-01T00:00:00' });
    remote.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(1, 'nube', '2026-01-01T10:00:00', '2026-01-01T10:00:00');
    local.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(1, 'local-edit', '2026-01-01T10:00:00', '2026-01-02T10:00:00');

    const result = await sync.pushToTurso('2026-01-01T00:00:00');
    expect(result.success).toBe(true);
    expect(result.idCollisions).toEqual([]);
    expect(result.pushed.pacientes).toBe(1);
    const row = remote.prepare('SELECT nombre FROM pacientes WHERE id = 1').get();
    expect(row.nombre).toBe('local-edit');
  });

  test('push: mismo id + created_at distinto → idCollision, NO sobrescribe remoto', async () => {
    const { local, remote, sync } = freshPair({ lastSyncAt: '2026-01-01T00:00:00' });
    remote.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(1, 'remoto-original', '2026-01-01T10:00:00', '2026-01-01T10:00:00');
    local.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(1, 'local-distinto', '2026-03-01T10:00:00', '2026-03-01T10:00:00');

    const result = await sync.pushToTurso('2026-01-01T00:00:00');
    expect(result.success).toBe(false);
    expect(result.idCollisions).toEqual(
      expect.arrayContaining([expect.objectContaining({ table: 'pacientes', id: 1, direction: 'push' })])
    );
    const row = remote.prepare('SELECT nombre, created_at FROM pacientes WHERE id = 1').get();
    expect(row.nombre).toBe('remoto-original');
    expect(String(row.created_at)).toBe('2026-01-01T10:00:00');
  });

  test('pull: mismo id + created_at distinto → idCollision, NO sobrescribe local', async () => {
    const { local, remote, sync } = freshPair({ lastSyncAt: '2026-01-01T00:00:00' });
    local.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(1, 'local-original', '2026-01-01T10:00:00', '2026-01-01T10:00:00');
    remote.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(1, 'remoto-chocante', '2026-03-01T10:00:00', '2026-03-01T10:00:00');

    const result = await sync.pullFromTurso('2026-01-01T00:00:00');
    expect(result.success).toBe(false);
    expect(result.idCollisions).toEqual(
      expect.arrayContaining([expect.objectContaining({ table: 'pacientes', id: 1, direction: 'pull' })])
    );
    const row = local.prepare('SELECT nombre FROM pacientes WHERE id = 1').get();
    expect(row.nombre).toBe('local-original');
  });

  test('pull: mismo id + mismo created_at + remoto nuevo → update local', async () => {
    const { local, remote, sync } = freshPair({ lastSyncAt: '2026-01-01T00:00:00' });
    local.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(1, 'local-viejo', '2026-01-01T10:00:00', '2026-01-01T10:00:00');
    remote.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(1, 'remoto-nuevo', '2026-01-01T10:00:00', '2026-01-02T10:00:00');

    const result = await sync.pullFromTurso('2026-01-01T00:00:00');
    expect(result.success).toBe(true);
    expect(result.idCollisions).toEqual([]);
    const row = local.prepare('SELECT nombre FROM pacientes WHERE id = 1').get();
    expect(row.nombre).toBe('remoto-nuevo');
  });
});

describe('updated_at — LWW: versión más nueva no es pisada por más vieja', () => {
  test('pull viejo no pisa versión local más nueva', async () => {
    const { local, remote, sync } = freshPair({ lastSyncAt: '2026-01-01T00:00:00' });
    local.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(7, 'local-nuevo', '2026-01-01T10:00:00', '2026-01-05T10:00:00');
    remote.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(7, 'remoto-viejo', '2026-01-01T10:00:00', '2026-01-02T10:00:00');

    const result = await sync.pullFromTurso('2026-01-01T00:00:00');
    expect(result.success).toBe(true);
    expect(result.skippedStale).toBeGreaterThanOrEqual(1);
    const row = local.prepare('SELECT nombre, updated_at FROM pacientes WHERE id = 7').get();
    expect(row.nombre).toBe('local-nuevo');
    expect(String(row.updated_at)).toBe('2026-01-05T10:00:00');
  });

  test('push viejo no pisa versión remota más nueva', async () => {
    const { local, remote, sync } = freshPair({ lastSyncAt: '2026-01-01T00:00:00' });
    local.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(7, 'local-viejo', '2026-01-01T10:00:00', '2026-01-02T10:00:00');
    remote.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(7, 'remoto-nuevo', '2026-01-01T10:00:00', '2026-01-05T10:00:00');

    const result = await sync.pushToTurso('2026-01-01T00:00:00');
    expect(result.success).toBe(true);
    expect(result.skippedStale).toBeGreaterThanOrEqual(1);
    const row = remote.prepare('SELECT nombre, updated_at FROM pacientes WHERE id = 7').get();
    expect(row.nombre).toBe('remoto-nuevo');
    expect(String(row.updated_at)).toBe('2026-01-05T10:00:00');
  });
});

describe('bootstrap — last_sync_at NULL', () => {
  test('DB nueva: pull total → fence sqlite_sequence → push → cursor al final', async () => {
    const { local, remote, sync } = freshPair({ lastSyncAt: null });
    // nube con historia
    for (let i = 1; i <= 5; i++) {
      remote.prepare(
        'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (?, ?, ?, ?)'
      ).run(i, `p${i}`, '2026-01-01T10:00:00', '2026-01-01T10:00:00');
    }
    // local solo sync_state NULL
    expect(sync.getLastSyncTime()).toBeNull();

    const result = await sync.fullSync();
    expect(result.bootstrap).toBe(true);
    expect(result.success).toBe(true);

    // pull trajo la historia
    const count = local.prepare('SELECT COUNT(*) AS c FROM pacientes').get();
    expect(Number(count.c)).toBe(5);

    // fence: sqlite_sequence ≥ max conocido
    const seq = local.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'pacientes'").get();
    expect(seq).toBeTruthy();
    expect(Number(seq.seq)).toBeGreaterThanOrEqual(5);

    // próximo id local > max
    const info = local.prepare("INSERT INTO pacientes (nombre, created_at, updated_at) VALUES ('nuevo', ?, ?)")
      .run('2026-02-01T10:00:00', '2026-02-01T10:00:00');
    expect(Number(info.lastInsertRowid)).toBeGreaterThan(5);

    // cursor establecido
    expect(sync.getLastSyncTime()).toBeTruthy();
  });

  test('fallo durante bootstrap (nube caída) deja cursor NULL y reintentable', async () => {
    const { sync } = freshPair({ lastSyncAt: null });
    globalThis.__C1_CLOUD_CONFIGURED = false;

    const result = await sync.fullSync();
    expect(result.bootstrap).toBe(true);
    expect(result.success).toBe(false);
    expect(sync.getLastSyncTime()).toBeNull();

    // reintento con nube OK
    globalThis.__C1_CLOUD_CONFIGURED = true;
    globalThis.__C1_REMOTE_DB.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (1, ?, ?, ?)'
    ).run('r1', '2026-01-01T10:00:00', '2026-01-01T10:00:00');

    const retry = await sync.fullSync();
    expect(retry.bootstrap).toBe(true);
    expect(retry.success).toBe(true);
    expect(sync.getLastSyncTime()).toBeTruthy();
  });

  test('idCollision en bootstrap impide avanzar el cursor', async () => {
    const { local, remote, sync } = freshPair({ lastSyncAt: null });
    remote.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (1, ?, ?, ?)'
    ).run('remoto', '2026-01-01T10:00:00', '2026-01-01T10:00:00');
    local.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (1, ?, ?, ?)'
    ).run('local-distinto', '2026-05-01T10:00:00', '2026-05-01T10:00:00');

    const result = await sync.fullSync();
    expect(result.bootstrap).toBe(true);
    expect(result.success).toBe(false);
    // pull falla primero con idCollision; bootstrap aborta antes de push
    expect(result.pull.idCollisions).toEqual(
      expect.arrayContaining([expect.objectContaining({ table: 'pacientes', id: 1, direction: 'pull' })])
    );
    expect(result.push.success).toBe(false);
    expect(sync.getLastSyncTime()).toBeNull();
    // remoto intacto
    expect(remote.prepare('SELECT nombre FROM pacientes WHERE id = 1').get().nombre).toBe('remoto');
  });
});

describe('fullSync normal (cursor existente)', () => {
  test('bootstrap=false cuando last_sync_at no es NULL', async () => {
    const { sync } = freshPair({ lastSyncAt: '2026-01-01T00:00:00' });
    const result = await sync.fullSync();
    expect(result.bootstrap).toBeUndefined();
    expect(result.success).toBe(true);
  });
});
