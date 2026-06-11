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

  // ============================================
  // INGRESOS MENSUALES (últimos 12 meses)
  // ============================================
  const ingresosMensuales = db.prepare(`
    SELECT strftime('%Y-%m', fecha_pago) as mes,
      COALESCE(SUM(a_cuenta), 0) as total
    FROM pagos
    WHERE fecha_pago >= date('now', '-12 months')
    GROUP BY mes
    ORDER BY mes ASC
  `).all();

  // ============================================
  // SALDOS PENDIENTES (pacientes con deuda)
  // ============================================
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

  // ============================================
  // MÉTODOS DE PAGO
  // ============================================
  const metodosPago = db.prepare(`
    SELECT COALESCE(metodo_pago, 'Efectivo') as metodo,
      COUNT(*) as cantidad,
      COALESCE(SUM(a_cuenta), 0) as total
    FROM pagos
    GROUP BY metodo
    ORDER BY total DESC
  `).all();

  // ============================================
  // PACIENTES NUEVOS POR MES (últimos 6 meses)
  // ============================================
  const pacientesNuevos = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as mes,
      COUNT(*) as total
    FROM pacientes
    WHERE created_at >= date('now', '-6 months')
    GROUP BY mes
    ORDER BY mes ASC
  `).all();

  // ============================================
  // TOP DIAGNÓSTICOS (parsear JSON de consultas)
  // ============================================
  const consultasDiag = db.prepare('SELECT diagnostico_lista FROM consultas WHERE diagnostico_lista IS NOT NULL').all();
  const diagCount = {};
  consultasDiag.forEach(c => {
    try {
      const lista = JSON.parse(c.diagnostico_lista);
      lista.forEach(d => {
        const txt = (d.texto || '').trim();
        if (txt) diagCount[txt] = (diagCount[txt] || 0) + 1;
      });
    } catch {}
  });
  const topDiagnosticos = Object.entries(diagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([texto, total]) => ({ texto, total }));

  // ============================================
  // DISTRIBUCIÓN POR EDAD
  // ============================================
  const distribucionEdad = [
    { rango: '0-17', total: 0 },
    { rango: '18-30', total: 0 },
    { rango: '31-50', total: 0 },
    { rango: '51+', total: 0 },
  ];
  const pacientesEdad = db.prepare('SELECT fecha_nacimiento FROM pacientes WHERE fecha_nacimiento IS NOT NULL').all();
  const hoy = new Date();
  pacientesEdad.forEach(p => {
    const nac = new Date(p.fecha_nacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
    if (edad < 18) distribucionEdad[0].total++;
    else if (edad <= 30) distribucionEdad[1].total++;
    else if (edad <= 50) distribucionEdad[2].total++;
    else distribucionEdad[3].total++;
  });

  // ============================================
  // PACIENTES POR SEXO
  // ============================================
  const porSexo = db.prepare(`
    SELECT COALESCE(sexo, 'N/D') as sexo, COUNT(*) as total
    FROM pacientes
    GROUP BY sexo
  `).all();

  // ============================================
  // SALUD BUCAL (necesidades odontológicas agregadas)
  // ============================================
  const saludBucal = db.prepare(`
    SELECT
      COALESCE(SUM(cariados), 0) as cariados,
      COALESCE(SUM(curados), 0) as curados,
      COALESCE(SUM(por_extraer), 0) as por_extraer,
      COALESCE(SUM(extraidos), 0) as extraidos,
      COALESCE(SUM(endodoncia), 0) as endodoncia,
      COALESCE(SUM(ortodoncia), 0) as ortodoncia,
      COALESCE(SUM(protesis), 0) as protesis,
      COALESCE(SUM(destartraje), 0) as destartraje
    FROM necesidades_odontologicas
  `).get();

  // ============================================
  // WHATSAPP STATS
  // ============================================
  const whatsappStats = { total: 0, enviados: 0, fallidos: 0 };
  try {
    const wa = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN delivery_status = 'sent' THEN 1 ELSE 0 END) as enviados,
        SUM(CASE WHEN delivery_status = 'failed' THEN 1 ELSE 0 END) as fallidos
      FROM whatsapp_log
    `).get();
    whatsappStats.total = wa.total || 0;
    whatsappStats.enviados = wa.enviados || 0;
    whatsappStats.fallidos = wa.fallidos || 0;
  } catch {}

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
    ingresosMensuales,
    saldosPendientes,
    metodosPago,
    pacientesNuevos,
    topDiagnosticos,
    distribucionEdad,
    porSexo,
    saludBucal,
    whatsappStats,
  });
};
