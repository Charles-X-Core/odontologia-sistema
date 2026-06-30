const db = require('../database');

function validarDocumento(tipo, numero) {
  if (!numero || numero.trim() === '') return tipo === 'sin_doc' || !tipo;
  const t = numero.trim();
  switch (tipo) {
    case 'dni': return /^\d{8}$/.test(t);
    case 'ce': return /^\d{8,12}$/.test(t);
    case 'pasaporte': return /^[A-Z0-9]{6,12}$/i.test(t);
    default: return t.length >= 4;
  }
}

function mensajeValidacionDoc(tipo) {
  switch (tipo) {
    case 'dni': return 'DNI debe tener exactamente 8 digitos numericos';
    case 'ce': return 'CE (Carnet de Extranjeria) debe tener 8-12 digitos numericos';
    case 'pasaporte': return 'Pasaporte debe tener 6-12 caracteres alfanumericos';
    default: return 'Formato de documento invalido';
  }
}

exports.crear = (req, res) => {
  const {
    apellido_paterno, apellido_materno, nombres, dni, tipo_documento, telefono, email,
    fecha_nacimiento, sexo, estado_civil, direccion, lugar_nacimiento,
    lugar_procedencia, grado_instruccion, ocupacion, nombre_acompanante,
    contacto_emergencia, telefono_emergencia,
    alergias, antecedentes_personales, antecedentes_familiares
  } = req.body;

  if (!apellido_paterno || !nombres) {
    return res.status(400).json({ error: 'Apellido paterno y nombres son obligatorios' });
  }

  const docTipo = tipo_documento || 'dni';
  const docNumero = dni || '';

  if (docTipo !== 'sin_doc' && !docNumero) {
    return res.status(400).json({ error: 'El numero de documento es obligatorio para este tipo' });
  }

  if (docNumero && !validarDocumento(docTipo, docNumero)) {
    return res.status(400).json({ error: mensajeValidacionDoc(docTipo) });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO pacientes (
        apellido_paterno, apellido_materno, nombres, dni, tipo_documento, telefono, email,
        fecha_nacimiento, sexo, estado_civil, direccion, lugar_nacimiento,
        lugar_procedencia, grado_instruccion, ocupacion, nombre_acompanante,
        contacto_emergencia, telefono_emergencia,
        alergias, antecedentes_personales, antecedentes_familiares
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      apellido_paterno, apellido_materno || '', nombres, docNumero || null, docTipo,
      telefono || null, email || null, fecha_nacimiento || null, sexo || null,
      estado_civil || '', direccion || null, lugar_nacimiento || '',
      lugar_procedencia || '', grado_instruccion || '', ocupacion || null,
      nombre_acompanante || '', contacto_emergencia || null, telefono_emergencia || null,
      alergias || '', antecedentes_personales || '', antecedentes_familiares || ''
    );
    res.status(201).json({ id: result.lastInsertRowid, apellido_paterno, apellido_materno, nombres, dni: docNumero, tipo_documento: docTipo });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Ya existe un paciente con ese documento' });
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

  const palabras = q.trim().split(/\s+/).filter(w => w.length > 0);

  if (palabras.length === 0) return res.json([]);

  if (palabras.length === 1) {
    const term = `%${palabras[0]}%`;
    const pacientes = db.prepare(`
      SELECT * FROM pacientes
      WHERE nombres LIKE ? OR apellido_paterno LIKE ? OR apellido_materno LIKE ?
         OR dni LIKE ? OR telefono LIKE ?
      ORDER BY apellido_paterno ASC
      LIMIT 20
    `).all(term, term, term, term, term);
    return res.json(pacientes);
  }

  const cols = ['nombres', 'apellido_paterno', 'apellido_materno', 'dni', 'telefono'];
  const andBlocks = [];
  const params = [];

  for (const palabra of palabras) {
    const likeBlocks = cols.map(col => `${col} LIKE ?`);
    andBlocks.push(`(${likeBlocks.join(' OR ')})`);
    const term = `%${palabra}%`;
    for (let i = 0; i < cols.length; i++) params.push(term);
  }

  const where = andBlocks.join(' AND ');
  const pacientes = db.prepare(`
    SELECT * FROM pacientes
    WHERE ${where}
    ORDER BY apellido_paterno ASC
    LIMIT 20
  `).all(...params);

  res.json(pacientes);
};

exports.obtenerPorId = (req, res) => {
  const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.json(paciente);
};

exports.actualizar = (req, res) => {
  const {
    apellido_paterno, apellido_materno, nombres, dni, tipo_documento, telefono, email,
    fecha_nacimiento, sexo, estado_civil, direccion, lugar_nacimiento,
    lugar_procedencia, grado_instruccion, ocupacion, nombre_acompanante,
    contacto_emergencia, telefono_emergencia, estado,
    alergias, antecedentes_personales, antecedentes_familiares
  } = req.body;
  const { id } = req.params;

  if (dni && tipo_documento && tipo_documento !== 'sin_doc') {
    if (!validarDocumento(tipo_documento, dni)) {
      return res.status(400).json({ error: mensajeValidacionDoc(tipo_documento) });
    }
  }

  try {
    const stmt = db.prepare(`
      UPDATE pacientes SET
        apellido_paterno = ?, apellido_materno = ?, nombres = ?,
        dni = ?, tipo_documento = ?,
        telefono = ?, email = ?, fecha_nacimiento = ?, sexo = ?,
        estado_civil = ?, direccion = ?, lugar_nacimiento = ?,
        lugar_procedencia = ?, grado_instruccion = ?, ocupacion = ?,
        nombre_acompanante = ?, contacto_emergencia = ?,
        telefono_emergencia = ?, estado = ?,
        alergias = ?, antecedentes_personales = ?, antecedentes_familiares = ?
      WHERE id = ?
    `);
    stmt.run(
      apellido_paterno || '', apellido_materno || '', nombres || '',
      dni || '', tipo_documento || 'dni',
      telefono || null, email || null, fecha_nacimiento || null, sexo || null,
      estado_civil || '', direccion || null, lugar_nacimiento || '',
      lugar_procedencia || '', grado_instruccion || '', ocupacion || null,
      nombre_acompanante || '', contacto_emergencia || null,
      telefono_emergencia || null, estado || 'activo',
      alergias || '', antecedentes_personales || '', antecedentes_familiares || '',
      id
    );
    res.json({ message: 'Paciente actualizado' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Ya existe otro paciente con ese documento' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.actualizarDni = (req, res) => {
  const { dni, tipo_documento } = req.body;
  const { id } = req.params;

  if (!dni || !dni.trim()) {
    return res.status(400).json({ error: 'El numero de documento es obligatorio' });
  }

  const docTipo = tipo_documento || 'dni';
  if (!validarDocumento(docTipo, dni)) {
    return res.status(400).json({ error: mensajeValidacionDoc(docTipo) });
  }

  try {
    const existing = db.prepare('SELECT id FROM pacientes WHERE dni = ? AND id != ?').get(dni.trim(), id);
    if (existing) {
      return res.status(409).json({ error: 'Ya existe otro paciente con ese documento' });
    }

    db.prepare('UPDATE pacientes SET dni = ?, tipo_documento = ? WHERE id = ?').run(dni.trim(), docTipo, id);
    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(id);
    res.json({ message: 'Documento actualizado', paciente });
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

  consultas.forEach(c => {
    if (c.odontograma) {
      try { c.odontograma = JSON.parse(c.odontograma); } catch {}
    }
    c.tratamientos = db.prepare('SELECT * FROM tratamientos WHERE consulta_id = ? ORDER BY created_at DESC').all(c.id);
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

  const resumen = {};
  resumen.total_consultas = consultas.length;
  resumen.total_tratamientos = db.prepare('SELECT COUNT(*) as n FROM tratamientos WHERE paciente_id = ?').get(req.params.id).n;
  resumen.tratamientos_pendientes = db.prepare("SELECT COUNT(*) as n FROM tratamientos WHERE paciente_id = ? AND estado != 'realizado'").get(req.params.id).n;
  resumen.total_recetas = db.prepare('SELECT COUNT(*) as n FROM recetas WHERE paciente_id = ?').get(req.params.id).n;
  const pagosRes = db.prepare('SELECT COALESCE(SUM(total),0) as total, COALESCE(SUM(a_cuenta),0) as pagado, COALESCE(SUM(saldo),0) as pendiente FROM pagos WHERE paciente_id = ?').get(req.params.id);
  resumen.total_pagado = pagosRes.pagado;
  resumen.total_pendiente = pagosRes.pendiente;
  resumen.total_tratamiento_costo = db.prepare('SELECT COALESCE(SUM(costo_total),0) as total FROM tratamientos WHERE paciente_id = ?').get(req.params.id).total;

  res.json({ paciente, historia, consultas, necesidades, resumen });
};
