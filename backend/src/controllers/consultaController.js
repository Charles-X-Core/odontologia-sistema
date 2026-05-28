const db = require('../database');

exports.crear = (req, res) => {
  const { historia_id, motivo, diagnostico, tratamiento, notas } = req.body;

  if (!historia_id || !motivo || !diagnostico || !tratamiento) {
    return res.status(400).json({ error: 'historia_id, motivo, diagnostico y tratamiento son obligatorios' });
  }

  const historia = db.prepare('SELECT id FROM historias_clinicas WHERE id = ?').get(historia_id);
  if (!historia) {
    return res.status(404).json({ error: 'Historia clinica no encontrada' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO consultas (historia_id, motivo, diagnostico, tratamiento, notas)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(historia_id, motivo, diagnostico, tratamiento, notas || '');
    res.status(201).json({ id: result.lastInsertRowid, historia_id, fecha: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerPorHistoria = (req, res) => {
  const consultas = db.prepare(`
    SELECT c.*, o.datos_json as odontograma
    FROM consultas c
    LEFT JOIN odontogramas o ON o.consulta_id = c.id
    WHERE c.historia_id = ?
    ORDER BY c.fecha DESC
  `).all(req.params.historiaId);
  res.json(consultas);
};

exports.obtenerPorId = (req, res) => {
  const consulta = db.prepare(`
    SELECT c.*, o.datos_json as odontograma
    FROM consultas c
    LEFT JOIN odontogramas o ON o.consulta_id = c.id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!consulta) return res.status(404).json({ error: 'Consulta no encontrada' });
  res.json(consulta);
};
