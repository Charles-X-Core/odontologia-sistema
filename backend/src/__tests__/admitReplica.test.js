/**
 * C4.2.5 — admitExistingReplica: admisión explícita de réplica verificada.
 *
 * Semántica: confirma una réplica local previamente verificada (conteos +
 * SHA por contenido) y establece el cursor con ZERO push. Distinto de
 * admitLocalPush (ese sí permite push de contenido en A2).
 *
 * Sin red real, sin PROD, sin push. Solo SQLite :memory: a ambos lados.
 */

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');

const JWT_SECRET = process.env.JWT_SECRET || 'clinica-odontologica-secret-2026';

jest.mock('../database', () => ({
  prepare: (sql) => {
    const d = globalThis.__ADM_LOCAL_DB;
    if (!d) throw new Error('local test db not ready');
    return d.prepare(sql);
  },
  exec: (sql) => {
    const d = globalThis.__ADM_LOCAL_DB;
    if (!d) throw new Error('local test db not ready');
    return d.exec(sql);
  },
}));

jest.mock('../cloudClient', () => ({
  isConfigured: () => globalThis.__ADM_CLOUD !== false,
  execute: async (stmt) => {
    const d = globalThis.__ADM_REMOTE_DB;
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
      device_id TEXT, bootstrap_completed_at TEXT, created_at TEXT, updated_at TEXT
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
      nombre TEXT, created_at TEXT, updated_at TEXT
    )`);
  }
}

function tokenFor(rol = 'admin') {
  return jwt.sign({ id: 1, email: 'admin', rol }, JWT_SECRET, { expiresIn: '5m' });
}

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    try {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    } catch { /* compat */ }
    server.close(() => resolve());
  });
}

function request(port, { method, path, token, body }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = data;
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Totales por tabla para probar que la admisión no toca filas clínicas.
 */
function clinicalCounts(db) {
  const out = {};
  for (const t of SYNC_TABLES) {
    out[t] = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
  }
  return out;
}

/**
 * Escenario A2: local con datos + cursor NULL. Devuelve sync fresco,
 * router montado y un espía sobre pushToTurso (debe quedar en 0 llamadas).
 */
async function setupA2({ withCursor = null } = {}) {
  const local = new DatabaseSync(':memory:');
  const remote = new DatabaseSync(':memory:');
  createSchema(local);
  createSchema(remote);
  local.prepare('INSERT INTO sync_state (id, last_sync_at) VALUES (1, ?)').run(withCursor);
  local.prepare("INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (1, 'local', '2026-01-01T10:00:00', '2026-01-01T10:00:00')").run();
  globalThis.__ADM_LOCAL_DB = local;
  globalThis.__ADM_REMOTE_DB = remote;
  globalThis.__ADM_CLOUD = true;
  jest.resetModules();
  const sync = require('../sync/syncService');
  const pushSpy = jest.spyOn(sync, 'pushToTurso');
  const { createSyncRouter } = require('../sync/syncRoutes');
  const app = express();
  app.use(express.json());
  app.use('/api/sync', createSyncRouter({ includeClean: false }));
  const { server, port } = await listen(app);
  return { local, remote, sync, pushSpy, server, port };
}

afterEach(async () => {
  globalThis.__ADM_LOCAL_DB = null;
  globalThis.__ADM_REMOTE_DB = null;
  globalThis.__ADM_CLOUD = true;
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('POST /api/sync/admit-replica — réplica verificada, zero push', () => {
  test('A2 → 200, cursor + bootstrap + device establecidos, push jamás llamado, filas intactas', async () => {
    const { local, pushSpy, server, port } = await setupA2();
    const before = clinicalCounts(local);
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/sync/admit-replica',
        token: tokenFor('admin'),
        body: {},
      });
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.data.admitted).toBe('existing_replica');
      expect(r.body.data.zeroPush).toBe(true);
      expect(r.body.data.pushExecuted).toBe(false);
      expect(pushSpy).not.toHaveBeenCalled();

      const state = local.prepare(
        'SELECT last_sync_at, bootstrap_completed_at, device_id FROM sync_state WHERE id = 1'
      ).get();
      expect(state.last_sync_at).not.toBeNull();
      expect(state.bootstrap_completed_at).not.toBeNull();
      expect(state.device_id).not.toBeNull();
      expect(clinicalCounts(local)).toEqual(before);
    } finally {
      await closeServer(server);
    }
  });

  test('el cursor queda deliberadamente ~24h en el pasado (ventana conservadora)', async () => {
    const { local, pushSpy, server, port } = await setupA2();
    const admitStart = Date.now();
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/sync/admit-replica',
        token: tokenFor('admin'),
        body: {},
      });
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      const state = local.prepare(
        'SELECT last_sync_at, bootstrap_completed_at FROM sync_state WHERE id = 1'
      ).get();
      // Comparación lexicográfica en formato ISO sin zona (mismo formato que
      // formatSyncTimestamp): evita ambigüedad de parse con offset local.
      const fmt = (ms) => new Date(ms).toISOString().slice(0, 19);
      const cur = state.last_sync_at;
      // ~24h atrás con margen ±5min respecto al instante de admisión.
      expect(cur < fmt(admitStart)).toBe(true);
      expect(cur >= fmt(admitStart - 24 * 3600 * 1000 - 5 * 60 * 1000)).toBe(true);
      expect(cur <= fmt(admitStart - 24 * 3600 * 1000 + 5 * 60 * 1000)).toBe(true);
      expect(state.bootstrap_completed_at).toBe(state.last_sync_at);
      expect(pushSpy).not.toHaveBeenCalled();
    } finally {
      await closeServer(server);
    }
  });

  test('parámetro tipo push es ignorado: zero push igualmente', async () => {
    const { local, pushSpy, server, port } = await setupA2();
    const before = clinicalCounts(local);
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/sync/admit-replica',
        token: tokenFor('admin'),
        body: { admitLocalPush: true, since: '2020-01-01T00:00:00' },
      });
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(pushSpy).not.toHaveBeenCalled();
      expect(clinicalCounts(local)).toEqual(before);
    } finally {
      await closeServer(server);
    }
  });

  test('A1 (local vacío) → 409 ADMIT_REPLICA_A1_EMPTY', async () => {
    const local = new DatabaseSync(':memory:');
    const remote = new DatabaseSync(':memory:');
    createSchema(local);
    createSchema(remote);
    local.prepare('INSERT INTO sync_state (id, last_sync_at) VALUES (1, NULL)').run();
    globalThis.__ADM_LOCAL_DB = local;
    globalThis.__ADM_REMOTE_DB = remote;
    globalThis.__ADM_CLOUD = true;
    jest.resetModules();
    const { createSyncRouter } = require('../sync/syncRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/sync', createSyncRouter({ includeClean: false }));
    const { server, port } = await listen(app);
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/sync/admit-replica',
        token: tokenFor('admin'),
        body: {},
      });
      expect(r.status).toBe(409);
      expect(r.body.error).toBe('ADMIT_REPLICA_A1_EMPTY');
      const state = local.prepare('SELECT last_sync_at FROM sync_state WHERE id = 1').get();
      expect(state.last_sync_at).toBeNull();
    } finally {
      await closeServer(server);
    }
  });

  test('bootstrap ya completado → 409 BOOTSTRAP_ALREADY_COMPLETED', async () => {
    const { pushSpy, server, port } = await setupA2({ withCursor: '2026-09-23T00:00:00' });
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/sync/admit-replica',
        token: tokenFor('admin'),
        body: {},
      });
      expect(r.status).toBe(409);
      expect(r.body.error).toBe('BOOTSTRAP_ALREADY_COMPLETED');
      expect(pushSpy).not.toHaveBeenCalled();
    } finally {
      await closeServer(server);
    }
  });

  test('sin autenticación → 401', async () => {
    const { server, port } = await setupA2();
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/sync/admit-replica',
        body: {},
      });
      expect(r.status).toBe(401);
    } finally {
      await closeServer(server);
    }
  });

  test('usuario no admin → 403', async () => {
    const { pushSpy, server, port } = await setupA2();
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/sync/admit-replica',
        token: tokenFor('odontologo'),
        body: {},
      });
      expect(r.status).toBe(403);
      expect(pushSpy).not.toHaveBeenCalled();
    } finally {
      await closeServer(server);
    }
  });
});
