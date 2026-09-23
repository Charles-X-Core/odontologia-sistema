const db = require('../db');
const { createClient } = require('@libsql/client');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { requireDevOrReject, getTursoEnv } = require('../utils/envGuard');

// Mapeo de tablas del sistema viejo al nuevo
const TABLE_MAPPING = {
  'usuarios': {
    table: 'usuarios',
    columns: ['id', 'nombre', 'email', 'password', 'rol', 'titulo', 'firma_imagen', 'cmp', 'created_at'],
  },
  'pacientes': {
    table: 'pacientes',
    columns: ['id', 'apellido_paterno', 'apellido_materno', 'nombres', 'dni', 'telefono', 'email',
      'fecha_nacimiento', 'sexo', 'estado_civil', 'direccion', 'lugar_nacimiento',
      'lugar_procedencia', 'grado_instruccion', 'ocupacion', 'nombre_acompanante',
      'contacto_emergencia', 'telefono_emergencia', 'estado', 'tipo_documento',
      'alergias', 'antecedentes_personales', 'antecedentes_familiares', 'created_at'],
  },
  'historias_clinicas': {
    table: 'historias_clinicas',
    columns: ['id', 'paciente_id', 'numero_historia', 'created_at', 'alergia_medicamentos',
      'propension_hemorragias', 'complicaciones_anestesia', 'presion_arterial_medicacion',
      'cardiopatias_personales', 'cardiopatias_familiares', 'diabetes_personal',
      'diabetes_familiar', 'hepatitis', 'otras_enfermedades', 'enfermedad_actual_medicacion',
      'observaciones'],
  },
  'consultas': {
    table: 'consultas',
    columns: ['id', 'historia_id', 'fecha', 'hora', 'motivo', 'tiempo_enfermedad',
      'signos_sintomas', 'relato_cronologico', 'funciones_biologicas', 'signos_vitales',
      'examen_clinico_general', 'evaluacion_odontoestomatologica', 'diagnostico_lista',
      'plan_tratamiento', 'notas', 'consentimiento_informado'],
  },
  'odontogramas': {
    table: 'odontogramas',
    columns: ['id', 'consulta_id', 'datos_json', 'created_at'],
  },
  'tratamientos': {
    table: 'tratamientos',
    columns: ['id', 'paciente_id', 'consulta_id', 'fecha', 'pieza_dental',
      'procedimiento_realizado', 'costo_total', 'monto_a_cuenta', 'saldo_pendiente',
      'estado', 'notas', 'created_at'],
  },
  'recetas': {
    table: 'recetas',
    columns: ['id', 'consulta_id', 'paciente_id', 'medicamentos', 'indicaciones', 'created_at'],
  },
  'imagenes': {
    table: 'imagenes',
    columns: ['id', 'paciente_id', 'consulta_id', 'archivo_nombre', 'archivo_original',
      'tipo', 'descripcion', 'hash_sha256', 'created_at'],
  },
  'pagos': {
    table: 'pagos',
    columns: ['id', 'paciente_id', 'tratamiento_id', 'consulta_id', 'fecha', 'procedimiento',
      'total', 'a_cuenta', 'saldo', 'metodo_pago', 'notas', 'created_at'],
  },
  'necesidades_odontologicas': {
    table: 'necesidades_odontologicas',
    columns: ['id', 'consulta_id', 'cariados', 'curados', 'por_extraer', 'endodoncia',
      'ortodoncia', 'protesis', 'extraidos', 'destartraje', 'created_at'],
  },
  'whatsapp_plantillas': {
    table: 'whatsapp_plantillas',
    columns: ['id', 'nombre', 'categoria', 'asunto', 'cuerpo', 'activa', 'created_at'],
  },
  'whatsapp_log': {
    table: 'whatsapp_log',
    columns: ['id', 'paciente_id', 'telefono', 'tipo', 'mensaje', 'estado', 'batch_id',
      'programado', 'usuario_id', 'delivery_status', 'message_id', 'created_at'],
  },
  'citas': {
    table: 'citas',
    columns: ['id', 'paciente_id', 'usuario_id', 'fecha', 'hora', 'duracion_minutos',
      'tipo', 'motivo', 'motivo_editado', 'estado', 'notas', 'recordatorio_enviado',
      'consulta_id', 'asistio_confirmed_at', 'created_at', 'updated_at'],
  },
};

// Detectar tablas en el .db
function detectTables(oldDb) {
  try {
    const result = oldDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    return result.map(r => r.name);
  } catch {
    return [];
  }
}

// Obtener columnas de una tabla
function getColumns(oldDb, tableName) {
  try {
    const info = oldDb.prepare(`PRAGMA table_info(${tableName})`).all();
    return info.map(c => c.name);
  } catch {
    return [];
  }
}

// Mapear columnas válidas
function mapColumns(oldColumns, validColumns) {
  return validColumns.filter(col => oldColumns.includes(col));
}

// Importar una tabla desde .db viejo a Turso
async function importTableFromDb(oldDb, tableName, mapping) {
  const oldColumns = getColumns(oldDb, tableName);
  if (oldColumns.length === 0) {
    return { imported: 0, skipped: 0, errors: 0, message: 'Tabla no encontrada', total: 0 };
  }

  const validColumns = mapColumns(oldColumns, mapping.columns);
  if (validColumns.length === 0) {
    return { imported: 0, skipped: 0, errors: 0, message: 'No hay columnas válidas', total: 0 };
  }

  // Leer datos del .db viejo
  const cols = validColumns.join(', ');
  let rows;
  try {
    rows = oldDb.prepare(`SELECT ${cols} FROM ${tableName}`).all();
  } catch (e) {
    return { imported: 0, skipped: 0, errors: 0, message: `Error leyendo: ${e.message}`, total: 0 };
  }

  if (rows.length === 0) {
    return { imported: 0, skipped: 0, errors: 0, message: 'Tabla vacía', total: 0 };
  }

  // Insertar en Turso
  const placeholders = validColumns.map(() => '?').join(', ');
  const sql = `INSERT OR IGNORE INTO ${mapping.table} (${cols}) VALUES (${placeholders})`;

  let imported = 0, skipped = 0, errors = 0;

  // Procesar en lotes de 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const statements = batch.map(row => {
      const values = validColumns.map(col => {
        const val = row[col];
        if (val === undefined || val === null) return null;
        return val;
      });
      return { sql, args: values };
    });

    try {
      await tursoClient.batch(statements);
      imported += batch.length;
    } catch (err) {
      // Fallback: insertar uno por uno
      for (const row of batch) {
        const values = validColumns.map(col => {
          const val = row[col];
          if (val === undefined || val === null) return null;
          return val;
        });
        try {
          const result = await tursoClient.execute({ sql, args: values });
          if (result.rowsAffected > 0) imported++;
          else skipped++;
        } catch (e) {
          if (e.message.includes('UNIQUE') || e.message.includes('duplicate')) {
            skipped++;
          } else {
            errors++;
          }
        }
      }
    }
  }

  return { imported, skipped, errors, total: rows.length };
}

// Conexión a Turso (se configura dinámicamente)
let tursoClient = null;

/**
 * Preview del .db viejo - muestra tablas y conteos
 */
exports.previewDb = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió archivo .db' });

  const tempPath = req.file.path;

  try {
    // Abrir el .db temporal
    const oldDb = new DatabaseSync(tempPath);

    // Detectar tablas
    const tables = detectTables(oldDb);
    const tableInfo = [];

    for (const tableName of tables) {
      const columns = getColumns(oldDb, tableName);
      let count = 0;
      try {
        const result = oldDb.prepare(`SELECT COUNT(*) as total FROM ${tableName}`).get();
        count = result?.total || 0;
      } catch {}

      const hasMapping = !!TABLE_MAPPING[tableName];
      const mappedTo = hasMapping ? TABLE_MAPPING[tableName].table : null;

      tableInfo.push({
        name: tableName,
        columns: columns.length,
        records: count,
        hasMapping,
        mappedTo,
        columnNames: columns,
      });
    }

    oldDb.close();

    res.json({
      filename: req.file.originalname,
      size: req.file.size,
      totalTables: tables.length,
      tables: tableInfo,
    });
  } catch (err) {
    // Limpiar archivo temporal
    try { fs.unlinkSync(tempPath); } catch {}
    res.status(500).json({ error: 'Error al leer archivo .db: ' + err.message });
  }
};

/**
 * Importar .db viejo a Turso
 */
exports.importDb = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió archivo .db' });

  if (!requireDevOrReject(req, res, 'importDb')) return;

  const tempPath = req.file.path;

  try {
    // Conectar a Turso
    tursoClient = createClient({
      url: process.env.TURSO_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // Verificar conexión
    await tursoClient.execute('SELECT 1');

    // Abrir el .db temporal
    const oldDb = new DatabaseSync(tempPath);

    // Detectar tablas
    const tables = detectTables(oldDb);

    // Importar cada tabla
    const results = {};
    let totalImported = 0, totalSkipped = 0, totalErrors = 0;

    for (const [key, mapping] of Object.entries(TABLE_MAPPING)) {
      if (tables.includes(key)) {
        const result = await importTableFromDb(oldDb, key, mapping);
        results[key] = result;
        totalImported += result.imported;
        totalSkipped += result.skipped;
        totalErrors += result.errors;
      }
    }

    oldDb.close();

    // Limpiar archivo temporal
    try { fs.unlinkSync(tempPath); } catch {}

    // Verificar en Turso
    const verification = {};
    for (const key of Object.keys(results)) {
      const count = await tursoClient.execute(`SELECT COUNT(*) as total FROM ${key}`);
      verification[key] = count.rows[0]?.total || 0;
    }

    res.json({
      success: true,
      filename: req.file.originalname,
      summary: {
        totalImported,
        totalSkipped,
        totalErrors,
      },
      tables: results,
      verification,
    });
  } catch (err) {
    // Limpiar archivo temporal
    try { fs.unlinkSync(tempPath); } catch {}
    res.status(500).json({ error: 'Error al importar: ' + err.message });
  }
};

/**
 * Exportar backup completo desde Turso
 */
exports.exportBackup = async (req, res) => {
  try {
    tursoClient = createClient({
      url: process.env.TURSO_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    const backup = {};
    const tables = Object.keys(TABLE_MAPPING);

    for (const tableName of tables) {
      try {
        const result = await tursoClient.execute(`SELECT * FROM ${tableName}`);
        backup[tableName] = result.rows;
      } catch {
        backup[tableName] = [];
      }
    }

    // Enviar como archivo JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(backup);
  } catch (err) {
    res.status(500).json({ error: 'Error al exportar: ' + err.message });
  }
};

/**
 * Borrar todos los datos de Turso (danger!)
 */
exports.cleanAll = async (req, res) => {
  if (!requireDevOrReject(req, res, 'cleanAll')) return;

  if (req.body.confirmation !== 'BORRAR TODO') {
    return res.status(400).json({ error: 'Confirmación incorrecta. Envía "BORRAR TODO"' });
  }

  try {
    tursoClient = createClient({
      url: process.env.TURSO_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    const tables = [
      'whatsapp_cola', 'whatsapp_batch', 'whatsapp_log', 'whatsapp_plantillas', 'whatsapp_config',
      'importaciones_historial', 'imagenes', 'recetas', 'necesidades_odontologicas',
      'pagos', 'tratamientos', 'odontogramas', 'consultas', 'historias_clinicas',
      'citas', 'pacientes'
    ];

    for (const table of tables) {
      try { await tursoClient.execute(`DELETE FROM ${table}`); } catch {}
    }

    res.json({
      mensaje: 'Todos los datos han sido eliminados de Turso',
      env: getTursoEnv(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al borrar: ' + err.message });
  }
};
