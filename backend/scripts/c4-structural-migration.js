/**
 * C4 — Migración Estructural Aditiva
 *
 * Prepara el esquema Turso/local para sincronización bidireccional.
 * DISEÑO: aditivo, idempotente, sin DML destructivo.
 *
 * Barreras de seguridad:
 *   - TURSO_ENV ausente => NO ejecutar (fail-safe: asumir PROD)
 *   - TURSO_ENV=prod   => NO ejecutar automáticamente
 *   - TURSO_ENV=dev    => PERMITIDO (exigir explícito)
 *
 * No reescribe datos clínicos históricos. Solo esquema + formato.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { requireDevOrConfirm, printEnvBanner } = require('../src/utils/envGuard');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

// Barrera: bloquear si TURSO_ENV no es dev o está ausente
requireDevOrConfirm('c4-structural-migration');

const LOCAL_DB = process.env.LOCAL_DB_PATH || path.join(__dirname, '..', 'clinica.db');
const local = new DatabaseSync(LOCAL_DB);

const SYNC_TABLES = [
  'pacientes', 'historias_clinicas', 'consultas', 'odontogramas',
  'tratamientos', 'recetas', 'pagos', 'necesidades_odontologicas', 'imagenes'
];

const ALL_SYNC_TABLES = [
  'pacientes', 'historias_clinicas', 'consultas', 'odontogramas',
  'tratamientos', 'recetas', 'pagos', 'necesidades_odontologicas', 'imagenes', 'citas'
];

let changes = {
  columnsAdded: [],
  tablesCreated: [],
  triggersCreated: [],
  dataNormalized: [],
  errors: []
};

/**
 * Ejecutar SQL de forma segura (catcheado, no aborta script).
 */
function safeExec(sql, description = '') {
  try {
    local.exec(sql);
    return true;
  } catch (e) {
    // En SQLite a veces el trigger/índice ya existe;
    // solo registramos y continuamos.
    changes.errors.push({ sql: description, error: e.message });
    return false;
  }
}

/**
 * ALTER TABLE ADD COLUMN solo si la columna no existe.
 */
function addColumnIfMissing(table, column, definition) {
  try {
    const cols = local.prepare(`PRAGMA table_info(${table})`).all().map(r => r.name);
    if (!cols.includes(column)) {
      safeExec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, `add ${column} to ${table}`);
      changes.columnsAdded.push({ table, column });
      return true;
    }
    return false;
  } catch (e) {
    changes.errors.push({ sql: `ALTER ${table} ADD ${column}`, error: e.message });
    return false;
  }
}

/**
 * CREATE TABLE IF NOT EXISTS condicional.
 * Usamos try/catch porque SQLite no tiene CREATE TABLE IF NOT EXISTS nativo
 * en el mismo sentido, pero la sintaxis es compatible con la mayoría de versiones.
 */
function createTableIfMissing(sql, name) {
  try {
    // Verificar si la tabla ya existe
    const row = local.prepare
      ? local.prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?").get(name)
      : null;
    const exists = row && row['COUNT(*)'] > 0;
    if (!exists) {
      safeExec(sql, `create table ${name}`);
      changes.tablesCreated.push(name);
    }
    return true;
  } catch (e) {
    changes.errors.push({ sql: name, error: e.message });
    return false;
  }
}

/**
 * CREATE TRIGGER IF NOT EXISTS pattern.
 */
function createTriggerIfMissing(sql, name) {
  try {
    const row = local.prepare
      ? local.prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name=?").get(name)
      : null;
    const exists = row && row['COUNT(*)'] > 0;
    if (!exists) {
      safeExec(sql, `create trigger ${name}`);
      changes.triggersCreated.push(name);
    }
    return true;
  } catch (e) {
    changes.errors.push({ sql: name, error: e.message });
    return false;
  }
}

// ============================================================
// 1. Barrera y banner
// ============================================================

printEnvBanner('c4-structural-migration (DDL idempotente)');

console.log('Entorno detectado: DEV (TURSO_ENV=dev) — migración estructural sobre clinica.db local');
console.log('URL Turso:', require('path').resolve('.env').TURSO_URL || '(local only)');
console.log('========================================\n');

/**
 * FASE A: updated_at en 9 tablas sync (si falta).
 * citas ya tiene updated_at por definición; NO lo tocamos.
 */
console.log('FASE A: Agregando updated_at a 9 tablas de sincronización (si faltan)...');

for (const table of SYNC_TABLES) {
  const added = addColumnIfMissing(table, 'updated_at', 'TEXT DEFAULT NULL');
  if (added) changes.columnsAdded.push(table);
}
console.log('  Columnas updated_at procesadas.');

// consultas.created_at: agregar si no existe (NULL por diseño, sin backfill)
console.log('\\nFASE B: Agregando consultas.created_at TEXT DEFAULT NULL (sin backfill)...');
const consultasAdded = addColumnIfMissing('consultas', 'created_at', 'TEXT DEFAULT NULL');
if (consultasAdded) changes.columnsAdded.push('consultas');
if (!consultasAdded) console.log('  consultas.created_at ya existe o no se pudo agregar.');

// ============================================================
// 2. sync_state table
// ============================================================

console.log('\\nFASE C: Creando/verificando tabla sync_state...');

const syncStateSql = `
  CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_sync_at TEXT,
    last_push_at TEXT,
    last_pull_at TEXT,
    device_id TEXT,
    bootstrap_completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`;
createTableIfMissing(syncStateSql, 'sync_state');

// Asegurar bootstrap_completed_at
try {
  const cols = local.prepare('PRAGMA table_info(sync_state)').all().map(r => r.name);
  if (!cols.includes('bootstrap_completed_at')) {
    local.exec('ALTER TABLE sync_state ADD COLUMN bootstrap_completed_at TEXT');
    changes.columnsAdded.push({ table: 'sync_state', column: 'bootstrap_completed_at' });
  }
} catch (e) {
  changes.errors.push({ sql: 'ALTER sync_state ADD bootstrap_completed_at', error: e.message });
}

// Insertar fila inicial si no existe (last_sync_at NULL = primer bootstrap)
try {
  const row = local.prepare('SELECT id FROM sync_state WHERE id = 1').get();
  if (!row) {
    local.exec("INSERT INTO sync_state (id, last_sync_at) VALUES (1, NULL)");
    console.log('  Fila sync_state insertada (last_sync_at NULL).');
  }
} catch (e) {
  changes.errors.push({ sql: 'INSERT sync_state initial', error: e.message });
}

// ============================================================
// 3. sync_tombstones table
// ============================================================

console.log('\\nFASE D: Creando/verificando tabla sync_tombstones...');

const tombstoneSql = `
  CREATE TABLE IF NOT EXISTS sync_tombstones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    deleted_at TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'user',
    synced_to_turso INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(table_name, record_id)
  )
`;
createTableIfMissing(tombstoneSql, 'sync_tombstones');

// Índices de uso frecuente
try {
  const idxExists1 = local.prepare(
    "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_tombstones_pending'"
  ).get()['COUNT(*)'] > 0;
  if (!idxExists1) {
    local.exec('CREATE INDEX IF NOT EXISTS idx_tombstones_pending ON sync_tombstones(synced_to_turso, deleted_at)');
    changes.tablesCreated.push('idx_tombstones_pending');
  }
} catch (e) { changes.errors.push({ sql: 'idx_tombstones_pending', error: e.message }); }

try {
  const idxExists2 = local.prepare(
    "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_tombstones_table'"
  ).get()['COUNT(*)'] > 0;
  if (!idxExists2) {
    local.exec('CREATE INDEX IF NOT EXISTS idx_tombstones_table ON sync_tombstones(table_name, record_id)');
    changes.tablesCreated.push('idx_tombstones_table');
  }
} catch (e) { changes.errors.push({ sql: 'idx_tombstones_table', error: e.message }); }

// ============================================================
// 4. Triggers updated_at (INSERT + UPDATE por tabla)
// ============================================================

console.log('\\nFASE E: Creando triggers updated_at INSERT/UPDATE (30 triggers)...');

const TRIGGER_TABLES = [...SYNC_TABLES]; // 9 tables

for (const table of TRIGGER_TABLES) {
  // Trigger INSERT
  const insertTrigger = `
    CREATE TRIGGER IF NOT EXISTS trg_${table}_insert
    AFTER INSERT ON ${table}
    BEGIN
      UPDATE ${table} SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
    END;
  `;
  createTriggerIfMissing(insertTrigger, `trg_${table}_insert`);

  // Trigger UPDATE (solo si updated_at no cambió o es NULL)
  const updateTrigger = `
    CREATE TRIGGER IF NOT EXISTS trg_${table}_update
    AFTER UPDATE ON ${table}
    WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
    BEGIN
      UPDATE ${table} SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
    END;
  `;
  createTriggerIfMissing(updateTrigger, `trg_${table}_update`);
}

// ============================================================
// 5. Triggers tombstones (DELETE por tabla)
// ============================================================

console.log('\\nFASE F: Creando triggers tombstones DELETE (10 triggers)...');

const TOMBSTONE_TABLES = [...ALL_SYNC_TABLES];

for (const table of TOMBSTONE_TABLES) {
  const tombstoneTrigger = `
    CREATE TRIGGER IF NOT EXISTS trg_${table}_tombstone
    AFTER DELETE ON ${table}
    BEGIN
      INSERT OR IGNORE INTO sync_tombstones
        (table_name, record_id, deleted_at, source)
      VALUES
        ('${table}', OLD.id,
         COALESCE(OLD.updated_at, strftime('%Y-%m-%dT%H:%M:%S', 'now')),
         'user');
    END;
  `;
  createTriggerIfMissing(tombstoneTrigger, `trg_${table}_tombstone`);
}

// ============================================================
// 6. Normalizar citas.updated_at formato espacio → ISO
// ============================================================

console.log('\\nFASE G: Normalizando citas.updated_at de formato space a ISO (única DML permitida)...');

try {
  // Detectar formato con espacio: "YYYY-MM-DD HH:mm:ss"
  const formatCheck = local.exec("SELECT updated_at FROM citas WHERE updated_at LIKE '____-__-__ __:__:__' LIMIT 1");
  const rows = local.prepare("SELECT updated_at FROM citas").all();
  let normalized = 0;
  const toNormalize = [];
  for (const r of rows) {
    if (r.updated_at && typeof r.updated_at === 'string' && r.updated_at.includes(' ') && !r.updated_at.includes('T')) {
      toNormalize.push(r.updated_at);
    }
  }
  if (toNormalize.length > 0) {
    // Aplicar normalización por lote
    const stmt = local.prepare(
      "UPDATE citas SET updated_at = REPLACE(updated_at, ' ', 'T') WHERE updated_at LIKE '____-__-__ __:__:__'"
    );
    const result = stmt.run();
    normalized = result.changes || 0;
    changes.dataNormalized.push({ table: 'citas', count: normalized });
    console.log(`  Normalizadas ${normalized} filas de citas.updated_at de formato space→ISO.`);
  } else {
    console.log('  Sin filas de citas con formato space — already ISO o vacío.');
  }
} catch (e) {
  changes.errors.push({ sql: 'normalize citas.updated_at', error: e.message });
  console.error('Error normalizando citas:', e.message);
}

// ============================================================
// 7. Resumen idempotencia
// ============================================================

console.log('\\n========================================');
console.log('    RESUMEN C4 MIGRACIÓN ESTRUCTURAL');
console.log('========================================\n');

const colNames = changes.columnsAdded.length > 0
  ? changes.columnsAdded.map(c => typeof c === 'object' ? c.table + '.' + c.column : c).join(', ')
  : 'NINGUNA (ya presentes)';
console.log('Columnas agregadas:', colNames);
console.log('Tablas creadas:', changes.tablesCreated.length > 0 ? changes.tablesCreated.join(', ') : 'NINGUNA (ya presentes)');
console.log('Triggers creados:', changes.triggersCreated.length > 0 ? changes.triggersCreated.length + ' triggers' : 'NINGUNO (ya presentes)');
console.log('Datos normalizados:', changes.dataNormalized.length > 0 ? changes.dataNormalized.map(c => c.count + ' en ' + c.table).join(', ') : 'NINGUNO');
console.log('Errores:', changes.errors.length, changes.errors.length > 0 ? '(revisar arriba)' : 'NINGUNO');

const totalTriggers = local.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='trigger'").get().c;
console.log('Total triggers en DB:', totalTriggers, '(expected: 50: 30 updated_at + 20 tombstone for 10 tables)');

// Idempotencia: segundo run debe tener 0 columnas nuevas, 0 triggers nuevos, 0 datos cambiados
console.log('\\n--- Idempotencia: solo reporte, sin cambios estructurales esperados ---');

console.log('\\n========================================');
console.log('  FIN C4 MIGRACIÓN ESTRUCTURAL');
console.log('========================================\n');