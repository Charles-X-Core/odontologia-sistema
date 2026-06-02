const { clinicHeader, footer } = require('./constants');

function check(val) { return val && val !== 'No' && val !== 'no' ? '■' : '□'; }

function generateHistoriaDoc(paciente, historia, consultas, pagos) {
  const ed = paciente.fecha_nacimiento ? (() => {
    const h = new Date(); const n = new Date(paciente.fecha_nacimiento);
    let e = h.getFullYear() - n.getFullYear();
    if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--;
    return e;
  })() : '';

  const content = [];

  // ========== HEADER ==========
  content.push({ text: 'FICHA DE HISTORIA CLINICA ODONTOLOGICA', style: 'title', alignment: 'center' });
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#1a1a2e' }], margin: [0, 0, 0, 8] });

  // Fecha y Numero
  content.push({
    columns: [
      { width: 300, text: `Fecha y hora: ${new Date().toLocaleString('es-PE')}`, style: 'small' },
      { width: '*', text: `Numero: ${historia?.numero_historia || '________'}`, style: 'small', alignment: 'right' },
    ],
    margin: [0, 0, 0, 10],
  });

  // ========== IDENTIFICACION DEL PACIENTE ==========
  content.push({ text: 'IDENTIFICACION DEL PACIENTE', style: 'sectionTitle' });
  content.push({
    table: {
      headerRows: 0,
      widths: [130, 100, 60, 80, 50, 95],
      body: [
        // Row 1: Apellidos y Nombres | DNI
        [
          { text: 'Apellido paterno - materno - Nombres:', style: 'tblLabel', colSpan: 5, border: [true, true, true, false] },
          '', '', '', '',
          { text: `${paciente.apellido_paterno || ''} ${paciente.apellido_materno || ''} ${paciente.nombres || ''}`, style: 'tblValue', border: [false, true, true, false] },
        ],
        [
          { text: 'DNI:', style: 'tblLabel', border: [true, false, true, false] },
          { text: paciente.dni || '', style: 'tblValue', border: [false, false, true, false] },
          { text: '', border: [false, false, true, false] },
          { text: '', border: [false, false, true, false] },
          { text: '', border: [false, false, true, false] },
          { text: '', border: [false, false, true, false] },
        ],
        // Row 2: Fecha Nac | Tel | Email
        [
          { text: 'Fecha de Nacimiento', style: 'tblLabel', border: [true, false, true, false] },
          { text: paciente.fecha_nacimiento ? new Date(paciente.fecha_nacimiento).toLocaleDateString('es-PE') : '', style: 'tblValue', border: [false, false, true, false] },
          { text: 'Telefono:', style: 'tblLabel', border: [false, false, true, false] },
          { text: paciente.telefono || '', style: 'tblValue', border: [false, false, true, false] },
          { text: 'Email:', style: 'tblLabel', border: [false, false, true, false] },
          { text: paciente.email || '', style: 'tblValue', border: [false, false, true, false] },
        ],
        // Row 3: Direccion
        [
          { text: 'Direccion:', style: 'tblLabel', colSpan: 6, border: [true, false, true, false] },
          '', '', '', '',
          { text: paciente.direccion || '', style: 'tblValue', border: [false, false, true, false] },
        ],
        // Row 4: Lugar Nac | Edad | Sexo | EC | Ocup | Trabajo
        [
          { text: 'Lugar de Nacimiento:', style: 'tblLabel', border: [true, false, true, false] },
          { text: paciente.lugar_nacimiento || '', style: 'tblValue', border: [false, false, true, false] },
          { text: 'Edad:', style: 'tblLabel', border: [false, false, true, false] },
          { text: `${ed}`, style: 'tblValue', border: [false, false, true, false] },
          { text: 'Sexo:', style: 'tblLabel', border: [false, false, true, false] },
          { text: `${check(paciente.sexo === 'M')} M   ${check(paciente.sexo === 'F')} F`, style: 'tblValue', border: [false, false, true, false] },
        ],
        [
          { text: 'Estado Civil:', style: 'tblLabel', border: [true, false, true, false] },
          { text: paciente.estado_civil || '', style: 'tblValue', border: [false, false, true, false] },
          { text: 'Ocupacion:', style: 'tblLabel', border: [false, false, true, false] },
          { text: paciente.ocupacion || '', style: 'tblValue', colSpan: 3, border: [false, false, true, false] },
          '', '',
        ],
        // Row 5: Grado | Procedencia | Acompanante
        [
          { text: 'Grado de Instruccion:', style: 'tblLabel', border: [true, false, true, false] },
          { text: paciente.grado_instruccion || '', style: 'tblValue', border: [false, false, true, false] },
          { text: 'Lugar de procedencia:', style: 'tblLabel', border: [false, false, true, false] },
          { text: paciente.lugar_procedencia || '', style: 'tblValue', border: [false, false, true, false] },
          { text: 'Nombre del Acompanante:', style: 'tblLabel', border: [false, false, true, false] },
          { text: paciente.nombre_acompanante || '', style: 'tblValue', border: [false, false, true, false] },
        ],
      ],
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#333',
      vLineColor: () => '#333',
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, 12],
  });

  // ========== ENFERMEDAD ACTUAL ==========
  content.push({ text: 'ENFERMEDAD ACTUAL', style: 'sectionTitle' });
  const ea = historia || {};
  content.push({
    table: {
      headerRows: 0,
      widths: ['*'],
      body: [
        [{ text: `Motivo de consulta: ${consultas?.[0]?.motivo || ea.motivo_consulta || '____________________________________________________________'}`, style: 'tblValue', border: [true, true, true, false] }],
        [{ text: `Tiempo de enfermedad: ${ea.tiempo_enfermedad || '____________________________________________________________'}`, style: 'tblValue', border: [true, false, true, false] }],
        [{ text: `Signos y sintomas principales: ${ea.signos_sintomas || '____________________________________________________________'}`, style: 'tblValue', border: [true, false, true, false] }],
        [{ text: `Relato cronologico: ${ea.relato_cronologico || '____________________________________________________________'}`, style: 'tblValue', border: [true, false, true, false] }],
        [{ text: `Funciones biologicas: ${ea.funciones_biologicas || '____________________________________________________________'}`, style: 'tblValue', border: [true, false, true, true] }],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#333',
      vLineColor: () => '#333',
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 12],
  });

  // ========== ANTECEDENTES ==========
  content.push({ text: 'ANTECEDENTES', style: 'sectionTitle' });

  const h = historia || {};
  const antRows = [
    ['Alergico a algun medicamento', h.alergia_medicamentos],
    ['Propenso a hemorragia', h.propension_hemorragias],
    ['Complicaciones con anestesia', h.complicaciones_anestesia],
    ['Presion Arterial / medicacion', h.presion_arterial_medicacion],
    ['Afeccion cardiaca / familiar', h.cardiopatias_familiares],
    ['Diabetes / familiar', h.diabetes_personal],
    ['Hepatitis (tipo A B C)', h.hepatitis],
  ];

  const signos = consultas?.[0]?.signos_vitales || {};
  const sp = typeof signos === 'string' ? JSON.parse(signos) : signos;

  content.push({
    table: {
      headerRows: 1,
      widths: [180, 30, 30, 150, 125],
      body: [
        // Header
        [
          { text: 'ANTECEDENTES PERSONALES Y/O FAMILIARES', style: 'tblHeader', colSpan: 3, alignment: 'center', border: [true, true, true, false] },
          '', '',
          { text: 'EXPLORACION FISICA', style: 'tblHeader', colSpan: 2, alignment: 'center', border: [false, true, true, false] },
          '',
        ],
        ...antRows.map(([label, val]) => [
          { text: label, style: 'tblValue', border: [true, false, true, false] },
          { text: check(val) === '■' ? '■' : '□', style: 'tblValue', alignment: 'center', border: [false, false, true, false] },
          { text: check(val) === '□' ? '□' : '□', style: 'tblValue', alignment: 'center', border: [false, false, true, false] },
          { text: '', border: [false, false, true, false] },
          { text: '', border: [false, false, true, false] },
        ]),
        // Signos vitales rows
        [
          { text: 'Otras enfermedades:', style: 'tblValue', border: [true, false, true, false] },
          { text: h.otras_enfermedades || '', style: 'tblValue', colSpan: 2, border: [false, false, true, false] },
          '',
          { text: `Presion Arterial: ${sp.presion_arterial || ''}`, style: 'tblValue', border: [false, false, true, false] },
          { text: `Examen Clinico General: ${sp.examen_general || ''}`, style: 'tblValue', border: [false, false, true, false] },
        ],
        [
          { text: 'Enfermedad actual / medicacion:', style: 'tblValue', colSpan: 3, border: [true, false, true, false] },
          '', '',
          { text: `Pulso: ${sp.pulso || ''}`, style: 'tblValue', border: [false, false, true, false] },
          { text: `Temperatura: ${sp.temperatura || ''}`, style: 'tblValue', border: [false, false, true, false] },
        ],
        [
          { text: '', border: [true, false, true, true] },
          { text: '', border: [false, false, true, true] },
          { text: '', border: [false, false, true, true] },
          { text: `Frec. Cardiaca: ${sp.frecuencia_cardiaca || ''}`, style: 'tblValue', border: [false, false, true, true] },
          { text: `Odontoestomatologico: ${sp.odontoestomatologico || ''}`, style: 'tblValue', border: [false, false, true, true] },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#333',
      vLineColor: () => '#333',
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, 12],
  });

  // ========== LISTA DE DIAGNOSTICO ==========
  content.push({ text: 'LISTA DE DIAGNOSTICO', style: 'sectionTitle' });
  const diags = consultas?.length > 0 ? (typeof consultas[0].diagnostico_lista === 'string' ? JSON.parse(consultas[0].diagnostico_lista) : (consultas[0].diagnostico_lista || [])) : [];
  const diagRows = diags.length > 0
    ? diags.map((d, i) => [{ text: `${i + 1}. ${d.texto || d.descripcion || d}`, style: 'tblValue', border: [true, false, true, false] }])
    : Array(5).fill(null).map(() => [{ text: '', border: [true, false, true, false] }]);

  content.push({
    table: {
      headerRows: 0,
      widths: ['*'],
      body: diagRows,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#333',
      vLineColor: () => '#333',
      paddingLeft: () => 6,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, 12],
  });

  // ========== TRATAMIENTO Y/O PLAN DE TRABAJO ==========
  content.push({ text: 'TRATAMIENTO Y/O PLAN DE TRABAJO', style: 'sectionTitle' });
  const tratPlan = consultas?.length > 0 ? (consultas[0].plan_tratamiento || consultas[0].tratamiento || '') : '';
  const planLines = tratPlan ? tratPlan.split('\n').filter(l => l.trim()) : [];
  const planRows = planLines.length > 0
    ? planLines.map(l => [{ text: l, style: 'tblValue', border: [true, false, true, false] }])
    : Array(8).fill(null).map(() => [{ text: '', border: [true, false, true, false] }]);

  content.push({
    table: {
      headerRows: 0,
      widths: ['*'],
      body: planRows,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#333',
      vLineColor: () => '#333',
      paddingLeft: () => 6,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, 12],
  });

  // ========== TRATAMIENTO (tabla de pagos) ==========
  content.push({ text: 'TRATAMIENTO', style: 'sectionTitle', decoration: 'underline' });

  const pagoRows = pagos && pagos.length > 0
    ? pagos.map(p => [
        { text: new Date(p.fecha).toLocaleDateString('es-PE'), style: 'tblValue', border: [true, false, true, false] },
        { text: p.diente || p.pza || '', style: 'tblValue', border: [false, false, true, false] },
        { text: p.procedimiento || '-', style: 'tblValue', border: [0, false, true, false] },
        { text: `$${(p.total || 0).toLocaleString()}`, style: 'tblValue', border: [false, false, true, false], alignment: 'right' },
        { text: `$${(p.a_cuenta || 0).toLocaleString()}`, style: 'tblValue', border: [false, false, true, false], alignment: 'right' },
        { text: `$${(p.saldo || 0).toLocaleString()}`, style: 'tblValue', border: [false, false, true, false], alignment: 'right' },
      ])
    : Array(8).fill(null).map(() => [
        { text: '', border: [true, false, true, false] },
        { text: '', border: [false, false, true, false] },
        { text: '', border: [false, false, true, false] },
        { text: '', border: [false, false, true, false] },
        { text: '', border: [false, false, true, false] },
        { text: '', border: [false, false, true, false] },
      ]);

  content.push({
    table: {
      headerRows: 1,
      widths: [75, 45, 180, 70, 70, 75],
      body: [
        [
          { text: 'FECHA', style: 'tblHeader', border: [true, true, true, true] },
          { text: 'PZA', style: 'tblHeader', border: [false, true, true, true] },
          { text: 'PROCEDIMIENTO', style: 'tblHeader', border: [false, true, true, true] },
          { text: 'TOTAL', style: 'tblHeader', border: [false, true, true, true] },
          { text: 'A CUENTA', style: 'tblHeader', border: [false, true, true, true] },
          { text: 'SALDO', style: 'tblHeader', border: [false, true, true, true] },
        ],
        ...pagoRows,
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#333',
      vLineColor: () => '#333',
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3,
      fillColor: (rowIndex) => rowIndex === 0 ? '#e8e8e8' : (rowIndex % 2 === 0 ? '#f9f9f9' : null),
    },
    margin: [0, 0, 0, 15],
  });

  // ========== FIRMA ==========
  content.push({ text: '', margin: [0, 25, 0, 0] });
  content.push({
    columns: [
      { width: '*', text: '' },
      { width: 200, stack: [
        { text: '________________________', alignment: 'center', margin: [0, 0, 0, 3] },
        { text: 'Firma del Odontologo', alignment: 'center', style: 'small' },
        { text: 'C.M.P.: _______________', alignment: 'center', style: 'small' },
      ]},
      { width: '*', text: '' },
    ],
  });

  return {
    pageSize: 'LETTER',
    pageMargins: [40, 50, 40, 50],
    header: clinicHeader,
    footer: footer,
    content,
    styles: {
      header: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
      subheader: { fontSize: 10, alignment: 'center', color: '#666666', margin: [0, 0, 0, 15] },
      title: { fontSize: 13, bold: true, margin: [0, 10, 0, 6] },
      sectionTitle: { fontSize: 10, bold: true, color: '#1a1a2e', margin: [0, 8, 0, 4] },
      label: { fontSize: 8, bold: true, color: '#333333' },
      value: { fontSize: 8.5 },
      small: { fontSize: 7.5, color: '#666666' },
      tblHeader: { fontSize: 8, bold: true, color: '#1a1a2e', alignment: 'center' },
      tblLabel: { fontSize: 8, bold: true, color: '#333' },
      tblValue: { fontSize: 8 },
    },
  };
}

module.exports = { generateHistoriaDoc };
