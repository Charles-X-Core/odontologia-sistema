/**
 * Proyecto 2 — GET /api/sync/cloud-status: diagnóstico de nube pre-bootstrap.
 *
 * Prueba que la consulta es solo-lectura, distingue vacía/con-datos/
 * no-configurada/error-conexión/tabla-faltante, y jamás toca SQLite local.
 *
 * Sin red real, sin PROD. cloudClient mockeado por modo; node:sqlite
 * espiado (cualquier apertura real fallaría el test).
 */

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'clinica-odontologica-secret-2026';

const SAVED_ENV = {};
for (const k of ['TURSO_URL']) {
  SAVED_ENV[k] = process.env[k];
}

const SYNC_TABLES = [
  'pacientes', 'historias_clinicas', 'consultas', 'odontogramas',
  'tratamientos', 'recetas', 'citas', 'pagos',
  'necesidades_odontologicas', 'imagenes'
];

// Modos: empty | data | fail | missing-table
jest.mock('../cloudClient', () => ({
  isConfigured: () => Boolean(process.env.TURSO_URL),
  execute: async (stmt) => {
    const s = typeof stmt === 'string' ? { sql: stmt, args: [] } : { sql: stmt.sql, args: stmt.args || [] };
    globalThis.__CS_SQLS.push(s.sql);
    const mode = globalThis.__CS_MODE || 'empty';
    if (mode === 'fail') throw new Error('connect timeout (simulado)');
    const m = s.sql.match(/FROM\s+(\w+)/i);
    const table = m ? m[1] : '';
    if (table === 'sqlite_master') return { rows: [{ c: 20 }], rowsAffected: 0, lastInsertRowid: 0 };
    if (table === 'sync_state' || table === 'sync_tombstones') {
      return { rows: [{ c: 0 }], rowsAffected: 0, lastInsertRowid: 0 };
    }
    if (mode === 'missing-table' && table === 'imagenes') {
      throw new Error('no such table: imagenes (simulado)');
    }
    const counts = mode === 'data'
      ? { pacientes: 3, consultas: 2 }
      : {};
    return { rows: [{ c: counts[table] || 0 }], rowsAffected: 0, lastInsertRowid: 0 };
  },
}));

jest.mock('node:sqlite', () => ({
  DatabaseSync: jest.fn(() => {
    throw new Error('SQLITE_OPEN_ATTEMPT: cloud-status no debe abrir SQLite');
  }),
}));

function sqliteOpenAttempts() {
  const { DatabaseSync } = require('node:sqlite');
  return DatabaseSync.mock.calls.length;
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

function request(port, { method, path, token }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    req.end();
  });
}

function setup(mode, { tursoUrl = 'libsql://dummy-cloud-status.turso.io' } = {}) {
  if (tursoUrl === null) delete process.env.TURSO_URL;
  else process.env.TURSO_URL = tursoUrl;
  globalThis.__CS_MODE = mode;
  globalThis.__CS_SQLS = [];
  jest.resetModules();
  return require('../sync/syncService');
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
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('getCloudStatus — diagnóstico solo-lectura', () => {
  test('1. nube vacía → empty y 10 tablas con 0', async () => {
    const sync = setup('empty');
    const r = await sync.getCloudStatus();
    expect(r.success).toBe(true);
    expect(r.data.cloud).toBe('empty');
    expect(r.data.isConfigured).toBe(true);
    expect(r.data.totalRows).toBe(0);
    for (const t of SYNC_TABLES) {
      expect(r.data.tables[t]).toEqual({ rows: 0, state: 'ok' });
    }
    expect(r.data.hasSyncState).toBe(true);
    expect(r.data.hasTombstones).toBe(true);
    expect(r.data.error).toBeNull();
  });

  test('2. nube con datos → with-data y totalRows correcto', async () => {
    const sync = setup('data');
    const r = await sync.getCloudStatus();
    expect(r.success).toBe(true);
    expect(r.data.cloud).toBe('with-data');
    expect(r.data.totalRows).toBe(5);
    expect(r.data.tables.pacientes).toEqual({ rows: 3, state: 'ok' });
    expect(r.data.tables.consultas).toEqual({ rows: 2, state: 'ok' });
  });

  test('3. fallo de execute/conexión → error, nunca empty', async () => {
    const sync = setup('fail');
    const r = await sync.getCloudStatus();
    expect(r.data.cloud).toBe('error');
    expect(r.data.cloud).not.toBe('empty');
    expect(r.data.error).toMatch(/connect timeout/);
    expect(r.data.totalRows).toBe(0);
  });

  test('4. tabla faltante → partial (no error global)', async () => {
    const sync = setup('missing-table');
    const r = await sync.getCloudStatus();
    expect(r.success).toBe(true);
    expect(r.data.cloud).toBe('partial');
    expect(r.data.tables.imagenes).toEqual({ rows: 0, state: 'missing' });
    expect(r.data.tables.pacientes.state).toBe('ok');
  });

  test('5. TURSO_URL ausente → unconfigured y 0 llamadas a execute', async () => {
    const sync = setup('empty', { tursoUrl: null });
    const r = await sync.getCloudStatus();
    expect(r.success).toBe(true);
    expect(r.data.cloud).toBe('unconfigured');
    expect(r.data.isConfigured).toBe(false);
    expect(r.data.totalRows).toBe(0);
    expect(globalThis.__CS_SQLS).toEqual([]);
  });

  test('6. todas las sentencias ejecutadas son SELECT', async () => {
    const sync = setup('data');
    await sync.getCloudStatus();
    expect(globalThis.__CS_SQLS.length).toBeGreaterThan(0);
    for (const sql of globalThis.__CS_SQLS) {
      expect(sql.trim().toUpperCase().startsWith('SELECT')).toBe(true);
    }
  });

  test('7. no se toca SQLite/DatabaseSync en ningún modo', async () => {
    for (const mode of ['empty', 'data', 'fail', 'missing-table']) {
      const sync = setup(mode);
      await sync.getCloudStatus();
    }
    const unconfigured = setup('empty', { tursoUrl: null });
    await unconfigured.getCloudStatus();
    expect(sqliteOpenAttempts()).toBe(0);
  });
});

describe('GET /api/sync/cloud-status — ruta', () => {
  test('8. devuelve 401 sin autenticación', async () => {
    process.env.TURSO_URL = 'libsql://dummy-cloud-status.turso.io';
    globalThis.__CS_MODE = 'empty';
    globalThis.__CS_SQLS = [];
    const { server, port } = await mountFresh();
    try {
      const r = await request(port, { method: 'GET', path: '/api/sync/cloud-status' });
      expect(r.status).toBe(401);
    } finally {
      await closeServer(server);
    }
  });

  test('9. devuelve 200 con autenticación y diagnóstico empty', async () => {
    process.env.TURSO_URL = 'libsql://dummy-cloud-status.turso.io';
    globalThis.__CS_MODE = 'empty';
    globalThis.__CS_SQLS = [];
    const { server, port } = await mountFresh();
    try {
      const r = await request(port, {
        method: 'GET',
        path: '/api/sync/cloud-status',
        token: tokenFor('admin'),
      });
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.data.cloud).toBe('empty');
      expect(Object.keys(r.body.data.tables)).toHaveLength(10);
    } finally {
      await closeServer(server);
    }
  });
});
