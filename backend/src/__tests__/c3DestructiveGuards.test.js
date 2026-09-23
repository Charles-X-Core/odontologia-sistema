/**
 * C3 — Blindaje de operaciones destructivas (sync/clean, dev-reset, backup/clean).
 * Sin red: no contacta Turso ni PROD. SQLite local mockeada cuando hace falta.
 */

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');

const JWT_SECRET = process.env.JWT_SECRET || 'clinica-odontologica-secret-2026';

jest.mock('../database', () => ({
  prepare: (sql) => {
    const d = globalThis.__C3_LOCAL_DB;
    if (!d) throw new Error('c3 local test db not ready');
    return d.prepare(sql);
  },
}));

jest.mock('../cloudClient', () => ({
  isConfigured: () => false,
  execute: async () => {
    throw new Error('cloud must not be called in C3 tests');
  },
}));

jest.mock('../db', () => ({
  prepare: jest.fn(() => ({
    run: jest.fn(async () => ({ rows: [], rowsAffected: 0 })),
  })),
}));

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function tokenFor(rol) {
  return jwt.sign(
    { id: 1, email: rol === 'admin' ? 'admin' : 'doctor', rol },
    JWT_SECRET,
    { expiresIn: '5m' }
  );
}

async function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
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

function freshLocalDb() {
  const db = new DatabaseSync(':memory:');
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
    CREATE TABLE IF NOT EXISTS pacientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, email TEXT, password TEXT, rol TEXT
    );
  `);
  globalThis.__C3_LOCAL_DB = db;
  return db;
}

let savedEnv;
beforeAll(() => {
  savedEnv = {
    TURSO_ENV: process.env.TURSO_ENV,
    TURSO_URL: process.env.TURSO_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    VERCEL: process.env.VERCEL,
    JWT_SECRET: process.env.JWT_SECRET,
  };
});

afterAll(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

afterEach(() => {
  globalThis.__C3_LOCAL_DB = null;
});

describe('envGuard — requireDevSafeUrlOrReject', () => {
  const { requireDevOrReject, requireDevSafeUrlOrReject } = require('../utils/envGuard');

  test('PROD (o TURSO_ENV ausente) → 403', async () => {
    await withEnv({ TURSO_ENV: undefined }, () => {
      const res = mockRes();
      expect(requireDevSafeUrlOrReject({}, res, 'cleanAll')).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
    });
    await withEnv({ TURSO_ENV: 'prod' }, () => {
      const res = mockRes();
      expect(requireDevSafeUrlOrReject({}, res, 'cleanAll')).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  test('DEV + URL sin etiqueta prod → permitido', async () => {
    await withEnv(
      {
        TURSO_ENV: 'dev',
        TURSO_URL: 'libsql://clinica-db-dev-charles-pv.aws-us-west-2.turso.io',
      },
      () => {
        const res = mockRes();
        expect(requireDevSafeUrlOrReject({}, res, 'cleanAll')).toBe(true);
        expect(res.status).not.toHaveBeenCalled();
      }
    );
  });

  test('TURSO_ENV=dev + URL PROD clara → 403 (sin inventar hostnames)', async () => {
    await withEnv(
      { TURSO_ENV: 'dev', TURSO_URL: 'libsql://clinica-db-prod.turso.io' },
      () => {
        const res = mockRes();
        expect(requireDevSafeUrlOrReject({}, res, 'cleanAll')).toBe(false);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ error: expect.stringContaining('cleanAll') })
        );
      }
    );
    await withEnv({ TURSO_ENV: 'dev', TURSO_URL: 'libsql://prod-clinica.turso.io' }, () => {
      const res = mockRes();
      expect(requireDevSafeUrlOrReject({}, res, 'cleanAll')).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  test('DEV + sin TURSO_URL → 403', async () => {
    await withEnv({ TURSO_ENV: 'dev', TURSO_URL: undefined }, () => {
      const res = mockRes();
      expect(requireDevSafeUrlOrReject({}, res, 'cleanAll')).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  test('DEV + URL inválida → 403', async () => {
    await withEnv({ TURSO_ENV: 'dev', TURSO_URL: 'not-a-url'}, () => {
      const res = mockRes();
      expect(requireDevSafeUrlOrReject({}, res, 'cleanAll')).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  test('requireDevOrReject sigue existiendo y bloquea PROD', async () => {
    await withEnv({ TURSO_ENV: 'prod' }, () => {
      const res = mockRes();
      expect(requireDevOrReject({}, res, 'importDb')).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});

describe('POST /api/sync/clean', () => {
  async function buildApp({ includeClean = true } = {}) {
    const { createSyncRouter } = require('../sync/syncRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/sync', createSyncRouter({ includeClean }));
    if (!includeClean) {
      app.use((req, res) => res.status(404).json({ error: 'Endpoint no encontrado' }));
    }
    return app;
  }

  test('sin token → 401 (ruta sigue autenticada)', async () => {
    await withEnv({ TURSO_ENV: 'dev' }, async () => {
      freshLocalDb();
      const app = await buildApp();
      const { server, port } = await listen(app);
      try {
        const r = await request(port, {
          method: 'POST',
          path: '/api/sync/clean',
          body: { confirmation: 'BORRAR TODO' },
        });
        expect(r.status).toBe(401);
      } finally {
        server.close();
      }
    });
  });

  test('PROD → 403 antes de borrar (admin + confirmación válidas)', async () => {
    await withEnv({ TURSO_ENV: 'prod' }, async () => {
      const db = freshLocalDb();
      db.prepare(
        "INSERT INTO pacientes (nombre, created_at, updated_at) VALUES ('x', '2026-01-01', '2026-01-01')"
      ).run();
      const app = await buildApp();
      const { server, port } = await listen(app);
      try {
        const r = await request(port, {
          method: 'POST',
          path: '/api/sync/clean',
          token: tokenFor('admin'),
          body: { confirmation: 'BORRAR TODO' },
        });
        expect(r.status).toBe(403);
        expect(Number(db.prepare('SELECT COUNT(*) c FROM pacientes').get().c)).toBe(1);
      } finally {
        server.close();
      }
    });
  });

  test('DEV + doctor → 403 (requireRole admin)', async () => {
    await withEnv({ TURSO_ENV: 'dev' }, async () => {
      freshLocalDb();
      const app = await buildApp();
      const { server, port } = await listen(app);
      try {
        const r = await request(port, {
          method: 'POST',
          path: '/api/sync/clean',
          token: tokenFor('odontologo'),
          body: { confirmation: 'BORRAR TODO' },
        });
        expect(r.status).toBe(403);
      } finally {
        server.close();
      }
    });
  });

  test('DEV + admin + confirmación incorrecta → 400', async () => {
    await withEnv({ TURSO_ENV: 'dev' }, async () => {
      freshLocalDb();
      const app = await buildApp();
      const { server, port } = await listen(app);
      try {
        const r = await request(port, {
          method: 'POST',
          path: '/api/sync/clean',
          token: tokenFor('admin'),
          body: { confirmation: 'si' },
        });
        expect(r.status).toBe(400);
      } finally {
        server.close();
      }
    });
  });

  test('DEV + admin + confirmación válida → 200 y borra tablas CLEAN', async () => {
    await withEnv({ TURSO_ENV: 'dev' }, async () => {
      const db = freshLocalDb();
      db.prepare(
        "INSERT INTO pacientes (nombre, created_at, updated_at) VALUES ('x', '2026-01-01', '2026-01-01')"
      ).run();
      const app = await buildApp();
      const { server, port } = await listen(app);
      try {
        const r = await request(port, {
          method: 'POST',
          path: '/api/sync/clean',
          token: tokenFor('admin'),
          body: { confirmation: 'BORRAR TODO' },
        });
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ success: true });
        expect(Number(db.prepare('SELECT COUNT(*) c FROM pacientes').get().c)).toBe(0);
      } finally {
        server.close();
      }
    });
  });

  test('tabla fuera de CLEAN_TABLES → 400 y no borra usuarios', async () => {
    await withEnv({ TURSO_ENV: 'dev' }, async () => {
      const db = freshLocalDb();
      db.prepare(
        "INSERT INTO usuarios (nombre, email, password, rol) VALUES ('a','a','x','admin')"
      ).run();
      db.prepare(
        "INSERT INTO pacientes (nombre, created_at, updated_at) VALUES ('x', '2026-01-01', '2026-01-01')"
      ).run();
      const app = await buildApp();
      const { server, port } = await listen(app);
      try {
        const r = await request(port, {
          method: 'POST',
          path: '/api/sync/clean',
          token: tokenFor('admin'),
          body: { confirmation: 'BORRAR TODO', tables: ['usuarios'] },
        });
        expect(r.status).toBe(400);
        expect(r.body.error).toMatch(/CLEAN_TABLES/);
        expect(Number(db.prepare('SELECT COUNT(*) c FROM usuarios').get().c)).toBe(1);
        expect(Number(db.prepare('SELECT COUNT(*) c FROM pacientes').get().c)).toBe(1);
      } finally {
        server.close();
      }
    });
  });

  test('includeClean=false (Vercel) → /clean no montada (404)', async () => {
    await withEnv({ TURSO_ENV: 'dev' }, async () => {
      freshLocalDb();
      const app = await buildApp({ includeClean: false });
      const { server, port } = await listen(app);
      try {
        const r = await request(port, {
          method: 'POST',
          path: '/api/sync/clean',
          token: tokenFor('admin'),
          body: { confirmation: 'BORRAR TODO' },
        });
        expect(r.status).toBe(404);
      } finally {
        server.close();
      }
    });
  });

  test('cleanLocalData rechaza tablas fuera de whitelist (defensa en profundidad)', async () => {
    await withEnv({ TURSO_ENV: 'dev' }, () => {
      freshLocalDb();
      const syncService = require('../sync/syncService');
      expect(() => syncService.cleanLocalData(['usuarios'])).toThrow(/CLEAN_TABLES/);
      expect(() => syncService.cleanLocalData(['pacientes; DROP TABLE usuarios'])).toThrow(
        /CLEAN_TABLES/
      );
      expect(syncService.cleanLocalData(['pacientes'])).toEqual({ pacientes: 0 });
    });
  });
});

describe('POST /api/importacion/dev-reset', () => {
  async function buildApp() {
    const { auth } = require('../middleware/auth');
    const importacionRouter = require('../routes/importacion');
    const app = express();
    app.use(express.json());
    app.use('/api/importacion', auth, importacionRouter);
    return app;
  }

  test('sin token → 401', async () => {
    const app = await buildApp();
    const { server, port } = await listen(app);
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/importacion/dev-reset',
        body: { confirmation: 'BORRAR TODO' },
      });
      expect(r.status).toBe(401);
    } finally {
      server.close();
    }
  });

  test('PROD → 403 antes de cualquier DELETE', async () => {
    await withEnv({ TURSO_ENV: 'prod' }, async () => {
      const db = require('../db');
      db.prepare.mockClear();
      const app = await buildApp();
      const { server, port } = await listen(app);
      try {
        const r = await request(port, {
          method: 'POST',
          path: '/api/importacion/dev-reset',
          token: tokenFor('admin'),
          body: { confirmation: 'BORRAR TODO' },
        });
        expect(r.status).toBe(403);
        const deleteCalls = db.prepare.mock.calls.filter(
          ([sql]) => typeof sql === 'string' && /^\s*DELETE/i.test(sql)
        );
        expect(deleteCalls).toHaveLength(0);
      } finally {
        server.close();
      }
    });
  });

  test('DEV + doctor → 403 (role)', async () => {
    await withEnv({ TURSO_ENV: 'dev' }, async () => {
      const app = await buildApp();
      const { server, port } = await listen(app);
      try {
        const r = await request(port, {
          method: 'POST',
          path: '/api/importacion/dev-reset',
          token: tokenFor('odontologo'),
          body: { confirmation: 'BORRAR TODO' },
        });
        expect(r.status).toBe(403);
      } finally {
        server.close();
      }
    });
  });

  test('DEV + admin + confirmación incorrecta → 400 (sin DELETE)', async () => {
    await withEnv({ TURSO_ENV: 'dev' }, async () => {
      const db = require('../db');
      db.prepare.mockClear();
      const app = await buildApp();
      const { server, port } = await listen(app);
      try {
        const r = await request(port, {
          method: 'POST',
          path: '/api/importacion/dev-reset',
          token: tokenFor('admin'),
          body: { confirmation: 'nope' },
        });
        expect(r.status).toBe(400);
        const deleteCalls = db.prepare.mock.calls.filter(
          ([sql]) => typeof sql === 'string' && /^\s*DELETE/i.test(sql)
        );
        expect(deleteCalls).toHaveLength(0);
      } finally {
        server.close();
      }
    });
  });

  test('DEV + admin + confirmación válida → 200 (db mockeada)', async () => {
    await withEnv({ TURSO_ENV: 'dev' }, async () => {
      const app = await buildApp();
      const { server, port } = await listen(app);
      try {
        const r = await request(port, {
          method: 'POST',
          path: '/api/importacion/dev-reset',
          token: tokenFor('admin'),
          body: { confirmation: 'BORRAR TODO' },
        });
        expect(r.status).toBe(200);
        expect(r.body.mensaje || r.body.message).toMatch(/reiniciad/i);
      } finally {
        server.close();
      }
    });
  });
});

describe('POST /api/backup/clean', () => {
  async function buildApp() {
    const backupRouter = require('../routes/backup');
    const app = express();
    app.use(express.json());
    app.use('/api/backup', backupRouter);
    return app;
  }

  test('sin token → 401 (ruta sigue autenticada)', async () => {
    const app = await buildApp();
    const { server, port } = await listen(app);
    try {
      const r = await request(port, {
        method: 'POST',
        path: '/api/backup/clean',
        body: { confirmation: 'BORRAR TODO' },
      });
      expect(r.status).toBe(401);
    } finally {
      server.close();
    }
  });

  test('PROD → 403', async () => {
    await withEnv(
      { TURSO_ENV: 'prod', TURSO_URL: 'libsql://clinica-db-prod.turso.io' },
      async () => {
        const app = await buildApp();
        const { server, port } = await listen(app);
        try {
          const r = await request(port, {
            method: 'POST',
            path: '/api/backup/clean',
            token: tokenFor('admin'),
            body: { confirmation: 'BORRAR TODO' },
          });
          expect(r.status).toBe(403);
        } finally {
          server.close();
        }
      }
    );
  });

  test('TURSO_ENV=dev + URL PROD clara → 403 (no contacta red)', async () => {
    await withEnv(
      { TURSO_ENV: 'dev', TURSO_URL: 'libsql://clinica-db-prod.turso.io' },
      async () => {
        const app = await buildApp();
        const { server, port } = await listen(app);
        try {
          const r = await request(port, {
            method: 'POST',
            path: '/api/backup/clean',
            token: tokenFor('admin'),
            body: { confirmation: 'BORRAR TODO' },
          });
          expect(r.status).toBe(403);
        } finally {
          server.close();
        }
      }
    );
  });

  test('TURSO_ENV ausente → 403 (fail-safe PROD)', async () => {
    await withEnv({ TURSO_ENV: undefined, TURSO_URL: 'libsql://anything' }, async () => {
      const app = await buildApp();
      const { server, port } = await listen(app);
      try {
        const r = await request(port, {
          method: 'POST',
          path: '/api/backup/clean',
          token: tokenFor('admin'),
          body: { confirmation: 'BORRAR TODO' },
        });
        expect(r.status).toBe(403);
      } finally {
        server.close();
      }
    });
  });
});

describe('montaje Vercel — createSyncRouter', () => {
  test('includeClean=false no registra POST /clean', () => {
    const { createSyncRouter } = require('../sync/syncRoutes');
    const r = createSyncRouter({ includeClean: false });
    const paths = r.stack
      .filter((l) => l.route)
      .map((l) => `${Object.keys(l.route.methods).join(',')} ${l.route.path}`);
    expect(paths.some((p) => p.includes('/clean'))).toBe(false);
    expect(paths.some((p) => p.includes('/push'))).toBe(true);
    expect(paths.some((p) => p.includes('/full'))).toBe(true);
  });

  test('includeClean=true registra POST /clean', () => {
    const { createSyncRouter } = require('../sync/syncRoutes');
    const r = createSyncRouter({ includeClean: true });
    const paths = r.stack.filter((l) => l.route).map((l) => l.route.path);
    expect(paths).toContain('/clean');
  });
});
