/**
 * Sync Service — Local SQLite ↔ Turso
 *
 * Strategy:
 * - Local SQLite via database.js (all local reads + writes)
 * - Turso via db.js adapter (cloud reads + writes)
 * - Conflict resolution: DELETE always wins over UPDATE
 * - Incremental sync: WHERE updated_at > lastSync
 * - Format: YYYY-MM-DDTHH:mm:ss (ISO 8601 sin milisegundos)
 * - Tombstones: sync_tombstones for DELETE synchronization
 * - Phase 2B-2: DELETE-wins enforcement, correct lastSync handling
 */

const db = require('../database');
const TursoClient = require('../db');

const SYNC_TABLES = [
  'pacientes', 'historias_clinicas', 'consultas', 'odontogramas',
  'tratamientos', 'recetas', 'citas', 'pagos',
  'necesidades_odontologicas', 'imagenes'
];

const CLEAN_TABLES = [
  'pacientes', 'historias_clinicas', 'consultas', 'odontogramas',
  'tratamientos', 'recetas', 'citas', 'pagos',
  'necesidades_odontologicas', 'imagenes'
];

const BATCH_SIZE = 50;

function formatSyncTimestamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, '');
}

function getLastSyncTime() {
  try {
    const row = db.prepare('SELECT last_sync_at FROM sync_state WHERE id = 1').get();
    return row ? row.last_sync_at : null;
  } catch {
    return null;
  }
}

function setLastSyncTime(timestamp) {
  try {
    const ts = timestamp || formatSyncTimestamp(new Date());
    db.prepare(
      "INSERT INTO sync_state (id, last_sync_at, updated_at) VALUES (1, ?, strftime('%Y-%m-%dT%H:%M:%S', 'now')) " +
      'ON CONFLICT(id) DO UPDATE SET last_sync_at = excluded.last_sync_at, updated_at = excluded.updated_at'
    ).run(ts);
  } catch (e) {
    console.error('Error setting last sync time:', e.message);
  }
}

/**
 * Check if a remote tombstone exists for a record in Turso.
 * Returns true if the record should NOT be pushed (DELETE wins remotely).
 */
async function hasRemoteTombstone(tableName, recordId) {
  try {
    const result = await TursoClient.execute({
      sql: 'SELECT 1 FROM sync_tombstones WHERE table_name = ? AND record_id = ?',
      args: [tableName, recordId]
    });
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if a local tombstone exists for a record in SQLite.
 * Returns true if the record should NOT be pulled (DELETE wins locally).
 */
function hasLocalTombstone(tableName, recordId) {
  try {
    const existing = db.prepare(
      'SELECT 1 FROM sync_tombstones WHERE table_name = ? AND record_id = ?'
    ).get(tableName, recordId);
    return !!existing;
  } catch {
    return false;
  }
}

async function pushToTurso(since = null) {
  if (!TursoClient.isTurso()) {
    return { success: false, error: 'Turso not configured' };
  }

  const lastSync = since || getLastSyncTime();
  const results = { pushed: {}, errors: [], skippedByRemoteTombstone: 0 };

  for (const table of SYNC_TABLES) {
    try {
      let rows;
      if (lastSync) {
        rows = db.prepare(`SELECT * FROM ${table} WHERE updated_at > ?`).all(lastSync);
      } else {
        rows = db.prepare(`SELECT * FROM ${table}`).all();
      }

      if (rows.length === 0) continue;

      let pushedCount = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        for (const row of batch) {
          try {
            // DELETE-WINS REMOTO: skip if tombstone exists in Turso
            if (await hasRemoteTombstone(table, row.id)) {
              results.skippedByRemoteTombstone++;
              continue;
            }

            const keys = Object.keys(row);
            const placeholders = keys.map(() => '?').join(', ');
            const updatePlaceholders = keys.filter(k => k !== 'id').map(k => `${k} = excluded.${k}`).join(', ');

            const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
              ON CONFLICT(id) DO UPDATE SET ${updatePlaceholders}`;

            await TursoClient.execute({
              sql,
              args: Object.values(row)
            });
            pushedCount++;
          } catch (e) {
            results.errors.push({ table, id: row.id, error: e.message });
          }
        }
      }

      results.pushed[table] = pushedCount;
    } catch (e) {
      results.errors.push({ table, error: e.message });
    }
  }

  // ============================================================
  // FASE 2B-1: Push pending tombstones to Turso
  // ============================================================
  try {
    const pendingTombstones = db.prepare(
      'SELECT * FROM sync_tombstones WHERE synced_to_turso = 0'
    ).all();

    let pushedTombstones = 0;
    const pushedIds = [];
    for (const ts of pendingTombstones) {
      try {
        await TursoClient.execute({
          sql: `INSERT OR IGNORE INTO sync_tombstones
                (table_name, record_id, deleted_at, source, synced_to_turso, created_at)
                VALUES (?, ?, ?, ?, 1, ?)`,
          args: [ts.table_name, ts.record_id, ts.deleted_at, ts.source, ts.created_at]
        });
        pushedTombstones++;
        pushedIds.push(ts.id);
      } catch (e) {
        results.errors.push({ table: 'sync_tombstones', id: ts.id, error: e.message });
      }
    }

    if (pushedIds.length > 0) {
      const placeholders = pushedIds.map(() => '?').join(',');
      db.prepare(`UPDATE sync_tombstones SET synced_to_turso = 1 WHERE id IN (${placeholders})`).run(...pushedIds);
    }
    results.pushedTombstones = pushedTombstones;
  } catch (e) {
    results.errors.push({ table: 'sync_tombstones', error: e.message });
  }

  // NOTE: setLastSyncTime is NOT called here — fullSync handles it
  return { success: results.errors.length === 0, ...results };
}

async function pullFromTurso(since = null) {
  if (!TursoClient.isTurso()) {
    return { success: false, error: 'Turso not configured' };
  }

  const lastSync = since || getLastSyncTime();
  const results = { pulled: {}, errors: [], skippedByTombstone: 0 };

  // ============================================================
  // FASE 2B-2: Pull remote tombstones FIRST and apply locally
  // This ensures DELETE-wins before any records are inserted.
  // ============================================================
  try {
    let remoteTombstones;
    if (lastSync) {
      remoteTombstones = await TursoClient.execute({
        sql: 'SELECT * FROM sync_tombstones WHERE deleted_at > ?',
        args: [lastSync]
      });
    } else {
      remoteTombstones = await TursoClient.execute({
        sql: 'SELECT * FROM sync_tombstones',
        args: []
      });
    }

    let appliedTombstones = 0;
    let skippedTombstones = 0;

    for (const rt of remoteTombstones.rows) {
      // Check if tombstone already exists locally
      const existing = db.prepare(
        'SELECT 1 FROM sync_tombstones WHERE table_name = ? AND record_id = ?'
      ).get(rt.table_name, rt.record_id);

      if (existing) {
        skippedTombstones++;
        continue;
      }

      // Apply DELETE locally
      try {
        db.prepare(`DELETE FROM ${rt.table_name} WHERE id = ?`).run(rt.record_id);
      } catch (e) {
        // Record may already not exist — that's fine
      }

      // Insert tombstone locally (trigger may have already done this, INSERT OR IGNORE is safe)
      try {
        db.prepare(
          `INSERT OR IGNORE INTO sync_tombstones
           (table_name, record_id, deleted_at, source, synced_to_turso, created_at)
           VALUES (?, ?, ?, 'sync', 1, ?)`
        ).run(rt.table_name, rt.record_id, rt.deleted_at, rt.created_at || formatSyncTimestamp(new Date()));
      } catch (e) {
        // Ignore duplicate
      }

      appliedTombstones++;
    }

    results.pulledTombstones = appliedTombstones;
    results.skippedTombstones = skippedTombstones;
  } catch (e) {
    results.errors.push({ table: 'sync_tombstones', error: e.message });
  }

  // ============================================================
  // FASE 2B-2: Pull records AFTER tombstones, with DELETE-wins check
  // ============================================================
  for (const table of SYNC_TABLES) {
    try {
      let result;
      if (lastSync) {
        result = await TursoClient.execute({
          sql: `SELECT * FROM ${table} WHERE updated_at > ?`,
          args: [lastSync]
        });
      } else {
        result = await TursoClient.execute({ sql: `SELECT * FROM ${table}`, args: [] });
      }

      if (result.rows.length === 0) continue;

      let pulledCount = 0;
      for (const row of result.rows) {
        try {
          // DELETE-WINS LOCAL: skip if tombstone exists locally
          if (hasLocalTombstone(table, row.id)) {
            results.skippedByTombstone++;
            continue;
          }

          const keys = Object.keys(row);
          const placeholders = keys.map(() => '?').join(', ');
          const updatePlaceholders = keys.filter(k => k !== 'id').map(k => `${k} = excluded.${k}`).join(', ');

          const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
            ON CONFLICT(id) DO UPDATE SET ${updatePlaceholders}`;

          db.prepare(sql).run(...Object.values(row));
          pulledCount++;
        } catch (e) {
          results.errors.push({ table, id: row.id, error: e.message });
        }
      }

      results.pulled[table] = pulledCount;
    } catch (e) {
      results.errors.push({ table, error: e.message });
    }
  }

  // NOTE: setLastSyncTime is NOT called here — fullSync handles it
  return { success: results.errors.length === 0, ...results };
}

async function fullSync() {
  const startTime = Date.now();

  // Capture lastSync ONCE before any operations
  const lastSync = getLastSyncTime();

  // Both push and pull use the SAME cursor
  const pushResult = await pushToTurso(lastSync);
  const pullResult = await pullFromTurso(lastSync);

  // Only update lastSync after both complete successfully
  if (pushResult.success && pullResult.success) {
    setLastSyncTime(formatSyncTimestamp(new Date()));
  }

  return {
    success: pushResult.success && pullResult.success,
    push: pushResult,
    pull: pullResult,
    duration: Date.now() - startTime,
    timestamp: formatSyncTimestamp(new Date())
  };
}

function getSyncStatus() {
  const lastSync = getLastSyncTime();
  const isTurso = TursoClient.isTurso();

  let pendingChanges = 0;
  if (lastSync) {
    for (const table of SYNC_TABLES) {
      try {
        const row = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE updated_at > ?`).get(lastSync);
        pendingChanges += row.count;
      } catch {}
    }
  }

  let pendingTombstones = 0;
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM sync_tombstones WHERE synced_to_turso = 0').get();
    pendingTombstones = row.count;
  } catch {}

  return {
    isTurso,
    lastSync,
    pendingChanges,
    pendingTombstones,
    tables: SYNC_TABLES
  };
}

function cleanLocalData(tables = null) {
  const targetTables = tables || CLEAN_TABLES;
  const results = {};

  for (const table of targetTables) {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
      db.prepare(`DELETE FROM ${table}`).run();
      results[table] = count;
    } catch (e) {
      results[table] = `error: ${e.message}`;
    }
  }

  return results;
}

module.exports = {
  pushToTurso,
  pullFromTurso,
  fullSync,
  getSyncStatus,
  cleanLocalData,
  getLastSyncTime,
  setLastSyncTime,
  formatSyncTimestamp,
  SYNC_TABLES,
  CLEAN_TABLES,
  BATCH_SIZE
};
