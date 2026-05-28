const db = require('../database');

exports.crear = (req, res) => {
  const { paciente_id, antecedentes, alergias, observaciones } = req.body;

  if (!paciente_id) {
    return res.status(400).json({ error: 'paciente_id es obligatorio' });
  }

  const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(paciente_id);
  if (!paciente) {
    return res.status(404).json({ error: 'Paciente no encontrado' });
  }

  const existente = db.prepare('SELECT id FROM historias_clinicas WHERE paciente_id = ?').get(paciente_id);
  if (existente) {
    return res.status(409).json({ error: 'El paciente ya tiene una historia clinica' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO historias_clinicas (paciente_id, antecedentes, alergias, observaciones)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(paciente_id, antecedentes || '', alergias || '', observaciones || '');
    res.status(201).json({ id: result.lastInsertRowid, paciente_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerPorPaciente = (req, res) => {
  const historia = db.prepare('SELECT * FROM historias_clinicas WHERE paciente_id = ?').get(req.params.pacienteId);
  if (!historia) return res.status(404).json({ error: 'Historia clinica no encontrada' });
  res.json(historia);
};

exports.actualizar = (req, res) => {
  const { antecedentes, alergias, observaciones } = req.body;
  try {
    db.prepare(`
      UPDATE historias_clinicas SET antecedentes = ?, alergias = ?, observaciones = ?
      WHERE id = ?
    `).run(antecedentes || '', alergias || '', observaciones || '', req.params.id);
    res.json({ message: 'Historia clinica actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
