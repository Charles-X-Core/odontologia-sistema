const db = require('../database');

exports.stats = (req, res) => {
  try {
    const totalPacientes = db.prepare('SELECT COUNT(*) as total FROM pacientes').get().total;
    const totalConsultas = db.prepare('SELECT COUNT(*) as total FROM consultas').get().total;
    const totalTratamientos = db.prepare('SELECT COUNT(*) as total FROM tratamientos').get().total;
    const tratamientosRealizados = db.prepare("SELECT COUNT(*) as total FROM tratamientos WHERE estado = 'realizado'").get().total;
    const tratamientosPlanificados = db.prepare("SELECT COUNT(*) as total FROM tratamientos WHERE estado = 'planificado'").get().total;

    const resultadoPagos = db.prepare(`
      SELECT
        COALESCE(SUM(total), 0) as total_general,
        COALESCE(SUM(a_cuenta), 0) as total_pagado,
        COALESCE(SUM(saldo), 0) as total_pendiente
      FROM pagos
    `).get();

    const ultimasConsultas = db.prepare(`
      SELECT c.*,
        (p.apellido_paterno || ' ' || p.apellido_materno || ' ' || p.nombres) as paciente_nombre
      FROM consultas c
      JOIN historias_clinicas h ON h.id = c.historia_id
      JOIN pacientes p ON p.id = h.paciente_id
      ORDER BY c.fecha DESC
      LIMIT 10
    `).all();

    ultimasConsultas.forEach(c => {
      if (c.diagnostico_lista) {
        try {
          const lista = JSON.parse(c.diagnostico_lista);
          c.diagnostico = lista.map(d => d.texto).join('; ');
        } catch { c.diagnostico = ''; }
      }
    });

    // INGRESOS MENSUALES (últimos 12 meses)
    const ingresosMensuales = db.prepare(`
      SELECT strftime('%Y-%m', fecha) as mes,
        COALESCE(SUM(a_cuenta), 0) as total
      FROM pagos
      WHERE fecha >= date('now', '-12 months')
      GROUP BY mes
      ORDER BY mes ASC
    `).all();

    // SALDOS PENDIENTES
    const saldosPendientes = db.prepare(`
      SELECT p.id, p.apellido_paterno, p.apellido_materno, p.nombres, p.dni,
        SUM(pg.saldo) as pendiente
      FROM pagos pg
      JOIN pacientes p ON p.id = pg.paciente_id
      WHERE pg.saldo > 0
      GROUP BY p.id
      ORDER BY pendiente DESC
      LIMIT 8
    `).all();

    res.json({
      pacientes: totalPacientes,
      consultas: totalConsultas,
      tratamientos: totalTratamientos,
      tratamientosRealizados,
      tratamientosPlanificados,
      pagos: resultadoPagos,
      ultimasConsultas,
      ingresosMensuales,
      saldosPendientes,
    });
  } catch (err) {
    console.error('[Dashboard] stats error:', err.message);
    res.json({
      pacientes: 0, consultas: 0, tratamientos: 0,
      tratamientosRealizados: 0, tratamientosPlanificados: 0,
      pagos: { total_general: 0, total_pagado: 0, total_pendiente: 0 },
      ultimasConsultas: [], ingresosMensuales: [], saldosPendientes: [],
    });
  }
};
