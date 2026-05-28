const db = require('../database');

exports.crear = (req, res) => {
  const { paciente_id, descripcion, estado, costo, diente_numero, notas } = req.body;
  if (!paciente_id || !descripcion) {
    return res.status(400).json({ error: 'paciente_id y descripcion son obligatorios' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO tratamientos (paciente_id, descripcion, estado, costo, diente_numero, notas)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(paciente_id, descripcion, estado || 'pendiente', costo || 0, diente_numero || null, notas || '');
    res.status(201).json({ id: result.lastInsertRowid, paciente_id, descripcion, estado: estado || 'pendiente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listarPorPaciente = (req, res) => {
  const tratamientos = db.prepare('SELECT * FROM tratamientos WHERE paciente_id = ? ORDER BY created_at DESC').all(req.params.pacienteId);
  res.json(tratamientos);
};

exports.actualizar = (req, res) => {
  const { descripcion, estado, costo, diente_numero, notas, fecha_fin } = req.body;
  try {
    const campos = [];
    const valores = [];
    if (descripcion !== undefined) { campos.push('descripcion = ?'); valores.push(descripcion); }
    if (estado !== undefined) { campos.push('estado = ?'); valores.push(estado); }
    if (costo !== undefined) { campos.push('costo = ?'); valores.push(costo); }
    if (diente_numero !== undefined) { campos.push('diente_numero = ?'); valores.push(diente_numero); }
    if (notas !== undefined) { campos.push('notas = ?'); valores.push(notas); }
    if (fecha_fin !== undefined) { campos.push('fecha_fin = ?'); valores.push(fecha_fin); }
    if (estado === 'completado') { campos.push('fecha_fin = ?'); valores.push(new Date().toISOString()); }
    if (estado === 'pendiente' || estado === 'en_proceso') { campos.push('fecha_fin = ?'); valores.push(null); }
    valores.push(req.params.id);
    db.prepare(`UPDATE tratamientos SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
    res.json({ message: 'Tratamiento actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.eliminar = (req, res) => {
  try {
    db.prepare('DELETE FROM tratamientos WHERE id = ?').run(req.params.id);
    res.json({ message: 'Tratamiento eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
