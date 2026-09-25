/**
 * Sync Service — Local SQLite ↔ Turso (C4.2.5)
 *
 * Bootstrap (last_sync_at NULL) — NO push ciego:
 * - A1 empty local  → pull total → tombstones → fence → cursor (SIN push de contenido)
 * - A2 with data    → pull → abortar si idCollision → fence → cursor
 *                      push PROHIBIDO salvo options.admitLocalPush === true
 * - idCollision en pull → aborta bootstrap completo, cursor queda NULL
 * - Incremental: idCollision NO avanza last_sync_at
 *
 * Guards: created_at lineage (COALESCE) + updated_at LWW.
 * Histórico consultas.created_at puede ser NULL (sin backfill).
 * Residual: ambos NULL + ids realmente distintos NO es detectable por linaje.
 */

const cloudClient = require('../cloudClient');
const crypto = require('crypto');

/**
 * C4.3 serverless: NO abrir SQLite en require-time.
 * `database.js` crea DatabaseSync(clinica.db) al importarse; en Vercel
 * (/var/task read-only) eso lanza "unable to open database file" y tumba
 * el montaje de /api/sync (y de todo lo que usa bootstrapGate).
 * localDb() difiere el require al primer uso real. En Desktop el
 * comportamiento es idéntico (require cache = mismo singleton).
 * En cloud sin SQLite local, los callers ya toleran el throw
 * (getLastSyncTime/getSyncStateRow/getLocalColumns → null; fence → error
 * por tabla; bootstrapGate → BOOTSTRAP_PENDING fail-safe).
 */
function localDb() {
  return require('../database');
}

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

/**
 * Ventana conservadora del cursor de admisión (C4.2.5).
 * admitExistingReplica fija last_sync_at 24h en el pasado para que el
 * siguiente incremental re-consulte cambios recientes de PROD ocurridos
 * entre la verificación externa y la admisión. El LWW existente resuelve
 * lo ya coincidente como stale/unchanged (escrituras no-op con mismos
 * valores); lo realmente nuevo en remoto se aplica por pull.
 */
const ADMIT_REPLICA_CURSOR_LOOKBACK_MS = 24 * 60 * 60 * 1000;

const columnCache = new Map();

function formatSyncTimestamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, '');
}

function getLocalColumns(table) {
  const key = `local:${table}`;
  if (columnCache.has(key)) return columnCache.get(key);
  try {
    const rows = localDb().prepare(`PRAGMA table_info(${table})`).all();
    const names = rows.map((r) => r.name).filter(Boolean);
    if (!names.length) return null;
    columnCache.set(key, names);
    return names;
  } catch {
    return null;
  }
}

function hasLocalColumn(table, column) {
  const cols = getLocalColumns(table);
  if (!cols) return false;
  return cols.includes(column);
}

function filterRowToLocal(table, row) {
  const cols = getLocalColumns(table);
  if (!cols || !cols.length) return row;
  const out = {};
  for (const k of Object.keys(row)) {
    if (cols.includes(k)) out[k] = row[k];
  }
  return Object.keys(out).length ? out : row;
}

function filterRowToKeys(row, allowedKeys) {
  if (!allowedKeys || !allowedKeys.length) return row;
  const out = {};
  for (const k of Object.keys(row)) {
    if (allowedKeys.includes(k)) out[k] = row[k];
  }
  return Object.keys(out).length ? out : row;
}

function getLastSyncTime() {
  try {
    const row = localDb().prepare('SELECT last_sync_at FROM sync_state WHERE id = 1').get();
    return row ? row.last_sync_at : null;
  } catch {
    return null;
  }
}

function getSyncStateRow() {
  try {
    return localDb().prepare(
      'SELECT last_sync_at, device_id, bootstrap_completed_at FROM sync_state WHERE id = 1'
    ).get() || null;
  } catch {
    return null;
  }
}

function ensureDeviceId() {
  try {
    const row = localDb().prepare('SELECT device_id FROM sync_state WHERE id = 1').get();
    if (row && row.device_id) return row.device_id;
    const id = crypto.randomUUID();
    localDb().prepare(
      "INSERT INTO sync_state (id, device_id) VALUES (1, ?) " +
      'ON CONFLICT(id) DO UPDATE SET device_id = excluded.device_id'
    ).run(id);
    return id;
  } catch {
    return null;
  }
}

function setLastSyncTime(timestamp) {
  try {
    const ts = timestamp || formatSyncTimestamp(new Date());
    let deviceId = null;
    try {
      const row = localDb().prepare('SELECT device_id FROM sync_state WHERE id = 1').get();
      deviceId = row && row.device_id ? row.device_id : crypto.randomUUID();
    } catch {
      deviceId = crypto.randomUUID();
    }
    localDb().prepare(
      "INSERT INTO sync_state (id, last_sync_at, device_id, bootstrap_completed_at, updated_at) " +
      "VALUES (1, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%S', 'now')) " +
      'ON CONFLICT(id) DO UPDATE SET last_sync_at = excluded.last_sync_at, ' +
      'device_id = COALESCE(sync_state.device_id, excluded.device_id), ' +
      'bootstrap_completed_at = COALESCE(sync_state.bootstrap_completed_at, excluded.bootstrap_completed_at), ' +
      'updated_at = excluded.updated_at'
    ).run(ts, deviceId, ts);
  } catch (e) {
    console.error('Error setting sync time:', e.message);
  }
}

/**
 * Invalida el cursor (restore / re-bootstrap manual). last_sync_at → NULL.
 * No borra datos clínicos.
 */
function invalidateCursor(reason = 'manual') {
  try {
    localDb().prepare(
      'UPDATE sync_state SET last_sync_at = NULL, bootstrap_completed_at = NULL, updated_at = ? WHERE id = 1'
    ).run(formatSyncTimestamp(new Date()));
    return { success: true, reason };
  } catch (e) {
    return { success: false, reason, error: e.message };
  }
}

/**
 * Admite una réplica local existente previamente verificada (C4.2.5).
 *
 * Caso: la SQLite local es copia del contenido PROD (conteos + SHA por
 * contenido verificados fuera de banda) y el bootstrap A2 aborta por
 * idCollision, correctamente. Esta función establece el cursor SIN push:
 *
 *   admitLocalPush      = permite push de contenido local en A2.
 *   admitExistingReplica = confirma réplica verificada, ZERO push.
 *
 * Semánticas deliberadamente distintas; esta función NUNCA llama a
 * pushToTurso() y NO modifica ni borra ninguna tabla clínica. Solo toca
 * sync_state (device_id + cursor) vía la lógica existente.
 *
 * @param {object} [options] — ignorado a propósito: ningún parámetro
 *   puede habilitar push por esta vía.
 */
function admitExistingReplica(options = {}) {
  void options;
  if (!cloudClient.isConfigured()) {
    return { success: false, admitted: null, error: 'Turso not configured' };
  }
  const lastSync = getLastSyncTime();
  if (lastSync) {
    return {
      success: false,
      admitted: null,
      error: 'BOOTSTRAP_ALREADY_COMPLETED',
      code: 'BOOTSTRAP_ALREADY_COMPLETED',
      lastSync,
    };
  }
  const classification = classifyBootstrapScenario();
  if (!classification || classification.scenario !== 'A2_with_data') {
    return {
      success: false,
      admitted: null,
      error: 'ADMIT_REPLICA_A1_EMPTY',
      code: 'ADMIT_REPLICA_A1_EMPTY',
      message: 'Solo una réplica con datos (A2) puede admitirse; A1 vacío requiere pull.',
      classification,
    };
  }
  const deviceId = ensureDeviceId();
  // Cursor deliberadamente en el pasado (nunca "now", nunca timestamp
  // externo/HTTP): cubre la ventana verificación→admisión. ZERO push igual.
  const ts = formatSyncTimestamp(new Date(Date.now() - ADMIT_REPLICA_CURSOR_LOOKBACK_MS));
  setLastSyncTime(ts);
  return {
    success: true,
    admitted: 'existing_replica',
    admittedReplica: true,
    zeroPush: true,
    pushExecuted: false,
    lastSyncAt: ts,
    bootstrapCompletedAt: ts,
    deviceId,
    classification,
  };
}

function classifyBootstrapScenario() {
  let localRows = 0;
  for (const t of SYNC_TABLES) {
    try {
      const row = localDb().prepare(`SELECT COUNT(*) AS c FROM ${t}`).get();
      localRows += Number(row && row.c) || 0;
    } catch {
      /* tabla ausente */
    }
  }
  if (localRows === 0) {
    return { scenario: 'A1_empty', localRows: 0, lastSync: getLastSyncTime() };
  }
  return {
    scenario: 'A2_with_data',
    localRows,
    lastSync: getLastSyncTime(),
    note: 'Sin last_sync_at: datos locales no admiten push automático en bootstrap'
  };
}

/**
 * Upsert con barreras (C4.2.5):
 * - created_at lineage con COALESCE (NULL ≡ NULL = misma línea desconocida → solo LWW)
 * - NULL vs valor ⇒ no igual ⇒ se rechaza (idCollision en classify)
 * - Si la tabla no tiene created_at, solo LWW (compat pre-C4 remoto)
 * - updated_at: COALESCE LWW
 */
/**
 * @param {object} row
 * @param {{ hasCreatedAt?: boolean }} [opts] — lado de la tabla:
 *   push → presencia de created_at en REMOTO; pull → en LOCAL.
 *   Si no se pasa, usa el esquema local (compat).
 */
function buildGuardedUpsertSql(table, row, opts = {}) {
  const keys = Object.keys(row);
  const placeholders = keys.map(() => '?').join(', ');
  const updateCols = keys.filter((k) => k !== 'id');
  const updateList = updateCols.map((k) => `${k} = excluded.${k}`).join(', ');

  const conditions = [];
  const hasCreated =
    opts.hasCreatedAt != null ? opts.hasCreatedAt : hasLocalColumn(table, 'created_at');
  const rowHasCreated = Object.prototype.hasOwnProperty.call(row, 'created_at');

  if (hasCreated) {
    if (rowHasCreated) {
      conditions.push(`COALESCE(${table}.created_at, '') = COALESCE(excluded.created_at, '')`);
    } else {
      conditions.push(`COALESCE(${table}.created_at, '') = ''`);
    }
  }

  conditions.push(
    `COALESCE(excluded.updated_at, '') >= COALESCE(${table}.updated_at, '')`
  );

  return `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET ${updateList}
    WHERE ${conditions.join(' AND ')}`;
}

function classifyUpsertSkip(existing, incoming) {
  if (!existing) return 'anomaly';
  const exHas = existing.created_at !== undefined;
  const inHas = incoming && incoming.created_at !== undefined;
  if (!exHas && !inHas) {
    return 'stale';
  }
  const exCreated = existing.created_at != null ? String(existing.created_at) : '';
  const inCreated = incoming && incoming.created_at != null ? String(incoming.created_at) : '';
  if (exCreated !== inCreated) return 'idCollision';
  return 'stale';
}

function hasLocalTombstone(tableName, recordId) {
  try {
    const existing = localDb().prepare(
      'SELECT 1 FROM sync_tombstones WHERE table_name = ? AND record_id = ?'
    ).get(tableName, recordId);
    return !!existing;
  } catch {
    return false;
  }
}

/**
 * Proyecto 2 — citas.usuario_id es referencia LOCAL no portable (quién
 * registró la cita en esa instalación; usuarios nunca se sincroniza).
 * Comprueba en destino remoto con caché por ejecución (una consulta por
 * usuario_id distinto, no N+1 por fila). Ante error se asume ausente:
 * NULL siempre satisface la FK, es la dirección segura.
 */
async function remoteUsuarioExists(userId, cache) {
  if (cache.has(userId)) return cache.get(userId);
  let exists = false;
  try {
    const r = await cloudClient.execute({
      sql: 'SELECT 1 AS one FROM usuarios WHERE id = ?',
      args: [userId]
    });
    exists = Array.isArray(r.rows) && r.rows.length > 0;
  } catch {
    exists = false;
  }
  cache.set(userId, exists);
  return exists;
}

function fenceLocalSequences() {
  const results = { fences: {}, errors: [], success: true };
  for (const table of SYNC_TABLES) {
    try {
      const maxRow = localDb().prepare(`SELECT COALESCE(MAX(id), 0) AS maxId FROM ${table}`).get();
      const fence = maxRow && maxRow.maxId != null ? Number(maxRow.maxId) : 0;
      const seqRow = localDb().prepare(`SELECT seq FROM sqlite_sequence WHERE name = ?`).get(table);
      if (!seqRow) {
        if (fence > 0) {
          localDb().prepare(`INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)`).run(table, fence);
        }
      } else if (fence > Number(seqRow.seq)) {
        localDb().prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = ?`).run(fence, table);
      }
      results.fences[table] = fence;
    } catch (e) {
      results.errors.push({ table, error: e.message });
      results.success = false;
    }
  }
  return results;
}

async function fetchRemoteColumns(table) {
  const key = `remote:${table}`;
  if (columnCache.has(key)) return columnCache.get(key);

  let names = null;
  try {
    const t = await cloudClient.execute({ sql: `PRAGMA table_info(${table})`, args: [] });
    if (t && Array.isArray(t.rows) && t.rows.length) {
      names = t.rows.map((row) => row.name).filter(Boolean);
    }
  } catch {
    /* fallback */
  }
  if (!names || !names.length) {
    try {
      const r = await cloudClient.execute({ sql: `SELECT * FROM ${table} LIMIT 1`, args: [] });
      if (r && Array.isArray(r.rows) && r.rows.length) {
        names = Object.keys(r.rows[0]);
      }
    } catch {
      /* fallback */
    }
  }
  if (names && names.length) {
    columnCache.set(key, names);
    return names;
  }
  return null;
}

async function classifyRemoteSkip(table, row) {
  const remoteCols = await fetchRemoteColumns(table);
  const wantsCreated = !remoteCols || !remoteCols.length || remoteCols.includes('created_at');
  try {
    const sql = wantsCreated
      ? `SELECT created_at, updated_at FROM ${table} WHERE id = ?`
      : `SELECT updated_at FROM ${table} WHERE id = ?`;
    const exRes = await cloudClient.execute({ sql, args: [row.id] });
    return classifyUpsertSkip(exRes.rows[0], wantsCreated ? row : { updated_at: row.updated_at });
  } catch {
    return 'anomaly';
  }
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
  // Snapshot único de tombstones remotos: 1 query por ejecución en vez de
  // 1 por fila (N+1). Misma semántica delete-wins, solo cambia el momento
  // de lectura (más consistente, no menos).
  // Si el snapshot falla: conjunto vacío. Es idéntico resultado que el
  // comportamiento previo, donde cada hasRemoteTombstone() individual
  // devolvía false al fallar. No se oculta nada: si el upsert posterior
  // falla, su error se registra igual en results.errors.
  let remoteTombstones = new Set();
  try {
    const t = await cloudClient.execute({
      sql: 'SELECT table_name, record_id FROM sync_tombstones',
      args: []
    });
    for (const r of (t && t.rows) || []) {
      if (r && r.table_name !== undefined && r.record_id !== undefined) {
        remoteTombstones.add(`${r.table_name}:${r.record_id}`);
      }
    }
  } catch {
    remoteTombstones = new Set();
  }
  // Caché por ejecución para la comprobación de usuarios remotos.
  const usuarioRemotoCache = new Map();

  // Cliente batch: 1 round-trip por lote de hasta BATCH_SIZE en vez de 1
  // por fila. batch() es transaccional (aborta al primer fallo), así que
  // ante error se reintenta el lote fila por fila con la semántica exacta
  // previa (errores/colisiones/stale por fila). Si el driver no expone
  // batch (tests viejos, mocks), se usa siempre la vía secuencial.
  // Rama de lectura de la respuesta: idéntica en ambas vías.
  async function classifyAndRecord(table, raw) {
    const kind = await classifyRemoteSkip(table, raw);
    if (kind === 'idCollision') {
      results.idCollisions.push({ table, id: raw.id, direction: 'push' });
    } else if (kind === 'stale') {
      results.skippedStale++;
    } else {
      results.errors.push({ table, id: raw.id, error: 'upsert guard rejected without existing row' });
    }
  }

  let batchClient = null;
  try {
    const c = cloudClient.getClient ? cloudClient.getClient() : null;
    if (c && typeof c.batch === 'function') batchClient = c;
  } catch {
    batchClient = null;
  }

  for (const table of SYNC_TABLES) {
    try {
      let rows;
      if (lastSync) {
        rows = localDb().prepare(`SELECT * FROM ${table} WHERE updated_at > ?`).all(lastSync);
      } else {
        rows = localDb().prepare(`SELECT * FROM ${table}`).all();
      }

      if (rows.length === 0) continue;

      const remoteCols = await fetchRemoteColumns(table);
      let pushedCount = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        // Fase A (sin cambios semánticos): filtros en memoria + adaptación
        // usuario_id; los errores de preparación se registran igual que antes.
        const prepared = [];
        for (const raw of batch) {
          try {
            if (remoteTombstones.has(`${table}:${raw.id}`)) {
              results.skippedByRemoteTombstone++;
              continue;
            }

            const row = remoteCols && remoteCols.length ? filterRowToKeys(raw, remoteCols) : raw;
            // Proyecto 2 — referencia LOCAL no portable: si la cita lleva
            // usuario_id pero ese usuario no existe en destino, se envía
            // NULL. Solo afecta la copia del upsert remoto: pushToTurso
            // jamás escribe en SQLite local, así que el original queda intacto.
            // NULL conserva NULL sin consultar. Con esto una cita huérfana
            // no falla por FK y el cursor puede seguir avanzando.
            if (table === 'citas' && row.usuario_id !== null && row.usuario_id !== undefined) {
              try {
                const exists = await remoteUsuarioExists(row.usuario_id, usuarioRemotoCache);
                if (!exists) row.usuario_id = null;
              } catch {
                /* ante duda, conservar comportamiento previo */
              }
            }
            const hasCreatedAt = !remoteCols || !remoteCols.length || remoteCols.includes('created_at');
            const sql = buildGuardedUpsertSql(table, row, { hasCreatedAt });
            prepared.push({ raw, sql, args: Object.values(row) });
          } catch (e) {
            results.errors.push({ table, id: raw.id, error: e.message });
          }
        }
        if (prepared.length === 0) continue;
        // Fase B: escritura por batch (1 round-trip por lote) con fallback
        // secuencial idéntico si el batch aborta. Mismos contadores y ramas.
        let batched = null;
        if (batchClient) {
          try {
            const out = await batchClient.batch(prepared.map((p) => ({ sql: p.sql, args: p.args })));
            if (Array.isArray(out) && out.length === prepared.length) batched = out;
          } catch {
            batched = null;
          }
        }
        if (batched) {
          for (let k = 0; k < prepared.length; k++) {
            const affected = Number(batched[k] && batched[k].rowsAffected) || 0;
            if (affected > 0) {
              pushedCount++;
            } else {
              await classifyAndRecord(table, prepared[k].raw);
            }
          }
        } else {
          for (const p of prepared) {
            try {
              const single = await cloudClient.execute({ sql: p.sql, args: p.args });
              if (single.rowsAffected > 0) {
                pushedCount++;
              } else {
                await classifyAndRecord(table, p.raw);
              }
            } catch (e) {
              results.errors.push({ table, id: p.raw.id, error: e.message });
            }
          }
        }
      }

      results.pushed[table] = pushedCount;
    } catch (e) {
      results.errors.push({ table, error: e.message });
    }
  }

  try {
    const pendingTombstones = localDb().prepare(
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
      localDb().prepare(`UPDATE sync_tombstones SET synced_to_turso = 1 WHERE id IN (${placeholders})`).run(...pushedIds);
    }
    results.pushedTombstones = pushedTombstones;
  } catch (e) {
    results.errors.push({ table: 'sync_tombstones', error: e.message });
  }

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
      const existing = localDb().prepare(
        'SELECT 1 FROM sync_tombstones WHERE table_name = ? AND record_id = ?'
      ).get(rt.table_name, rt.record_id);

      if (existing) {
        skippedTombstones++;
        continue;
      }

      try {
        localDb().prepare(`DELETE FROM ${rt.table_name} WHERE id = ?`).run(rt.record_id);
      } catch (e) {
        /* ya borrado */
      }

      try {
        localDb().prepare(
          `INSERT OR IGNORE INTO sync_tombstones
           (table_name, record_id, deleted_at, source, synced_to_turso, created_at)
           VALUES (?, ?, ?, 'sync', 1, ?)`
        ).run(rt.table_name, rt.record_id, rt.deleted_at, rt.created_at || formatSyncTimestamp(new Date()));
      } catch (e) {
        /* duplicado */
      }

      appliedTombstones++;
    }

    results.pulledTombstones = appliedTombstones;
    results.skippedTombstones = skippedTombstones;
  } catch (e) {
    results.errors.push({ table: 'sync_tombstones', error: e.message });
  }

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
      for (const remoteRow of result.rows) {
        try {
          if (hasLocalTombstone(table, remoteRow.id)) {
            results.skippedByTombstone++;
            continue;
          }

          const row = filterRowToLocal(table, remoteRow);
          // C4.3: citas.usuario_id referencia usuarios(id), tabla deliberadamente
          // fuera de SYNC_TABLES. En bootstrap A1 (local vacío) el pull de citas
          // con usuario_id huérfano rompería por FOREIGN KEY. La columna es
          // opcional (ON DELETE SET NULL): si el usuario no existe en local,
          // se nulifica SOLO esa FK y el pull continúa. PRAGMA foreign_keys
          // sigue activo; no se toca lineage/LWW/tombstones/cursors.
          if (table === 'citas' && row.usuario_id !== null && row.usuario_id !== undefined) {
            try {
              const userExists = localDb().prepare(
                'SELECT 1 FROM usuarios WHERE id = ?'
              ).get(row.usuario_id);
              if (!userExists) row.usuario_id = null;
            } catch {
              /* sin tabla usuarios: conservar comportamiento previo */
            }
          }
          // Proyecto 2 — referencia LOCAL no portable, sentido inverso: un
          // usuario_id remoto NULL (p. ej. degradado por el push) NUNCA debe
          // borrar el registrante local. Solo esta columna; el resto del
          // merge (LWW/lineage/tombstones) queda intacto.
          if (
            table === 'citas' &&
            row.usuario_id === null &&
            hasLocalColumn(table, 'usuario_id')
          ) {
            try {
              const existing = localDb().prepare(
                'SELECT usuario_id FROM citas WHERE id = ?'
              ).get(row.id);
              if (existing && existing.usuario_id !== null && existing.usuario_id !== undefined) {
                row.usuario_id = existing.usuario_id;
              }
            } catch {
              /* conservar comportamiento previo */
            }
          }
          const hasCreatedAt = hasLocalColumn(table, 'created_at');
          const sql = buildGuardedUpsertSql(table, row, { hasCreatedAt });
          const runResult = localDb().prepare(sql).run(...Object.values(row));
          const changes = runResult && runResult.changes != null ? Number(runResult.changes) : 0;

          if (changes > 0) {
            pulledCount++;
          } else {
            const existing = hasLocalColumn(table, 'created_at')
              ? localDb().prepare(`SELECT created_at, updated_at FROM ${table} WHERE id = ?`).get(row.id)
              : localDb().prepare(`SELECT updated_at FROM ${table} WHERE id = ?`).get(row.id);
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
          results.errors.push({ table, id: remoteRow.id, error: e.message });
        }
      }

      results.pulled[table] = pulledCount;
    } catch (e) {
      results.errors.push({ table, error: e.message });
    }
  }

  return {
    success: results.errors.length === 0 && results.idCollisions.length === 0,
    ...results
  };
}

function skippedPush(reason) {
  return {
    success: true,
    skipped: true,
    reason,
    pushed: {},
    errors: [],
    idCollisions: [],
    skippedStale: 0,
    skippedByRemoteTombstone: 0
  };
}

function abortedPush(reason) {
  return {
    success: false,
    skipped: true,
    aborted: true,
    reason,
    pushed: {},
    errors: [],
    idCollisions: [],
    skippedStale: 0,
    skippedByRemoteTombstone: 0
  };
}

/**
 * Bootstrap C4.2.5:
 * A1 vacío: pull-only (sin push de contenido).
 * A2 con datos: pull; colisión aborta; push prohibido salvo admitLocalPush.
 */
async function bootstrapSync(startTime, options = {}) {
  const timestamp = formatSyncTimestamp(new Date());
  const classification = classifyBootstrapScenario();

  const pullResult = await pullFromTurso(null);

  if (!pullResult.success) {
    return {
      success: false,
      bootstrap: true,
      classification,
      aborted: pullResult.idCollisions && pullResult.idCollisions.length
        ? 'idCollision'
        : 'pull_failed',
      pull: pullResult,
      push: abortedPush(pullResult.error || 'bootstrap pull failed'),
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
      classification,
      aborted: 'fence_failed',
      pull: pullResult,
      push: abortedPush('bootstrap fence failed'),
      fence,
      duration: Date.now() - startTime,
      timestamp
    };
  }

  let pushResult;
  if (classification.scenario === 'A1_empty') {
    pushResult = skippedPush('A1_pull_only_no_push');
  } else if (options.admitLocalPush === true) {
    pushResult = await pushToTurso(null);
    if (!pushResult.success) {
      return {
        success: false,
        bootstrap: true,
        classification,
        aborted: 'admitted_push_failed',
        pull: pullResult,
        push: pushResult,
        fence,
        duration: Date.now() - startTime,
        timestamp
      };
    }
  } else {
    pushResult = skippedPush('A2_bootstrap_push_prohibited');
  }

  const success =
    pullResult.success &&
    fence.success &&
    pushResult.success &&
    (!pullResult.idCollisions || pullResult.idCollisions.length === 0);

  if (success) {
    setLastSyncTime(formatSyncTimestamp(new Date()));
  }

  return {
    success,
    bootstrap: true,
    classification,
    pull: pullResult,
    push: pushResult,
    fence,
    duration: Date.now() - startTime,
    timestamp
  };
}

async function fullSync(options = {}) {
  const startTime = Date.now();
  const lastSync = getLastSyncTime();

  if (!lastSync) {
    return await bootstrapSync(startTime, options);
  }

  const pushResult = await pushToTurso(lastSync);
  const pullResult = await pullFromTurso(lastSync);

  const hasCollision =
    (pushResult.idCollisions && pushResult.idCollisions.length > 0) ||
    (pullResult.idCollisions && pullResult.idCollisions.length > 0);

  const bothOk = pushResult.success && pullResult.success && !hasCollision;
  if (bothOk) {
    setLastSyncTime(formatSyncTimestamp(new Date()));
  }

  return {
    success: bothOk,
    aborted: hasCollision ? 'idCollision' : undefined,
    push: pushResult,
    pull: pullResult,
    duration: Date.now() - startTime,
    timestamp: formatSyncTimestamp(new Date())
  };
}

function getSyncStatus() {
  const state = getSyncStateRow();
  const lastSync = state ? state.last_sync_at : null;
  const isTurso = cloudClient.isConfigured();
  const scenario = classifyBootstrapScenario();

  let pendingChanges = 0;
  if (lastSync) {
    for (const table of SYNC_TABLES) {
      try {
        const row = localDb().prepare(`SELECT COUNT(*) as count FROM ${table} WHERE updated_at > ?`).get(lastSync);
        pendingChanges += row.count;
      } catch {}
    }
  }

  let pendingTombstones = 0;
  try {
    const row = localDb().prepare(`SELECT COUNT(*) as count FROM sync_tombstones WHERE synced_to_turso = 0`).get();
    pendingTombstones = row.count;
  } catch {}

  return {
    isTurso,
    lastSync,
    bootstrapPending: isTurso && !lastSync,
    bootstrapCompletedAt: state ? state.bootstrap_completed_at || null : null,
    deviceId: state ? state.device_id || null : null,
    scenario: scenario.scenario,
    pendingChanges,
    pendingTombstones,
    tables: SYNC_TABLES
  };
}

/**
 * Diagnóstico de nube pre-bootstrap (Proyecto 2).
 *
 * Responde si la nube Turso está vacía ANTES de iniciar la primera
 * sincronización, sin ejecutar ningún sync. Garantías:
 * - SOLO sentencias SELECT fijas (tablas desde SYNC_TABLES, sin input).
 * - NUNCA toca localDb()/db.js/database.js (Vercel-safe: sin SQLite).
 * - NUNCA ejecuta push/pull/fullSync/setLastSyncTime ni escribe nada.
 * - NUNCA confunde fallo de conexión con nube vacía (probe estructural
 *   previo sobre sqlite_master).
 *
 * Estados (data.cloud):
 * - unconfigured: sin TURSO_URL (cero queries).
 * - error: el probe estructural falla (conexión/auth) — nunca empty.
 * - partial: alguna de las 10 tablas falta o no se resuelve.
 * - with-data: alguna tabla tiene filas.
 * - empty: las 10 existen y totalRows === 0.
 * La ausencia de sync_state/sync_tombstones (nube pre-C4) solo se refleja
 * en hasSyncState/hasTombstones, jamás como error global.
 */
async function getCloudStatus() {
  const emptyTables = () => {
    const t = {};
    for (const name of SYNC_TABLES) t[name] = { rows: 0, state: 'unknown' };
    return t;
  };
  const base = (cloud, extra = {}) => ({
    success: true,
    data: {
      cloud,
      isConfigured: cloudClient.isConfigured(),
      totalRows: 0,
      tables: emptyTables(),
      hasSyncState: false,
      hasTombstones: false,
      error: null,
      ...extra
    }
  });

  if (!cloudClient.isConfigured()) {
    return base('unconfigured');
  }

  // Probe estructural: distingue fallo global (conexión/auth) de nube vacía.
  try {
    await cloudClient.execute({ sql: 'SELECT COUNT(*) AS c FROM sqlite_master', args: [] });
  } catch (e) {
    return base('error', { error: e.message || 'Error de conexión con Turso' });
  }

  const tables = emptyTables();
  let totalRows = 0;
  let unknown = 0;
  for (const table of SYNC_TABLES) {
    try {
      const r = await cloudClient.execute({ sql: `SELECT COUNT(*) AS c FROM ${table}`, args: [] });
      const c = r && r.rows && r.rows[0] != null ? Number(r.rows[0].c) || 0 : 0;
      tables[table] = { rows: c, state: 'ok' };
      totalRows += c;
    } catch {
      tables[table] = { rows: 0, state: 'missing' };
      unknown += 1;
    }
  }

  let hasSyncState = false;
  let hasTombstones = false;
  try {
    await cloudClient.execute({ sql: 'SELECT COUNT(*) AS c FROM sync_state', args: [] });
    hasSyncState = true;
  } catch {
    hasSyncState = false;
  }
  try {
    await cloudClient.execute({ sql: 'SELECT COUNT(*) AS c FROM sync_tombstones', args: [] });
    hasTombstones = true;
  } catch {
    hasTombstones = false;
  }

  const cloud = unknown > 0 ? 'partial' : (totalRows > 0 ? 'with-data' : 'empty');
  return base(cloud, { totalRows, tables, hasSyncState, hasTombstones });
}

function cleanLocalData(tables = null) {
  const targetTables = tables == null ? CLEAN_TABLES : tables;
  if (!Array.isArray(targetTables)) {
    throw new Error('tables debe ser un array');
  }
  const invalid = targetTables.filter((t) => !CLEAN_TABLES.includes(t));
  if (invalid.length > 0) {
    throw new Error('Tablas fuera de CLEAN_TABLES: ' + invalid.join(', '));
  }

  const results = {};

  for (const table of targetTables) {
    try {
      const count = localDb().prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
      localDb().prepare(`DELETE FROM ${table}`).run();
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
  bootstrapSync,
  getSyncStatus,
  getCloudStatus,
  cleanLocalData,
  getLastSyncTime,
  setLastSyncTime,
  formatSyncTimestamp,
  fenceLocalSequences,
  buildGuardedUpsertSql,
  classifyUpsertSkip,
  classifyBootstrapScenario,
  ensureDeviceId,
  invalidateCursor,
  admitExistingReplica,
  ADMIT_REPLICA_CURSOR_LOOKBACK_MS,
  SYNC_TABLES,
  CLEAN_TABLES,
  BATCH_SIZE
};
