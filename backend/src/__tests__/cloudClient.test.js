/**
 * C1 — cloudClient: TURSO_URL/TOKEN configuran la nube del sync.
 * isConfigured() es puro: no ejecuta queries.
 */

describe('cloudClient', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.TURSO_URL;
    delete process.env.TURSO_AUTH_TOKEN;
  });

  test('sin TURSO_URL → isConfigured=false', () => {
    delete process.env.TURSO_URL;
    const cloud = require('../cloudClient');
    expect(cloud.isConfigured()).toBe(false);
  });

  test('con TURSO_URL → isConfigured=true sin ejecutar query', () => {
    process.env.TURSO_URL = 'libsql://clinica-db-dev';
    process.env.TURSO_AUTH_TOKEN = 'token-test';
    const cloud = require('../cloudClient');
    expect(cloud.isConfigured()).toBe(true);
    // puro: no expone clientes ni red
    expect(typeof cloud.execute).toBe('function');
    expect(typeof cloud.getClient).toBe('function');
  });

  test('TURSO_AUTH_TOKEN vacío sigue permitiendo isConfigured', () => {
    process.env.TURSO_URL = 'libsql://x';
    process.env.TURSO_AUTH_TOKEN = '';
    const cloud = require('../cloudClient');
    expect(cloud.isConfigured()).toBe(true);
  });

  test('execute sin configurar → error claro CLOUD_NOT_CONFIGURED', async () => {
    delete process.env.TURSO_URL;
    const cloud = require('../cloudClient');
    expect(cloud.isConfigured()).toBe(false);
    await expect(cloud.execute({ sql: 'SELECT 1', args: [] })).rejects.toMatchObject({
      code: 'CLOUD_NOT_CONFIGURED',
      message: expect.stringContaining('TURSO_URL'),
    });
  });

  test('no depende de db.js', () => {
    jest.isolateModules(() => {
      jest.doMock('../db', () => {
        throw new Error('cloudClient no debe importar db.js');
      });
      const cloud = require('../cloudClient');
      expect(typeof cloud.execute).toBe('function');
    });
  });
});
