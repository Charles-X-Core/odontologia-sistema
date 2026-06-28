function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

function generatePagoHtml(paciente, pago) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Comprobante de Pago - ${nombreCompleto(paciente)}</title>
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
    .monto-box { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .monto-box .monto { font-size: 32px; font-weight: 700; color: #16a34a; }
    .monto-box .label { font-size: 14px; color: #666; }
    .footer { text-align: center; margin-top: 40px; color: #999; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>COMPROBANTE DE PAGO</h1>
    <p>Clinica Dental Pro - Clinica Odontologica</p>
  </div>

  <div class="section">
    <h3>Datos del Paciente</h3>
    <div class="info-grid">
      <div><span class="label">Nombre:</span> ${nombreCompleto(paciente)}</div>
      <div><span class="label">Telefono:</span> ${paciente.telefono || '-'}</div>
      <div><span class="label">Fecha de Pago:</span> ${new Date(pago.fecha || pago.created_at || Date.now()).toLocaleDateString('es-PE')}</div>
      <div><span class="label">Metodo:</span> ${pago.metodo_pago || 'Efectivo'}</div>
    </div>
  </div>

  <div class="monto-box">
    <div class="label">Monto Pagado</div>
    <div class="monto">S/ ${parseFloat(pago.monto || 0).toFixed(2)}</div>
  </div>

  ${pago.concepto ? `<div class="section"><h3>Concepto</h3><p>${pago.concepto}</p></div>` : ''}

  <div class="footer">Clinica Dental Pro - Clinica Odontologica | Comprobante generado electronicamente</div>
</body>
</html>`;
}

module.exports = { generatePagoHtml };
