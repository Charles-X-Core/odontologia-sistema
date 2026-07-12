const db = require('../database');

exports.crear = (req, res) => {
  const {
    historia_id, fecha, hora, motivo, tiempo_enfermedad, signos_sintomas,
    relato_cronologico, funciones_biologicas, signos_vitales,
    examen_clinico_general, evaluacion_odontoestomatologica,
    diagnostico_lista, plan_tratamiento, consentimiento_informado, notas
  } = req.body;

  if (!historia_id || !motivo) {
    return res.status(400).json({ error: 'historia_id y motivo son obligatorios' });
  }

  const historia = db.prepare('SELECT id FROM historias_clinicas WHERE id = ?').get(historia_id);
  if (!historia) {
    return res.status(404).json({ error: 'Historia clinica no encontrada' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO consultas (
        historia_id, fecha, hora, motivo, tiempo_enfermedad, signos_sintomas,
        relato_cronologico, funciones_biologicas, signos_vitales,
        examen_clinico_general, evaluacion_odontoestomatologica,
        diagnostico_lista, plan_tratamiento, consentimiento_informado, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      historia_id,
      fecha || new Date().toISOString(),
      hora || '',
      motivo,
      tiempo_enfermedad || '',
      signos_sintomas || '',
      relato_cronologico || '',
      funciones_biologicas || '',
      JSON.stringify(signos_vitales || {}),
      examen_clinico_general || '',
      evaluacion_odontoestomatologica || '',
      JSON.stringify(diagnostico_lista || []),
      JSON.stringify(plan_tratamiento || {}),
      consentimiento_informado || 0,
      notas || ''
    );
    res.status(201).json({ id: result.lastInsertRowid, historia_id, fecha: fecha || new Date().toISOString() });
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

  consultas.forEach(c => {
    if (c.signos_vitales) c.signos_vitales = JSON.parse(c.signos_vitales);
    if (c.diagnostico_lista) c.diagnostico_lista = JSON.parse(c.diagnostico_lista);
    if (c.plan_tratamiento) c.plan_tratamiento = JSON.parse(c.plan_tratamiento);
  });

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

  if (consulta.signos_vitales) consulta.signos_vitales = JSON.parse(consulta.signos_vitales);
  if (consulta.diagnostico_lista) consulta.diagnostico_lista = JSON.parse(consulta.diagnostico_lista);
  if (consulta.plan_tratamiento) consulta.plan_tratamiento = JSON.parse(consulta.plan_tratamiento);

  res.json(consulta);
};

exports.actualizar = (req, res) => {
  const {
    fecha, hora, motivo, tiempo_enfermedad, signos_sintomas,
    relato_cronologico, funciones_biologicas, signos_vitales,
    examen_clinico_general, evaluacion_odontoestomatologica,
    diagnostico_lista, plan_tratamiento, notas
  } = req.body;
  try {
    db.prepare(`
      UPDATE consultas SET
        fecha = ?, hora = ?, motivo = ?, tiempo_enfermedad = ?,
        signos_sintomas = ?, relato_cronologico = ?, funciones_biologicas = ?,
        signos_vitales = ?, examen_clinico_general = ?,
        evaluacion_odontoestomatologica = ?, diagnostico_lista = ?,
        plan_tratamiento = ?, notas = ?
      WHERE id = ?
    `).run(
      fecha || new Date().toISOString(), hora || '', motivo || '',
      tiempo_enfermedad || '', signos_sintomas || '',
      relato_cronologico || '', funciones_biologicas || '',
      JSON.stringify(signos_vitales || {}),
      examen_clinico_general || '',
      evaluacion_odontoestomatologica || '',
      JSON.stringify(diagnostico_lista || []),
      JSON.stringify(plan_tratamiento || {}),
      notas || '',
      req.params.id
    );
    res.json({ message: 'Consulta actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.eliminar = (req, res) => {
  try {
    db.prepare('DELETE FROM consultas WHERE id = ?').run(req.params.id);
    res.json({ message: 'Consulta eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
