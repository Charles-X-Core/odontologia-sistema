const db = require('../database');
const PDFDocument = require('pdfkit');

function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

function addHeader(doc) {
  doc.fontSize(20).font('Helvetica-Bold').text('Vita Mirabilis', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text('Clinica Odontologica', { align: 'center' });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(565, doc.y).strokeColor('#2563eb').lineWidth(1).stroke();
  doc.moveDown(0.8);
}

function addFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).font('Helvetica').fillColor('#666666')
      .text(`Pagina ${i - range.start + 1} de ${range.count}`, 50, doc.page.height - 40, { align: 'right', width: 515 });
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 50, doc.page.height - 40, { width: 200 });
  }
}

function drawTable(doc, headers, rows, startX, startY, colWidths) {
  let y = startY;
  const rowHeight = 20;

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#2563eb');
  let x = startX;
  headers.forEach((h, i) => {
    doc.fillColor('#ffffff').text(h, x + 4, y + 5, { width: colWidths[i] - 8 });
    x += colWidths[i];
  });
  y += rowHeight;

  rows.forEach((row, ri) => {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }
    const bg = ri % 2 === 0 ? '#f0f4ff' : '#ffffff';
    doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill(bg).fillColor('#000000');
    doc.font('Helvetica').fontSize(8);
    x = startX;
    row.forEach((cell, ci) => {
      doc.text(String(cell || '-'), x + 4, y + 5, { width: colWidths[ci] - 8 });
      x += colWidths[ci];
    });
    y += rowHeight;
  });

  return y;
}

exports.receta = (req, res) => {
  try {
    const receta = db.prepare(`
      SELECT r.*, p.apellido_paterno, p.apellido_materno, p.nombres, p.dni, p.telefono,
             u.nombre as doctor_nombre, u.titulo as doctor_titulo, u.cmp as doctor_cmp, u.firma_imagen as doctor_firma
      FROM recetas r
      JOIN pacientes p ON p.id = r.paciente_id
      LEFT JOIN usuarios u ON u.id = ?
      WHERE r.id = ?
    `).get(req.usuario.id, req.params.id);
    if (!receta) return res.status(404).json({ error: 'Receta no encontrada' });

    const meds = typeof receta.medicamentos === 'string' ? JSON.parse(receta.medicamentos) : receta.medicamentos;
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=receta-${receta.id}.pdf`);
    doc.pipe(res);

    addHeader(doc);
    doc.fontSize(14).font('Helvetica-Bold').text('RECETA MEDICA', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica-Bold').text('Paciente: ').font('Helvetica').text(nombreCompleto(receta));
    doc.font('Helvetica-Bold').text('DNI: ').font('Helvetica').text(receta.dni || '-');
    doc.font('Helvetica-Bold').text('Fecha: ').font('Helvetica').text(new Date(receta.created_at || Date.now()).toLocaleDateString('es-ES'));
    doc.moveDown(1);

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2563eb').text('Medicamentos');
    doc.fillColor('#000000').moveDown(0.3);

    const y = doc.y;
    const tableY = drawTable(doc,
      ['Medicamento', 'Dosis', 'Frecuencia', 'Duracion'],
      meds.map(m => [m.nombre, m.dosis, m.frecuencia, m.duracion]),
      50, y, [180, 100, 130, 105]
    );
    doc.y = tableY + 10;

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2563eb').text('Indicaciones');
    doc.fillColor('#000000').font('Helvetica').fontSize(10).text(receta.indicaciones || 'Sin indicaciones');
    doc.moveDown(2);

    doc.font('Helvetica').fontSize(10).text('________________________', { align: 'center' });
    if (receta.doctor_firma) {
      try {
        const imgData = receta.doctor_firma.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(imgData, 'base64');
        doc.image(imgBuffer, { width: 120, align: 'center' });
        doc.moveDown(0.5);
      } catch {}
    }
    doc.font('Helvetica-Bold').text(receta.doctor_nombre || 'Doctor', { align: 'center' });
    doc.font('Helvetica').fontSize(8).text(receta.doctor_titulo || 'Odontologo', { align: 'center' });
    if (receta.doctor_cmp) {
      doc.font('Helvetica').fontSize(8).text(`C.M.P.: ${receta.doctor_cmp}`, { align: 'center' });
    }

    addFooter(doc);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.historia = (req, res) => {
  try {
    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const historia = db.prepare('SELECT * FROM historias_clinicas WHERE paciente_id = ?').get(paciente.id);
    const consultas = historia ? db.prepare(`
      SELECT c.* FROM consultas c WHERE c.historia_id = ? ORDER BY c.fecha DESC
    `).all(historia.id) : [];
    const pagos = db.prepare('SELECT * FROM pagos WHERE paciente_id = ? ORDER BY fecha DESC').all(paciente.id);

    const { generateHistoriaHtml } = require('../services/pdfTemplates/historiaHtmlPdf');
    const html = generateHistoriaHtml(paciente, historia, consultas, pagos, req.usuario.id);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error generando historia:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.historiaConsulta = (req, res) => {
  try {
    const { pacienteId, consultaId } = req.params;
    const { generateHistoriaConsultaHtml } = require('../services/pdfTemplates/historiaHtmlPdf');
    const html = generateHistoriaConsultaHtml(parseInt(pacienteId), parseInt(consultaId), req.usuario.id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error generando historia por consulta:', err.message);
    res.status(500).json({ error: err.message });
  }
};
exports.pago = (req, res) => {
  try {
    const pago = db.prepare('SELECT * FROM pagos WHERE id = ?').get(req.params.id);
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });

    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(pago.paciente_id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const doctor = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=pago-${pago.id}.pdf`);
    doc.pipe(res);

    addHeader(doc);
    doc.fontSize(14).font('Helvetica-Bold').text('COMPROBANTE DE PAGO', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica-Bold').text('Paciente: ').font('Helvetica').text(nombreCompleto(paciente));
    doc.font('Helvetica-Bold').text('DNI: ').font('Helvetica').text(paciente.dni || '-');
    doc.font('Helvetica-Bold').text('Fecha Pago: ').font('Helvetica').text(new Date(pago.fecha).toLocaleDateString('es-ES'));
    doc.font('Helvetica-Bold').text('Metodo: ').font('Helvetica').text(pago.metodo_pago || 'Efectivo');
    doc.moveDown(1);

    const tableY = drawTable(doc,
      ['Concepto', 'Monto'],
      [[pago.procedimiento || 'Pago general', `$${(pago.total || 0).toLocaleString()}`]],
      50, doc.y, [350, 165]
    );
    doc.y = tableY + 10;

    doc.font('Helvetica-Bold').text('Total: ').font('Helvetica').text(`$${(pago.total || 0).toLocaleString()}`);
    doc.font('Helvetica-Bold').text('A Cuenta: ').font('Helvetica').text(`$${(pago.a_cuenta || 0).toLocaleString()}`);
    doc.font('Helvetica-Bold').text('Saldo Pendiente: ').font('Helvetica').text(`$${(pago.saldo || 0).toLocaleString()}`);
    doc.moveDown(2);

    if (doctor?.firma_imagen) {
      try {
        const imgData = doctor.firma_imagen.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(imgData, 'base64');
        doc.image(imgBuffer, { width: 120, align: 'center' });
        doc.moveDown(0.5);
      } catch {}
    }
    doc.font('Helvetica').fontSize(10).text('________________________', { align: 'center' });
    doc.font('Helvetica-Bold').text(doctor?.nombre || 'Doctor', { align: 'center' });
    doc.font('Helvetica').fontSize(8).text(doctor?.titulo || 'Odontologo', { align: 'center' });
    if (doctor?.cmp) {
      doc.font('Helvetica').fontSize(8).text(`C.M.P.: ${doctor.cmp}`, { align: 'center' });
    }

    addFooter(doc);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.tratamientos = (req, res) => {
  try {
    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const doctor = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);

    const tratamientos = db.prepare(`
      SELECT t.*, c.fecha as consulta_fecha, c.motivo as consulta_motivo, c.hora as consulta_hora
      FROM tratamientos t
      LEFT JOIN consultas c ON c.id = t.consulta_id
      WHERE t.paciente_id = ?
      ORDER BY t.created_at DESC
    `).all(paciente.id);

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=tratamientos-${paciente.id}.pdf`);
    doc.pipe(res);

    addHeader(doc);
    doc.fontSize(14).font('Helvetica-Bold').text('PLAN DE TRATAMIENTO', { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica-Bold').text('Paciente: ').font('Helvetica').text(nombreCompleto(paciente));
    doc.font('Helvetica-Bold').text('DNI: ').font('Helvetica').text(paciente.dni || '-');
    doc.moveDown(0.8);

    const colWidths = [60, 35, 185, 65, 65, 65];
    let grandTotalCosto = 0;
    let grandTotalPagado = 0;

    const porConsulta = {};
    const sinConsulta = [];
    for (const t of tratamientos) {
      if (t.consulta_id) {
        if (!porConsulta[t.consulta_id]) {
          porConsulta[t.consulta_id] = {
            fecha: t.consulta_fecha,
            hora: t.consulta_hora,
            motivo: t.consulta_motivo,
            items: []
          };
        }
        porConsulta[t.consulta_id].items.push(t);
      } else {
        sinConsulta.push(t);
      }
    }

    for (const [consId, grupo] of Object.entries(porConsulta)) {
      if (doc.y > doc.page.height - 120) { doc.addPage(); doc.y = 50; }

      const fechaStr = grupo.fecha ? new Date(grupo.fecha).toLocaleDateString('es-ES') : '-';
      const horaStr = grupo.hora || '';
      doc.fontSize(10).font('Helvetica-Bold')
        .fillColor('#2563eb')
        .text(`Consulta: ${fechaStr}${horaStr ? ' ' + horaStr : ''}`, 50);
      if (grupo.motivo) {
        doc.fontSize(9).font('Helvetica').fillColor('#555555')
          .text(`Motivo: ${grupo.motivo}`, 50);
      }
      doc.moveDown(0.3);

      const rows = grupo.items.map(t => [
        t.fecha ? new Date(t.fecha).toLocaleDateString('es-ES') : '-',
        t.pieza_dental || '-',
        t.procedimiento_realizado || '-',
        `$${(t.costo_total || 0).toLocaleString()}`,
        `$${(t.monto_a_cuenta || 0).toLocaleString()}`,
        `$${(t.saldo_pendiente || 0).toLocaleString()}`
      ]);

      const tableY = drawTable(doc, ['Fecha', 'Pza', 'Procedimiento', 'Costo', 'Pagado', 'Saldo'], rows, 50, doc.y, colWidths);

      const subCosto = grupo.items.reduce((s, t) => s + (t.costo_total || 0), 0);
      const subPagado = grupo.items.reduce((s, t) => s + (t.monto_a_cuenta || 0), 0);
      grandTotalCosto += subCosto;
      grandTotalPagado += subPagado;

      doc.y = tableY + 4;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333')
        .text(`Subtotal: $${subCosto.toLocaleString()}  |  Pagado: $${subPagado.toLocaleString()}  |  Saldo: $${(subCosto - subPagado).toLocaleString()}`, 50);
      doc.moveDown(1);
      doc.fillColor('#000000');
    }

    if (sinConsulta.length > 0) {
      if (doc.y > doc.page.height - 120) { doc.addPage(); doc.y = 50; }

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2563eb')
        .text('Sin consulta vinculada', 50);
      doc.moveDown(0.3);

      const rows = sinConsulta.map(t => [
        t.fecha ? new Date(t.fecha).toLocaleDateString('es-ES') : '-',
        t.pieza_dental || '-',
        t.procedimiento_realizado || '-',
        `$${(t.costo_total || 0).toLocaleString()}`,
        `$${(t.monto_a_cuenta || 0).toLocaleString()}`,
        `$${(t.saldo_pendiente || 0).toLocaleString()}`
      ]);

      const tableY = drawTable(doc, ['Fecha', 'Pza', 'Procedimiento', 'Costo', 'Pagado', 'Saldo'], rows, 50, doc.y, colWidths);

      const subCosto = sinConsulta.reduce((s, t) => s + (t.costo_total || 0), 0);
      const subPagado = sinConsulta.reduce((s, t) => s + (t.monto_a_cuenta || 0), 0);
      grandTotalCosto += subCosto;
      grandTotalPagado += subPagado;

      doc.y = tableY + 4;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333')
        .text(`Subtotal: $${subCosto.toLocaleString()}  |  Pagado: $${subPagado.toLocaleString()}  |  Saldo: $${(subCosto - subPagado).toLocaleString()}`, 50);
      doc.moveDown(1);
      doc.fillColor('#000000');
    }

    doc.moveTo(50, doc.y).lineTo(565, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Bold')
      .text(`TOTAL: $${grandTotalCosto.toLocaleString()}  |  PAGADO: $${grandTotalPagado.toLocaleString()}  |  SALDO: $${(grandTotalCosto - grandTotalPagado).toLocaleString()}`);
    doc.moveDown(2);

    if (doctor?.firma_imagen) {
      try {
        const imgData = doctor.firma_imagen.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(imgData, 'base64');
        doc.image(imgBuffer, { width: 120, align: 'center' });
        doc.moveDown(0.5);
      } catch {}
    }
    doc.font('Helvetica').fontSize(10).text('________________________', { align: 'center' });
    doc.font('Helvetica-Bold').text(doctor?.nombre || 'Doctor', { align: 'center' });
    doc.font('Helvetica').fontSize(8).text(doctor?.titulo || 'Odontologo', { align: 'center' });
    if (doctor?.cmp) {
      doc.font('Helvetica').fontSize(8).text(`C.M.P.: ${doctor.cmp}`, { align: 'center' });
    }

    addFooter(doc);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
