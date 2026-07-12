const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'clinica.db');

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec("CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'odontologo', titulo TEXT DEFAULT 'C.D Odontologia', firma_imagen TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')))");

db.exec("CREATE TABLE IF NOT EXISTS pacientes (id INTEGER PRIMARY KEY AUTOINCREMENT, apellido_paterno TEXT NOT NULL, apellido_materno TEXT DEFAULT '', nombres TEXT NOT NULL, dni TEXT UNIQUE NOT NULL, telefono TEXT, email TEXT, fecha_nacimiento TEXT, sexo TEXT, estado_civil TEXT DEFAULT '', direccion TEXT, lugar_nacimiento TEXT DEFAULT '', lugar_procedencia TEXT DEFAULT '', grado_instruccion TEXT DEFAULT '', ocupacion TEXT, nombre_acompanante TEXT DEFAULT '', contacto_emergencia TEXT, telefono_emergencia TEXT, estado TEXT DEFAULT 'activo', created_at TEXT DEFAULT (datetime('now')))");

db.exec("CREATE TABLE IF NOT EXISTS historias_clinicas (id INTEGER PRIMARY KEY AUTOINCREMENT, paciente_id INTEGER UNIQUE NOT NULL, numero_historia TEXT, created_at TEXT DEFAULT (datetime('now')), alergia_medicamentos TEXT DEFAULT '', propension_hemorragias TEXT DEFAULT '', complicaciones_anestesia TEXT DEFAULT '', presion_arterial_medicacion TEXT DEFAULT '', cardiopatias_personales TEXT DEFAULT '', cardiopatias_familiares TEXT DEFAULT '', diabetes_personal TEXT DEFAULT '', diabetes_familiar TEXT DEFAULT '', hepatitis TEXT DEFAULT '', otras_enfermedades TEXT DEFAULT '', enfermedad_actual_medicacion TEXT DEFAULT '', observaciones TEXT DEFAULT '', FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE)");

db.exec("CREATE TABLE IF NOT EXISTS consultas (id INTEGER PRIMARY KEY AUTOINCREMENT, historia_id INTEGER NOT NULL, fecha TEXT DEFAULT (datetime('now')), hora TEXT DEFAULT '', motivo TEXT NOT NULL, tiempo_enfermedad TEXT DEFAULT '', signos_sintomas TEXT DEFAULT '', relato_cronologico TEXT DEFAULT '', funciones_biologicas TEXT DEFAULT '', signos_vitales TEXT DEFAULT '{}', examen_clinico_general TEXT DEFAULT '', evaluacion_odontoestomatologica TEXT DEFAULT '', diagnostico_lista TEXT DEFAULT '[]', plan_tratamiento TEXT DEFAULT '{}', notas TEXT DEFAULT '', FOREIGN KEY (historia_id) REFERENCES historias_clinicas(id) ON DELETE CASCADE)");

db.exec("CREATE TABLE IF NOT EXISTS odontogramas (id INTEGER PRIMARY KEY AUTOINCREMENT, consulta_id INTEGER NOT NULL, datos_json TEXT NOT NULL DEFAULT '{}', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE CASCADE)");

db.exec("CREATE TABLE IF NOT EXISTS tratamientos (id INTEGER PRIMARY KEY AUTOINCREMENT, paciente_id INTEGER NOT NULL, consulta_id INTEGER, fecha TEXT NOT NULL, pieza_dental TEXT DEFAULT '', procedimiento_realizado TEXT NOT NULL, costo_total REAL DEFAULT 0, monto_a_cuenta REAL DEFAULT 0, saldo_pendiente REAL DEFAULT 0, estado TEXT DEFAULT 'planificado', notas TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE)");

db.exec("CREATE TABLE IF NOT EXISTS recetas (id INTEGER PRIMARY KEY AUTOINCREMENT, consulta_id INTEGER NOT NULL, paciente_id INTEGER NOT NULL, medicamentos TEXT NOT NULL DEFAULT '[]', indicaciones TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE CASCADE, FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE)");

db.exec("CREATE TABLE IF NOT EXISTS imagenes (id INTEGER PRIMARY KEY AUTOINCREMENT, paciente_id INTEGER NOT NULL, consulta_id INTEGER, archivo_nombre TEXT NOT NULL, archivo_original TEXT NOT NULL, tipo TEXT DEFAULT 'foto', descripcion TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE, FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE SET NULL)");

db.exec("CREATE TABLE IF NOT EXISTS necesidades_odontologicas (id INTEGER PRIMARY KEY AUTOINCREMENT, consulta_id INTEGER UNIQUE NOT NULL, cariados INTEGER DEFAULT 0, curados INTEGER DEFAULT 0, por_extraer INTEGER DEFAULT 0, endodoncia INTEGER DEFAULT 0, ortodoncia INTEGER DEFAULT 0, protesis INTEGER DEFAULT 0, extraidos INTEGER DEFAULT 0, destartraje INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE CASCADE)");

db.exec("CREATE TABLE IF NOT EXISTS pagos (id INTEGER PRIMARY KEY AUTOINCREMENT, paciente_id INTEGER NOT NULL, tratamiento_id INTEGER, consulta_id INTEGER, fecha TEXT NOT NULL, procedimiento TEXT, total REAL DEFAULT 0, a_cuenta REAL DEFAULT 0, saldo REAL DEFAULT 0, metodo_pago TEXT DEFAULT 'efectivo', notas TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE)");

db.exec("CREATE TABLE IF NOT EXISTS whatsapp_log (id INTEGER PRIMARY KEY AUTOINCREMENT, paciente_id INTEGER NOT NULL, telefono TEXT NOT NULL, tipo TEXT NOT NULL, mensaje TEXT NOT NULL, estado TEXT DEFAULT 'enviado', batch_id INTEGER, programado INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE)");

db.exec("CREATE TABLE IF NOT EXISTS whatsapp_plantillas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, categoria TEXT NOT NULL, asunto TEXT DEFAULT '', cuerpo TEXT NOT NULL, activa INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))");

db.exec("CREATE TABLE IF NOT EXISTS whatsapp_cola (id INTEGER PRIMARY KEY AUTOINCREMENT, paciente_id INTEGER NOT NULL, tipo TEXT NOT NULL, mensaje TEXT NOT NULL, programado_para TEXT NOT NULL, estado TEXT DEFAULT 'pendiente', intentos INTEGER DEFAULT 0, error TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE)");

db.exec("CREATE TABLE IF NOT EXISTS whatsapp_batch (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT DEFAULT '', filtros TEXT DEFAULT '{}', tipo TEXT NOT NULL, total_pacientes INTEGER DEFAULT 0, enviados INTEGER DEFAULT 0, fallidos INTEGER DEFAULT 0, estado TEXT DEFAULT 'pendiente', created_at TEXT DEFAULT (datetime('now')))");

const count = db.prepare('SELECT COUNT(*) as total FROM whatsapp_plantillas').get();
if (count.total === 0) {
  const insert = db.prepare('INSERT INTO whatsapp_plantillas (nombre, categoria, asunto, cuerpo) VALUES (?, ?, ?, ?)');
  insert.run('Receta Medica', 'salud', 'Receta Medica', 'Buenos dias {nombre_completo}, le comparto su receta medica:\n\n{medicamentos}\n\nIndicaciones: {indicaciones}\n\nSi tiene alguna duda, no dude en comunicarse.\n_Clinica Dental Pro - Clinica Odontologica_');
  insert.run('Plan de Tratamiento', 'tratamiento', 'Plan de Tratamiento', 'Buenos dias {nombre_completo}, le compartimos su plan de tratamiento:\n\n{tratamientos_lista}\n\nTotal: S/{costo_total}\nSaldo pendiente: S/{saldo_pendiente}\n\nAgende su proxima cita: 982-890-328\n_Clinica Dental Pro - Clinica Odontologica_');
  insert.run('Recordatorio de Pago', 'pago', 'Recordatorio de Pago', 'Buenos dias {nombre_completo}, le recordamos que tiene un saldo pendiente de:\n\nS/{saldo_pendiente}\n\nPuede realizar su pago en clinica o comunicarse para coordinar una fecha.\n\n_Clinica Dental Pro - Clinica Odontologica_');
  insert.run('Proxima Cita', 'cita', 'Proxima Cita', 'Buenos dias {nombre_completo}, le recordamos su proxima cita:\n\nFecha: {fecha_cita}\nHora: {hora_cita}\nProcedimiento: {procedimiento}\n\nSi necesita reprogramar, comuniquese con nosotros.\n_Clinica Dental Pro - Clinica Odontologica_');
  insert.run('Bienvenida', 'marketing', 'Bienvenida', 'Hola {nombre_completo}, bienvenido(a) a Clinica Dental Pro - Clinica Odontologica!\n\nEstamos encantados de atenderle. Si tiene alguna consulta, no dude en escribirnos.\n\nTelefono: 982-890-328\n_Clinica Dental Pro - Clinica Odontologica_');
  insert.run('Seguimiento', 'salud', 'Seguimiento Post-Tratamiento', 'Buenos dias {nombre_completo}, como se encuentra despues de su tratamiento?\n\nSi tiene alguna molestia o consulta, estamos para ayudarle.\n\n_Clinica Dental Pro - Clinica Odontologica_');
  insert.run('Confirmacion de Cita', 'cita', 'Confirmacion de Cita', 'Buenos dias {nombre_completo}, tiene una cita programada para:\n\nFecha: {fecha_cita}\nHora: {hora_cita}\n\nPor favor confirme su asistencia respondiendo SI o NO.\n_Clinica Dental Pro - Clinica Odontologica_');
  insert.run('Feliz Cumpleanos', 'marketing', 'Feliz Cumpleanos!', 'Feliz cumpleanos {nombre_completo}!\n\nDe parte de todo el equipo de Clinica Dental Pro le deseamos lo mejor en este dia tan especial.\n\nTelefono: 982-890-328\n_Clinica Dental Pro - Clinica Odontologica_');
  insert.run('Recordatorio de Limpieza', 'salud', 'Recordatorio de Limpieza Dental', 'Buenos dias {nombre_completo}, ya han pasado varios meses desde su ultima limpieza dental.\n\nEs recomendable realizarse una limpieza cada 6 meses para mantener su salud bucal.\n\nAgende su cita: 982-890-328\n_Clinica Dental Pro - Clinica Odontologica_');
  insert.run('Saldo a Favor', 'pago', 'Saldo a Favor', 'Buenos dias {nombre_completo}, le informamos que cuenta con un saldo a favor de:\n\nS/{saldo_a_favor}\n\nEste credito puede ser utilizado en su proximo tratamiento.\n\n_Clinica Dental Pro - Clinica Odontologica_');
  insert.run('Custom', 'otro', '', '{mensaje_personalizado}');
}

try { db.exec("ALTER TABLE whatsapp_log ADD COLUMN batch_id INTEGER"); } catch {}
try { db.exec("ALTER TABLE whatsapp_log ADD COLUMN programado INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE whatsapp_log ADD COLUMN usuario_id INTEGER"); } catch {}
try { db.exec("ALTER TABLE whatsapp_cola ADD COLUMN batch_id INTEGER"); } catch {}
try { db.exec("ALTER TABLE whatsapp_log ADD COLUMN delivery_status TEXT DEFAULT 'enviado'"); } catch {}
try { db.exec("ALTER TABLE whatsapp_log ADD COLUMN message_id TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE pacientes ADD COLUMN tipo_documento TEXT DEFAULT 'dni'"); } catch {}
try { db.exec("ALTER TABLE usuarios ADD COLUMN titulo TEXT DEFAULT 'C.D Odontologia'"); } catch {}
try { db.exec("ALTER TABLE usuarios ADD COLUMN firma_imagen TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE usuarios ADD COLUMN cmp TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE imagenes ADD COLUMN hash_sha256 TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE pacientes ADD COLUMN alergias TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE pacientes ADD COLUMN antecedentes_personales TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE pacientes ADD COLUMN antecedentes_familiares TEXT DEFAULT ''"); } catch {}

db.exec("CREATE TABLE IF NOT EXISTS importaciones_historial (id INTEGER PRIMARY KEY AUTOINCREMENT, archivo_nombre TEXT, archivo_hash TEXT, fecha_importacion TEXT DEFAULT (datetime('now')), pacientes_creados INTEGER DEFAULT 0, pacientes_duplicados INTEGER DEFAULT 0, consultas_creadas INTEGER DEFAULT 0, tratamientos_creados INTEGER DEFAULT 0, pagos_creados INTEGER DEFAULT 0, total_errores INTEGER DEFAULT 0, usuario_id INTEGER)");

db.exec("CREATE TABLE IF NOT EXISTS whatsapp_config (id INTEGER PRIMARY KEY AUTOINCREMENT, clave TEXT UNIQUE NOT NULL, valor TEXT NOT NULL, descripcion TEXT DEFAULT '', updated_at TEXT DEFAULT (datetime('now')))");

const configDefaults = [
  ['delay_envios', '2000', 'Milisegundos entre envios de mensajes'],
  ['max_mensajes_dia', '100', 'Maximo de mensajes enviados por dia'],
  ['scheduler_interval', '60', 'Segundos entre verificaciones de la cola'],
  ['max_reintentos', '3', 'Maximo de reintentos para mensajes fallidos'],
  ['codigo_pais', '51', 'Codigo de pais para telefonos (51=Peru)'],
  ['hora_inicio_envios', '08:00', 'Hora de inicio para envios'],
  ['hora_fin_envios', '20:00', 'Hora de fin para envios'],
  ['enviar_sabados', 'true', 'Permitir envios los sabados'],
  ['enviar_domingos', 'false', 'Permitir envios los domingos'],
];
const cfgCount = db.prepare('SELECT COUNT(*) as total FROM whatsapp_config').get();
if (cfgCount.total === 0) {
  const insertCfg = db.prepare('INSERT INTO whatsapp_config (clave, valor, descripcion) VALUES (?, ?, ?)');
  for (const [k, v, d] of configDefaults) insertCfg.run(k, v, d);
}

try {
  db.exec("ALTER TABLE tratamientos ALTER COLUMN estado TEXT DEFAULT 'planificado'");
} catch (e) {
  // Column already has correct default or ALTER not supported
}

try { db.exec("ALTER TABLE consultas ADD COLUMN consentimiento_informado INTEGER DEFAULT 0"); } catch {}

module.exports = db;
