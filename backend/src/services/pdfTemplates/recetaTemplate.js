const { clinicHeader, footer, field, nombreCompleto } = require('./constants');

function generateRecetaDoc(receta, paciente, doctor) {
  const meds = typeof receta.medicamentos === 'string' ? JSON.parse(receta.medicamentos) : receta.medicamentos;

  return {
    pageSize: 'LETTER',
    pageMargins: [40, 60, 40, 60],
    header: clinicHeader,
    footer: footer,
    content: [
      { text: 'RECETA MEDICA', style: 'title', alignment: 'center' },
      { canvas: [{ type: 'line', x1: 180, y1: 0, x2: 335, y2: 0, lineWidth: 1, lineColor: '#2563eb' }], margin: [0, 0, 0, 15] },

      { text: 'Datos del Paciente', style: 'sectionTitle' },
      {
        columns: [
          { width: '*', stack: [
            ...field('Paciente', nombreCompleto(paciente)),
            ...field('DNI', paciente.dni),
          ]},
          { width: '*', stack: [
            ...field('Fecha', new Date(receta.created_at || Date.now()).toLocaleDateString('es-ES')),
            ...field('Telefono', paciente.telefono),
          ]},
        ],
      },

      { text: 'Medicamentos', style: 'sectionTitle' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Medicamento', style: 'tableHeader' },
              { text: 'Dosis', style: 'tableHeader' },
              { text: 'Frecuencia', style: 'tableHeader' },
              { text: 'Duracion', style: 'tableHeader' },
            ],
            ...meds.map(m => [
              { text: m.nombre || '', style: 'tableCell' },
              { text: m.dosis || '', style: 'tableCell' },
              { text: m.frecuencia || '', style: 'tableCell' },
              { text: m.duracion || '', style: 'tableCell' },
            ]),
          ],
        },
        layout: {
          hLineWidth: (i) => (i === 0 || i === 1) ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#cccccc',
          vLineColor: () => '#cccccc',
          fillColor: (rowIndex) => (rowIndex === 0) ? '#2563eb' : (rowIndex % 2 === 0 ? '#f0f4ff' : null),
        },
        margin: [0, 0, 0, 10],
      },

      { text: 'Indicaciones', style: 'sectionTitle' },
      { text: receta.indicaciones || 'Sin indicaciones especificas', style: 'value', margin: [0, 0, 0, 20] },

      {
        columns: [
          { width: '*', text: '' },
          { width: '*', stack: [
            ...(doctor?.firma_imagen ? [{ image: doctor.firma_imagen, width: 120, alignment: 'center', margin: [0, 10, 0, 5] }] : []),
            { text: '________________________', alignment: 'center', margin: [0, 10, 0, 3] },
            { text: doctor?.nombre || 'Doctor', alignment: 'center', style: 'label' },
            { text: doctor?.titulo || 'Odontologo', alignment: 'center', style: 'small' },
            ...(doctor?.cmp ? [{ text: `C.M.P.: ${doctor.cmp}`, alignment: 'center', style: 'small' }] : []),
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

module.exports = { generateRecetaDoc };
