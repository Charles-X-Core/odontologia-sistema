const db = require('../database');

exports.crear = (req, res) => {
  const { consulta_id, cariados, curados, por_extraer, endodoncia, ortodoncia, protesis, extraidos, destartraje } = req.body;

  if (!consulta_id) {
    return res.status(400).json({ error: 'consulta_id es obligatorio' });
  }

  const consulta = db.prepare('SELECT id FROM consultas WHERE id = ?').get(consulta_id);
  if (!consulta) {
    return res.status(404).json({ error: 'Consulta no encontrada' });
  }

  try {
    const existente = db.prepare('SELECT id FROM necesidades_odontologicas WHERE consulta_id = ?').get(consulta_id);

    if (existente) {
      db.prepare(`
        UPDATE necesidades_odontologicas SET cariados = ?, curados = ?, por_extraer = ?,
        endodoncia = ?, ortodoncia = ?, protesis = ?, extraidos = ?, destartraje = ?
        WHERE consulta_id = ?
      `).run(
        cariados || 0, curados || 0, por_extraer || 0,
        endodoncia || 0, ortodoncia || 0, protesis || 0,
        extraidos || 0, destartraje || 0, consulta_id
      );
      return res.json({ message: 'Necesidades actualizadas', id: existente.id });
    }

    const stmt = db.prepare(`
      INSERT INTO necesidades_odontologicas (consulta_id, cariados, curados, por_extraer, endodoncia, ortodoncia, protesis, extraidos, destartraje)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      consulta_id,
      cariados || 0, curados || 0, por_extraer || 0,
      endodoncia || 0, ortodoncia || 0, protesis || 0,
      extraidos || 0, destartraje || 0
    );
    res.status(201).json({ id: result.lastInsertRowid, consulta_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerPorConsulta = (req, res) => {
  const necesidades = db.prepare('SELECT * FROM necesidades_odontologicas WHERE consulta_id = ?').get(req.params.consultaId);
  if (!necesidades) return res.json(null);
  res.json(necesidades);
};

exports.obtenerPorPaciente = (req, res) => {
  const necesidades = db.prepare(`
    SELECT n.*, c.fecha as consulta_fecha
    FROM necesidades_odontologicas n
    JOIN consultas c ON c.id = n.consulta_id
    JOIN historias_clinicas h ON h.id = c.historia_id
    WHERE h.paciente_id = ?
    ORDER BY c.fecha DESC
  `).all(req.params.pacienteId);
  res.json(necesidades);
};
