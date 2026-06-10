const db = require('../database');

exports.crear = (req, res) => {
  const { paciente_id, tratamiento_id, consulta_id, fecha, procedimiento, total, a_cuenta, metodo_pago, notas } = req.body;

  if (!paciente_id || !fecha) {
    return res.status(400).json({ error: 'paciente_id y fecha son obligatorios' });
  }

  const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(paciente_id);
  if (!paciente) {
    return res.status(404).json({ error: 'Paciente no encontrado' });
  }

  if (tratamiento_id) {
    const trat = db.prepare('SELECT id, saldo_pendiente FROM tratamientos WHERE id = ? AND paciente_id = ?').get(tratamiento_id, paciente_id);
    if (!trat) {
      return res.status(404).json({ error: 'Tratamiento no encontrado para este paciente' });
    }
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

    if (tratamiento_id && aCuentaNum > 0) {
      db.prepare('UPDATE tratamientos SET monto_a_cuenta = monto_a_cuenta + ?, saldo_pendiente = saldo_pendiente - ? WHERE id = ?')
        .run(aCuentaNum, aCuentaNum, tratamiento_id);
    }

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

  try {
    const pagoActual = db.prepare('SELECT * FROM pagos WHERE id = ?').get(req.params.id);
    if (!pagoActual) return res.status(404).json({ error: 'Pago no encontrado' });

    const totalNum = parseFloat(total) || 0;
    const aCuentaNum = parseFloat(a_cuenta) || 0;
    const saldo = totalNum - aCuentaNum;

    db.prepare(`
      UPDATE pagos SET fecha = ?, procedimiento = ?, total = ?, a_cuenta = ?, saldo = ?, metodo_pago = ?, notas = ?
      WHERE id = ?
    `).run(fecha, procedimiento || '', totalNum, aCuentaNum, saldo, metodo_pago || 'efectivo', notas || '', req.params.id);

    if (pagoActual.tratamiento_id) {
      const diff = aCuentaNum - (pagoActual.a_cuenta || 0);
      if (diff !== 0) {
        db.prepare('UPDATE tratamientos SET monto_a_cuenta = monto_a_cuenta + ?, saldo_pendiente = saldo_pendiente - ? WHERE id = ?')
          .run(diff, diff, pagoActual.tratamiento_id);
      }
    }

    res.json({ message: 'Pago actualizado', saldo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.eliminar = (req, res) => {
  try {
    const pago = db.prepare('SELECT * FROM pagos WHERE id = ?').get(req.params.id);
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });

    if (pago.tratamiento_id && pago.a_cuenta > 0) {
      db.prepare('UPDATE tratamientos SET monto_a_cuenta = monto_a_cuenta - ?, saldo_pendiente = saldo_pendiente + ? WHERE id = ?')
        .run(pago.a_cuenta, pago.a_cuenta, pago.tratamiento_id);
    }

    db.prepare('DELETE FROM pagos WHERE id = ?').run(req.params.id);
    res.json({ message: 'Pago eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resumenPorPaciente = (req, res) => {
  const pacienteId = req.params.pacienteId;

  const tratamientos = db.prepare(`
    SELECT
      COALESCE(SUM(costo_total), 0) as total_tratamientos,
      COALESCE(SUM(monto_a_cuenta), 0) as pagado_tratamientos,
      COALESCE(SUM(saldo_pendiente), 0) as saldo_tratamientos,
      COUNT(*) as cantidad_tratamientos
    FROM tratamientos WHERE paciente_id = ?
  `).get(pacienteId);

  const pagos = db.prepare(`
    SELECT
      COALESCE(SUM(total), 0) as total_pagos,
      COALESCE(SUM(a_cuenta), 0) as pagado_pagos,
      COALESCE(SUM(saldo), 0) as saldo_pagos,
      COUNT(*) as cantidad_pagos
    FROM pagos WHERE paciente_id = ?
  `).get(pacienteId);

  res.json({
    total_general: pagos.total_pagos,
    total_pagado: pagos.pagado_pagos,
    total_pendiente: pagos.saldo_pagos,
    total_tratamientos: tratamientos.total_tratamientos,
    pagado_tratamientos: tratamientos.pagado_tratamientos,
    saldo_tratamientos: tratamientos.saldo_tratamientos,
    cantidad_tratamientos: tratamientos.cantidad_tratamientos,
    cantidad_pagos: pagos.cantidad_pagos,
  });
};
