/**
 * C1 — auth local: login con usuarios seed en SQLite local (DB_MODE=local).
 * No toca red ni Turso.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('auth local (DB_MODE=local)', () => {
  let tempDir;
  let authController;
  let dbModule;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'c1-auth-'));
    process.env.DB_MODE = 'local';
    process.env.DB_PATH = path.join(tempDir, 'clinica.db');
    delete process.env.TURSO_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    process.env.JWT_SECRET = 'test-secret-c1';

    jest.resetModules();
    // schema local
    require('../database');
    // usuarios seed (admin/admin, doctor/doctor)
    require('../seed');
    dbModule = require('../db');
    authController = require('../controllers/authController');
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    delete process.env.DB_MODE;
    delete process.env.DB_PATH;
  });

  function mockRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  }

  test('db.js en modo local no usa cloudClient', () => {
    expect(dbModule.isTurso()).toBe(false);
    expect(dbModule.resolveMode()).toBe('local');
  });

  test('usuarios seed existen en SQLite local', () => {
    const row = dbModule.prepare('SELECT email FROM usuarios WHERE email = ?').get('admin');
    // prepare().get es async-promise en modo local? no: Promise.resolve — pero .get de db.js devuelve Promise
    // usar await en el test de login; aquí verificamos vía database directa
    const direct = require('../database').prepare('SELECT email FROM usuarios WHERE email = ?').get('admin');
    expect(direct).toBeTruthy();
    expect(direct.email).toBe('admin');
  });

  test('login admin funciona contra SQLite local', async () => {
    const req = { body: { email: 'admin', password: 'admin' } };
    const res = mockRes();
    await authController.login(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.any(String),
        usuario: expect.objectContaining({ email: 'admin', rol: 'admin' }),
      })
    );
  });

  test('login doctor funciona contra SQLite local', async () => {
    const req = { body: { email: 'doctor', password: 'doctor' } };
    const res = mockRes();
    await authController.login(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario: expect.objectContaining({ email: 'doctor' }),
      })
    );
  });

  test('login con password incorrecto falla 401', async () => {
    const req = { body: { email: 'admin', password: 'mala' } };
    const res = mockRes();
    await authController.login(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
