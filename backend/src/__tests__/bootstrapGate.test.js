/**
 * C4.2.5 — bootstrapGate: 409 BOOTSTRAP_PENDING en escrituras de negocio
 * solo si la nube está configurada y last_sync_at es NULL.
 */

jest.mock('../database', () => ({
  prepare: jest.fn(),
}));

jest.mock('../cloudClient', () => ({
  isConfigured: jest.fn(),
  execute: jest.fn(),
}));

jest.mock('../sync/syncService', () => ({
  getLastSyncTime: jest.fn(),
}));

const mockCloud = require('../cloudClient');
const mockSync = require('../sync/syncService');
const { requireBootstrapIfCloud, withBootstrapGate, WRITE_METHODS } = require('../middleware/bootstrapGate');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('bootstrapGate — requireBootstrapIfCloud', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sin TURSO_URL → next (CRUD local libre)', () => {
    mockCloud.isConfigured.mockReturnValue(false);
    const next = jest.fn();
    const res = mockRes();
    requireBootstrapIfCloud({}, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  test('nube + last_sync_at NULL → 409 BOOTSTRAP_PENDING', () => {
    mockCloud.isConfigured.mockReturnValue(true);
    mockSync.getLastSyncTime.mockReturnValue(null);
    const next = jest.fn();
    const res = mockRes();
    requireBootstrapIfCloud({}, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('BOOTSTRAP_PENDING');
    expect(res.body.code).toBe('BOOTSTRAP_PENDING');
  });

  test('nube + last_sync_at presente → next (bootstrap completado)', () => {
    mockCloud.isConfigured.mockReturnValue(true);
    mockSync.getLastSyncTime.mockReturnValue('2026-01-01T00:00:00');
    const next = jest.fn();
    const res = mockRes();
    requireBootstrapIfCloud({}, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  test('getLastSyncTime lanza → se trata como NULL (fail-closed)', () => {
    mockCloud.isConfigured.mockReturnValue(true);
    mockSync.getLastSyncTime.mockImplementation(() => { throw new Error('db'); });
    const next = jest.fn();
    const res = mockRes();
    requireBootstrapIfCloud({}, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
  });
});

describe('bootstrapGate — withBootstrapGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('solo aplica a métodos de escritura', () => {
    expect([...WRITE_METHODS].sort()).toEqual(['DELETE', 'PATCH', 'POST', 'PUT']);
  });

  test('GET no se gatea aunque bootstrap pendiente', () => {
    mockCloud.isConfigured.mockReturnValue(true);
    mockSync.getLastSyncTime.mockReturnValue(null);
    const router = { use: jest.fn() };
    withBootstrapGate(router);
    expect(router.use).toHaveBeenCalledTimes(1);
    const mw = router.use.mock.calls[0][0];
    const next = jest.fn();
    const res = mockRes();
    mw({ method: 'GET' }, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('POST se gatea con bootstrap pendiente', () => {
    mockCloud.isConfigured.mockReturnValue(true);
    mockSync.getLastSyncTime.mockReturnValue(null);
    const router = { use: jest.fn() };
    withBootstrapGate(router);
    const mw = router.use.mock.calls[0][0];
    const next = jest.fn();
    const res = mockRes();
    mw({ method: 'POST' }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
  });
});

describe('seedPolicy — isProdCloudConfigured / shouldSeedClinical (C4.2.5.1)', () => {
  const { shouldSeedClinical, isProdCloudConfigured } = require('../utils/seedPolicy');
  const originalUrl = process.env.TURSO_URL;
  const originalEnv = process.env.TURSO_ENV;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.TURSO_URL;
    else process.env.TURSO_URL = originalUrl;
    if (originalEnv === undefined) delete process.env.TURSO_ENV;
    else process.env.TURSO_ENV = originalEnv;
  });

  test('sin TURSO_URL → local, seed clínico permitido', () => {
    delete process.env.TURSO_URL;
    delete process.env.TURSO_ENV;
    expect(shouldSeedClinical()).toBe(true);
    expect(isProdCloudConfigured()).toBe(false);
  });

  test('TURSO_ENV=dev explícito + nube DEV → seed clínico permitido', () => {
    process.env.TURSO_URL = 'libsql://clinica-db-dev-charles-pv.aws-us-west-2.turso.io';
    process.env.TURSO_ENV = 'dev';
    expect(shouldSeedClinical()).toBe(true);
    expect(isProdCloudConfigured()).toBe(false);
  });

  test('nube sin TURSO_ENV → fail-safe PROD, sin seed clínico', () => {
    process.env.TURSO_URL = 'libsql://clinica-db-dev-charles-pv.aws-us-west-2.turso.io';
    delete process.env.TURSO_ENV;
    expect(shouldSeedClinical()).toBe(false);
    expect(isProdCloudConfigured()).toBe(true);
  });

  test('TURSO_ENV=prod → sin seed clínico', () => {
    process.env.TURSO_URL = 'libsql://clinica-db-charles-pv.aws-us-west-2.turso.io';
    process.env.TURSO_ENV = 'prod';
    expect(shouldSeedClinical()).toBe(false);
    expect(isProdCloudConfigured()).toBe(true);
  });

  test('TURSO_ENV=dev + hostname etiqueta prod → sin seed clínico', () => {
    process.env.TURSO_URL = 'libsql://clinica-db-prod.turso.io';
    process.env.TURSO_ENV = 'dev';
    expect(shouldSeedClinical()).toBe(false);
    expect(isProdCloudConfigured()).toBe(true);
  });
});
