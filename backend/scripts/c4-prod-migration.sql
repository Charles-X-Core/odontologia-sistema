-- ============================================================================
-- C4 — Migración estructural PROD (clinica-db)
-- Archivo: backend/scripts/c4-prod-migration.sql
-- Generado: 2026-09-24. ESTADO: EJECUTADO una vez sobre PROD (C4) y verificado
-- (schema, triggers, sync_state, sync_tombstones, updated_at, integrity_check OK).
-- NO volver a ejecutar sobre el PROD actual.
--
-- Fuentes obligatorias (verificadas sentencia por sentencia):
--   backend/scripts/c4-structural-migration.js  (FASE A–G, SQL literal)
--   ~/backups/odontologia-prod/c4-prod-baseline-2026-09-23.txt
--   ~/backups/odontologia-prod/clinica-db-prod-2026-09-23.db
--   backend/src/sync/syncService.js  (columnas/nombres esperados)
--   backend/src/database.js          (CREATE TABLE citas con updated_at)
--
-- REGLAS CUMPLIDAS:
--   - No DROP. No DELETE FROM. No backfill de updated_at.
--   - No backfill de consultas.created_at (queda NULL en histórico).
--   - No modifica contenido clínico (único UPDATE: formato de citas.updated_at).
--   - NO crea trg_citas_insert ni trg_citas_update (citas ya trae updated_at).
--   - Triggers usan strftime('%Y-%m-%dT%H:%M:%S','now') — nunca datetime('now').
--   - Diseñado para UNA sola ejecución sobre el baseline PROD (17 tablas,
--     0 triggers, sin sync_state/sync_tombstones, counts 756/756/808/3/160/2/1/6/48/1).
--     Esa ejecución ya ocurrió y fue verificada; NO repetir sobre el PROD actual.
--   - SQLite PROD (baseline: 3.45.1): ALTER TABLE ADD COLUMN, CREATE TABLE,
--     CREATE INDEX, CREATE TRIGGER con WHEN, INSERT...WHERE NOT EXISTS y
--     UPDATE...REPLACE/LIKE son sintaxis válida en esa versión. Sin alternativas
--     inventadas: todo lo usado existe en SQLite ≥ 3.25.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD COLUMN updated_at TEXT DEFAULT NULL (exactamente 9 tablas; citas NO)
--    C4 original: FASE A, SYNC_TABLES (script líneas 27-30, 137-140)
-- ----------------------------------------------------------------------------
ALTER TABLE pacientes ADD COLUMN updated_at TEXT DEFAULT NULL;
ALTER TABLE historias_clinicas ADD COLUMN updated_at TEXT DEFAULT NULL;
ALTER TABLE consultas ADD COLUMN updated_at TEXT DEFAULT NULL;
ALTER TABLE odontogramas ADD COLUMN updated_at TEXT DEFAULT NULL;
ALTER TABLE tratamientos ADD COLUMN updated_at TEXT DEFAULT NULL;
ALTER TABLE recetas ADD COLUMN updated_at TEXT DEFAULT NULL;
ALTER TABLE pagos ADD COLUMN updated_at TEXT DEFAULT NULL;
ALTER TABLE necesidades_odontologicas ADD COLUMN updated_at TEXT DEFAULT NULL;
ALTER TABLE imagenes ADD COLUMN updated_at TEXT DEFAULT NULL;

-- ----------------------------------------------------------------------------
-- 2. ADD COLUMN consultas.created_at TEXT DEFAULT NULL (sin backfill)
--    C4 original: FASE B (script líneas 144-147)
-- ----------------------------------------------------------------------------
ALTER TABLE consultas ADD COLUMN created_at TEXT DEFAULT NULL;

-- ----------------------------------------------------------------------------
-- 3. CREATE TABLE sync_state (compatible con syncService: getLastSyncTime,
--    getSyncStateRow, ensureDeviceId, setLastSyncTime, invalidateCursor)
--    C4 original: FASE C (script líneas 155-167 + ALTER rescate 170-175
--    incluido aquí inline, estado final idéntico)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_sync_at TEXT,
  last_push_at TEXT,
  last_pull_at TEXT,
  device_id TEXT,
  bootstrap_completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- 4. INSERT condicional sync_state id=1 con last_sync_at=NULL
--    C4 original: SELECT id...WHERE id=1 y solo entonces INSERT (líneas 181-186).
--    Traducción mecánica a SQL puro: INSERT...SELECT...WHERE NOT EXISTS.
-- ----------------------------------------------------------------------------
INSERT INTO sync_state (id, last_sync_at)
SELECT 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM sync_state WHERE id = 1);

-- ----------------------------------------------------------------------------
-- 5. CREATE TABLE sync_tombstones (compatible con syncService push/pull:
--    table_name, record_id, deleted_at, source, synced_to_turso, created_at)
--    C4 original: FASE D (script líneas 197-208)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_tombstones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  deleted_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user',
  synced_to_turso INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(table_name, record_id)
);

-- ----------------------------------------------------------------------------
-- 6. Índices de tombstones (script líneas 212-230)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tombstones_pending ON sync_tombstones(synced_to_turso, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tombstones_table ON sync_tombstones(table_name, record_id);

-- ----------------------------------------------------------------------------
-- 7. Triggers INSERT/UPDATE updated_at — 9 tablas × 2 = 18 triggers
--    C4 original: FASE E (script líneas 240-261). citas EXCLUIDA a propósito.
--    UPDATE con WHEN anti-recursión (solo si updated_at no cambió o es NULL).
-- ----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_pacientes_insert
AFTER INSERT ON pacientes
BEGIN
  UPDATE pacientes SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_pacientes_update
AFTER UPDATE ON pacientes
WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
BEGIN
  UPDATE pacientes SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_historias_clinicas_insert
AFTER INSERT ON historias_clinicas
BEGIN
  UPDATE historias_clinicas SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_historias_clinicas_update
AFTER UPDATE ON historias_clinicas
WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
BEGIN
  UPDATE historias_clinicas SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_consultas_insert
AFTER INSERT ON consultas
BEGIN
  UPDATE consultas SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_consultas_update
AFTER UPDATE ON consultas
WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
BEGIN
  UPDATE consultas SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_odontogramas_insert
AFTER INSERT ON odontogramas
BEGIN
  UPDATE odontogramas SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_odontogramas_update
AFTER UPDATE ON odontogramas
WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
BEGIN
  UPDATE odontogramas SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_tratamientos_insert
AFTER INSERT ON tratamientos
BEGIN
  UPDATE tratamientos SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_tratamientos_update
AFTER UPDATE ON tratamientos
WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
BEGIN
  UPDATE tratamientos SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_recetas_insert
AFTER INSERT ON recetas
BEGIN
  UPDATE recetas SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_recetas_update
AFTER UPDATE ON recetas
WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
BEGIN
  UPDATE recetas SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_pagos_insert
AFTER INSERT ON pagos
BEGIN
  UPDATE pagos SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_pagos_update
AFTER UPDATE ON pagos
WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
BEGIN
  UPDATE pagos SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_necesidades_odontologicas_insert
AFTER INSERT ON necesidades_odontologicas
BEGIN
  UPDATE necesidades_odontologicas SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_necesidades_odontologicas_update
AFTER UPDATE ON necesidades_odontologicas
WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
BEGIN
  UPDATE necesidades_odontologicas SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_imagenes_insert
AFTER INSERT ON imagenes
BEGIN
  UPDATE imagenes SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_imagenes_update
AFTER UPDATE ON imagenes
WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
BEGIN
  UPDATE imagenes SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now') WHERE id = NEW.id;
END;

-- ----------------------------------------------------------------------------
-- 8. Triggers DELETE/tombstone — 10 tablas (9 + citas) = 10 triggers
--    C4 original: FASE F (script líneas 271-285, TOMBSTONE_TABLES = ALL_SYNC_TABLES)
-- ----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_pacientes_tombstone
AFTER DELETE ON pacientes
BEGIN
  INSERT OR IGNORE INTO sync_tombstones
    (table_name, record_id, deleted_at, source)
  VALUES
    ('pacientes', OLD.id,
     COALESCE(OLD.updated_at, strftime('%Y-%m-%dT%H:%M:%S', 'now')),
     'user');
END;
CREATE TRIGGER IF NOT EXISTS trg_historias_clinicas_tombstone
AFTER DELETE ON historias_clinicas
BEGIN
  INSERT OR IGNORE INTO sync_tombstones
    (table_name, record_id, deleted_at, source)
  VALUES
    ('historias_clinicas', OLD.id,
     COALESCE(OLD.updated_at, strftime('%Y-%m-%dT%H:%M:%S', 'now')),
     'user');
END;
CREATE TRIGGER IF NOT EXISTS trg_consultas_tombstone
AFTER DELETE ON consultas
BEGIN
  INSERT OR IGNORE INTO sync_tombstones
    (table_name, record_id, deleted_at, source)
  VALUES
    ('consultas', OLD.id,
     COALESCE(OLD.updated_at, strftime('%Y-%m-%dT%H:%M:%S', 'now')),
     'user');
END;
CREATE TRIGGER IF NOT EXISTS trg_odontogramas_tombstone
AFTER DELETE ON odontogramas
BEGIN
  INSERT OR IGNORE INTO sync_tombstones
    (table_name, record_id, deleted_at, source)
  VALUES
    ('odontogramas', OLD.id,
     COALESCE(OLD.updated_at, strftime('%Y-%m-%dT%H:%M:%S', 'now')),
     'user');
END;
CREATE TRIGGER IF NOT EXISTS trg_tratamientos_tombstone
AFTER DELETE ON tratamientos
BEGIN
  INSERT OR IGNORE INTO sync_tombstones
    (table_name, record_id, deleted_at, source)
  VALUES
    ('tratamientos', OLD.id,
     COALESCE(OLD.updated_at, strftime('%Y-%m-%dT%H:%M:%S', 'now')),
     'user');
END;
CREATE TRIGGER IF NOT EXISTS trg_recetas_tombstone
AFTER DELETE ON recetas
BEGIN
  INSERT OR IGNORE INTO sync_tombstones
    (table_name, record_id, deleted_at, source)
  VALUES
    ('recetas', OLD.id,
     COALESCE(OLD.updated_at, strftime('%Y-%m-%dT%H:%M:%S', 'now')),
     'user');
END;
CREATE TRIGGER IF NOT EXISTS trg_citas_tombstone
AFTER DELETE ON citas
BEGIN
  INSERT OR IGNORE INTO sync_tombstones
    (table_name, record_id, deleted_at, source)
  VALUES
    ('citas', OLD.id,
     COALESCE(OLD.updated_at, strftime('%Y-%m-%dT%H:%M:%S', 'now')),
     'user');
END;
CREATE TRIGGER IF NOT EXISTS trg_pagos_tombstone
AFTER DELETE ON pagos
BEGIN
  INSERT OR IGNORE INTO sync_tombstones
    (table_name, record_id, deleted_at, source)
  VALUES
    ('pagos', OLD.id,
     COALESCE(OLD.updated_at, strftime('%Y-%m-%dT%H:%M:%S', 'now')),
     'user');
END;
CREATE TRIGGER IF NOT EXISTS trg_necesidades_odontologicas_tombstone
AFTER DELETE ON necesidades_odontologicas
BEGIN
  INSERT OR IGNORE INTO sync_tombstones
    (table_name, record_id, deleted_at, source)
  VALUES
    ('necesidades_odontologicas', OLD.id,
     COALESCE(OLD.updated_at, strftime('%Y-%m-%dT%H:%M:%S', 'now')),
     'user');
END;
CREATE TRIGGER IF NOT EXISTS trg_imagenes_tombstone
AFTER DELETE ON imagenes
BEGIN
  INSERT OR IGNORE INTO sync_tombstones
    (table_name, record_id, deleted_at, source)
  VALUES
    ('imagenes', OLD.id,
     COALESCE(OLD.updated_at, strftime('%Y-%m-%dT%H:%M:%S', 'now')),
     'user');
END;

-- ----------------------------------------------------------------------------
-- 9. Normalización citas.updated_at espacio → ISO (ÚNICO DML sobre datos)
--    C4 original: FASE G (script líneas 306-308). Convierte la fila PROD
--    '2026-09-22 07:26:22' → '2026-09-22T07:26:22'.
-- ----------------------------------------------------------------------------
UPDATE citas SET updated_at = REPLACE(updated_at, ' ', 'T') WHERE updated_at LIKE '____-__-__ __:__:__';

-- FIN C4-PROD-MIGRATION — total esperado: 10 ALTER, 2 CREATE TABLE, 2 CREATE
-- INDEX, 28 CREATE TRIGGER, 1 INSERT, 1 UPDATE. Cero DROP. Cero DELETE FROM.
