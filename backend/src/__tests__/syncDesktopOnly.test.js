/**
 * C4.3 opción A — Vercel no es Desktop: las operaciones de sync con pata
 * local (full/push/pull/rebootstrap/admit-replica) se bloquean con 409
 * SYNC_DESKTOP_ONLY cuando process.env.VERCEL está presente, ANTES de
 * tocar syncService, cloudClient o SQLite. GET /status sigue abierto.
 *
 * Demuestra:
 *  A. VERCEL=1 → 409 exacto en las 5 rutas POST;
 *  B. cero constructions de DatabaseSync, cero queries cloud, cero cambios;
 *  C. GET /status funciona en Vercel;
 *  D. sin VERCEL el comportamiento es el anterior (409 BOOTSTRAP_PENDING);
 *  E. admit-replica ya no puede dar falso success en Vercel.
 *
 * Sin red real, sin PROD. Solo localhost + :memory:.
 */

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET || 'clinica-odontologica-secret-2026';

const SAVED_ENV = {};
for (const k of ['VERCEL', 'LOCAL_DB_PATH', 'DB_PATH', 'UPLOAD_DIR', 'TURSO_URL']) {
  SAVED_ENV[k] = process.env[k];
}

// Contador hermético de queries cloud (debe quedar en 0 bajo VERCEL).
jest.mock('../cloudClient', () => ({
  isConfigured: () => globalThis.__DSO_CLOUD !== false,
  execute: async (stmt) => {
    globalThis.__DSO_CLOUD_CALLS.push(typeof stmt === 'string' ? stmt : stmt.sql);
    throw new Error('cloudClient.execute no debe llamarse bajo VERCEL');
  },
}));

// Wrapper que cuenta constructions de DatabaseSync delegando al real.
// Permite :memory: en el caso sin-VERCEL y prueba 0 aperturas con VERCEL.
jest.mock('node:sqlite', () => {
  const actual = jest.requireActual('node:sqlite');
  globalThis.__DSO_SQLITE_CALLS = globalThis.__DSO_SQLITE_CALLS || [];
  function DatabaseSync(...args) {
    globalThis.__DSO_SQLITE_CALLS.push(args);
    return new actual.DatabaseSync(...args);
  }
  return { DatabaseSync };
});

function sqliteCalls() {
  return globalThis.__DSO_SQLITE_CALLS.length;
}

function cloudCalls() {
  return globalThis.__DSO_CLOUD_CALLS.length;
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

// Bloqueador: archivo regular; todo acceso debajo falla ENOTDIR inmediato.
const BLOCKER = `/tmp/opencode/dso-blocker-${process.pid}`;
const DEAD_DB = `${BLOCKER}/clinica.db`;

function setVercelEnv() {
  fs.writeFileSync(BLOCKER, 'bloqueador ENOTDIR');
  process.env.VERCEL = '1';
  process.env.LOCAL_DB_PATH = DEAD_DB;
  process.env.DB_PATH = DEAD_DB;
  process.env.TURSO_URL = 'libsql://dummy-dso.turso.io';
  globalThis.__DSO_CLOUD = true;
  globalThis.__DSO_CLOUD_CALLS = [];
  globalThis.__DSO_SQLITE_CALLS = [];
}

function setDesktopEnv() {
  process.env.VERCEL = '';
  delete process.env.VERCEL;
  process.env.LOCAL_DB_PATH = ':memory:';
  process.env.DB_PATH = ':memory:';
  delete process.env.TURSO_URL;
  globalThis.__DSO_CLOUD = true;
  globalThis.__DSO_CLOUD_CALLS = [];
  globalThis.__DSO_SQLITE_CALLS = [];
}

async function mountFresh() {
  jest.resetModules();
  const { createSyncRouter } = require('../sync/syncRoutes');
  const app = express();
  app.use(express.json());
  app.use('/api/sync', createSyncRouter({ includeClean: false }));
  return listen(app);
}

afterEach(() => {
  for (const k of Object.keys(SAVED_ENV)) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
  globalThis.__DSO_CLOUD = true;
  jest.resetModules();
  jest.restoreAllMocks();
});

afterAll(() => {
  try {
    fs.unlinkSync(BLOCKER);
  } catch { /* limpieza best-effort */ }
});

const BLOCKED_ROUTES = [
  ['POST', '/api/sync/full', {}],
  ['POST', '/api/sync/push', {}],
  ['POST', '/api/sync/push', { admitLocalPush: true }],
  ['POST', '/api/sync/pull', {}],
  ['POST', '/api/sync/rebootstrap', { reason: 'x' }],
  ['POST', '/api/sync/admit-replica', {}],
  ['POST', '/api/sync/admit-replica', { admitLocalPush: true }],
];

describe('C4.3 opción A — VERCEL=1 bloquea sync con pata local', () => {
  test.each(BLOCKED_ROUTES)('%s %s %j → 409 SYNC_DESKTOP_ONLY, cero SQLite, cero cloud', async (method, path, body) => {
    setVercelEnv();
    const { server, port } = await mountFresh();
    try {
      const r = await request(port, { method, path, token: tokenFor('admin'), body });
      expect(r.status).toBe(409);
      expect(r.body).toEqual({
        success: false,
        error: 'SYNC_DESKTOP_ONLY',
        code: 'SYNC_DESKTOP_ONLY',
        message: 'Las operaciones de sincronización requieren el almacenamiento SQLite local del Desktop.',
      });
      expect(sqliteCalls()).toBe(0);
      expect(cloudCalls()).toBe(0);
    } finally {
      await closeServer(server);
    }
  });

  test('GET /status sigue funcionando en Vercel (sin bloqueo, sin crash)', async () => {
    setVercelEnv();
    const { server, port } = await mountFresh();
    try {
      const r = await request(port, { method: 'GET', path: '/api/sync/status', token: tokenFor('admin') });
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  test('sin token en Vercel → 401 de auth antes del guard (sin tocar nada)', async () => {
    setVercelEnv();
    const { server, port } = await mountFresh();
    try {
      const r = await request(port, { method: 'POST', path: '/api/sync/full', body: {} });
      expect(r.status).toBe(401);
      expect(sqliteCalls()).toBe(0);
      expect(cloudCalls()).toBe(0);
    } finally {
      await closeServer(server);
    }
  });
});

describe('C4.3 opción A — sin VERCEL el comportamiento no cambia', () => {
  test('POST /push con cursor NULL → 409 BOOTSTRAP_PENDING (ruta anterior intacta)', async () => {
    setDesktopEnv();
    const { server, port } = await mountFresh();
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/sync/push',
        token: tokenFor('admin'),
        body: {},
      });
      expect(r.status).toBe(409);
      expect(r.body.error).toBe('BOOTSTRAP_PENDING');
      expect(cloudCalls()).toBe(0);
    } finally {
      await closeServer(server);
    }
  });
});
