const db = require('../database');

exports.crear = (req, res) => {
  const { paciente_id, tratamiento_id, consulta_id, fecha, procedimiento, total, a_cuenta, metodo_pago, notas } = req.body;

  if (!paciente_id || !fecha) {
    return res.status(400).json({ error: 'paciente_id y fecha son obligatorios' });
  }
  if (!consulta_id) {
    return res.status(400).json({ error: 'consulta_id es obligatorio - todo pago debe vincularse a una consulta' });
  }

  const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(paciente_id);
  if (!paciente) {
    return res.status(404).json({ error: 'Paciente no encontrado' });
  }

  const totalNum = parseFloat(total) || 0;
  const aCuentaNum = parseFloat(a_cuenta) || 0;
  const saldo = totalNum - aCuentaNum;

  try {
    const stmt = db.prepare(`
      INSERT INTO pagos (paciente_id, tratamiento_id, consulta_id, fecha, procedimiento, total, a_cuenta, saldo, metodo_pago, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      paciente_id, tratamiento_id || null, consulta_id || null,
      fecha, procedimiento || '', totalNum, aCuentaNum, saldo,
      metodo_pago || 'efectivo', notas || ''
    );
    res.status(201).json({ id: result.lastInsertRowid, paciente_id, saldo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listarPorPaciente = (req, res) => {
  const pagos = db.prepare(`
    SELECT p.*, t.procedimiento_realizado as tratamiento_descripcion
    FROM pagos p
    LEFT JOIN tratamientos t ON t.id = p.tratamiento_id
    WHERE p.paciente_id = ?
    ORDER BY p.fecha DESC
  `).all(req.params.pacienteId);
  res.json(pagos);
};

exports.obtenerPorId = (req, res) => {
  const pago = db.prepare('SELECT * FROM pagos WHERE id = ?').get(req.params.id);
  if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
  res.json(pago);
};

exports.actualizar = (req, res) => {
  const { fecha, procedimiento, total, a_cuenta, metodo_pago, notas } = req.body;
  const totalNum = parseFloat(total) || 0;
  const aCuentaNum = parseFloat(a_cuenta) || 0;
  const saldo = totalNum - aCuentaNum;

  try {
    db.prepare(`
      UPDATE pagos SET fecha = ?, procedimiento = ?, total = ?, a_cuenta = ?, saldo = ?, metodo_pago = ?, notas = ?
      WHERE id = ?
    `).run(fecha, procedimiento || '', totalNum, aCuentaNum, saldo, metodo_pago || 'efectivo', notas || '', req.params.id);
    res.json({ message: 'Pago actualizado', saldo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.eliminar = (req, res) => {
  try {
    db.prepare('DELETE FROM pagos WHERE id = ?').run(req.params.id);
    res.json({ message: 'Pago eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resumenPorPaciente = (req, res) => {
  const resultado = db.prepare(`
    SELECT
      COALESCE(SUM(total), 0) as total_general,
      COALESCE(SUM(a_cuenta), 0) as total_pagado,
      COALESCE(SUM(saldo), 0) as total_pendiente
    FROM pagos WHERE paciente_id = ?
  `).get(req.params.pacienteId);
  res.json(resultado);
};
