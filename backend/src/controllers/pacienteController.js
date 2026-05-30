const db = require('../database');

exports.crear = (req, res) => {
  const { nombre, dni, telefono, email, fecha_nacimiento, sexo } = req.body;

  if (!nombre || !dni) {
    return res.status(400).json({ error: 'Nombre y DNI son obligatorios' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO pacientes (nombre, dni, telefono, email, fecha_nacimiento, sexo)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(nombre, dni, telefono || null, email || null, fecha_nacimiento || null, sexo || null);
    res.status(201).json({ id: result.lastInsertRowid, nombre, dni });
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

exports.obtenerPorId = (req, res) => {
  const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.json(paciente);
};

exports.actualizar = (req, res) => {
  const { nombre, telefono, email, fecha_nacimiento, sexo } = req.body;
  const { id } = req.params;

  try {
    const stmt = db.prepare(`
      UPDATE pacientes SET nombre = ?, telefono = ?, email = ?, fecha_nacimiento = ?, sexo = ?
      WHERE id = ?
    `);
    stmt.run(nombre, telefono || null, email || null, fecha_nacimiento || null, sexo || null, id);
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
  if (!historia) return res.json({ paciente, historia: null, consultas: [] });

  const consultas = db.prepare(`
    SELECT c.*, o.datos_json as odontograma
    FROM consultas c
    LEFT JOIN odontogramas o ON o.consulta_id = c.id
    WHERE c.historia_id = ?
    ORDER BY c.fecha DESC
  `).all(historia.id);

  consultas.forEach(c => {
    if (c.odontograma) c.odontograma = JSON.parse(c.odontograma);
  });

  const ultimaConsulta = consultas.length > 0 ? consultas[0] : null;
  let necesidades = null;
  if (ultimaConsulta) {
    necesidades = db.prepare('SELECT * FROM necesidades_odontologicas WHERE consulta_id = ?').get(ultimaConsulta.id) || null;
  }

  res.json({ paciente, historia, consultas, necesidades });
};
