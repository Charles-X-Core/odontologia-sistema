const db = require('../db');

exports.stats = async (req, res) => {
  try {
    const totalPacientes = (await db.prepare('SELECT COUNT(*) as total FROM pacientes').get()).total;
    const totalConsultas = (await db.prepare('SELECT COUNT(*) as total FROM consultas').get()).total;
    const totalTratamientos = (await db.prepare('SELECT COUNT(*) as total FROM tratamientos').get()).total;
    const tratamientosRealizados = (await db.prepare("SELECT COUNT(*) as total FROM tratamientos WHERE estado = 'realizado'").get()).total;
    const tratamientosPlanificados = (await db.prepare("SELECT COUNT(*) as total FROM tratamientos WHERE estado = 'planificado'").get()).total;

    const resultadoPagos = await db.prepare(`
      SELECT
        COALESCE(SUM(total), 0) as total_general,
        COALESCE(SUM(a_cuenta), 0) as total_pagado,
        COALESCE(SUM(saldo), 0) as total_pendiente
      FROM pagos
    `).get();

    const ultimasConsultas = await db.prepare(`
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
    const ingresosMensuales = await db.prepare(`
      SELECT strftime('%Y-%m', fecha) as mes,
        COALESCE(SUM(a_cuenta), 0) as total
      FROM pagos
      WHERE fecha >= date('now', '-12 months')
      GROUP BY mes
      ORDER BY mes ASC
    `).all();

    // SALDOS PENDIENTES
    const saldosPendientes = await db.prepare(`
      SELECT p.id, p.apellido_paterno, p.apellido_materno, p.nombres, p.dni,
        SUM(pg.saldo) as pendiente
      FROM pagos pg
      JOIN pacientes p ON p.id = pg.paciente_id
      WHERE pg.saldo > 0
      GROUP BY p.id
      ORDER BY pendiente DESC
      LIMIT 8
    `).all();

    // PROXIMAS CITAS
    const hoy = new Date().toISOString().split('T')[0];
    const proximasCitas = await db.prepare(`
      SELECT c.id, c.fecha, c.hora, c.motivo, c.tipo, c.estado, c.duracion_minutos,
        (p.apellido_paterno || ' ' || p.apellido_materno || ' ' || p.nombres) as paciente_nombre,
        p.dni as paciente_dni
      FROM citas c
      JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.fecha >= ? AND c.estado IN ('pendiente', 'confirmada')
      ORDER BY c.fecha ASC, c.hora ASC
      LIMIT 8
    `).all(hoy);

    // CITAS DE HOY
    const totalCitasHoy = (await db.prepare(
      "SELECT COUNT(*) as total FROM citas WHERE fecha = ? AND estado IN ('pendiente', 'confirmada', 'completada')"
    ).get(hoy)).total;

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
      proximasCitas,
      totalCitasHoy,
    });
  } catch (err) {
    console.error('[Dashboard] stats error:', err.message);
    res.json({
      pacientes: 0, consultas: 0, tratamientos: 0,
      tratamientosRealizados: 0, tratamientosPlanificados: 0,
      pagos: { total_general: 0, total_pagado: 0, total_pendiente: 0 },
      ultimasConsultas: [], ingresosMensuales: [], saldosPendientes: [],
      proximasCitas: [], totalCitasHoy: 0,
    });
  }
};
