const { clinicHeader, footer, field, nombreCompleto } = require('./constants');

function generatePagoDoc(pago, paciente) {
  return {
    pageSize: 'LETTER',
    pageMargins: [40, 60, 40, 60],
    header: clinicHeader,
    footer: footer,
    content: [
      { text: 'COMPROBANTE DE PAGO', style: 'title', alignment: 'center' },
      { canvas: [{ type: 'line', x1: 170, y1: 0, x2: 345, y2: 0, lineWidth: 1, lineColor: '#2563eb' }], margin: [0, 0, 0, 15] },

      { text: 'Datos del Paciente', style: 'sectionTitle' },
      {
        columns: [
          { width: '*', stack: [
            ...field('Paciente', nombreCompleto(paciente)),
            ...field('DNI', paciente.dni),
          ]},
          { width: '*', stack: [
            ...field('Fecha de Pago', new Date(pago.fecha).toLocaleDateString('es-ES')),
            ...field('Metodo', pago.metodo_pago || 'Efectivo'),
          ]},
        ],
      },

      { text: 'Detalle del Pago', style: 'sectionTitle' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto'],
          body: [
            [{ text: 'Concepto', style: 'tableHeader' }, { text: 'Monto', style: 'tableHeader' }],
            [{ text: pago.procedimiento || 'Pago general', style: 'tableCell' }, { text: `$${(pago.total || 0).toLocaleString()}`, style: 'tableCell', alignment: 'right' }],
          ],
        },
        layout: { hLineWidth: (i) => (i === 0 || i === 1) ? 1 : 0.5, vLineWidth: () => 0.5, hLineColor: () => '#cccccc', vLineColor: () => '#cccccc', fillColor: (i) => i === 0 ? '#2563eb' : null },
        margin: [0, 0, 0, 10],
      },

      { text: 'Resumen', style: 'sectionTitle' },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [{ text: 'Total', style: 'label', bold: true }, { text: `$${(pago.total || 0).toLocaleString()}`, style: 'value', alignment: 'right' }],
            [{ text: 'A Cuenta', style: 'label', bold: true }, { text: `$${(pago.a_cuenta || 0).toLocaleString()}`, style: 'value', alignment: 'right' }],
            [{ text: 'Saldo Pendiente', style: 'label', bold: true }, { text: `$${(pago.saldo || 0).toLocaleString()}`, style: 'value', alignment: 'right', color: (pago.saldo || 0) > 0 ? '#dc2626' : '#16a34a' }],
          ],
        },
        layout: { hLineWidth: (i) => i <= 1 ? 1 : 0.5, vLineWidth: () => 0.5, hLineColor: () => '#cccccc', vLineColor: () => '#cccccc' },
        margin: [0, 0, 0, 20],
      },

      ...(pago.notas ? [{ text: 'Observaciones', style: 'sectionTitle' }, { text: pago.notas, style: 'value', margin: [0, 0, 0, 20] }] : []),

      {
        columns: [
          { width: '*', text: '' },
          { width: '*', stack: [
            { text: '________________________', alignment: 'center', margin: [0, 30, 0, 3] },
            { text: 'Firma', alignment: 'center', style: 'small' },
          ]},
          { width: '*', text: '' },
        ],
      },
    ],
    styles: {
      header: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
      subheader: { fontSize: 10, alignment: 'center', color: '#666666', margin: [0, 0, 0, 15] },
      title: { fontSize: 14, bold: true, margin: [0, 15, 0, 8] },
      sectionTitle: { fontSize: 11, bold: true, color: '#2563eb', margin: [0, 12, 0, 6] },
      label: { fontSize: 9, bold: true, color: '#333333' },
      value: { fontSize: 10 },
      small: { fontSize: 8, color: '#666666' },
      tableHeader: { fontSize: 9, bold: true, color: '#ffffff', alignment: 'center' },
      tableCell: { fontSize: 9 },
    },
  };
}

module.exports = { generatePagoDoc };
