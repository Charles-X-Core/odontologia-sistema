const db = require('../database');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

function queryAll(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function buildExcelWorkbook(hojas) {
  const wb = XLSX.utils.book_new();
  for (const [nombre, data] of Object.entries(hojas)) {
    if (data.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([['(sin datos)']]);
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    }
  }
  return wb;
}

function sendExcel(res, wb, nombreArchivo) {
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.xlsx"`);
  res.send(buf);
}

function sendCsv(res, data, nombreArchivo) {
  if (data.length === 0) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.csv"`);
    return res.send('(sin datos)');
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.csv"`);
  res.send(csv);
}

exports.completo = (req, res) => {
  try {
    const formato = req.query.formato || 'xlsx';

    const pacientes = queryAll(`
      SELECT p.*, hc.numero_historia
      FROM pacientes p
      LEFT JOIN historias_clinicas hc ON hc.paciente_id = p.id
      ORDER BY p.id
    `);

    const historias = queryAll('SELECT * FROM historias_clinicas ORDER BY id');

    const consultas = queryAll(`
      SELECT c.*, hc.numero_historia, p.dni, p.nombres, p.apellido_paterno, p.apellido_materno
      FROM consultas c
      JOIN historias_clinicas hc ON c.historia_id = hc.id
      JOIN pacientes p ON hc.paciente_id = p.id
      ORDER BY c.id
    `);

    const odontogramas = queryAll(`
      SELECT o.*, c.fecha as consulta_fecha, p.dni
      FROM odontogramas o
      JOIN consultas c ON o.consulta_id = c.id
      JOIN historias_clinicas hc ON c.historia_id = hc.id
      JOIN pacientes p ON hc.paciente_id = p.id
      ORDER BY o.id
    `);

    const tratamientos = queryAll(`
      SELECT t.*, p.dni, p.nombres, p.apellido_paterno
      FROM tratamientos t
      JOIN pacientes p ON t.paciente_id = p.id
      ORDER BY t.id
    `);

    const pagos = queryAll(`
      SELECT pg.*, p.dni, p.nombres, p.apellido_paterno
      FROM pagos pg
      JOIN pacientes p ON pg.paciente_id = p.id
      ORDER BY pg.id
    `);

    const recetas = queryAll(`
      SELECT r.*, p.dni, p.nombres, p.apellido_paterno
      FROM recetas r
      JOIN pacientes p ON r.paciente_id = p.id
      ORDER BY r.id
    `);

    if (formato === 'csv') {
      const ws = XLSX.utils.json_to_sheet(pacientes);
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="estacion_datos_completo.csv"');
      return res.send(csv);
    }

    const wb = buildExcelWorkbook({
      'Pacientes': pacientes,
      'Historias Clinicas': historias,
      'Consultas': consultas,
      'Odontogramas': odontogramas,
      'Tratamientos': tratamientos,
      'Pagos': pagos,
      'Recetas': recetas,
    });

    sendExcel(res, wb, 'estacion_datos_completo');
  } catch (err) {
    res.status(500).json({ error: 'Error al exportar: ' + err.message });
  }
};

exports.pacientes = (req, res) => {
  try {
    const formato = req.query.formato || 'xlsx';
    const data = queryAll(`
      SELECT p.*, hc.numero_historia
      FROM pacientes p
      LEFT JOIN historias_clinicas hc ON hc.paciente_id = p.id
      ORDER BY p.id
    `);

    if (formato === 'csv') return sendCsv(res, data, 'pacientes');

    const wb = buildExcelWorkbook({ Pacientes: data });
    sendExcel(res, wb, 'pacientes');
  } catch (err) {
    res.status(500).json({ error: 'Error al exportar: ' + err.message });
  }
};

exports.consultas = (req, res) => {
  try {
    const formato = req.query.formato || 'xlsx';
    const data = queryAll(`
      SELECT c.*, hc.numero_historia, p.dni, p.nombres, p.apellido_paterno, p.apellido_materno
      FROM consultas c
      JOIN historias_clinicas hc ON c.historia_id = hc.id
      JOIN pacientes p ON hc.paciente_id = p.id
      ORDER BY c.id
    `);

    if (formato === 'csv') return sendCsv(res, data, 'consultas');

    const wb = buildExcelWorkbook({ Consultas: data });
    sendExcel(res, wb, 'consultas');
  } catch (err) {
    res.status(500).json({ error: 'Error al exportar: ' + err.message });
  }
};

exports.tratamientos = (req, res) => {
  try {
    const formato = req.query.formato || 'xlsx';
    const data = queryAll(`
      SELECT t.*, p.dni, p.nombres, p.apellido_paterno
      FROM tratamientos t
      JOIN pacientes p ON t.paciente_id = p.id
      ORDER BY t.id
    `);

    if (formato === 'csv') return sendCsv(res, data, 'tratamientos');

    const wb = buildExcelWorkbook({ Tratamientos: data });
    sendExcel(res, wb, 'tratamientos');
  } catch (err) {
    res.status(500).json({ error: 'Error al exportar: ' + err.message });
  }
};

exports.pagos = (req, res) => {
  try {
    const formato = req.query.formato || 'xlsx';
    const data = queryAll(`
      SELECT pg.*, p.dni, p.nombres, p.apellido_paterno
      FROM pagos pg
      JOIN pacientes p ON pg.paciente_id = p.id
      ORDER BY pg.id
    `);

    if (formato === 'csv') return sendCsv(res, data, 'pagos');

    const wb = buildExcelWorkbook({ Pagos: data });
    sendExcel(res, wb, 'pagos');
  } catch (err) {
    res.status(500).json({ error: 'Error al exportar: ' + err.message });
  }
};

exports.recetas = (req, res) => {
  try {
    const formato = req.query.formato || 'xlsx';
    const data = queryAll(`
      SELECT r.*, p.dni, p.nombres, p.apellido_paterno
      FROM recetas r
      JOIN pacientes p ON r.paciente_id = p.id
      ORDER BY r.id
    `);

    if (formato === 'csv') return sendCsv(res, data, 'recetas');

    const wb = buildExcelWorkbook({ Recetas: data });
    sendExcel(res, wb, 'recetas');
  } catch (err) {
    res.status(500).json({ error: 'Error al exportar: ' + err.message });
  }
};

exports.estadisticas = (req, res) => {
  try {
    const stats = {
      pacientes: db.prepare('SELECT COUNT(*) as t FROM pacientes').get().t,
      historias: db.prepare('SELECT COUNT(*) as t FROM historias_clinicas').get().t,
      consultas: db.prepare('SELECT COUNT(*) as t FROM consultas').get().t,
      odontogramas: db.prepare('SELECT COUNT(*) as t FROM odontogramas').get().t,
      tratamientos: db.prepare('SELECT COUNT(*) as t FROM tratamientos').get().t,
      pagos: db.prepare('SELECT COUNT(*) as t FROM pagos').get().t,
      recetas: db.prepare('SELECT COUNT(*) as t FROM recetas').get().t,
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estadisticas: ' + err.message });
  }
};

exports.exportarBD = (req, res) => {
  try {
    const dbPath = path.join(__dirname, '..', '..', 'clinica.db');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Base de datos no encontrada' });
    }
    const fecha = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `clinica_backup_${fecha}.db`;
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.sendFile(dbPath);
  } catch (err) {
    res.status(500).json({ error: 'Error al exportar BD: ' + err.message });
  }
};

exports.importarBDAnterior = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envio archivo .db' });
  try {
    const tmpPath = req.file.path;

    let oldDb;
    try {
      oldDb = new DatabaseSync(tmpPath);
    } catch (e) {
      fs.unlinkSync(tmpPath);
      return res.status(400).json({ error: 'Archivo no es una base de datos SQLite valida: ' + e.message });
    }

    const resultados = {
      pacientes: { nuevos: 0, duplicados: 0, errores: 0 },
      consultas: { nuevos: 0, duplicados: 0, errores: 0 },
      tratamientos: { nuevos: 0, duplicados: 0, errores: 0 },
      pagos: { nuevos: 0, duplicados: 0, errores: 0 },
      recetas: { nuevos: 0, duplicados: 0, errores: 0 },
    };

    const insertPaciente = db.prepare(`
      INSERT OR IGNORE INTO pacientes (apellido_paterno, apellido_materno, nombres, dni, telefono, email, fecha_nacimiento, sexo, estado_civil, direccion, lugar_nacimiento, lugar_procedencia, grado_instruccion, ocupacion, nombre_acompanante, contacto_emergencia, telefono_emergencia, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertHistoria = db.prepare(`
      INSERT OR IGNORE INTO historias_clinicas (paciente_id, numero_historia, alergia_medicamentos, propension_hemorragias, complicaciones_anestesia, presion_arterial_medicacion, cardiopatias_personales, cardiopatias_familiares, diabetes_personal, diabetes_familiar, hepatitis, otras_enfermedades, enfermedad_actual_medicacion, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertConsulta = db.prepare(`
      INSERT OR IGNORE INTO consultas (historia_id, fecha, hora, motivo, tiempo_enfermedad, signos_sintomas, relato_cronologico, funciones_biologicas, signos_vitales, examen_clinico_general, evaluacion_odontoestomatologica, diagnostico_lista, plan_tratamiento, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTratamiento = db.prepare(`
      INSERT OR IGNORE INTO tratamientos (paciente_id, consulta_id, fecha, pieza_dental, procedimiento_realizado, costo_total, monto_a_cuenta, saldo_pendiente, estado, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPago = db.prepare(`
      INSERT OR IGNORE INTO pagos (paciente_id, tratamiento_id, consulta_id, fecha, procedimiento, total, a_cuenta, saldo, metodo_pago, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertReceta = db.prepare(`
      INSERT OR IGNORE INTO recetas (consulta_id, paciente_id, medicamentos, indicaciones)
      VALUES (?, ?, ?, ?)
    `);

    const insertOdontograma = db.prepare(`
      INSERT OR IGNORE INTO odontogramas (consulta_id, datos_json)
      VALUES (?, ?)
    `);

    const hasTable = (tableName) => {
      try {
        const r = oldDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
        return !!r;
      } catch {
        return false;
      }
    };

    const oldToNewPacienteId = {};

    const transferir = db.transaction(() => {
      if (hasTable('pacientes')) {
        const oldPacientes = oldDb.prepare('SELECT * FROM pacientes').all();
        for (const p of oldPacientes) {
          try {
            const existente = db.prepare('SELECT id FROM pacientes WHERE dni = ?').get(p.dni);
            if (existente) {
              resultados.pacientes.duplicados++;
              oldToNewPacienteId[p.id] = existente.id;
            } else {
              const info = insertPaciente.run(
                p.apellido_paterno || '', p.apellido_materno || '', p.nombres || '', p.dni || '',
                p.telefono || '', p.email || '', p.fecha_nacimiento || '', p.sexo || '',
                p.estado_civil || '', p.direccion || '', p.lugar_nacimiento || '', p.lugar_procedencia || '',
                p.grado_instruccion || '', p.ocupacion || '', p.nombre_acompanante || '',
                p.contacto_emergencia || '', p.telefono_emergencia || '', p.estado || 'activo'
              );
              oldToNewPacienteId[p.id] = info.lastInsertRowid;
              resultados.pacientes.nuevos++;
            }
          } catch (e) {
            resultados.pacientes.errores++;
          }
        }
      }

      const oldToNewHistoriaId = {};
      if (hasTable('historias_clinicas')) {
        const oldHistorias = oldDb.prepare('SELECT * FROM historias_clinicas').all();
        for (const h of oldHistorias) {
          try {
            const newPacienteId = oldToNewPacienteId[h.paciente_id];
            if (!newPacienteId) continue;
            const existente = db.prepare('SELECT id FROM historias_clinicas WHERE paciente_id = ?').get(newPacienteId);
            if (existente) {
              oldToNewHistoriaId[h.id] = existente.id;
              continue;
            }
            const info = insertHistoria.run(
              newPacienteId, h.numero_historia || '',
              h.alergia_medicamentos || '', h.propension_hemorragias || '',
              h.complicaciones_anestesia || '', h.presion_arterial_medicacion || '',
              h.cardiopatias_personales || '', h.cardiopatias_familiares || '',
              h.diabetes_personal || '', h.diabetes_familiar || '',
              h.hepatitis || '', h.otras_enfermedades || '',
              h.enfermedad_actual_medicacion || '', h.observaciones || ''
            );
            oldToNewHistoriaId[h.id] = info.lastInsertRowid;
          } catch (e) {}
        }
      }

      const oldToNewConsultaId = {};
      if (hasTable('consultas')) {
        const oldConsultas = oldDb.prepare('SELECT * FROM consultas').all();
        for (const c of oldConsultas) {
          try {
            const newHistoriaId = oldToNewHistoriaId[c.historia_id];
            if (!newHistoriaId) continue;
            const info = insertConsulta.run(
              newHistoriaId, c.fecha || '', c.hora || '', c.motivo || '',
              c.tiempo_enfermedad || '', c.signos_sintomas || '',
              c.relato_cronologico || '', c.funciones_biologicas || '',
              c.signos_vitales || '{}', c.examen_clinico_general || '',
              c.evaluacion_odontoestomatologica || '', c.diagnostico_lista || '[]',
              c.plan_tratamiento || '{}', c.notas || ''
            );
            oldToNewConsultaId[c.id] = info.lastInsertRowid;
            resultados.consultas.nuevos++;
          } catch (e) {
            resultados.consultas.errores++;
          }
        }
      }

      if (hasTable('odontogramas')) {
        const oldOdont = oldDb.prepare('SELECT * FROM odontogramas').all();
        for (const o of oldOdont) {
          try {
            const newConsultaId = oldToNewConsultaId[o.consulta_id];
            if (!newConsultaId) continue;
            insertOdontograma.run(newConsultaId, o.datos_json || '{}');
          } catch (e) {}
        }
      }

      if (hasTable('tratamientos')) {
        const oldTrat = oldDb.prepare('SELECT * FROM tratamientos').all();
        for (const t of oldTrat) {
          try {
            const newPacienteId = oldToNewPacienteId[t.paciente_id];
            if (!newPacienteId) continue;
            const newConsultaId = t.consulta_id ? oldToNewConsultaId[t.consulta_id] : null;
            insertTratamiento.run(
              newPacienteId, newConsultaId, t.fecha || '', t.pieza_dental || '',
              t.procedimiento_realizado || '', t.costo_total || 0,
              t.monto_a_cuenta || 0, t.saldo_pendiente || 0,
              t.estado || 'planificado', t.notas || ''
            );
            resultados.tratamientos.nuevos++;
          } catch (e) {
            resultados.tratamientos.errores++;
          }
        }
      }

      if (hasTable('pagos')) {
        const oldPagos = oldDb.prepare('SELECT * FROM pagos').all();
        for (const pg of oldPagos) {
          try {
            const newPacienteId = oldToNewPacienteId[pg.paciente_id];
            if (!newPacienteId) continue;
            const newConsultaId = pg.consulta_id ? oldToNewConsultaId[pg.consulta_id] : null;
            insertPago.run(
              newPacienteId, null, newConsultaId, pg.fecha || '',
              pg.procedimiento || '', pg.total || 0, pg.a_cuenta || 0,
              pg.saldo || 0, pg.metodo_pago || 'efectivo', pg.notas || ''
            );
            resultados.pagos.nuevos++;
          } catch (e) {
            resultados.pagos.errores++;
          }
        }
      }

      if (hasTable('recetas')) {
        const oldRecetas = oldDb.prepare('SELECT * FROM recetas').all();
        for (const r of oldRecetas) {
          try {
            const newPacienteId = oldToNewPacienteId[r.paciente_id];
            const newConsultaId = r.consulta_id ? oldToNewConsultaId[r.consulta_id] : null;
            if (!newPacienteId) continue;
            insertReceta.run(newConsultaId, newPacienteId, r.medicamentos || '[]', r.indicaciones || '');
            resultados.recetas.nuevos++;
          } catch (e) {
            resultados.recetas.errores++;
          }
        }
      }
    });

    transferir();
    oldDb.close();
    fs.unlinkSync(tmpPath);

    res.json({ mensaje: 'Importacion de BD anterior completada', resultados });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Error al importar BD: ' + err.message });
  }
};
