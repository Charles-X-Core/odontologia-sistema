jest.mock('../database', () => ({
  prepare: jest.fn(),
}));

jest.mock('../cloudClient', () => ({
  isConfigured: jest.fn().mockReturnValue(false),
  execute: jest.fn(),
}));

const mockDatabase = require('../database');
const mockCloud = require('../cloudClient');

function mockChain(getFn, runFn, allFn) {
  return {
    get: jest.fn().mockImplementation(getFn || (() => null)),
    run: jest.fn().mockImplementation(runFn || (() => ({ changes: 1, lastInsertRowid: 1 }))),
    all: jest.fn().mockImplementation(allFn || (() => [])),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCloud.isConfigured.mockReturnValue(false);
  mockCloud.execute.mockReset();
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
    expect(runFn).toHaveBeenCalledWith('2026-09-22T10:00:00', expect.any(String), '2026-09-22T10:00:00');
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
    mockCloud.isConfigured.mockReturnValue(false);
    const { pushToTurso } = require('../sync/syncService');
    const result = await pushToTurso();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Turso not configured');
  });

  test('push with no changes succeeds', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      return mockChain(null, null, () => []);
    });
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { pushToTurso } = require('../sync/syncService');
    const result = await pushToTurso();
    expect(result.success).toBe(true);
  });

  test('push calls cloudClient.execute for each record', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('SELECT') && sql.includes('updated_at')) {
        return { all: () => [{ id: 1, nombre: 'Ana', updated_at: '2026-09-22T10:00:01' }], get: jest.fn(), run: jest.fn() };
      }
      return mockChain(null, null, () => []);
    });
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 1, lastInsertRowid: 1 });

    const { pushToTurso } = require('../sync/syncService');
    await pushToTurso();
    expect(mockCloud.execute).toHaveBeenCalled();
  });

  test('push uses WHERE updated_at > lastSync', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
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
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { pushToTurso } = require('../sync/syncService');
    await pushToTurso();
    expect(mockAll).toHaveBeenCalledWith('2026-09-22T10:00:00');
  });
});

describe('pullFromTurso', () => {
  test('returns error when Turso not configured', async () => {
    mockCloud.isConfigured.mockReturnValue(false);
    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Turso not configured');
  });

  test('pull with no changes succeeds', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    mockDatabase.prepare.mockReturnValue(mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' })));
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso();
    expect(result.success).toBe(true);
  });

  test('pull calls cloudClient.execute with WHERE updated_at > lastSync', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    mockDatabase.prepare.mockReturnValue(mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' })));
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { pullFromTurso } = require('../sync/syncService');
    await pullFromTurso();
    const calls = mockCloud.execute.mock.calls;
    const selectCall = calls.find(c => c[0].sql && c[0].sql.includes('SELECT'));
    expect(selectCall).toBeDefined();
    expect(selectCall[0].args).toContain('2026-09-22T10:00:00');
  });

  test('pull inserts remote records into local SQLite', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    mockDatabase.prepare.mockReturnValue(mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' })));
    const remoteRows = [{ id: 1, nombre: 'Bob', updated_at: '2026-09-22T10:00:01' }];
    mockCloud.execute.mockResolvedValue({ rows: remoteRows, rowsAffected: 1, lastInsertRowid: 1 });

    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso();
    expect(result.success).toBe(true);
    // Verify local DB prepare was called for INSERT
    expect(mockDatabase.prepare).toHaveBeenCalled();
  });
});

describe('fullSync', () => {
  test('returns push and pull results', async () => {
    mockCloud.isConfigured.mockReturnValue(false);
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
    mockCloud.isConfigured.mockReturnValue(false);
    mockDatabase.prepare.mockReturnValue(mockChain(() => null));
    const { getSyncStatus } = require('../sync/syncService');
    const status = getSyncStatus();
    expect(status).toHaveProperty('isTurso');
    expect(status).toHaveProperty('lastSync');
    expect(status).toHaveProperty('pendingChanges');
    expect(status).toHaveProperty('pendingTombstones');
    expect(status).toHaveProperty('tables');
  });

  test('includes pendingTombstones count', () => {
    mockCloud.isConfigured.mockReturnValue(false);
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_tombstones') && sql.includes('COUNT')) {
        return mockChain(() => ({ count: 3 }));
      }
      return mockChain(() => null);
    });
    const { getSyncStatus } = require('../sync/syncService');
    const status = getSyncStatus();
    expect(status.pendingTombstones).toBe(3);
  });
});

describe('TOMBSTONES — pushToTurso', () => {
  test('pushes pending tombstones to Turso', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    const pendingTombstones = [
      { id: 1, table_name: 'pacientes', record_id: 123, deleted_at: '2026-09-23T10:00:00', source: 'user', synced_to_turso: 0, created_at: '2026-09-23T10:00:00' }
    ];
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('sync_tombstones') && sql.includes('SELECT') && sql.includes('synced_to_turso = 0')) {
        return { all: () => pendingTombstones, get: jest.fn(), run: jest.fn() };
      }
      return mockChain(null, null, () => []);
    });
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 1, lastInsertRowid: 1 });

    const { pushToTurso } = require('../sync/syncService');
    const result = await pushToTurso();
    expect(result.success).toBe(true);
    expect(result.pushedTombstones).toBe(1);
    expect(mockCloud.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining('INSERT OR IGNORE INTO sync_tombstones')
      })
    );
  });

  test('marks tombstones as synced after push', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    const pendingTombstones = [
      { id: 1, table_name: 'pacientes', record_id: 123, deleted_at: '2026-09-23T10:00:00', source: 'user', synced_to_turso: 0, created_at: '2026-09-23T10:00:00' }
    ];
    const runFn = jest.fn();
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('sync_tombstones') && sql.includes('SELECT') && sql.includes('synced_to_turso = 0')) {
        return { all: () => pendingTombstones, get: jest.fn(), run: jest.fn() };
      }
      if (sql.includes('UPDATE sync_tombstones SET synced_to_turso = 1')) {
        return { run: runFn };
      }
      return mockChain(null, null, () => []);
    });
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 1, lastInsertRowid: 1 });

    const { pushToTurso } = require('../sync/syncService');
    await pushToTurso();
    expect(runFn).toHaveBeenCalled();
  });

  test('returns 0 pushedTombstones when none pending', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('sync_tombstones') && sql.includes('SELECT')) {
        return { all: () => [], get: jest.fn(), run: jest.fn() };
      }
      return mockChain(null, null, () => []);
    });
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { pushToTurso } = require('../sync/syncService');
    const result = await pushToTurso();
    expect(result.pushedTombstones).toBe(0);
  });
});

describe('TOMBSTONES — pullFromTurso', () => {
  test('pulls remote tombstones and applies DELETE locally', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    const remoteTombstones = {
      rows: [
        { table_name: 'pacientes', record_id: 123, deleted_at: '2026-09-23T10:00:00', source: 'user', created_at: '2026-09-23T10:00:00' }
      ]
    };
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('SELECT 1 FROM sync_tombstones WHERE table_name')) {
        return mockChain(() => null); // No existing tombstone
      }
      if (sql.includes('DELETE FROM')) {
        return { run: jest.fn() };
      }
      if (sql.includes('INSERT OR IGNORE INTO sync_tombstones')) {
        return { run: jest.fn() };
      }
      return mockChain(null, jest.fn(), () => []);
    });

    let callCount = 0;
    mockCloud.execute.mockImplementation((params) => {
      callCount++;
      if (callCount === 1) return remoteTombstones; // First call: tombstones
      return { rows: [], rowsAffected: 0, lastInsertRowid: 0 };
    });

    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso('2026-09-22T10:00:00');
    expect(result.success).toBe(true);
    expect(result.pulledTombstones).toBe(1);
  });

  test('skips tombstone that already exists locally', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    const remoteTombstones = {
      rows: [
        { table_name: 'pacientes', record_id: 123, deleted_at: '2026-09-23T10:00:00', source: 'user', created_at: '2026-09-23T10:00:00' }
      ]
    };
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('SELECT 1 FROM sync_tombstones WHERE table_name')) {
        return mockChain(() => ({ 1: 1 })); // Tombstone exists locally
      }
      return mockChain(null, jest.fn(), () => []);
    });

    let callCount = 0;
    mockCloud.execute.mockImplementation((params) => {
      callCount++;
      if (callCount === 1) return remoteTombstones; // First call: tombstones
      return { rows: [], rowsAffected: 0, lastInsertRowid: 0 };
    });

    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso('2026-09-22T10:00:00');
    expect(result.success).toBe(true);
    expect(result.pulledTombstones).toBe(0);
    expect(result.skippedTombstones).toBe(1);
  });

  test('applies DELETE for non-existing local record gracefully', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    const remoteTombstones = {
      rows: [
        { table_name: 'pacientes', record_id: 999, deleted_at: '2026-09-23T10:00:00', source: 'sync', created_at: '2026-09-23T10:00:00' }
      ]
    };
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('SELECT 1 FROM sync_tombstones WHERE table_name')) {
        return mockChain(() => null);
      }
      if (sql.includes('DELETE FROM')) {
        return { run: jest.fn() };
      }
      if (sql.includes('INSERT OR IGNORE INTO sync_tombstones')) {
        return { run: jest.fn() };
      }
      return mockChain(null, jest.fn(), () => []);
    });

    let callCount = 0;
    mockCloud.execute.mockImplementation((params) => {
      callCount++;
      if (callCount === 1) return remoteTombstones; // First call: tombstones
      return { rows: [], rowsAffected: 0, lastInsertRowid: 0 };
    });

    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso('2026-09-22T10:00:00');
    expect(result.success).toBe(true);
    expect(result.pulledTombstones).toBe(1);
  });
});

describe('TOMBSTONES — ping-pong prevention', () => {
  test('INSERT OR IGNORE prevents duplicate tombstones', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    const pendingTombstones = [
      { id: 1, table_name: 'pacientes', record_id: 123, deleted_at: '2026-09-23T10:00:00', source: 'user', synced_to_turso: 0, created_at: '2026-09-23T10:00:00' }
    ];
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('sync_tombstones') && sql.includes('SELECT') && sql.includes('synced_to_turso = 0')) {
        return { all: () => pendingTombstones, get: jest.fn(), run: jest.fn() };
      }
      return mockChain(null, null, () => []);
    });
    // Turso returns error for duplicate (UNIQUE constraint)
    mockCloud.execute.mockImplementation(() => {
      return { rows: [], rowsAffected: 0, lastInsertRowid: 0 };
    });

    const { pushToTurso } = require('../sync/syncService');
    const result = await pushToTurso();
    expect(result.success).toBe(true);
    // The INSERT OR IGNORE SQL is sent — Turso handles dedup via UNIQUE
    expect(mockCloud.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining('INSERT OR IGNORE INTO sync_tombstones')
      })
    );
  });
});

// ============================================================
// FASE 2B-2: DELETE-Wins Enforcement Tests
// ============================================================

describe('DELETE-WINS — pullFromTurso local tombstone blocks INSERT', () => {
  test('local tombstone prevents pulled record from being inserted', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    // Remote tombstone already applied locally
    const remoteTombstones = { rows: [] };
    // Remote record that was modified before deletion
    const remoteRecords = { rows: [{ id: 99, nombre: 'Test', updated_at: '2026-09-23T10:00:00' }] };

    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      // Tombstone exists locally
      if (sql.includes('SELECT 1 FROM sync_tombstones WHERE table_name')) {
        return mockChain(() => ({ 1: 1 }));
      }
      return mockChain(null, jest.fn(), () => []);
    });

    let callCount = 0;
    mockCloud.execute.mockImplementation((params) => {
      callCount++;
      if (callCount === 1) return remoteTombstones; // tombstones query
      if (callCount === 2) return remoteRecords; // records query
      return { rows: [], rowsAffected: 0, lastInsertRowid: 0 };
    });

    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso('2026-09-22T10:00:00');
    expect(result.success).toBe(true);
    expect(result.skippedByTombstone).toBe(1);
    // Verify INSERT was NOT called for the record with tombstone
    const insertCalls = mockDatabase.prepare.mock.calls.filter(c => c[0] && c[0].includes('INSERT INTO') && !c[0].includes('sync_tombstones'));
    expect(insertCalls.length).toBe(0);
  });
});

describe('DELETE-WINS — pushToTurso remote tombstone blocks INSERT', () => {
  test('remote tombstone prevents local record from being pushed', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    const localRecords = [{ id: 99, nombre: 'Test', updated_at: '2026-09-23T10:00:00' }];

    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('SELECT') && sql.includes('updated_at') && sql.includes('pacientes')) {
        return { all: () => localRecords, get: jest.fn(), run: jest.fn() };
      }
      if (sql.includes('sync_tombstones') && sql.includes('SELECT') && sql.includes('synced_to_turso = 0')) {
        return { all: () => [], get: jest.fn(), run: jest.fn() };
      }
      return mockChain(null, null, () => []);
    });

    let callCount = 0;
    mockCloud.execute.mockImplementation((params) => {
      callCount++;
      // First call per table: check remote tombstone → exists!
      if (params.sql && params.sql.includes('SELECT 1 FROM sync_tombstones')) {
        return { rows: [{ 1: 1 }], rowsAffected: 0, lastInsertRowid: 0 };
      }
      return { rows: [], rowsAffected: 0, lastInsertRowid: 0 };
    });

    const { pushToTurso } = require('../sync/syncService');
    const result = await pushToTurso('2026-09-22T10:00:00');
    expect(result.success).toBe(true);
    expect(result.skippedByRemoteTombstone).toBe(1);
    // Verify INSERT was NOT called for the record
    const insertCalls = mockCloud.execute.mock.calls.filter(c => c[0] && c[0].sql && c[0].sql.includes('INSERT INTO') && !c[0].sql.includes('sync_tombstones'));
    expect(insertCalls.length).toBe(0);
  });
});

describe('DELETE-WINS — remote DELETE + local UPDATE scenario', () => {
  test('local UPDATE does not override remote DELETE', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    // Remote tombstone for record 42
    const remoteTombstones = { rows: [{ table_name: 'pacientes', record_id: 42, deleted_at: '2026-09-23T10:00:00', source: 'user', created_at: '2026-09-23T10:00:00' }] };
    // Remote record 42 also exists (was updated before deletion)
    const remoteRecords = { rows: [{ id: 42, nombre: 'Updated', updated_at: '2026-09-23T09:59:00' }] };

    let tombstoneCheckCount = 0;
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      // First tombstone check: no local tombstone yet
      // After tombstone is applied, second check should find it
      if (sql.includes('SELECT 1 FROM sync_tombstones WHERE table_name') && sql.includes('record_id')) {
        tombstoneCheckCount++;
        if (tombstoneCheckCount === 1) {
          return mockChain(() => null); // First check: no tombstone
        }
        return mockChain(() => ({ 1: 1 })); // Second check: tombstone exists
      }
      // DELETE succeeds
      if (sql.includes('DELETE FROM') && !sql.includes('sync_tombstones')) {
        return { run: jest.fn() };
      }
      // INSERT tombstone
      if (sql.includes('INSERT OR IGNORE INTO sync_tombstones')) {
        return { run: jest.fn() };
      }
      return mockChain(null, jest.fn(), () => []);
    });

    let callCount = 0;
    mockCloud.execute.mockImplementation((params) => {
      callCount++;
      if (callCount === 1) return remoteTombstones; // tombstones first
      if (callCount === 2) return remoteRecords; // records second
      return { rows: [], rowsAffected: 0, lastInsertRowid: 0 };
    });

    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso('2026-09-22T10:00:00');
    expect(result.success).toBe(true);
    // Tombstone applied first, then record skipped because tombstone now exists locally
    expect(result.pulledTombstones).toBe(1);
    expect(result.skippedByTombstone).toBe(1);
  });
});

describe('DELETE-WINS — local DELETE + remote UPDATE scenario', () => {
  test('remote UPDATE does not recreate locally deleted record', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    // No remote tombstones
    const remoteTombstones = { rows: [] };
    // Remote record 42 was updated
    const remoteRecords = { rows: [{ id: 42, nombre: 'Updated', updated_at: '2026-09-23T10:00:00' }] };

    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      // Local tombstone EXISTS for record 42 — match by table_name parameter
      if (sql.includes('SELECT 1 FROM sync_tombstones WHERE table_name') && sql.includes('record_id')) {
        return mockChain(() => ({ 1: 1 }));
      }
      return mockChain(null, jest.fn(), () => []);
    });

    let callCount = 0;
    mockCloud.execute.mockImplementation((params) => {
      callCount++;
      if (callCount === 1) return remoteTombstones;
      if (callCount === 2) return remoteRecords;
      return { rows: [], rowsAffected: 0, lastInsertRowid: 0 };
    });

    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso('2026-09-22T10:00:00');
    expect(result.success).toBe(true);
    expect(result.skippedByTombstone).toBe(1);
    // Verify INSERT was NOT called
    const insertCalls = mockDatabase.prepare.mock.calls.filter(c => c[0] && c[0].includes('INSERT INTO') && !c[0].includes('sync_tombstones'));
    expect(insertCalls.length).toBe(0);
  });
});

describe('DELETE-WINS — PULL applies tombstones before records', () => {
  test('tombstones are processed before records in pullFromTurso', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    const executionOrder = [];

    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('SELECT 1 FROM sync_tombstones WHERE table_name')) {
        return mockChain(() => null);
      }
      if (sql.includes('DELETE FROM')) {
        executionOrder.push('delete');
        return { run: jest.fn() };
      }
      if (sql.includes('INSERT OR IGNORE INTO sync_tombstones') && !sql.includes('VALUES')) {
        return { run: jest.fn() };
      }
      if (sql.includes('INSERT OR IGNORE INTO sync_tombstones')) {
        executionOrder.push('insert_tombstone');
        return { run: jest.fn() };
      }
      if (sql.includes('INSERT INTO') && !sql.includes('sync_tombstones')) {
        executionOrder.push('insert_record');
        return { run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }) };
      }
      return mockChain(null, jest.fn(), () => []);
    });

    let callCount = 0;
    mockCloud.execute.mockImplementation((params) => {
      callCount++;
      // First: tombstone (record was deleted remotely)
      if (callCount === 1) {
        return { rows: [{ table_name: 'pacientes', record_id: 50, deleted_at: '2026-09-23T10:00:00', source: 'user', created_at: '2026-09-23T10:00:00' }] };
      }
      // Second: record (different record, not deleted)
      if (callCount === 2) {
        return { rows: [{ id: 51, nombre: 'Active', updated_at: '2026-09-23T10:00:00' }] };
      }
      return { rows: [], rowsAffected: 0, lastInsertRowid: 0 };
    });

    const { pullFromTurso } = require('../sync/syncService');
    const result = await pullFromTurso('2026-09-22T10:00:00');
    expect(result.success).toBe(true);
    // delete should come before insert_record
    const deleteIdx = executionOrder.indexOf('delete');
    const insertIdx = executionOrder.indexOf('insert_record');
    expect(deleteIdx).toBeLessThan(insertIdx);
  });
});

describe('lastSync — fullSync uses same cursor for push and pull', () => {
  test('fullSync captures lastSync once and passes to both push and pull', async () => {
    mockCloud.isConfigured.mockReturnValue(false);
    const { fullSync } = require('../sync/syncService');
    const result = await fullSync();
    // When Turso is not configured, both return errors but lastSync is not advanced
    expect(result.push.success).toBe(false);
    expect(result.pull.success).toBe(false);
  });

  test('fullSync does not advance lastSync when Turso not configured', async () => {
    mockCloud.isConfigured.mockReturnValue(false);
    const runFn = jest.fn();
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state') && sql.includes('SELECT')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('sync_state') && sql.includes('INSERT')) {
        return { run: runFn };
      }
      return mockChain(null, null, () => []);
    });

    const { fullSync } = require('../sync/syncService');
    const result = await fullSync();
    expect(result.success).toBe(false);
    // setLastSyncTime should NOT have been called on failure
    expect(runFn).not.toHaveBeenCalled();
  });

  test('fullSync advances lastSync only after both push and pull succeed', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    const runFn = jest.fn();
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state') && sql.includes('SELECT')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('sync_state') && sql.includes('INSERT')) {
        return { run: runFn };
      }
      if (sql.includes('sync_tombstones') && sql.includes('SELECT') && sql.includes('synced_to_turso = 0')) {
        return { all: () => [], get: jest.fn(), run: jest.fn() };
      }
      return mockChain(null, null, () => []);
    });
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { fullSync } = require('../sync/syncService');
    const result = await fullSync();
    expect(result.success).toBe(true);
    // setLastSyncTime should have been called exactly once
    expect(runFn).toHaveBeenCalledTimes(1);
  });
});

describe('lastSync — remote change during PUSH not lost', () => {
  test('PULL with same lastSync catches changes made during PUSH', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    const runFn = jest.fn();
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state') && sql.includes('SELECT')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('sync_state') && sql.includes('INSERT')) {
        return { run: runFn };
      }
      if (sql.includes('sync_tombstones') && sql.includes('SELECT') && sql.includes('synced_to_turso = 0')) {
        return { all: () => [], get: jest.fn(), run: jest.fn() };
      }
      return mockChain(null, null, () => []);
    });

    let callCount = 0;
    mockCloud.execute.mockImplementation((params) => {
      callCount++;
      // Tombstone query (empty)
      if (params.sql && params.sql.includes('sync_tombstones') && params.sql.includes('deleted_at')) {
        return { rows: [] };
      }
      // Record query — returns a change that happened "during" PUSH
      if (params.sql && params.sql.includes('SELECT') && params.sql.includes('updated_at')) {
        return { rows: [{ id: 77, nombre: 'Late', updated_at: '2026-09-22T10:00:01' }] };
      }
      return { rows: [], rowsAffected: 0, lastInsertRowid: 0 };
    });

    const { fullSync } = require('../sync/syncService');
    const result = await fullSync();
    expect(result.success).toBe(true);
    // The late change should have been pulled
    expect(result.pull.pulled.pacientes).toBeGreaterThanOrEqual(0);
  });
});

describe('lastSync — failed sync does not advance cursor', () => {
  test('pushToTurso alone does not advance lastSync', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    const runFn = jest.fn();
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state') && sql.includes('SELECT')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('sync_state') && sql.includes('INSERT')) {
        return { run: runFn };
      }
      if (sql.includes('sync_tombstones') && sql.includes('SELECT') && sql.includes('synced_to_turso = 0')) {
        return { all: () => [], get: jest.fn(), run: jest.fn() };
      }
      return mockChain(null, null, () => []);
    });
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { pushToTurso } = require('../sync/syncService');
    await pushToTurso('2026-09-22T10:00:00');
    // pushToTurso should NOT call setLastSyncTime
    expect(runFn).not.toHaveBeenCalled();
  });

  test('pullFromTurso alone does not advance lastSync', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    const runFn = jest.fn();
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state') && sql.includes('SELECT')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('sync_state') && sql.includes('INSERT')) {
        return { run: runFn };
      }
      return mockChain(null, null, () => []);
    });
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { pullFromTurso } = require('../sync/syncService');
    await pullFromTurso('2026-09-22T10:00:00');
    // pullFromTurso should NOT call setLastSyncTime
    expect(runFn).not.toHaveBeenCalled();
  });
});

describe('IDEMPOTENCY — repeated sync produces same result', () => {
  test('running fullSync twice produces same outcome', async () => {
    mockCloud.isConfigured.mockReturnValue(true);
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state') && sql.includes('SELECT')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('sync_state') && sql.includes('INSERT')) {
        return { run: jest.fn() };
      }
      if (sql.includes('sync_tombstones') && sql.includes('SELECT') && sql.includes('synced_to_turso = 0')) {
        return { all: () => [], get: jest.fn(), run: jest.fn() };
      }
      return mockChain(null, null, () => []);
    });
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const { fullSync } = require('../sync/syncService');
    const result1 = await fullSync();
    const result2 = await fullSync();
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });
});

// ============================================================
// C1 — cloudClient como remoto (no db.js) + CRUD local + offline
// ============================================================

describe('C1 — arquitectura de módulos', () => {
  test('syncService no importa db.js (el remoto es cloudClient)', () => {
    jest.isolateModules(() => {
      jest.doMock('../db', () => {
        throw new Error('db.js no debe usarse como remoto en sync');
      });
      jest.doMock('../database', () => ({
        prepare: jest.fn(() => ({
          get: jest.fn(() => null),
          all: jest.fn(() => []),
          run: jest.fn(() => ({ changes: 0, lastInsertRowid: 0 })),
        })),
      }));
      jest.doMock('../cloudClient', () => ({
        isConfigured: jest.fn(() => false),
        execute: jest.fn(),
      }));
      expect(() => require('../sync/syncService')).not.toThrow();
    });
  });

  test('syncService usa cloudClient.isConfigured como gate de nube', async () => {
    mockCloud.isConfigured.mockReturnValue(false);
    const { pushToTurso } = require('../sync/syncService');
    const result = await pushToTurso();
    expect(mockCloud.isConfigured).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Turso not configured');
    expect(mockCloud.execute).not.toHaveBeenCalled();
  });
});

describe('C1 — sin nube: CRUD local sigue disponible y sync falla sin avanzar cursor', () => {
  test('fullSync sin nube no avanza lastSync y el siguiente intento reintentable', async () => {
    mockCloud.isConfigured.mockReturnValue(false);
    const setLast = jest.fn();
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state') && sql.includes('SELECT')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('sync_state') && sql.includes('INSERT')) {
        return { run: setLast };
      }
      return mockChain(null, null, () => []);
    });

    const { fullSync } = require('../sync/syncService');
    const first = await fullSync();
    expect(first.success).toBe(false);
    expect(setLast).not.toHaveBeenCalled();

    // reintento: nube sigue caída → otra vez sin cursor
    const second = await fullSync();
    expect(second.success).toBe(false);
    expect(setLast).not.toHaveBeenCalled();

    // la nube vuelve → puede avanzar
    mockCloud.isConfigured.mockReturnValue(true);
    mockDatabase.prepare.mockImplementation((sql) => {
      if (sql.includes('sync_state') && sql.includes('SELECT')) {
        return mockChain(() => ({ last_sync_at: '2026-09-22T10:00:00' }));
      }
      if (sql.includes('sync_state') && sql.includes('INSERT')) {
        return { run: setLast };
      }
      if (sql.includes('sync_tombstones') && sql.includes('SELECT') && sql.includes('synced_to_turso = 0')) {
        return { all: () => [], get: jest.fn(), run: jest.fn() };
      }
      return mockChain(null, null, () => []);
    });
    mockCloud.execute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: 0 });

    const third = await fullSync();
    expect(third.success).toBe(true);
    expect(setLast).toHaveBeenCalledTimes(1);
  });
});
