const db = require('../database');

exports.stats = (req, res) => {
  const totalPacientes = db.prepare('SELECT COUNT(*) as total FROM pacientes').get().total;
  const totalConsultas = db.prepare('SELECT COUNT(*) as total FROM consultas').get().total;
  const totalTratamientos = db.prepare('SELECT COUNT(*) as total FROM tratamientos').get().total;
  const tratamientosRealizados = db.prepare("SELECT COUNT(*) as total FROM tratamientos WHERE estado = 'realizado'").get().total;
  const tratamientosPlanificados = db.prepare("SELECT COUNT(*) as total FROM tratamientos WHERE estado = 'planificado'").get().total;
  const totalRecetas = db.prepare('SELECT COUNT(*) as total FROM recetas').get().total;

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

  const consultasPorDia = db.prepare(`
    SELECT
      CASE CAST(strftime('%w', c.fecha) AS INTEGER)
        WHEN 0 THEN 'Dom'
        WHEN 1 THEN 'Lun'
        WHEN 2 THEN 'Mar'
        WHEN 3 THEN 'Mie'
        WHEN 4 THEN 'Jue'
        WHEN 5 THEN 'Vie'
        WHEN 6 THEN 'Sab'
      END as dia,
      strftime('%w', c.fecha) as dia_num,
      COUNT(*) as total
    FROM consultas c
    GROUP BY dia_num
    ORDER BY dia_num
  `).all();

  res.json({
    pacientes: totalPacientes,
    consultas: totalConsultas,
    tratamientos: totalTratamientos,
    tratamientosRealizados,
    tratamientosPlanificados,
    recetas: totalRecetas,
    pagos: resultadoPagos,
    ultimasConsultas,
    consultasPorDia,
  });
};
