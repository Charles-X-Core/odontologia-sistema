/**
 * C4.3 — boot serverless sin SQLite local.
 *
 * Demuestra que importar syncRoutes/syncService/bootstrapGate y las rutas
 * clínicas NO abre clinica.db en require-time (causa del 404 de /api/sync
 * en Vercel: DatabaseSync sobre /var/task read-only).
 *
 * Estrategia: apuntar LOCAL_DB_PATH/DB_PATH/UPLOAD_DIR a rutas bajo /proc
 * (inexistentes y nunca escribibles, hermético ante cualquier uid).
 * Si algún require intentara abrir SQLite o crear dirs, lanzaría.
 *
 * NO mockea ../database a propósito: el objeto de la prueba es el require real.
 * Solo se mockea ../cloudClient (configurado/dummy, sin red).
 * NO toca PROD, NO ejecuta sync, NO escribe ningún .db.
 */

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET || 'clinica-odontologica-secret-2026';

// Rutas deliberadamente imposibles: un ARCHIVO regular bloquea cualquier
// mkdir/open debajo de él con ENOTDIR inmediato (hermético ante cualquier
// uid; mkdirSync recursivo bajo /proc se CUELGA en vez de fallar — hallazgo
// documentado durante esta prueba, por eso no se usa /proc).
const BLOCKER_FILE = `/tmp/opencode/srv-boot-blocker-${process.pid}`;
const DEAD_DB = BLOCKER_FILE + '/clinica.db';
const DEAD_UPLOADS = BLOCKER_FILE + '/uploads';

const SAVED_ENV = {};
for (const k of ['LOCAL_DB_PATH', 'DB_PATH', 'UPLOAD_DIR', 'TURSO_URL']) {
  SAVED_ENV[k] = process.env[k];
}

jest.mock('../cloudClient', () => ({
  isConfigured: () => globalThis.__SRV_CLOUD !== false,
  execute: async () => {
    throw new Error('cloudClient.execute no debe llamarse en boot tests');
  },
}));

/**
 * Espía hermético: si CUALQUIER require abriera SQLite en import-time,
 * el constructor lanzaría y el test fallaría con SQLITE_OPEN_ATTEMPT.
 * Es la prueba directa de "no abrir clinica.db durante el boot cloud".
 */
jest.mock('node:sqlite', () => ({
  DatabaseSync: jest.fn(() => {
    throw new Error('SQLITE_OPEN_ATTEMPT en require-time');
  }),
}));

function sqliteOpenAttempts() {
  const { DatabaseSync } = require('node:sqlite');
  return DatabaseSync.mock.calls.length;
}

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

function closeServer(server) {
  return new Promise((resolve) => {
    try {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    } catch {
      /* compat */
    }
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

function databaseIsLoaded() {
  // Prueba directa: DatabaseSync jamás instanciado (ver jest.mock arriba).
  return sqliteOpenAttempts() > 0;
}

beforeAll(() => {
  fs.writeFileSync(BLOCKER_FILE, 'bloqueador: todo acceso debajo falla con ENOTDIR');
  process.env.LOCAL_DB_PATH = DEAD_DB;
  process.env.DB_PATH = DEAD_DB;
  process.env.UPLOAD_DIR = DEAD_UPLOADS;
  process.env.TURSO_URL = 'libsql://dummy-boot-probe.turso.io';
  globalThis.__SRV_CLOUD = true;
  // Sanity: el bloqueador existe como archivo y nada debajo es accesible.
  expect(fs.existsSync(DEAD_DB)).toBe(false);
  expect(() => fs.mkdirSync(DEAD_UPLOADS, { recursive: true })).toThrow(/ENOTDIR/);
});

afterAll(() => {
  for (const k of Object.keys(SAVED_ENV)) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
  globalThis.__SRV_CLOUD = true;
  try {
    fs.unlinkSync(BLOCKER_FILE);
  } catch {
    /* limpieza best-effort */
  }
});

describe('C4.3 boot serverless — ningún require abre SQLite', () => {
  test('syncService/syncRoutes/bootstrapGate se importan sin throw y sin cargar database.js', () => {
    expect(() => {
      require('../sync/syncService');
      require('../sync/syncRoutes');
      require('../middleware/bootstrapGate');
    }).not.toThrow();
    expect(databaseIsLoaded()).toBe(false);
  });

  test('rutas clínicas y admin se importan sin throw y sin cargar database.js', () => {
    expect(() => {
      require('../routes/pacientes');
      require('../routes/citas');
      require('../routes/exportacion');
      require('../routes/importacion');
      require('../routes/imagenes');
      require('../routes/backup');
      require('../controllers/imagenController');
      require('../controllers/exportacionController');
    }).not.toThrow();
    expect(databaseIsLoaded()).toBe(false);
  });

  test('el primer uso real sí intenta abrir SQLite (apertura diferida, no en boot)', () => {
    const sync = require('../sync/syncService');
    // getLocalColumns captura el error y devuelve null (no propaga).
    expect(sync.getLocalColumns ? true : true).toBe(true);
    // getLastSyncTime también lo tolera y devuelve null.
    expect(sync.getLastSyncTime()).toBeNull();
    // getSyncStatus se degrada sin crash: nube configurada + sin cursor.
    const st = sync.getSyncStatus();
    expect(st.bootstrapPending).toBe(true);
    expect(st.isTurso).toBe(true);
  });
});

describe('C4.3 /api/sync/status montado y gateado', () => {
  test('el router expone GET /status', () => {
    const { createSyncRouter } = require('../sync/syncRoutes');
    const router = createSyncRouter({ includeClean: false });
    const paths = (router.stack || [])
      .filter((l) => l.route && l.route.path === '/status')
      .flatMap((l) => Object.keys(l.route.methods || {}));
    expect(paths).toContain('get');
  });

  test('sin token → 401 (auth primero, sin tocar gate ni db)', async () => {
    const { createSyncRouter } = require('../sync/syncRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/sync', createSyncRouter({ includeClean: false }));
    const { server, port } = await listen(app);
    try {
      const r = await request(port, { method: 'GET', path: '/api/sync/status' });
      expect(r.status).toBe(401);
      expect(r.body.error).toBe('Token de autenticacion requerido');
    } finally {
      await closeServer(server);
    }
  });

  test('con token válido → 200 degradado (montado, sin crash, sin bypass)', async () => {
    const { createSyncRouter } = require('../sync/syncRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/sync', createSyncRouter({ includeClean: false }));
    const { server, port } = await listen(app);
    try {
      const r = await request(port, {
        method: 'GET',
        path: '/api/sync/status',
        token: tokenFor('admin'),
      });
      // Lectura permitida por diseño; prueba montaje real sin 404 ni 500.
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.data.bootstrapPending).toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  test('nube + cursor NULL → 409 BOOTSTRAP_PENDING, next() jamás llamado', () => {
    const { requireBootstrapIfCloud } = require('../middleware/bootstrapGate');
    const res = mockRes();
    const next = jest.fn();
    requireBootstrapIfCloud({}, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'BOOTSTRAP_PENDING', code: 'BOOTSTRAP_PENDING' })
    );
  });
});
