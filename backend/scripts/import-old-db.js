/**
 * Script para importar base de datos vieja del doctor
 * 
 * Uso:
 *   node import-old-db.js /ruta/al/archivo-viejo.db
 * 
 * El script:
 * 1. Lee el .db viejo
 * 2. Detecta qué tablas existe
 * 3. Mapea columnas a nuestro esquema
 * 4. Inserta en Turso (o SQLite local)
 * 5. Muestra resumen de lo importado
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@libsql/client');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Configuración
const TURSO_URL = process.env.TURSO_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

// Conexión a Turso
const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

// Mapeo de tablas: { tabla_vieja: { tabla_nueva, columnas } }
const TABLE_MAPPING = {
  'usuarios': {
    table: 'usuarios',
    columns: ['id', 'nombre', 'email', 'password', 'rol', 'titulo', 'firma_imagen', 'cmp', 'created_at'],
    required: ['nombre', 'email', 'password'],
  },
  'pacientes': {
    table: 'pacientes',
    columns: ['id', 'apellido_paterno', 'apellido_materno', 'nombres', 'dni', 'telefono', 'email',
      'fecha_nacimiento', 'sexo', 'estado_civil', 'direccion', 'lugar_nacimiento',
      'lugar_procedencia', 'grado_instruccion', 'ocupacion', 'nombre_acompanante',
      'contacto_emergencia', 'telefono_emergencia', 'estado', 'tipo_documento',
      'alergias', 'antecedentes_personales', 'antecedentes_familiares', 'created_at'],
    required: ['nombres', 'dni'],
  },
  'historias_clinicas': {
    table: 'historias_clinicas',
    columns: ['id', 'paciente_id', 'numero_historia', 'created_at', 'alergia_medicamentos',
      'propension_hemorragias', 'complicaciones_anestesia', 'presion_arterial_medicacion',
      'cardiopatias_personales', 'cardiopatias_familiares', 'diabetes_personal',
      'diabetes_familiar', 'hepatitis', 'otras_enfermedades', 'enfermedad_actual_medicacion',
      'observaciones'],
    required: ['paciente_id'],
  },
  'consultas': {
    table: 'consultas',
    columns: ['id', 'historia_id', 'fecha', 'hora', 'motivo', 'tiempo_enfermedad',
      'signos_sintomas', 'relato_cronologico', 'funciones_biologicas', 'signos_vitales',
      'examen_clinico_general', 'evaluacion_odontoestomatologica', 'diagnostico_lista',
      'plan_tratamiento', 'notas', 'consentimiento_informado'],
    required: ['historia_id', 'motivo'],
  },
  'odontogramas': {
    table: 'odontogramas',
    columns: ['id', 'consulta_id', 'datos_json', 'created_at'],
    required: ['consulta_id'],
  },
  'tratamientos': {
    table: 'tratamientos',
    columns: ['id', 'paciente_id', 'consulta_id', 'fecha', 'pieza_dental',
      'procedimiento_realizado', 'costo_total', 'monto_a_cuenta', 'saldo_pendiente',
      'estado', 'notas', 'created_at'],
    required: ['paciente_id', 'procedimiento_realizado'],
  },
  'recetas': {
    table: 'recetas',
    columns: ['id', 'consulta_id', 'paciente_id', 'medicamentos', 'indicaciones', 'created_at'],
    required: ['consulta_id', 'paciente_id'],
  },
  'imagenes': {
    table: 'imagenes',
    columns: ['id', 'paciente_id', 'consulta_id', 'archivo_nombre', 'archivo_original',
      'tipo', 'descripcion', 'hash_sha256', 'created_at'],
    required: ['paciente_id', 'archivo_nombre'],
  },
  'pagos': {
    table: 'pagos',
    columns: ['id', 'paciente_id', 'tratamiento_id', 'consulta_id', 'fecha', 'procedimiento',
      'total', 'a_cuenta', 'saldo', 'metodo_pago', 'notas', 'created_at'],
    required: ['paciente_id', 'fecha'],
  },
  'necesidades_odontologicas': {
    table: 'necesidades_odontologicas',
    columns: ['id', 'consulta_id', 'cariados', 'curados', 'por_extraer', 'endodoncia',
      'ortodoncia', 'protesis', 'extraidos', 'destartraje', 'created_at'],
    required: ['consulta_id'],
  },
  'whatsapp_plantillas': {
    table: 'whatsapp_plantillas',
    columns: ['id', 'nombre', 'categoria', 'asunto', 'cuerpo', 'activa', 'created_at'],
    required: ['nombre', 'cuerpo'],
  },
  'whatsapp_log': {
    table: 'whatsapp_log',
    columns: ['id', 'paciente_id', 'telefono', 'tipo', 'mensaje', 'estado', 'batch_id',
      'programado', 'usuario_id', 'delivery_status', 'message_id', 'created_at'],
    required: ['paciente_id', 'telefono', 'mensaje'],
  },
  'citas': {
    table: 'citas',
    columns: ['id', 'paciente_id', 'usuario_id', 'fecha', 'hora', 'duracion_minutos',
      'tipo', 'motivo', 'motivo_editado', 'estado', 'notas', 'recordatorio_enviado',
      'consulta_id', 'asistio_confirmed_at', 'created_at', 'updated_at'],
    required: ['paciente_id', 'fecha', 'hora'],
  },
};

// Detectar tablas en el .db viejo
function detectTables(oldDb) {
  const result = oldDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  return result.map(r => r.name);
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

// Mapear columnas del .db viejo a nuestro esquema
function mapColumns(oldColumns, mapping) {
  const mapped = [];
  for (const col of mapping.columns) {
    if (oldColumns.includes(col)) {
      mapped.push(col);
    }
  }
  return mapped;
}

// Importar una tabla
async function importTable(oldDb, tableName, mapping) {
  const oldColumns = getColumns(oldDb, tableName);
  if (oldColumns.length === 0) {
    return { imported: 0, skipped: 0, errors: 0, message: 'Tabla no encontrada' };
  }

  const validColumns = mapColumns(oldColumns, mapping);
  if (validColumns.length === 0) {
    return { imported: 0, skipped: 0, errors: 0, message: 'No hay columnas válidas' };
  }

  // Leer datos del .db viejo
  const cols = validColumns.join(', ');
  let rows;
  try {
    rows = oldDb.prepare(`SELECT ${cols} FROM ${tableName}`).all();
  } catch (e) {
    return { imported: 0, skipped: 0, errors: 0, message: `Error leyendo: ${e.message}` };
  }

  if (rows.length === 0) {
    return { imported: 0, skipped: 0, errors: 0, message: 'Tabla vacía' };
  }

  // Insertar en Turso
  const placeholders = validColumns.map(() => '?').join(', ');
  const sql = `INSERT OR IGNORE INTO ${mapping.table} (${cols}) VALUES (${placeholders})`;

  let imported = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const values = validColumns.map(col => {
      const val = row[col];
      if (val === undefined || val === null) return null;
      return val;
    });

    try {
      const result = await turso.execute({ sql, args: values });
      if (result.rowsAffected > 0) {
        imported++;
      } else {
        skipped++;
      }
    } catch (e) {
      if (e.message.includes('UNIQUE') || e.message.includes('duplicate')) {
        skipped++;
      } else {
        errors++;
      }
    }
  }

  return { imported, skipped, errors, total: rows.length };
}

// Función principal
async function importOldDb(dbPath) {
  console.log('========================================');
  console.log('  IMPORTADOR DE BASE DE DATOS VIEJA');
  console.log('========================================\n');

  // Verificar que el archivo existe
  if (!fs.existsSync(dbPath)) {
    console.error(`[ERROR] No se encontró: ${dbPath}`);
    process.exit(1);
  }

  console.log(`[1] Abriendo: ${dbPath}`);

  // Abrir el .db viejo
  const oldDb = new DatabaseSync(dbPath);

  // Detectar tablas
  const tables = detectTables(oldDb);
  console.log(`[2] Tablas encontradas: ${tables.length}`);
  tables.forEach(t => console.log(`    - ${t}`));
  console.log('');

  // Verificar conexión Turso
  await turso.execute('SELECT 1');
  console.log('[3] Conexión Turso: OK\n');

  // Importar cada tabla
  let totalImported = 0, totalSkipped = 0, totalErrors = 0;
  const results = [];

  for (const [key, mapping] of Object.entries(TABLE_MAPPING)) {
    if (tables.includes(key)) {
      process.stdout.write(`  Importando ${key}...`);
      const result = await importTable(oldDb, key, mapping);
      totalImported += result.imported;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
      results.push({ table: key, ...result });
      console.log(` ${result.imported}/${result.total} ✓`);
    }
  }

  // Resumen
  console.log('\n========================================');
  console.log('  RESUMEN DE IMPORTACIÓN');
  console.log('========================================');
  console.log(`  Registros importados: ${totalImported}`);
  console.log(`  Registros omitidos:   ${totalSkipped} (duplicados)`);
  console.log(`  Errores:              ${totalErrors}`);
  console.log('');

  // Verificar en Turso
  console.log('  Verificación en Turso:');
  for (const r of results) {
    const count = await turso.execute(`SELECT COUNT(*) as total FROM ${r.table}`);
    const total = count.rows[0]?.total || 0;
    console.log(`    ${r.table}: ${total} registros`);
  }

  console.log('\n========================================');
  console.log('  IMPORTACIÓN COMPLETADA');
  console.log('========================================');

  oldDb.close();
}

// Ejecutar
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Uso: node import-old-db.js /ruta/al/archivo-viejo.db');
  console.log('');
  console.log('Ejemplo:');
  console.log('  node import-old-db.js C:\\Users\\Doctor\\Desktop\\clinica_vieja.db');
  process.exit(1);
}

importOldDb(args[0]).catch(e => {
  console.error('[ERROR]', e.message);
  process.exit(1);
});
