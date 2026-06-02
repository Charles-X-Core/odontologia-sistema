const db = require('../database');

exports.crear = (req, res) => {
  const {
    apellido_paterno, apellido_materno, nombres, dni, telefono, email,
    fecha_nacimiento, sexo, estado_civil, direccion, lugar_nacimiento,
    lugar_procedencia, grado_instruccion, ocupacion, nombre_acompanante,
    contacto_emergencia, telefono_emergencia
  } = req.body;

  if (!apellido_paterno || !nombres || !dni) {
    return res.status(400).json({ error: 'Apellido paterno, nombres y DNI son obligatorios' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO pacientes (
        apellido_paterno, apellido_materno, nombres, dni, telefono, email,
        fecha_nacimiento, sexo, estado_civil, direccion, lugar_nacimiento,
        lugar_procedencia, grado_instruccion, ocupacion, nombre_acompanante,
        contacto_emergencia, telefono_emergencia
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      apellido_paterno, apellido_materno || '', nombres, dni,
      telefono || null, email || null, fecha_nacimiento || null, sexo || null,
      estado_civil || '', direccion || null, lugar_nacimiento || '',
      lugar_procedencia || '', grado_instruccion || '', ocupacion || null,
      nombre_acompanante || '', contacto_emergencia || null, telefono_emergencia || null
    );
    res.status(201).json({ id: result.lastInsertRowid, apellido_paterno, apellido_materno, nombres, dni });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Ya existe un paciente con ese DNI' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.listar = (req, res) => {
  const pacientes = db.prepare('SELECT * FROM pacientes ORDER BY created_at DESC').all();
  res.json(pacientes);
};

exports.buscar = (req, res) => {
  const q = req.query.q;
  if (!q || q.trim().length < 1) {
    return res.json([]);
  }
  const term = `%${q.trim()}%`;
  const pacientes = db.prepare(`
    SELECT * FROM pacientes
    WHERE nombres LIKE ? OR apellido_paterno LIKE ? OR apellido_materno LIKE ?
       OR dni LIKE ? OR telefono LIKE ?
    ORDER BY apellido_paterno ASC
    LIMIT 20
  `).all(term, term, term, term, term);
  res.json(pacientes);
};

exports.obtenerPorId = (req, res) => {
  const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.json(paciente);
};

exports.actualizar = (req, res) => {
  const {
    apellido_paterno, apellido_materno, nombres, telefono, email,
    fecha_nacimiento, sexo, estado_civil, direccion, lugar_nacimiento,
    lugar_procedencia, grado_instruccion, ocupacion, nombre_acompanante,
    contacto_emergencia, telefono_emergencia, estado
  } = req.body;
  const { id } = req.params;

  try {
    const stmt = db.prepare(`
      UPDATE pacientes SET
        apellido_paterno = ?, apellido_materno = ?, nombres = ?,
        telefono = ?, email = ?, fecha_nacimiento = ?, sexo = ?,
        estado_civil = ?, direccion = ?, lugar_nacimiento = ?,
        lugar_procedencia = ?, grado_instruccion = ?, ocupacion = ?,
        nombre_acompanante = ?, contacto_emergencia = ?,
        telefono_emergencia = ?, estado = ?
      WHERE id = ?
    `);
    stmt.run(
      apellido_paterno || '', apellido_materno || '', nombres || '',
      telefono || null, email || null, fecha_nacimiento || null, sexo || null,
      estado_civil || '', direccion || null, lugar_nacimiento || '',
      lugar_procedencia || '', grado_instruccion || '', ocupacion || null,
      nombre_acompanante || '', contacto_emergencia || null,
      telefono_emergencia || null, estado || 'activo', id
    );
    res.json({ message: 'Paciente actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.eliminar = (req, res) => {
  try {
    db.prepare('DELETE FROM pacientes WHERE id = ?').run(req.params.id);
    res.json({ message: 'Paciente eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerHistorial = (req, res) => {
  const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

  const historia = db.prepare('SELECT * FROM historias_clinicas WHERE paciente_id = ?').get(req.params.id);
  if (!historia) return res.json({ paciente, historia: null, consultas: [], resumen: {} });

  const consultas = db.prepare(`
    SELECT c.*, o.datos_json as odontograma
    FROM consultas c
    LEFT JOIN odontogramas o ON o.consulta_id = c.id
    WHERE c.historia_id = ?
    ORDER BY c.fecha DESC
  `).all(historia.id);

  // Enriquecer cada consulta con datos vinculados
  consultas.forEach(c => {
    if (c.odontograma) {
      try { c.odontograma = JSON.parse(c.odontograma); } catch {}
    }
    c.tratamientos = db.prepare('SELECT * FROM tratamientos WHERE consulta_id = ? ORDER BY fecha DESC').all(c.id);
    c.recetas = db.prepare('SELECT id, medicamentos, indicaciones, created_at FROM recetas WHERE consulta_id = ? ORDER BY created_at DESC').all(c.id);
    c.recetas.forEach(r => {
      try { r.medicamentos = JSON.parse(r.medicamentos); } catch {}
    });
    c.pagos = db.prepare('SELECT * FROM pagos WHERE consulta_id = ? ORDER BY fecha DESC').all(c.id);
    c.necesidades = db.prepare('SELECT * FROM necesidades_odontologicas WHERE consulta_id = ?').get(c.id) || null;
  });

  const ultimaConsulta = consultas.length > 0 ? consultas[0] : null;
  let necesidades = null;
  if (ultimaConsulta) {
    necesidades = ultimaConsulta.necesidades;
  }

  // Resumen general del paciente
  const resumen = {};
  resumen.total_consultas = consultas.length;
  resumen.total_tratamientos = db.prepare('SELECT COUNT(*) as n FROM tratamientos WHERE paciente_id = ?').get(req.params.id).n;
  resumen.tratamientos_pendientes = db.prepare("SELECT COUNT(*) as n FROM tratamientos WHERE paciente_id = ? AND estado != 'completado'").get(req.params.id).n;
  resumen.total_recetas = db.prepare('SELECT COUNT(*) as n FROM recetas WHERE paciente_id = ?').get(req.params.id).n;
  const pagosRes = db.prepare('SELECT COALESCE(SUM(total),0) as total, COALESCE(SUM(a_cuenta),0) as pagado, COALESCE(SUM(saldo),0) as pendiente FROM pagos WHERE paciente_id = ?').get(req.params.id);
  resumen.total_pagado = pagosRes.pagado;
  resumen.total_pendiente = pagosRes.pendiente;
  resumen.total_tratamiento_costo = db.prepare('SELECT COALESCE(SUM(costo_total),0) as total FROM tratamientos WHERE paciente_id = ?').get(req.params.id).total;

  res.json({ paciente, historia, consultas, necesidades, resumen });
};
