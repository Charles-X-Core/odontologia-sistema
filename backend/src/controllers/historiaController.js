const db = require('../database');

exports.crear = (req, res) => {
  const {
    paciente_id, observaciones,
    alergia_medicamentos, propension_hemorragias, complicaciones_anestesia,
    presion_arterial_medicacion, cardiopatias_personales, cardiopatias_familiares,
    diabetes_personal, diabetes_familiar, hepatitis, otras_enfermedades,
    enfermedad_actual_medicacion
  } = req.body;

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

  const ultimo = db.prepare("SELECT MAX(CAST(numero_historia AS INTEGER)) as max_num FROM historias_clinicas WHERE numero_historia IS NOT NULL AND numero_historia != ''").get();
  const siguienteNumero = (ultimo?.max_num || 0) + 1;

  try {
    const stmt = db.prepare(`
      INSERT INTO historias_clinicas (
        paciente_id, numero_historia, observaciones,
        alergia_medicamentos, propension_hemorragias, complicaciones_anestesia,
        presion_arterial_medicacion, cardiopatias_personales, cardiopatias_familiares,
        diabetes_personal, diabetes_familiar, hepatitis, otras_enfermedades,
        enfermedad_actual_medicacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      paciente_id, String(siguienteNumero), observaciones || '',
      alergia_medicamentos || '', propension_hemorragias || '',
      complicaciones_anestesia || '', presion_arterial_medicacion || '',
      cardiopatias_personales || '', cardiopatias_familiares || '',
      diabetes_personal || '', diabetes_familiar || '',
      hepatitis || '', otras_enfermedades || '',
      enfermedad_actual_medicacion || ''
    );
    res.status(201).json({ id: result.lastInsertRowid, paciente_id, numero_historia: String(siguienteNumero) });
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
  const {
    observaciones,
    alergia_medicamentos, propension_hemorragias, complicaciones_anestesia,
    presion_arterial_medicacion, cardiopatias_personales, cardiopatias_familiares,
    diabetes_personal, diabetes_familiar, hepatitis, otras_enfermedades,
    enfermedad_actual_medicacion
  } = req.body;
  try {
    db.prepare(`
      UPDATE historias_clinicas SET
        observaciones = ?,
        alergia_medicamentos = ?, propension_hemorragias = ?,
        complicaciones_anestesia = ?, presion_arterial_medicacion = ?,
        cardiopatias_personales = ?, cardiopatias_familiares = ?,
        diabetes_personal = ?, diabetes_familiar = ?,
        hepatitis = ?, otras_enfermedades = ?,
        enfermedad_actual_medicacion = ?
      WHERE id = ?
    `).run(
      observaciones || '',
      alergia_medicamentos || '', propension_hemorragias || '',
      complicaciones_anestesia || '', presion_arterial_medicacion || '',
      cardiopatias_personales || '', cardiopatias_familiares || '',
      diabetes_personal || '', diabetes_familiar || '',
      hepatitis || '', otras_enfermedades || '',
      enfermedad_actual_medicacion || '',
      req.params.id
    );
    res.json({ message: 'Historia clinica actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
