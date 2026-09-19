require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@libsql/client');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const turso = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const LOCAL_DB = path.join(__dirname, '..', 'clinica.db');
const local = new DatabaseSync(LOCAL_DB);

// Migrar tabla con batch inserts
async function migrateTable(tursoTable, localTable, columns, batchSize = 50) {
  const rows = local.prepare(`SELECT * FROM ${localTable}`).all();
  if (rows.length === 0) {
    console.log(`  [${tursoTable}] 0 registros`);
    return 0;
  }

  const cols = columns.join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR IGNORE INTO ${tursoTable} (${cols}) VALUES (${placeholders})`;

  let migrated = 0;
  // Process in batches
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const statements = batch.map(row => {
      const values = columns.map(col => {
        const val = row[col];
        if (val === undefined || val === null) return null;
        return val;
      });
      return { sql, args: values };
    });

    try {
      await turso.batch(statements);
      migrated += batch.length;
    } catch (err) {
      // Fallback: insert one by one for this batch
      for (const row of batch) {
        const values = columns.map(col => {
          const val = row[col];
          if (val === undefined || val === null) return null;
          return val;
        });
        try {
          await turso.execute({ sql, args: values });
          migrated++;
        } catch (e) {
          // Skip duplicates
        }
      }
    }

    // Progress
    const pct = Math.round(((i + batch.length) / rows.length) * 100);
    process.stdout.write(`\r  [${tursoTable}] ${migrated}/${rows.length} (${pct}%)`);
  }

  console.log(`\r  [${tursoTable}] ${migrated}/${rows.length} registros ✓`);
  return migrated;
}

async function migrateAll() {
  console.log('========================================');
  console.log('  MIGRACIÓN COMPLETA A TURSO');
  console.log('========================================\n');

  const localCount = local.prepare('SELECT COUNT(*) as total FROM pacientes').get();
  console.log(`[Local] ${localCount.total} pacientes en clinica.db\n`);

  await turso.execute('SELECT 1');
  console.log('[Turso] Conexión OK\n');

  let total = 0;

  console.log('1/17 Migrando usuarios...');
  total += await migrateTable('usuarios', 'usuarios', [
    'id', 'nombre', 'email', 'password', 'rol', 'titulo', 'firma_imagen', 'cmp', 'created_at'
  ]);

  console.log('\n2/17 Migrando pacientes...');
  total += await migrateTable('pacientes', 'pacientes', [
    'id', 'apellido_paterno', 'apellido_materno', 'nombres', 'dni', 'telefono', 'email',
    'fecha_nacimiento', 'sexo', 'estado_civil', 'direccion', 'lugar_nacimiento',
    'lugar_procedencia', 'grado_instruccion', 'ocupacion', 'nombre_acompanante',
    'contacto_emergencia', 'telefono_emergencia', 'estado', 'tipo_documento',
    'alergias', 'antecedentes_personales', 'antecedentes_familiares', 'created_at'
  ]);

  console.log('\n3/17 Migrando historias clínicas...');
  total += await migrateTable('historias_clinicas', 'historias_clinicas', [
    'id', 'paciente_id', 'numero_historia', 'created_at', 'alergia_medicamentos',
    'propension_hemorragias', 'complicaciones_anestesia', 'presion_arterial_medicacion',
    'cardiopatias_personales', 'cardiopatias_familiares', 'diabetes_personal',
    'diabetes_familiar', 'hepatitis', 'otras_enfermedades', 'enfermedad_actual_medicacion',
    'observaciones'
  ]);

  console.log('\n4/17 Migrando consultas...');
  total += await migrateTable('consultas', 'consultas', [
    'id', 'historia_id', 'fecha', 'hora', 'motivo', 'tiempo_enfermedad',
    'signos_sintomas', 'relato_cronologico', 'funciones_biologicas', 'signos_vitales',
    'examen_clinico_general', 'evaluacion_odontoestomatologica', 'diagnostico_lista',
    'plan_tratamiento', 'notas', 'consentimiento_informado'
  ]);

  console.log('\n5/17 Migrando odontogramas...');
  total += await migrateTable('odontogramas', 'odontogramas', [
    'id', 'consulta_id', 'datos_json', 'created_at'
  ]);

  console.log('\n6/17 Migrando tratamientos...');
  total += await migrateTable('tratamientos', 'tratamientos', [
    'id', 'paciente_id', 'consulta_id', 'fecha', 'pieza_dental',
    'procedimiento_realizado', 'costo_total', 'monto_a_cuenta', 'saldo_pendiente',
    'estado', 'notas', 'created_at'
  ]);

  console.log('\n7/17 Migrando recetas...');
  total += await migrateTable('recetas', 'recetas', [
    'id', 'consulta_id', 'paciente_id', 'medicamentos', 'indicaciones', 'created_at'
  ]);

  console.log('\n8/17 Migrando imágenes...');
  total += await migrateTable('imagenes', 'imagenes', [
    'id', 'paciente_id', 'consulta_id', 'archivo_nombre', 'archivo_original',
    'tipo', 'descripcion', 'hash_sha256', 'created_at'
  ]);

  console.log('\n9/17 Migrando pagos...');
  total += await migrateTable('pagos', 'pagos', [
    'id', 'paciente_id', 'tratamiento_id', 'consulta_id', 'fecha', 'procedimiento',
    'total', 'a_cuenta', 'saldo', 'metodo_pago', 'notas', 'created_at'
  ]);

  console.log('\n10/17 Migrando necesidades odontológicas...');
  total += await migrateTable('necesidades_odontologicas', 'necesidades_odontologicas', [
    'id', 'consulta_id', 'cariados', 'curados', 'por_extraer', 'endodoncia',
    'ortodoncia', 'protesis', 'extraidos', 'destartraje', 'created_at'
  ]);

  console.log('\n11/17 Migrando WhatsApp log...');
  total += await migrateTable('whatsapp_log', 'whatsapp_log', [
    'id', 'paciente_id', 'telefono', 'tipo', 'mensaje', 'estado', 'batch_id',
    'programado', 'usuario_id', 'delivery_status', 'message_id', 'created_at'
  ]);

  console.log('\n12/17 Migrando WhatsApp plantillas...');
  total += await migrateTable('whatsapp_plantillas', 'whatsapp_plantillas', [
    'id', 'nombre', 'categoria', 'asunto', 'cuerpo', 'activa', 'created_at'
  ]);

  console.log('\n13/17 Migrando WhatsApp cola...');
  total += await migrateTable('whatsapp_cola', 'whatsapp_cola', [
    'id', 'paciente_id', 'tipo', 'mensaje', 'programado_para', 'estado',
    'intentos', 'error', 'batch_id', 'created_at'
  ]);

  console.log('\n14/17 Migrando WhatsApp batch...');
  total += await migrateTable('whatsapp_batch', 'whatsapp_batch', [
    'id', 'nombre', 'filtros', 'tipo', 'total_pacientes', 'enviados',
    'fallidos', 'estado', 'created_at'
  ]);

  console.log('\n15/17 Migrando WhatsApp config...');
  total += await migrateTable('whatsapp_config', 'whatsapp_config', [
    'id', 'clave', 'valor', 'descripcion', 'updated_at'
  ]);

  console.log('\n16/17 Migrando citas...');
  total += await migrateTable('citas', 'citas', [
    'id', 'paciente_id', 'usuario_id', 'fecha', 'hora', 'duracion_minutos',
    'tipo', 'motivo', 'motivo_editado', 'estado', 'notas', 'recordatorio_enviado',
    'consulta_id', 'asistio_confirmed_at', 'created_at', 'updated_at'
  ]);

  console.log('\n17/17 Migrando importaciones historial...');
  total += await migrateTable('importaciones_historial', 'importaciones_historial', [
    'id', 'archivo_nombre', 'archivo_hash', 'fecha_importacion', 'pacientes_creados',
    'pacientes_duplicados', 'consultas_creadas', 'tratamientos_creados', 'pagos_creados',
    'total_errores', 'usuario_id'
  ]);

  console.log('\n========================================');
  console.log('  RESUMEN DE MIGRACIÓN');
  console.log('========================================');
  console.log(`  Total registros migrados: ${total}\n`);

  // Verificar conteos
  const tables = [
    'usuarios', 'pacientes', 'historias_clinicas', 'consultas',
    'odontogramas', 'tratamientos', 'recetas', 'imagenes', 'pagos',
    'necesidades_odontologicas', 'whatsapp_log', 'whatsapp_plantillas',
    'whatsapp_cola', 'whatsapp_batch', 'whatsapp_config', 'citas',
    'importaciones_historial'
  ];

  console.log('  Verificación en Turso:');
  for (const table of tables) {
    const result = await turso.execute(`SELECT COUNT(*) as total FROM ${table}`);
    const count = result.rows[0]?.total || 0;
    const localResult = local.prepare(`SELECT COUNT(*) as total FROM ${table}`).get();
    const localCount = localResult?.total || 0;
    const match = count === localCount ? '✓' : count > localCount ? '▲' : '▼';
    console.log(`    ${match} ${table}: Turso=${count} Local=${localCount}`);
  }

  console.log('\n========================================');
  console.log('  MIGRACIÓN COMPLETADA');
  console.log('========================================');
}

migrateAll().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
