const db = require('../database');

exports.crear = (req, res) => {
  const {
    paciente_id, consulta_id, fecha, pieza_dental,
    procedimiento_realizado, costo_total, monto_a_cuenta, notas
  } = req.body;

  if (!paciente_id || !procedimiento_realizado) {
    return res.status(400).json({ error: 'paciente_id y procedimiento_realizado son obligatorios' });
  }
  if (!consulta_id) {
    return res.status(400).json({ error: 'consulta_id es obligatorio - todo tratamiento debe vincularse a una consulta' });
  }

  const costoTotalNum = parseFloat(costo_total) || 0;
  const montoCuentaNum = parseFloat(monto_a_cuenta) || 0;
  const saldoPendiente = costoTotalNum - montoCuentaNum;

  try {
    const result = db.prepare(`
      INSERT INTO tratamientos (
        paciente_id, consulta_id, fecha, pieza_dental,
        procedimiento_realizado, costo_total, monto_a_cuenta, saldo_pendiente, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paciente_id, consulta_id || null,
      fecha || new Date().toISOString().split('T')[0],
      pieza_dental || '', procedimiento_realizado,
      costoTotalNum, montoCuentaNum, saldoPendiente, notas || ''
    );
    res.status(201).json({ id: result.lastInsertRowid, paciente_id, saldo_pendiente: saldoPendiente });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listarPorPaciente = (req, res) => {
  const tratamientos = db.prepare(`
    SELECT t.*, c.fecha as consulta_fecha
    FROM tratamientos t
    LEFT JOIN consultas c ON c.id = t.consulta_id
    WHERE t.paciente_id = ?
    ORDER BY t.fecha DESC
  `).all(req.params.pacienteId);
  res.json(tratamientos);
};

exports.actualizar = (req, res) => {
  const {
    consulta_id, fecha, pieza_dental, procedimiento_realizado,
    costo_total, monto_a_cuenta, estado, notas
  } = req.body;

  try {
    const campos = [];
    const valores = [];

    if (consulta_id !== undefined) { campos.push('consulta_id = ?'); valores.push(consulta_id); }
    if (fecha !== undefined) { campos.push('fecha = ?'); valores.push(fecha); }
    if (pieza_dental !== undefined) { campos.push('pieza_dental = ?'); valores.push(pieza_dental); }
    if (procedimiento_realizado !== undefined) { campos.push('procedimiento_realizado = ?'); valores.push(procedimiento_realizado); }
    if (costo_total !== undefined) { campos.push('costo_total = ?'); valores.push(parseFloat(costo_total) || 0); }
    if (monto_a_cuenta !== undefined) { campos.push('monto_a_cuenta = ?'); valores.push(parseFloat(monto_a_cuenta) || 0); }
    if (estado !== undefined) { campos.push('estado = ?'); valores.push(estado); }
    if (notas !== undefined) { campos.push('notas = ?'); valores.push(notas); }

    // Recalcular saldo si cambió costo o monto
    if (costo_total !== undefined || monto_a_cuenta !== undefined) {
      const actual = db.prepare('SELECT costo_total, monto_a_cuenta FROM tratamientos WHERE id = ?').get(req.params.id);
      if (actual) {
        const nuevoCosto = costo_total !== undefined ? (parseFloat(costo_total) || 0) : actual.costo_total;
        const nuevoMonto = monto_a_cuenta !== undefined ? (parseFloat(monto_a_cuenta) || 0) : actual.monto_a_cuenta;
        campos.push('saldo_pendiente = ?');
        valores.push(nuevoCosto - nuevoMonto);
      }
    }

    if (campos.length === 0) {
      return res.json({ message: 'Sin cambios' });
    }

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
