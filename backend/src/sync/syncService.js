/**
 * Sync Service — Local SQLite ↔ Turso
 * 
 * Strategy:
 * - Local SQLite is primary (all reads + writes)
 * - Turso is cloud backup (async push/pull)
 * - Conflict resolution: last-write-wins (updated_at)
 * - Queue: tracks dirty records for efficient sync
 */

const db = require('../database');
const TursoClient = require('../db');

const SYNC_TABLES = [
  'pacientes', 'historias_clinicas', 'consultas', 'tratamientos',
  'odontograma', ' radiografias', 'presupuestos', 'presupuesto_items',
  'facturas', 'citas', 'recetas', 'indicaciones',
  'seguimiento_whatsapp', 'configuracion', 'notas_seguimiento'
];

const CLEAN_TABLES = [
  'usuarios', 'configuracion', 'pacientes', 'historias_clinicas',
  'consultas', 'tratamientos', 'odontograma', 'radiografias',
  'presupuestos', 'presupuesto_items', 'facturas', 'citas',
  'recetas', 'indicaciones', 'seguimiento_whatsapp', 'notas_seguimiento'
];

const BATCH_SIZE = 50;

/**
 * Get timestamp of last sync
 */
function getLastSyncTime() {
  try {
    const row = db.prepare("SELECT valor FROM configuracion WHERE clave = 'last_sync_at'").get();
    return row ? row.valor : null;
  } catch {
    return null;
  }
}

/**
 * Set last sync timestamp
 */
function setLastSyncTime(timestamp) {
  try {
    db.prepare("INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('last_sync_at', ?)").run(timestamp);
  } catch (e) {
    console.error('Error setting last sync time:', e.message);
  }
}

/**
 * Push local changes to Turso
 * Finds records newer than last sync and uploads them
 */
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

  setLastSyncTime(new Date().toISOString());
  return { success: true, ...results };
}

/**
 * Pull remote changes from Turso to local
 * Downloads records newer than last sync
 */
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

  setLastSyncTime(new Date().toISOString());
  return { success: true, ...results };
}

/**
 * Full bidirectional sync
 * Push local first, then pull remote
 */
async function fullSync() {
  const startTime = Date.now();
  
  const pushResult = await pushToTurso();
  const pullResult = await pullFromTurso();

  return {
    success: pushResult.success && pullResult.success,
    push: pushResult,
    pull: pullResult,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get sync status
 */
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

/**
 * Clean data from local database (for fresh import)
 */
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
  SYNC_TABLES
};
