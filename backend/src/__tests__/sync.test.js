jest.mock('../database', () => ({
  prepare: jest.fn(),
}));

jest.mock('../db', () => ({
  prepare: jest.fn(),
  isTurso: jest.fn().mockReturnValue(false),
  execute: jest.fn(),
}));

const mockDatabase = require('../database');
const mockDb = require('../db');

function mockChain(getFn, runFn, allFn) {
  return {
    get: jest.fn().mockImplementation(getFn || (() => null)),
    run: jest.fn().mockImplementation(runFn || (() => ({ changes: 0, lastInsertRowid: 0 }))),
    all: jest.fn().mockImplementation(allFn || (() => [])),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.isTurso.mockReturnValue(false);
  mockDb.execute.mockReset();
});

describe('SYNC_TABLES', () => {
  test('contains only real tables', () => {
    const { SYNC_TABLES } = require('../sync/syncService');
    expect(SYNC_TABLES).toEqual([
      'pacientes', 'historias_clinicas', 'consultas', 'odontogramas',
      'tratamientos', 'recetas', 'citas', 'pagos',
      'necesidades_odontologicas', 'imagenes'
    ]);
  });

  test('usuarios is NOT included', () => {
    const { SYNC_TABLES } = require('../sync/syncService');
    expect(SYNC_TABLES).not.toContain('usuarios');
  });

  test('WhatsApp tables are NOT included', () => {
    const { SYNC_TABLES } = require('../sync/syncService');
    for (const t of ['whatsapp_log', 'whatsapp_plantillas', 'whatsapp_cola', 'whatsapp_batch', 'whatsapp_config']) {
      expect(SYNC_TABLES).not.toContain(t);
    }
  });

  test('fantasy tables are NOT included', () => {
    const { SYNC_TABLES } = require('../sync/syncService');
    for (const t of ['configuracion', 'radiografias', 'odontograma', 'presupuestos', 'presupuesto_items', 'facturas', 'indicaciones', 'seguimiento_whatsapp', 'notas_seguimiento']) {
      expect(SYNC_TABLES).not.toContain(t);
    }
  });

  test('CLEAN_TABLES does NOT include usuarios', () => {
    const { CLEAN_TABLES } = require('../sync/syncService');
    expect(CLEAN_TABLES).not.toContain('usuarios');
  });

  test('BATCH_SIZE is 50', () => {
    const { BATCH_SIZE } = require('../sync/syncService');
    expect(BATCH_SIZE).toBe(50);
  });
});

describe('formatSyncTimestamp', () => {
  test('returns ISO format without milliseconds', () => {
    const { formatSyncTimestamp } = require('../sync/syncService');
    const ts = formatSyncTimestamp(new Date('2026-09-22T10:30:45.123Z'));
    expect(ts).toBe('2026-09-22T10:30:45');
  });

  test('matches YYYY-MM-DDTHH:mm:ss pattern', () => {
    const { formatSyncTimestamp } = require('../sync/syncService');
    const ts = formatSyncTimestamp(new Date());
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});

describe('getLastSyncTime', () => {
  test('returns null when sync_state has no row', () => {
    mockDatabase.prepare.mockReturnValue(mockChain(() => null));
    const { getLastSyncTime } = require('../sync/syncService');
    expect(getLastSyncTime()).toBeNull();
  });

  test('returns timestamp from sync_state', () => {
    mockDatabase.prepare.mockReturnValue(mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' })));
    const { getLastSyncTime } = require('../sync/syncService');
    expect(getLastSyncTime()).toBe('2026-09-22T10:00:00');
  });
});

describe('setLastSyncTime', () => {
  test('inserts into sync_state with provided timestamp', () => {
    const runFn = jest.fn();
    mockDatabase.prepare.mockReturnValue(mockChain(null, runFn));
    const { setLastSyncTime } = require('../sync/syncService');
    setLastSyncTime('2026-09-22T10:00:00');
    expect(runFn).toHaveBeenCalledWith('2026-09-22T10:00:00');
  });

  test('generates ISO timestamp when no argument given', () => {
    const runFn = jest.fn();
    mockDatabase.prepare.mockReturnValue(mockChain(null, runFn));
    const { setLastSyncTime } = require('../sync/syncService');
    setLastSyncTime();
    const calledWith = runFn.mock.calls[0][0];
    expect(calledWith).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});

describe('pushToTurso', () => {
  test('returns error when Turso not configured', async () => {
    mockDb.isTurso.mockReturnValue(false);
    const { pushToTurso } = require('../sync/syncService');
    const result = await pushToTurso();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Turso not configured');
  });

  test('push with no changes succeeds', async () => {
    mockDb.isTurso.mockReturnValue(true);
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      return mockChain(null, null, () => []);
    });
    mockDb.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { pushToTurso } = require('../sync/syncService');
    const result = await pushToTurso();
    expect(result.success).toBe(true);
  });

  test('push calls TursoClient.execute for each record', async () => {
    mockDb.isTurso.mockReturnValue(true);
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('SELECT') && sql.includes('updated_at')) {
        return { all: () => [{ id: 1, nombre: 'Ana', updated_at: '2026-09-22T10:00:01' }], get: jest.fn(), run: jest.fn() };
      }
      return mockChain(null, null, () => []);
    });
    mockDb.execute.mockResolvedValue({ rows: [], rowsAffected: 1, lastInsertRowid: 1 });

    const { pushToTurso } = require('../sync/syncService');
    await pushToTurso();
    expect(mockDb.execute).toHaveBeenCalled();
  });

  test('push uses WHERE updated_at > lastSync', async () => {
    mockDb.isTurso.mockReturnValue(true);
    const mockAll = jest.fn().mockReturnValue([]);
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('updated_at')) {
        return { all: mockAll, get: jest.fn(), run: jest.fn() };
      }
      return mockChain(null, null, () => []);
    });
    mockDb.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { pushToTurso } = require('../sync/syncService');
    await pushToTurso();
    expect(mockAll).toHaveBeenCalledWith('2026-09-22T10:00:00');
  });
});

describe('pullFromTurso', () => {
  test('returns error when Turso not configured', async () => {
    mockDb.isTurso.mockReturnValue(false);
    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Turso not configured');
  });

  test('pull with no changes succeeds', async () => {
    mockDb.isTurso.mockReturnValue(true);
    mockDatabase.prepare.mockReturnValue(mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' })));
    mockDb.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso();
    expect(result.success).toBe(true);
  });

  test('pull calls TursoClient.execute with WHERE updated_at > lastSync', async () => {
    mockDb.isTurso.mockReturnValue(true);
    mockDatabase.prepare.mockReturnValue(mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' })));
    mockDb.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { pullFromTurso } = require('../sync/syncService');
    await pullFromTurso();
    const calls = mockDb.execute.mock.calls;
    const selectCall = calls.find(c => c[0].sql && c[0].sql.includes('SELECT'));
    expect(selectCall).toBeDefined();
    expect(selectCall[0].args).toContain('2026-09-22T10:00:00');
  });

  test('pull inserts remote records into local SQLite', async () => {
    mockDb.isTurso.mockReturnValue(true);
    mockDatabase.prepare.mockReturnValue(mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' })));
    const remoteRows = [{ id: 1, nombre: 'Bob', updated_at: '2026-09-22T10:00:01' }];
    mockDb.execute.mockResolvedValue({ rows: remoteRows, rowsAffected: 1, lastInsertRowid: 1 });

    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso();
    expect(result.success).toBe(true);
    // Verify local DB prepare was called for INSERT
    expect(mockDatabase.prepare).toHaveBeenCalled();
  });
});

describe('fullSync', () => {
  test('returns push and pull results', async () => {
    mockDb.isTurso.mockReturnValue(false);
    const { fullSync } = require('../sync/syncService');
    const result = await fullSync();
    expect(result).toHaveProperty('push');
    expect(result).toHaveProperty('pull');
    expect(result).toHaveProperty('duration');
    expect(result).toHaveProperty('timestamp');
  });
});

describe('getSyncStatus', () => {
  test('returns sync status object', () => {
    mockDb.isTurso.mockReturnValue(false);
    mockDatabase.prepare.mockReturnValue(mockChain(() => null));
    const { getSyncStatus } = require('../sync/syncService');
    const status = getSyncStatus();
    expect(status).toHaveProperty('isTurso');
    expect(status).toHaveProperty('lastSync');
    expect(status).toHaveProperty('pendingChanges');
    expect(status).toHaveProperty('tables');
  });
});
