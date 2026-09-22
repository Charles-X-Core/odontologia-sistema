/**
 * Sync Service — Local SQLite ↔ Turso
 *
 * Strategy:
 * - Local SQLite via database.js (all local reads + writes)
 * - Turso via db.js adapter (cloud reads + writes)
 * - Conflict resolution: last-write-wins (updated_at)
 * - Incremental sync: WHERE updated_at > lastSync
 * - Format: YYYY-MM-DDTHH:mm:ss (ISO 8601 sin milisegundos)
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

async function pushToTurso(since = null) {
  if (!TursoClient.isTurso()) {
    return { success: false, error: 'Turso not configured' };
  }

  const lastSync = since || getLastSyncTime();
  const results = { pushed: {}, errors: [] };

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

  setLastSyncTime(formatSyncTimestamp(new Date()));
  return { success: true, ...results };
}

async function pullFromTurso(since = null) {
  if (!TursoClient.isTurso()) {
    return { success: false, error: 'Turso not configured' };
  }

  const lastSync = since || getLastSyncTime();
  const results = { pulled: {}, errors: [] };

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

  setLastSyncTime(formatSyncTimestamp(new Date()));
  return { success: true, ...results };
}

async function fullSync() {
  const startTime = Date.now();

  const pushResult = await pushToTurso();
  const pullResult = await pullFromTurso();

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

  return {
    isTurso,
    lastSync,
    pendingChanges,
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
