const db = require('../db');

function motivoUsar(cita) {
  return cita.motivo_editado || cita.motivo;
}

exports.listar = async (req, res) => {
  try {
    const { fecha, estado, paciente_id, desde, hasta } = req.query;
    let sql = `
      SELECT c.*,
        (p.apellido_paterno || ' ' || p.apellido_materno || ' ' || p.nombres) as paciente_nombre,
        p.dni as paciente_dni,
        p.telefono as paciente_telefono,
        u.nombre as doctor_nombre
      FROM citas c
      JOIN pacientes p ON p.id = c.paciente_id
      LEFT JOIN usuarios u ON u.id = c.usuario_id
      WHERE 1=1
    `;
    const params = [];

    if (desde) { sql += ' AND c.fecha >= ?'; params.push(desde); }
    if (hasta) { sql += ' AND c.fecha <= ?'; params.push(hasta); }
    if (fecha) { sql += ' AND c.fecha = ?'; params.push(fecha); }
    if (estado) { sql += ' AND c.estado = ?'; params.push(estado); }
    if (paciente_id) { sql += ' AND c.paciente_id = ?'; params.push(paciente_id); }

    sql += ' ORDER BY c.fecha ASC, c.hora ASC';

    const citas = await db.prepare(sql).all(...params);
    citas.forEach(c => { c.motivo_usar = motivoUsar(c); });
    res.json(citas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtener = async (req, res) => {
  try {
    const cita = await db.prepare(`
      SELECT c.*,
        (p.apellido_paterno || ' ' || p.apellido_materno || ' ' || p.nombres) as paciente_nombre,
        p.dni as paciente_dni,
        p.telefono as paciente_telefono,
        p.email as paciente_email,
        p.fecha_nacimiento as paciente_fecha_nacimiento,
        p.alergias as paciente_alergias,
        u.nombre as doctor_nombre
      FROM citas c
      JOIN pacientes p ON p.id = c.paciente_id
      LEFT JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
    cita.motivo_usar = motivoUsar(cita);
    res.json(cita);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.crear = async (req, res) => {
  const { paciente_id, fecha, hora, duracion_minutos, tipo, motivo, notas } = req.body;

  if (!paciente_id || !fecha || !hora) {
    return res.status(400).json({ error: 'paciente_id, fecha y hora son obligatorios' });
  }

  const paciente = await db.prepare('SELECT id FROM pacientes WHERE id = ?').get(paciente_id);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

  try {
    const result = await db.prepare(`
      INSERT INTO citas (paciente_id, usuario_id, fecha, hora, duracion_minutos, tipo, motivo, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paciente_id,
      req.usuario.id,
      fecha,
      hora,
      duracion_minutos || 30,
      tipo || 'consulta',
      motivo || '',
      notas || ''
    );

    const nueva = await db.prepare('SELECT * FROM citas WHERE id = ?').get(result.lastInsertRowid);
    nueva.motivo_usar = motivoUsar(nueva);
    res.status(201).json(nueva);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.actualizar = async (req, res) => {
  const { fecha, hora, duracion_minutos, tipo, motivo, motivo_editado, estado, notas } = req.body;

  try {
    const existente = await db.prepare('SELECT * FROM citas WHERE id = ?').get(req.params.id);
    if (!existente) return res.status(404).json({ error: 'Cita no encontrada' });

    await db.prepare(`
      UPDATE citas SET
        fecha = ?, hora = ?, duracion_minutos = ?, tipo = ?,
        motivo = ?, motivo_editado = ?, estado = ?, notas = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      fecha ?? existente.fecha,
      hora ?? existente.hora,
      duracion_minutos ?? existente.duracion_minutos,
      tipo ?? existente.tipo,
      motivo ?? existente.motivo,
      motivo_editado !== undefined ? motivo_editado : existente.motivo_editado,
      estado ?? existente.estado,
      notas ?? existente.notas,
      req.params.id
    );

    const actualizada = await db.prepare('SELECT * FROM citas WHERE id = ?').get(req.params.id);
    actualizada.motivo_usar = motivoUsar(actualizada);
    res.json(actualizada);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.eliminar = async (req, res) => {
  try {
    const cita = await db.prepare('SELECT id FROM citas WHERE id = ?').get(req.params.id);
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });

    await db.prepare('DELETE FROM citas WHERE id = ?').run(req.params.id);
    res.json({ message: 'Cita eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.confirmar = async (req, res) => {
  try {
    const cita = await db.prepare('SELECT * FROM citas WHERE id = ?').get(req.params.id);
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
    if (cita.estado !== 'pendiente') {
      return res.status(400).json({ error: `No se puede confirmar una cita en estado "${cita.estado}"` });
    }

    const { motivo_editado } = req.body;

    await db.prepare(`
      UPDATE citas SET
        estado = 'confirmada',
        motivo_editado = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      motivo_editado !== undefined ? motivo_editado : cita.motivo_editado,
      req.params.id
    );

    const actualizada = await db.prepare('SELECT * FROM citas WHERE id = ?').get(req.params.id);
    actualizada.motivo_usar = motivoUsar(actualizada);
    res.json({ message: 'Cita confirmada', cita: actualizada });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.asistio = async (req, res) => {
  try {
    const cita = await db.prepare('SELECT * FROM citas WHERE id = ?').get(req.params.id);
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
    if (cita.estado !== 'confirmada' && cita.estado !== 'pendiente') {
      return res.status(400).json({ error: `No se puede marcar asistencia en estado "${cita.estado}"` });
    }

    const { motivo_editado } = req.body;

    await db.prepare(`
      UPDATE citas SET
        estado = 'asistio',
        asistio_confirmed_at = datetime('now'),
        motivo_editado = CASE WHEN ? != '' THEN ? ELSE motivo_editado END,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      motivo_editado || '',
      motivo_editado || '',
      req.params.id
    );

    const actualizada = await db.prepare('SELECT * FROM citas WHERE id = ?').get(req.params.id);
    actualizada.motivo_usar = motivoUsar(actualizada);
    res.json({ message: 'Asistencia registrada', cita: actualizada });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.prepararSesion = async (req, res) => {
  try {
    const cita = await db.prepare(`
      SELECT c.*,
        (p.apellido_paterno || ' ' || p.apellido_materno || ' ' || p.nombres) as paciente_nombre,
        p.dni as paciente_dni,
        p.telefono as paciente_telefono,
        p.fecha_nacimiento as paciente_fecha_nacimiento,
        p.alergias as paciente_alergias
      FROM citas c
      JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });

    const paciente = await db.prepare('SELECT * FROM pacientes WHERE id = ?').get(cita.paciente_id);

    res.json({
      cita_id: cita.id,
      paciente_id: cita.paciente_id,
      paciente,
      motivo_usar: motivoUsar(cita),
      tipo: cita.tipo,
      fecha: cita.fecha,
      hora: cita.hora,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.completar = async (req, res) => {
  const { consulta_id } = req.body;

  try {
    const cita = await db.prepare('SELECT * FROM citas WHERE id = ?').get(req.params.id);
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
    if (cita.estado !== 'asistio') {
      return res.status(400).json({ error: `No se puede completar una cita en estado "${cita.estado}"` });
    }

    await db.prepare(`
      UPDATE citas SET
        estado = 'completada',
        consulta_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(consulta_id, req.params.id);

    res.json({ message: 'Cita completada y vinculada a consulta' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.pendientesProcesar = async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const citas = await db.prepare(`
      SELECT c.*,
        (p.apellido_paterno || ' ' || p.apellido_materno || ' ' || p.nombres) as paciente_nombre,
        p.dni as paciente_dni,
        p.telefono as paciente_telefono,
        p.alergias as paciente_alergias
      FROM citas c
      JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.estado = 'asistio'
      ORDER BY c.fecha ASC, c.hora ASC
    `).all();

    citas.forEach(c => { c.motivo_usar = motivoUsar(c); });
    res.json(citas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.hoy = async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const citas = await db.prepare(`
      SELECT c.*,
        (p.apellido_paterno || ' ' || p.apellido_materno || ' ' || p.nombres) as paciente_nombre,
        p.dni as paciente_dni,
        p.telefono as paciente_telefono,
        p.alergias as paciente_alergias
      FROM citas c
      JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.fecha = ?
      ORDER BY c.hora ASC
    `).all(hoy);

    citas.forEach(c => { c.motivo_usar = motivoUsar(c); });
    res.json(citas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.proximas = async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const citas = await db.prepare(`
      SELECT c.*,
        (p.apellido_paterno || ' ' || p.apellido_materno || ' ' || p.nombres) as paciente_nombre,
        p.dni as paciente_dni,
        p.telefono as paciente_telefono
      FROM citas c
      JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.fecha >= ? AND c.estado IN ('pendiente', 'confirmada')
      ORDER BY c.fecha ASC, c.hora ASC
      LIMIT 10
    `).all(hoy);

    citas.forEach(c => { c.motivo_usar = motivoUsar(c); });
    res.json(citas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
