function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

function generateRecetaHtml(paciente, receta) {
  const meds = typeof receta.medicamentos === 'string' ? JSON.parse(receta.medicamentos) : receta.medicamentos;
  const medsHtml = meds.map(m => `
    <tr>
      <td style="font-weight:600">${m.nombre}</td>
      <td>${m.dosis || '-'}</td>
      <td>${m.frecuencia || '-'}</td>
      <td>${m.duracion || '-'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Receta Medica - ${nombreCompleto(paciente)}</title>
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
    .indicaciones { background: #f0f7ff; padding: 12px; border-radius: 6px; border-left: 3px solid #2563eb; margin-top: 15px; }
    .footer { text-align: center; margin-top: 40px; color: #999; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RECETA MEDICA</h1>
    <p>Vita Mirabilis - Clinica Odontologica</p>
  </div>

  <div class="section">
    <h3>Datos del Paciente</h3>
    <div class="info-grid">
      <div><span class="label">Nombre:</span> ${nombreCompleto(paciente)}</div>
      <div><span class="label">Telefono:</span> ${paciente.telefono || '-'}</div>
      <div><span class="label">Fecha:</span> ${new Date(receta.created_at || Date.now()).toLocaleDateString('es-PE')}</div>
      <div><span class="label">Edad:</span> ${paciente.edad || '-'}</div>
    </div>
  </div>

  <div class="section">
    <h3>Medicamentos</h3>
    <table>
      <thead>
        <tr><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Duracion</th></tr>
      </thead>
      <tbody>${medsHtml}</tbody>
    </table>
  </div>

  ${receta.indicaciones ? `<div class="indicaciones"><strong>Indicaciones:</strong> ${receta.indicaciones}</div>` : ''}

  <div class="footer">Vita Mirabilis - Clinica Odontologica | Receta generada electronicamente</div>
</body>
</html>`;
}

module.exports = { generateRecetaHtml };
