const path = require('path');

const FONTS = {
  Roboto: {
    normal: path.join(__dirname, '..', '..', 'node_modules', 'pdfmake', 'build', 'vfs_fonts', 'roboto-regular.ttf'),
    bold: path.join(__dirname, '..', '..', 'node_modules', 'pdfmake', 'build', 'vfs_fonts', 'roboto-medium.ttf'),
    italics: path.join(__dirname, '..', '..', 'node_modules', 'pdfmake', 'build', 'vfs_fonts', 'roboto-italics.ttf'),
    bolditalics: path.join(__dirname, '..', '..', 'node_modules', 'pdfmake', 'build', 'vfs_fonts', 'roboto-mediumitalics.ttf'),
  }
};

const CLINIC_NAME = 'Vita Mirabilis';
const CLINIC_SUBTITLE = 'Clinica Odontologica';

const styles = {
  header: {
    fontSize: 18,
    bold: true,
    alignment: 'center',
    margin: [0, 0, 0, 5],
  },
  subheader: {
    fontSize: 10,
    alignment: 'center',
    color: '#666666',
    margin: [0, 0, 0, 15],
  },
  title: {
    fontSize: 14,
    bold: true,
    margin: [0, 15, 0, 8],
  },
  subtitle: {
    fontSize: 11,
    bold: true,
    margin: [0, 10, 0, 5],
  },
  label: {
    fontSize: 9,
    bold: true,
    color: '#333333',
  },
  value: {
    fontSize: 10,
  },
  small: {
    fontSize: 8,
    color: '#666666',
  },
  fieldRow: {
    margin: [0, 3, 0, 3],
  },
  sectionTitle: {
    fontSize: 11,
    bold: true,
    color: '#2563eb',
    margin: [0, 12, 0, 6],
    decoration: 'underline',
    decorationColor: '#2563eb',
  },
  tableHeader: {
    fontSize: 9,
    bold: true,
    color: '#ffffff',
    fillColor: '#2563eb',
    alignment: 'center',
  },
  tableCell: {
    fontSize: 9,
  },
  firmaLine: {
    margin: [0, 40, 0, 0],
    decoration: 'underline',
    decorationColor: '#000000',
  },
};

function clinicHeader() {
  return [
    { text: CLINIC_NAME, style: 'header' },
    { text: CLINIC_SUBTITLE, style: 'subheader' },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#2563eb' }], margin: [0, 0, 0, 10] },
  ];
}

function footer(currentPage, pageCount) {
  return {
    columns: [
      { text: `Generado: ${new Date().toLocaleDateString('es-ES')}`, style: 'small', width: '*' },
      { text: `Pagina ${currentPage} de ${pageCount}`, style: 'small', width: 'auto', alignment: 'right' },
    ],
    margin: [40, 0, 40, 0],
  };
}

function field(label, value) {
  return [
    { text: `${label}: `, style: 'label', margin: [0, 3, 0, 0] },
    { text: String(value || '-'), style: 'value', margin: [0, 0, 0, 3] },
  ];
}

function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

module.exports = { FONTS, CLINIC_NAME, styles, clinicHeader, footer, field, nombreCompleto };
