const db = require('../database');

exports.crear = (req, res) => {
  const { consulta_id, datos_json } = req.body;

  if (!consulta_id) {
    return res.status(400).json({ error: 'consulta_id es obligatorio' });
  }

  const consulta = db.prepare('SELECT id FROM consultas WHERE id = ?').get(consulta_id);
  if (!consulta) {
    return res.status(404).json({ error: 'Consulta no encontrada' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO odontogramas (consulta_id, datos_json)
      VALUES (?, ?)
    `);
    const result = stmt.run(consulta_id, JSON.stringify(datos_json || {}));
    res.status(201).json({ id: result.lastInsertRowid, consulta_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerPorConsulta = (req, res) => {
  const odontograma = db.prepare('SELECT * FROM odontogramas WHERE consulta_id = ?').get(req.params.consultaId);
  if (!odontograma) return res.status(404).json({ error: 'Odontograma no encontrado' });
  odontograma.datos_json = JSON.parse(odontograma.datos_json);
  res.json(odontograma);
};

exports.obtenerHistorial = (req, res) => {
  const odontogramas = db.prepare(`
    SELECT o.*, c.fecha as consulta_fecha
    FROM odontogramas o
    JOIN consultas c ON c.id = o.consulta_id
    WHERE c.historia_id = ?
    ORDER BY c.fecha DESC
  `).all(req.params.historiaId);

  odontogramas.forEach(o => { o.datos_json = JSON.parse(o.datos_json); });
  res.json(odontogramas);
};
