/**
 * Sync Service — Local SQLite ↔ Turso
 *
 * Strategy (C1: DB_MODE separa CRUD de nube):
 * - Local SQLite via database.js (all local reads + writes) — lado local del sync
 * - Turso via cloudClient (cloud reads + writes) — solo sync, no CRUD
 * - Conflict resolution: DELETE always wins over UPDATE
 * - Guards: created_at linaje + updated_at LWW en upserts (barrera anti-corrupción,
 *   NO es identidad multi-dispositivo definitiva — pendiente)
 * - Incremental sync: WHERE updated_at > lastSync
 * - Bootstrap: last_sync_at NULL ⇒ pull total → fence sqlite_sequence → push → cursor
 * - Format: YYYY-MM-DDTHH:mm:ss (ISO 8601 sin milisegundos)
 * - Tombstones: sync_tombstones for DELETE synchronization
 * - Phase 2B-2: DELETE-wins enforcement, correct lastSync handling
 */

const db = require('../database');
const cloudClient = require('../cloudClient');

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
    console.error('Error setting sync time:', e.message);
  }
}

/**
 * Upsert con barreras:
 * 1) created_at distinto ⇒ otra fila con el mismo id ⇒ idCollision (no sobrescribe)
 * 2) updated_at entrante más viejo ⇒ skip stale (LWW, no pisa versión más nueva)
 * NOTA: protección contra corrupción silenciosa, NO identidad offline multi-dispositivo definitiva.
 */
function buildGuardedUpsertSql(table, row) {
  const keys = Object.keys(row);
  const placeholders = keys.map(() => '?').join(', ');
  const updateCols = keys.filter(k => k !== 'id');
  const updateList = updateCols.map(k => `${k} = excluded.${k}`).join(', ');
  return `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET ${updateList}
    WHERE ${table}.created_at = excluded.created_at
      AND COALESCE(excluded.updated_at, '') >= COALESCE(${table}.updated_at, '')`;
}

function classifyUpsertSkip(existing, incoming) {
  if (!existing) return 'anomaly';
  const exCreated = existing.created_at != null ? String(existing.created_at) : '';
  const inCreated = incoming.created_at != null ? String(incoming.created_at) : '';
  if (exCreated !== inCreated) return 'idCollision';
  return 'stale';
}

/**
 * Check if a remote tombstone exists for a record in Turso.
 * Returns true if the record should NOT be pushed (DELETE wins remotely).
 */
async function hasRemoteTombstone(tableName, recordId) {
  try {
    const result = await cloudClient.execute({
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

/**
 * Ajusta sqlite_sequence local al máximo id conocido (post-pull en bootstrap)
 * para que los próximos AUTOINCREMENT no colisionen con ids de la nube.
 */
function fenceLocalSequences() {
  const results = { fences: {}, errors: [], success: true };
  for (const table of SYNC_TABLES) {
    try {
      const maxRow = db.prepare(`SELECT COALESCE(MAX(id), 0) AS maxId FROM ${table}`).get();
      const fence = maxRow && maxRow.maxId != null ? Number(maxRow.maxId) : 0;
      const seqRow = db.prepare(`SELECT seq FROM sqlite_sequence WHERE name = ?`).get(table);
      if (!seqRow) {
        if (fence > 0) {
          db.prepare(`INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)`).run(table, fence);
        }
      } else if (fence > Number(seqRow.seq)) {
        db.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = ?`).run(fence, table);
      }
      results.fences[table] = fence;
    } catch (e) {
      results.errors.push({ table, error: e.message });
      results.success = false;
    }
  }
  return results;
}

async function pushToTurso(since = null) {
  if (!cloudClient.isConfigured()) {
    return { success: false, error: 'Turso not configured' };
  }

  const lastSync = since || getLastSyncTime();
  const results = {
    pushed: {}, errors: [], skippedByRemoteTombstone: 0,
    idCollisions: [], skippedStale: 0
  };

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

            const sql = buildGuardedUpsertSql(table, row);
            const result = await cloudClient.execute({
              sql,
              args: Object.values(row)
            });

            if (result.rowsAffected > 0) {
              pushedCount++;
            } else {
              const exRes = await cloudClient.execute({
                sql: `SELECT created_at, updated_at FROM ${table} WHERE id = ?`,
                args: [row.id]
              });
              const kind = classifyUpsertSkip(exRes.rows[0], row);
              if (kind === 'idCollision') {
                results.idCollisions.push({ table, id: row.id, direction: 'push' });
              } else if (kind === 'stale') {
                results.skippedStale++;
              } else {
                results.errors.push({ table, id: row.id, error: 'upsert guard rejected without existing row' });
              }
            }
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
        await cloudClient.execute({
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
  return {
    success: results.errors.length === 0 && results.idCollisions.length === 0,
    ...results
  };
}

async function pullFromTurso(since = null) {
  if (!cloudClient.isConfigured()) {
    return { success: false, error: 'Turso not configured' };
  }

  const lastSync = since || getLastSyncTime();
  const results = {
    pulled: {}, errors: [], skippedByTombstone: 0,
    idCollisions: [], skippedStale: 0
  };

  // ============================================================
  // FASE 2B-2: Pull remote tombstones FIRST and apply locally.
  // This ensures DELETE-wins before any records are inserted.
  // ============================================================
  try {
    let remoteTombstones;
    if (lastSync) {
      remoteTombstones = await cloudClient.execute({
        sql: 'SELECT * FROM sync_tombstones WHERE deleted_at > ?',
        args: [lastSync]
      });
    } else {
      remoteTombstones = await cloudClient.execute({
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
        result = await cloudClient.execute({
          sql: `SELECT * FROM ${table} WHERE updated_at > ?`,
          args: [lastSync]
        });
      } else {
        result = await cloudClient.execute({ sql: `SELECT * FROM ${table}`, args: [] });
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

          const sql = buildGuardedUpsertSql(table, row);
          const runResult = db.prepare(sql).run(...Object.values(row));
          const changes = runResult && runResult.changes != null ? Number(runResult.changes) : 0;

          if (changes > 0) {
            pulledCount++;
          } else {
            const existing = db.prepare(
              `SELECT created_at, updated_at FROM ${table} WHERE id = ?`
            ).get(row.id);
            const kind = classifyUpsertSkip(existing, row);
            if (kind === 'idCollision') {
              results.idCollisions.push({ table, id: row.id, direction: 'pull' });
            } else if (kind === 'stale') {
              results.skippedStale++;
            } else {
              results.errors.push({ table, id: row.id, error: 'upsert guard rejected without existing row' });
            }
          }
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
  return {
    success: results.errors.length === 0 && results.idCollisions.length === 0,
    ...results
  };
}

/**
 * Bootstrap (last_sync_at IS NULL): pull total → fence sqlite_sequence → push → cursor.
 * El cursor solo avanza si todo el bootstrap termina bien (incluye idCollisions=0).
 */
async function bootstrapSync(startTime) {
  const timestamp = formatSyncTimestamp(new Date());
  const pullResult = await pullFromTurso(null);

  if (!pullResult.success) {
    return {
      success: false,
      bootstrap: true,
      pull: pullResult,
      push: { success: false, error: pullResult.error || 'bootstrap pull failed' },
      fence: null,
      duration: Date.now() - startTime,
      timestamp
    };
  }

  const fence = fenceLocalSequences();
  if (!fence.success) {
    return {
      success: false,
      bootstrap: true,
      pull: pullResult,
      push: { success: false, error: 'bootstrap fence failed' },
      fence,
      duration: Date.now() - startTime,
      timestamp
    };
  }

  const pushResult = await pushToTurso(null);
  const success = pullResult.success && pushResult.success;
  if (success) {
    setLastSyncTime(formatSyncTimestamp(new Date()));
  }

  return {
    success,
    bootstrap: true,
    pull: pullResult,
    push: pushResult,
    fence,
    duration: Date.now() - startTime,
    timestamp
  };
}

async function fullSync() {
  const startTime = Date.now();

  // Capture lastSync ONCE before any operations
  const lastSync = getLastSyncTime();

  // Bootstrap: cursor NULL ⇒ pull total → fence → push → cursor al final
  if (!lastSync) {
    return await bootstrapSync(startTime);
  }

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
  const isTurso = cloudClient.isConfigured();

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
    const row = db.prepare(`SELECT COUNT(*) as count FROM sync_tombstones WHERE synced_to_turso = 0`).get();
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
  fenceLocalSequences,
  buildGuardedUpsertSql,
  SYNC_TABLES,
  CLEAN_TABLES,
  BATCH_SIZE
};
