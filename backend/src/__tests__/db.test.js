/**
 * C1 — db.js: DB_MODE decide el CRUD (local | turso)
 * TURSO_URL no debe dirigir el CRUD.
 */

jest.mock('../database', () => ({
  prepare: jest.fn(() => ({
    get: jest.fn(() => null),
    all: jest.fn(() => []),
    run: jest.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  })),
  exec: jest.fn(),
}));

jest.mock('../cloudClient', () => ({
  isConfigured: jest.fn(() => true),
  execute: jest.fn(async () => ({ rows: [], rowsAffected: 0, lastInsertRowid: 0 })),
  __cloud: true,
}));

let mockDatabase;
let mockCloud;

describe('db.js — DB_MODE routing', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.DB_MODE;
    delete process.env.TURSO_URL;
    // tras resetModules, re-obtener instancias frescas de los mocks
    mockDatabase = require('../database');
    mockCloud = require('../cloudClient');
  });

  test('DB_MODE ausente → local (database.js)', () => {
    delete process.env.DB_MODE;
    const db = require('../db');
    const client = db.getClient();
    expect(client.__cloud).toBeUndefined();
    expect(client.prepare).toBeDefined();
    expect(db.isTurso()).toBe(false);
    expect(db.resolveMode()).toBe('local');
  });

  test('DB_MODE=local → database.js', () => {
    process.env.DB_MODE = 'local';
    const db = require('../db');
    const client = db.getClient();
    expect(client.__cloud).toBeUndefined();
    expect(db.isTurso()).toBe(false);
  });

  test('DB_MODE=turso → cloudClient', () => {
    process.env.DB_MODE = 'turso';
    const db = require('../db');
    const client = db.getClient();
    expect(client.__cloud).toBe(true);
    expect(db.isTurso()).toBe(true);
    expect(db.resolveMode()).toBe('turso');
  });

  test('TURSO_URL presente NO cambia el CRUD si DB_MODE=local', () => {
    process.env.DB_MODE = 'local';
    process.env.TURSO_URL = 'libsql://clinica-db-dev';
    const db = require('../db');
    expect(db.isTurso()).toBe(false);
    expect(db.resolveMode()).toBe('local');
    const client = db.getClient();
    expect(client.__cloud).toBeUndefined();
  });

  test('DB_MODE=local nunca instancia @libsql/client', async () => {
    process.env.DB_MODE = 'local';
    process.env.TURSO_URL = 'libsql://should-not-load';
    let libsqlLoaded = false;
    jest.isolateModules(() => {
      jest.doMock('@libsql/client', () => {
        libsqlLoaded = true;
        return { createClient: () => ({ execute: jest.fn() }) };
      });
      const db = require('../db');
      db.getClient();
      // ruta local: prepare/get no debe tocar @libsql
      db.prepare('SELECT 1').get();
      db.execute({ sql: 'SELECT 1', args: [] });
    });
    expect(libsqlLoaded).toBe(false);
  });

  test('exports compatibles: prepare, exec, getClient, isTurso, execute', () => {
    const db = require('../db');
    expect(typeof db.prepare).toBe('function');
    expect(typeof db.exec).toBe('function');
    expect(typeof db.getClient).toBe('function');
    expect(typeof db.isTurso).toBe('function');
    expect(typeof db.execute).toBe('function');
    expect(typeof db.resolveMode).toBe('function');
  });

  test('DB_MODE se evalúa en runtime (cambio de modo entre llamadas)', () => {
    process.env.DB_MODE = 'local';
    const db = require('../db');
    expect(db.isTurso()).toBe(false);
    expect(db.resolveMode()).toBe('local');

    process.env.DB_MODE = 'turso';
    expect(db.isTurso()).toBe(true);
    expect(db.resolveMode()).toBe('turso');
    const client = db.getClient();
    expect(client.__cloud).toBe(true);
  });

  test('CRUD local funciona sin TURSO_URL (sin nube)', async () => {
    process.env.DB_MODE = 'local';
    delete process.env.TURSO_URL;
    const db = require('../db');
    const result = await db.execute({ sql: 'INSERT INTO t(a) VALUES (?)', args: ['x'] });
    expect(result.rowsAffected).toBe(1);
    expect(mockCloud.execute).not.toHaveBeenCalled();
    const row = await db.prepare('SELECT 1').get();
    expect(row).toBeNull(); // mock database get → null; sin error = ruta local viva
  });

  test('modo turso delega en cloudClient.execute', async () => {
    process.env.DB_MODE = 'turso';
    const db = require('../db');
    await db.execute({ sql: 'SELECT 1', args: [] });
    expect(mockCloud.execute).toHaveBeenCalled();
    expect(mockDatabase.prepare).not.toHaveBeenCalled();
  });
});
