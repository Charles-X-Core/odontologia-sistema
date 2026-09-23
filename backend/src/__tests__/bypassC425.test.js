/**
 * C4.2.5.1 — cierre de bypasses pre-commit.
 * Sin red real: cloudClient/syncService mockados o SQLite en memoria.
 * No toca PROD.
 */

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');

const JWT_SECRET = process.env.JWT_SECRET || 'clinica-odontologica-secret-2026';

jest.mock('../database', () => ({
  prepare: (sql) => {
    const d = globalThis.__C425_LOCAL_DB;
    if (!d) throw new Error('local test db not ready');
    return d.prepare(sql);
  },
  exec: (sql) => {
    const d = globalThis.__C425_LOCAL_DB;
    if (!d) throw new Error('local test db not ready');
    return d.exec(sql);
  },
}));

jest.mock('../cloudClient', () => ({
  isConfigured: () => globalThis.__C425_CLOUD !== false,
  execute: async (stmt) => {
    const d = globalThis.__C425_REMOTE_DB;
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

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
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
  globalThis.__C425_LOCAL_DB = local;
  globalThis.__C425_REMOTE_DB = remote;
  globalThis.__C425_CLOUD = true;
  jest.resetModules();
  return { local, remote };
}

async function withSyncRouter(fn, opts = {}) {
  const { createSyncRouter } = require('../sync/syncRoutes');
  const router = createSyncRouter({ includeClean: false, ...opts });
  const app = express();
  app.use(express.json());
  app.use('/api/sync', router);
  const { server, port } = await listen(app);
  try {
    return await fn(port);
  } finally {
    server.close();
  }
}

afterEach(() => {
  globalThis.__C425_LOCAL_DB = null;
  globalThis.__C425_REMOTE_DB = null;
  globalThis.__C425_CLOUD = true;
  jest.resetModules();
});

describe('POST /api/sync/push — bootstrap pendiente', () => {
  const token = tokenFor('admin');

  test('last_sync NULL + push normal → 409 BOOTSTRAP_PENDING (sin push)', async () => {
    freshPair({ lastSyncAt: null });
    const result = await withSyncRouter(async (port) => {
      return request(port, { method: 'POST', path: '/api/sync/push', token, body: {} });
    });
    expect(result.status).toBe(409);
    expect(result.body.error).toBe('BOOTSTRAP_PENDING');
    expect(result.body.code).toBe('BOOTSTRAP_PENDING');
    expect(remoteEmpty('pacientes')).toBe(true);
  });

  test('last_sync NULL + admitLocalPush=true en A1 → 409, jamás push', async () => {
    freshPair({ lastSyncAt: null });
    const result = await withSyncRouter(async (port) => {
      return request(port, {
        method: 'POST',
        path: '/api/sync/push',
        token,
        body: { admitLocalPush: true },
      });
    });
    expect(result.status).toBe(409);
    expect(result.body.error).toBe('BOOTSTRAP_A1_PULL_ONLY');
    expect(remoteEmpty('pacientes')).toBe(true);
  });

  test('last_sync NULL + admitLocalPush=true en A2 → push permitido (solo datos locales)', async () => {
    freshPair({ lastSyncAt: null });
    globalThis.__C425_LOCAL_DB.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (1, ?, ?, ?)'
    ).run('local-a2', '2026-01-01T10:00:00', '2026-01-01T10:00:00');
    const result = await withSyncRouter(async (port) => {
      return request(port, {
        method: 'POST',
        path: '/api/sync/push',
        token,
        body: { admitLocalPush: true },
      });
    });
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(remoteEmpty('pacientes')).toBe(false);
    // push no avanza cursor
    expect(syncLast(null)).toBeNull();
  });

  test('last_sync NULL + admitLocalPush=false (explícito) → 409', async () => {
    freshPair({ lastSyncAt: null });
    const result = await withSyncRouter(async (port) => {
      return request(port, {
        method: 'POST',
        path: '/api/sync/push',
        token,
        body: { admitLocalPush: false },
      });
    });
    expect(result.status).toBe(409);
    expect(result.body.error).toBe('BOOTSTRAP_PENDING');
  });

  test('con cursor existente → push incremental permitido', async () => {
    freshPair({ lastSyncAt: '2026-01-01T00:00:00' });
    const result = await withSyncRouter(async (port) => {
      return request(port, { method: 'POST', path: '/api/sync/push', token, body: {} });
    });
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
  });

  test('rebootstrap invalida cursor y el siguiente push queda bloqueado', async () => {
    freshPair({ lastSyncAt: '2026-01-01T00:00:00' });
    const after = await withSyncRouter(async (port) => {
      const reb = await request(port, {
        method: 'POST',
        path: '/api/sync/rebootstrap',
        token,
        body: { reason: 'restore' },
      });
      const push = await request(port, {
        method: 'POST',
        path: '/api/sync/push',
        token,
        body: {},
      });
      return { reb, push };
    });
    expect(after.reb.status).toBe(200);
    expect(after.reb.body.success).toBe(true);
    expect(after.push.status).toBe(409);
    expect(after.push.body.error).toBe('BOOTSTRAP_PENDING');
  });
});

function remoteSeedRow() {
  globalThis.__C425_REMOTE_DB.prepare(
    'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (1, ?, ?, ?)'
  ).run('remoto', '2026-01-01T10:00:00', '2026-01-01T10:00:00');
}

function remoteEmpty(table) {
  const row = globalThis.__C425_REMOTE_DB.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get();
  return Number(row.c) === 0;
}

function remoteCount(table) {
  const row = globalThis.__C425_REMOTE_DB.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get();
  return Number(row.c);
}

function syncLast(_expectNull) {
  try {
    const row = globalThis.__C425_LOCAL_DB.prepare('SELECT last_sync_at FROM sync_state WHERE id = 1').get();
    return row ? row.last_sync_at : null;
  } catch {
    return null;
  }
}

describe('POST /api/exportacion/importar-db — bootstrap gate puntual', () => {
  test('nube + bootstrap pendiente → 409, no entra a multer ni escribe clínico', async () => {
    freshPair({ lastSyncAt: null });
    globalThis.__C425_CLOUD = true;
    jest.resetModules();

    const { requireBootstrapIfCloud } = require('../middleware/bootstrapGate');
    const app = express();
    app.use(express.json());
    app.post('/api/exportacion/importar-db', requireBootstrapIfCloud, (req, res) => {
      res.json({ ok: true, wrote: true });
    });
    const { server, port } = await listen(app);
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/exportacion/importar-db',
        body: {},
      });
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('BOOTSTRAP_PENDING');
      expect(r.body.wrote).toBeUndefined();
      const c = globalThis.__C425_LOCAL_DB.prepare('SELECT COUNT(*) AS c FROM pacientes').get();
      expect(Number(c.c)).toBe(0);
    } finally {
      server.close();
    }
  });

  test('bootstrap completado → importación administrativa permitida (sigue next)', async () => {
    freshPair({ lastSyncAt: '2026-01-01T00:00:00' });
    globalThis.__C425_CLOUD = true;
    jest.resetModules();
    const { requireBootstrapIfCloud } = require('../middleware/bootstrapGate');
    const app = express();
    app.use(express.json());
    app.post('/api/exportacion/importar-db', requireBootstrapIfCloud, (req, res) => {
      res.json({ ok: true });
    });
    const { server, port } = await listen(app);
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/exportacion/importar-db',
        body: {},
      });
      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);
    } finally {
      server.close();
    }
  });

  test('sin nube (local) → importación permitida', async () => {
    freshPair({ lastSyncAt: null });
    globalThis.__C425_CLOUD = false;
    jest.resetModules();
    const { requireBootstrapIfCloud } = require('../middleware/bootstrapGate');
    const app = express();
    app.use(express.json());
    app.post('/api/exportacion/importar-db', requireBootstrapIfCloud, (req, res) => {
      res.json({ ok: true });
    });
    const { server, port } = await listen(app);
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/exportacion/importar-db',
        body: {},
      });
      expect(r.status).toBe(200);
    } finally {
      server.close();
    }
  });
});

describe('backup — operación administrativa C3 (fuera de bootstrapGate)', () => {
  const { requireDevOrReject, requireDevSafeUrlOrReject } = require('../utils/envGuard');
  const originalEnv = process.env.TURSO_ENV;
  const originalUrl = process.env.TURSO_URL;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TURSO_ENV;
    else process.env.TURSO_ENV = originalEnv;
    if (originalUrl === undefined) delete process.env.TURSO_URL;
    else process.env.TURSO_URL = originalUrl;
  });

  test('importDb: TURSO_ENV ausente → 403 (guard C3 intacto)', () => {
    delete process.env.TURSO_ENV;
    const res = mockRes();
    expect(requireDevOrReject({}, res, 'importDb')).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('cleanAll: TURSO_ENV ausente → 403 (guard C3 intacto)', () => {
    delete process.env.TURSO_ENV;
    const res = mockRes();
    expect(requireDevSafeUrlOrReject({}, res, 'cleanAll')).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('routes/backup no usa withBootstrapGate (decisión administrativa)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../routes/backup.js'), 'utf8');
    expect(src).not.toMatch(/withBootstrapGate/);
    expect(src).not.toMatch(/requireBootstrapIfCloud/);
    expect(src).toMatch(/require\('\.\.\/middleware\/auth'\)/);
  });

  test('backup importDb sigue exigiendo DEV en controller', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../controllers/backupController.js'), 'utf8');
    expect(src).toMatch(/requireDevOrReject\(req, res, 'importDb'\)/);
    expect(src).toMatch(/requireDevSafeUrlOrReject\(req, res, 'cleanAll'\)/);
  });
});

describe('seedPolicy — PROD / DEV / local', () => {
  const { shouldSeedClinical, isProdCloudConfigured } = require('../utils/seedPolicy');
  const originalEnv = process.env.TURSO_ENV;
  const originalUrl = process.env.TURSO_URL;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TURSO_ENV;
    else process.env.TURSO_ENV = originalEnv;
    if (originalUrl === undefined) delete process.env.TURSO_URL;
    else process.env.TURSO_URL = originalUrl;
  });

  test('local sin TURSO_URL → seed clínico SÍ', () => {
    delete process.env.TURSO_URL;
    delete process.env.TURSO_ENV;
    expect(shouldSeedClinical()).toBe(true);
    expect(isProdCloudConfigured()).toBe(false);
  });

  test('nube DEV explícita (TURSO_ENV=dev) → seed clínico SÍ', () => {
    process.env.TURSO_URL = 'libsql://clinica-db-dev-charles-pv.aws-us-west-2.turso.io';
    process.env.TURSO_ENV = 'dev';
    expect(shouldSeedClinical()).toBe(true);
    expect(isProdCloudConfigured()).toBe(false);
  });

  test('nube sin TURSO_ENV (fail-safe PROD) → seed clínico NO', () => {
    process.env.TURSO_URL = 'libsql://clinica-db-dev-charles-pv.aws-us-west-2.turso.io';
    delete process.env.TURSO_ENV;
    expect(shouldSeedClinical()).toBe(false);
    expect(isProdCloudConfigured()).toBe(true);
  });

  test('TURSO_ENV=prod + URL → seed clínico NO', () => {
    process.env.TURSO_URL = 'libsql://clinica-db-charles-pv.aws-us-west-2.turso.io';
    process.env.TURSO_ENV = 'prod';
    expect(shouldSeedClinical()).toBe(false);
    expect(isProdCloudConfigured()).toBe(true);
  });

  test('TURSO_ENV=dev + hostname etiqueta prod → seed clínico NO', () => {
    process.env.TURSO_URL = 'libsql://clinica-db-prod.turso.io';
    process.env.TURSO_ENV = 'dev';
    expect(shouldSeedClinical()).toBe(false);
    expect(isProdCloudConfigured()).toBe(true);
  });
});

describe('bootstrap A1/A2 — jamás push sin admisión (syncService)', () => {
  test('A1 fullSync: push skipped A1_pull_only_no_push', async () => {
    freshPair({ lastSyncAt: null });
    remoteSeedRow();
    const sync = require('../sync/syncService');
    const result = await sync.fullSync();
    expect(result.bootstrap).toBe(true);
    expect(result.classification.scenario).toBe('A1_empty');
    expect(result.push.skipped).toBe(true);
    expect(result.push.reason).toBe('A1_pull_only_no_push');
    expect(remoteEmpty('pacientes')).toBe(false); // solo pull
  });

  test('A2 fullSync sin admitLocalPush: push skipped A2_bootstrap_push_prohibited', async () => {
    freshPair({ lastSyncAt: null });
    globalThis.__C425_LOCAL_DB.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (5, ?, ?, ?)'
    ).run('local', '2026-01-01T10:00:00', '2026-01-01T10:00:00');
    const sync = require('../sync/syncService');
    const result = await sync.fullSync();
    expect(result.classification.scenario).toBe('A2_with_data');
    expect(result.push.skipped).toBe(true);
    expect(result.push.reason).toBe('A2_bootstrap_push_prohibited');
    expect(remoteEmpty('pacientes')).toBe(true);
  });

  test('A2 bootstrapSync con admitLocalPush=true → push corre', async () => {
    freshPair({ lastSyncAt: null });
    globalThis.__C425_LOCAL_DB.prepare(
      'INSERT INTO pacientes (id, nombre, created_at, updated_at) VALUES (5, ?, ?, ?)'
    ).run('local-admit', '2026-01-01T10:00:00', '2026-01-01T10:00:00');
    const sync = require('../sync/syncService');
    const result = await sync.bootstrapSync(Date.now(), { admitLocalPush: true });
    expect(result.classification.scenario).toBe('A2_with_data');
    expect(result.push.skipped).toBeUndefined();
    expect(result.push.pushed.pacientes).toBe(1);
    expect(remoteEmpty('pacientes')).toBe(false);
  });
});
