const db = require('../db');

exports.crear = async (req, res) => {
  const { consulta_id, paciente_id, medicamentos, indicaciones } = req.body;
  if (!consulta_id || !paciente_id || !medicamentos) {
    return res.status(400).json({ error: 'consulta_id, paciente_id y medicamentos son obligatorios' });
  }
  try {
    const result = await db.prepare(`
      INSERT INTO recetas (consulta_id, paciente_id, medicamentos, indicaciones)
      VALUES (?, ?, ?, ?)
    `).run(consulta_id, paciente_id, JSON.stringify(medicamentos), indicaciones || '');
    res.status(201).json({ id: result.lastInsertRowid, consulta_id, paciente_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.porConsulta = async (req, res) => {
  const recetas = await db.prepare('SELECT * FROM recetas WHERE consulta_id = ?').all(req.params.consultaId);
  recetas.forEach(r => { r.medicamentos = JSON.parse(r.medicamentos); });
  res.json(recetas);
};

exports.porPaciente = async (req, res) => {
  const recetas = await db.prepare(`
    SELECT r.*, c.fecha as consulta_fecha, c.motivo as consulta_motivo
    FROM recetas r
    JOIN consultas c ON c.id = r.consulta_id
    WHERE r.paciente_id = ?
    ORDER BY r.created_at DESC
  `).all(req.params.pacienteId);
  recetas.forEach(r => { r.medicamentos = JSON.parse(r.medicamentos); });
  res.json(recetas);
};

exports.obtener = async (req, res) => {
  const receta = await db.prepare(`
    SELECT r.*, p.nombres as paciente_nombre, p.apellido_paterno, p.apellido_materno, p.dni as paciente_dni, c.fecha as consulta_fecha
    FROM recetas r
    JOIN pacientes p ON p.id = r.paciente_id
    JOIN consultas c ON c.id = r.consulta_id
    WHERE r.id = ?
  `).get(req.params.id);
  if (!receta) return res.status(404).json({ error: 'Receta no encontrada' });
  receta.medicamentos = JSON.parse(receta.medicamentos);
  res.json(receta);
};

exports.eliminar = async (req, res) => {
  try {
    await db.prepare('DELETE FROM recetas WHERE id = ?').run(req.params.id);
    res.json({ message: 'Receta eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
