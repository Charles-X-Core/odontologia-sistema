function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

function generateTratamientosHtml(paciente, tratamientos, pagos) {
  const trats = Array.isArray(tratamientos) ? tratamientos : [];
  const pags = Array.isArray(pagos) ? pagos : [];

  const tratsHtml = trats.length > 0 ? trats.map(t => {
    const icon = t.estado === 'realizado' ? '✅' : '⏳';
    return `<tr>
      <td>${t.fecha ? new Date(t.fecha).toLocaleDateString('es-PE') : '-'}</td>
      <td>${t.pieza_dental || '-'}</td>
      <td>${icon} ${t.procedimiento_realizado}</td>
      <td>S/ ${(t.costo_total || 0).toFixed(2)}</td>
      <td>S/ ${(t.monto_a_cuenta || 0).toFixed(2)}</td>
      <td>S/ ${(t.saldo_pendiente || 0).toFixed(2)}</td>
      <td>${t.estado || 'planificado'}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" style="text-align:center">No hay tratamientos registrados</td></tr>';

  const totalCosto = trats.reduce((s, t) => s + (t.costo_total || 0), 0);
  const totalPagado = trats.reduce((s, t) => s + (t.monto_a_cuenta || 0), 0);
  const totalSaldo = trats.reduce((s, t) => s + (t.saldo_pendiente || 0), 0);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Plan de Tratamiento - ${nombreCompleto(paciente)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
    .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { color: #2563eb; font-size: 22px; }
    .header p { color: #666; font-size: 12px; }
    .section { margin-bottom: 20px; }
    .section h3 { color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .info-grid .label { font-weight: 600; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
    th { background: #f8fafc; color: #2563eb; font-weight: 600; }
    .total-box { background: #f0f7ff; border: 2px solid #2563eb; border-radius: 8px; padding: 15px; display: flex; justify-content: space-between; margin-top: 15px; }
    .total-box .monto { font-size: 18px; font-weight: 700; color: #2563eb; }
    .footer { text-align: center; margin-top: 40px; color: #999; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>PLAN DE TRATAMIENTO</h1>
    <p>Clinica Dental Pro - Clinica Odontologica</p>
  </div>

  <div class="section">
    <h3>Datos del Paciente</h3>
    <div class="info-grid">
      <div><span class="label">Nombre:</span> ${nombreCompleto(paciente)}</div>
      <div><span class="label">Telefono:</span> ${paciente.telefono || '-'}</div>
      <div><span class="label">Fecha:</span> ${new Date().toLocaleDateString('es-PE')}</div>
    </div>
  </div>

  <div class="section">
    <h3>Tratamientos</h3>
    <table>
      <thead>
        <tr><th>Fecha</th><th>Pza</th><th>Procedimiento</th><th>Costo</th><th>A Cuenta</th><th>Saldo</th><th>Estado</th></tr>
      </thead>
      <tbody>${tratsHtml}</tbody>
    </table>
    <div class="total-box">
      <div><span>Total: </span><span class="monto">S/ ${totalCosto.toFixed(2)}</span></div>
      <div><span>Pagado: </span><span class="monto">S/ ${totalPagado.toFixed(2)}</span></div>
      <div><span>Saldo: </span><span class="monto" style="color:${totalSaldo > 0 ? '#dc2626' : '#16a34a'}">S/ ${totalSaldo.toFixed(2)}</span></div>
    </div>
  </div>

  <div class="footer">Clinica Dental Pro - Clinica Odontologica | Plan de tratamiento generado electronicamente</div>
</body>
</html>`;
}

module.exports = { generateTratamientosHtml };
