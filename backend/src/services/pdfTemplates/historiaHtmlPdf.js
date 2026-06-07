const fs = require('fs');
const path = require('path');
const db = require('../../database');

const ESTADOS_COLORES = {
  sano: '#ffffff',
  caries: '#000000',
  obturado: '#666666',
  endodoncia: '#333333',
  corona: '#999999',
  extraccion: '#000000',
  ausente: '#cccccc',
  provisional: '#aaaaaa',
  implante: '#555555',
  puente: '#888888',
  restaurado: '#666666',
};

const ESTADOS_SIMBOLOS = {
  sano:        { letra: '',    simbolo: '',    desc: 'Sano' },
  caries:      { letra: 'CA',  simbolo: '■',   desc: 'Caries' },
  obturado:    { letra: 'OB',  simbolo: '◆',   desc: 'Obturado' },
  endodoncia:  { letra: 'EN',  simbolo: '●',   desc: 'Endodoncia' },
  corona:      { letra: 'CR',  simbolo: '▲',   desc: 'Corona' },
  extraccion:  { letra: 'EX',  simbolo: '✕',   desc: 'Extraccion' },
  ausente:     { letra: 'AU',  simbolo: '○',   desc: 'Ausente' },
  provisional: { letra: 'PR',  simbolo: '△',   desc: 'Provisional' },
  implante:    { letra: 'IM',  simbolo: 'T',   desc: 'Implante' },
  puente:      { letra: 'PU',  simbolo: '═',   desc: 'Puente' },
  restaurado:  { letra: 'RE',  simbolo: '◇',   desc: 'Restaurado' },
};

const DIENTES_PERMANENTES = [
  [18, 17, 16, 15, 14, 13, 12, 11],
  [21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41],
  [31, 32, 33, 34, 35, 36, 37, 38],
];

const DIENTES_TEMPORALES = [
  [55, 54, 53, 52, 51],
  [61, 62, 63, 64, 65],
  [85, 84, 83, 82, 81],
  [71, 72, 73, 74, 75],
];

const SVG_DIR = path.join(__dirname, '..', '..', '..', '..', 'frontend', 'public', 'odontograma-svg');
const LOGO_PATH = path.join(__dirname, '..', '..', '..', '..', 'frontend', 'public', 'logo2.png');

function getLogoBase64() {
  try {
    const buf = fs.readFileSync(LOGO_PATH);
    const ext = path.extname(LOGO_PATH).slice(1).toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

function check(val) { return val && val !== 'No' && val !== 'no' && val !== '' ? '■' : '□'; }

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parsePlanTratamiento(planRaw) {
  if (!planRaw) return [];
  let plan = planRaw;
  if (typeof plan === 'string') {
    try { plan = JSON.parse(plan); } catch {}
  }
  if (typeof plan === 'object' && plan !== null && !Array.isArray(plan)) {
    const lineas = [];
    if (plan.descripcion) lineas.push(`Descripcion: ${plan.descripcion}`);
    if (plan.procedimientos) {
      const procs = (typeof plan.procedimientos === 'string' ? plan.procedimientos : JSON.stringify(plan.procedimientos)).split('\n').filter(l => l.trim());
      lineas.push(`Procedimientos:\n${procs.join('\n')}`);
    }
    if (plan.secuencia) lineas.push(`Secuencia: ${plan.secuencia}`);
    return lineas.join('\n').split('\n').filter(l => l.trim());
  }
  return String(plan).split('\n').filter(l => l.trim());
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return '';
  const h = new Date(); const n = new Date(fechaNacimiento);
  let e = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--;
  return e;
}

function readSvg(num) {
  const svgPath = path.join(SVG_DIR, `${num}.svg`);
  try {
    return fs.readFileSync(svgPath, 'utf-8');
  } catch {
    return null;
  }
}

function colorSvg(svgContent, color) {
  if (!svgContent) return '';
  return svgContent
    .replace(/fill="#000000"/g, `fill="${color}" stroke="#000000" stroke-width="20"`)
    .replace(/width="100%"/g, 'width="100%"')
    .replace(/<svg/, '<svg style="display:block;margin:0 auto;"');
}

function renderOdontogramaSvg(datosJson) {
  if (!datosJson) return '<p style="color:#999;font-size:9px;text-align:center;padding:8px;">Odontograma no registrado</p>';

  let dientes = {};
  if (typeof datosJson === 'string') {
    try { datosJson = JSON.parse(datosJson); } catch { return '<p style="color:#999">Error al parsear odontograma</p>'; }
  }
  if (datosJson.dientes) {
    dientes = datosJson.dientes;
  } else {
    dientes = datosJson;
  }

  const hasTemporales = Object.keys(dientes).some(k => parseInt(k) >= 50);

  function renderFila(nums) {
    let row = '';
    for (const num of nums) {
      const d = dientes[String(num)] || {};
      const estado = d.estado || 'sano';
      const color = ESTADOS_COLORES[estado] || ESTADOS_COLORES.sano;
      const info = ESTADOS_SIMBOLOS[estado] || ESTADOS_SIMBOLOS.sano;
      const svg = readSvg(num);
      const colored = colorSvg(svg, color);
      const badge = info.letra
        ? `<span class="diente-badge">${info.simbolo}<br/>${info.letra}</span>`
        : '';
      row += `<div class="diente-box"><span class="diente-num">${num}</span>${colored}${badge}</div>`;
    }
    return row;
  }

  let html = '';

  // PERMANENTE SUPERIOR: 18-11 | | 21-28
  html += '<div style="text-align:center;font-size:9px;font-weight:700;margin-bottom:4px;">Denticion Permanente Superior</div>';
  html += '<div class="odontograma-arcada">';
  html += '<div class="odontograma-row">' + renderFila(DIENTES_PERMANENTES[0]) + '</div>';
  html += '<div class="separador-vertical"></div>';
  html += '<div class="odontograma-row">' + renderFila(DIENTES_PERMANENTES[1]) + '</div>';
  html += '</div>';

  // Temporales superiores
  if (hasTemporales) {
    html += '<div style="text-align:center;font-size:8px;font-weight:600;color:#555;margin:6px 0 4px 0;">Denticion Temporal Superior</div>';
    html += '<div class="odontograma-arcada">';
    html += '<div class="odontograma-row">' + renderFila(DIENTES_TEMPORALES[0]) + '</div>';
    html += '<div class="separador-vertical separador-temporal"></div>';
    html += '<div class="odontograma-row">' + renderFila(DIENTES_TEMPORALES[1]) + '</div>';
    html += '</div>';
  }

  // Separador horizontal entre superior e inferior
  html += '<div class="diente-separador"></div>';

  // Temporales inferiores
  if (hasTemporales) {
    html += '<div style="text-align:center;font-size:8px;font-weight:600;color:#555;margin:4px 0 4px 0;">Denticion Temporal Inferior</div>';
    html += '<div class="odontograma-arcada">';
    html += '<div class="odontograma-row">' + renderFila(DIENTES_TEMPORALES[2]) + '</div>';
    html += '<div class="separador-vertical separador-temporal"></div>';
    html += '<div class="odontograma-row">' + renderFila(DIENTES_TEMPORALES[3]) + '</div>';
    html += '</div>';
  }

  // PERMANENTE INFERIOR: 48-41 | | 31-38
  html += '<div style="text-align:center;font-size:9px;font-weight:700;margin:4px 0 4px 0;">Denticion Permanente Inferior</div>';
  html += '<div class="odontograma-arcada">';
  html += '<div class="odontograma-row">' + renderFila(DIENTES_PERMANENTES[2]) + '</div>';
  html += '<div class="separador-vertical"></div>';
  html += '<div class="odontograma-row">' + renderFila(DIENTES_PERMANENTES[3]) + '</div>';
  html += '</div>';

  // Leyenda
  html += '<div class="leyenda-odontograma">';
  const leyendas = [
    'sano', 'caries', 'obturado', 'endodoncia', 'corona',
    'extraccion', 'ausente', 'provisional', 'implante', 'puente',
  ];
  for (const key of leyendas) {
    const info = ESTADOS_SIMBOLOS[key];
    html += `<span class="leyenda-item"><span class="leyenda-cuadro" style="background:${ESTADOS_COLORES[key]}">${info.simbolo ? `<span style="color:#fff;font-size:8px;font-weight:700;">${info.simbolo}</span>` : ''}</span>${info.desc} (${info.letra})</span>`;
  }
  html += '</div>';

  return html;
}

function calcularNecesidades(datosJson) {
  const necesidades = { cariados: 0, curados: 0, por_extraer: 0, ausentes: 0, protesis: 0 };
  if (!datosJson) return necesidades;
  if (typeof datosJson === 'string') {
    try { datosJson = JSON.parse(datosJson); } catch { return necesidades; }
  }
  const dientes = datosJson.dientes || datosJson;
  for (const [num, info] of Object.entries(dientes)) {
    const estado = info.estado || info;
    if (estado === 'caries') necesidades.cariados++;
    else if (estado === 'obturado' || estado === 'restaurado') necesidades.curados++;
    else if (estado === 'extraccion') necesidades.por_extraer++;
    else if (estado === 'ausente') necesidades.ausentes++;
    else if (['corona', 'implante', 'puente', 'provisional'].includes(estado)) necesidades.protesis++;
  }
  return necesidades;
}

function renderRecetas(recetas) {
  if (!recetas || recetas.length === 0) return '';
  return recetas.map(r => {
    let meds = typeof r.medicamentos === 'string' ? JSON.parse(r.medicamentos) : (r.medicamentos || []);
    const medsHtml = meds.map(m =>
      `<div class="receta-med">• <strong>${escapeHtml(m.nombre)}</strong> — ${escapeHtml(m.dosis)} | ${escapeHtml(m.frecuencia)} | ${escapeHtml(m.duracion)}</div>`
    ).join('');
    const indicaciones = r.indicaciones ? `<div class="receta-indicaciones">Indicaciones: ${escapeHtml(r.indicaciones)}</div>` : '';
    return `<div class="receta-box"><h4>Receta — ${new Date(r.created_at).toLocaleDateString('es-PE')}</h4>${medsHtml}${indicaciones}</div>`;
  }).join('');
}

function fillTemplate(template, data) {
  let html = template;
  html = html.replace(/\{\{#if\s+(\w+)\}\}\s*([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
    return data[key] ? content : '';
  });
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' || typeof value === 'number') {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value != null ? String(value) : '');
    }
  }
  return html;
}

function buildDataPorConsulta(paciente, historia, consulta, odontograma, tratamientos, recetas, doctor) {
  const signos = typeof consulta.signos_vitales === 'string' ? JSON.parse(consulta.signos_vitales) : (consulta.signos_vitales || {});
  const diags = typeof consulta.diagnostico_lista === 'string' ? JSON.parse(consulta.diagnostico_lista) : (consulta.diagnostico_lista || []);
  const odontoDatos = odontograma ? (typeof odontograma.datos_json === 'string' ? JSON.parse(odontograma.datos_json) : odontograma.datos_json) : null;
  const necesidades = calcularNecesidades(odontoDatos);

  const peso = signos.peso || '';
  const altura = signos.altura || '';
  let imc = '';
  if (peso && altura) {
    const alturaM = parseFloat(altura) / 100;
    if (alturaM > 0) {
      const imcNum = (parseFloat(peso) / (alturaM * alturaM)).toFixed(1);
      let clasif = '';
      if (imcNum < 18.5) clasif = 'Bajo peso';
      else if (imcNum < 25) clasif = 'Normal';
      else if (imcNum < 30) clasif = 'Sobrepeso';
      else clasif = 'Obesidad';
      imc = `${imcNum} (${clasif})`;
    }
  }

  const diagData = {};
  for (let i = 1; i <= 7; i++) {
    diagData[`diagnostico_${i}`] = diags[i - 1] ? (diags[i - 1].texto || diags[i - 1].descripcion || diags[i - 1]) : '';
  }

  const plan = parsePlanTratamiento(consulta.plan_tratamiento || consulta.tratamiento);
  const planData = {};
  for (let i = 1; i <= 10; i++) {
    planData[`plan_tratamiento_${i}`] = plan[i - 1] || '';
  }

  const tratData = {};
  for (let i = 1; i <= 12; i++) {
    const t = tratamientos?.[i - 1];
    tratData[`trat_fecha_${i}`] = t ? new Date(t.fecha).toLocaleDateString('es-PE') : '';
    tratData[`trat_pza_${i}`] = t ? (t.pieza_dental || '') : '';
    tratData[`trat_proc_${i}`] = t ? (t.procedimiento_realizado || '') : '';
    tratData[`trat_total_${i}`] = t ? `$${(t.costo_total || 0).toLocaleString()}` : '';
    tratData[`trat_cuenta_${i}`] = t ? `$${(t.monto_a_cuenta || 0).toLocaleString()}` : '';
    tratData[`trat_saldo_${i}`] = t ? `$${(t.saldo_pendiente || 0).toLocaleString()}` : '';
  }

  return {
    logo_base64: getLogoBase64(),
    fecha_hora: new Date().toLocaleString('es-PE'),
    numero_historia: historia?.numero_historia || '',
    apellido_paterno: paciente.apellido_paterno || '',
    apellido_materno: paciente.apellido_materno || '',
    nombres: paciente.nombres || '',
    dni: paciente.dni || '',
    fecha_nacimiento: paciente.fecha_nacimiento ? new Date(paciente.fecha_nacimiento).toLocaleDateString('es-PE') : '',
    telefono: paciente.telefono || '',
    email: paciente.email || '',
    direccion: paciente.direccion || '',
    lugar_nacimiento: paciente.lugar_nacimiento || '',
    edad: calcularEdad(paciente.fecha_nacimiento),
    sexo_m: check(paciente.sexo === 'M'),
    sexo_f: check(paciente.sexo === 'F'),
    estado_civil: paciente.estado_civil || '',
    ocupacion: paciente.ocupacion || '',
    dependiente: check(historia?.trabajo_tipo === 'dependiente'),
    independiente: check(historia?.trabajo_tipo === 'independiente'),
    grado_instruccion: paciente.grado_instruccion || '',
    lugar_procedencia: paciente.lugar_procedencia || '',
    nombre_acompanante: paciente.nombre_acompanante || '',
    motivo_consulta: consulta.motivo || historia?.motivo_consulta || '',
    tiempo_enfermedad: historia?.tiempo_enfermedad || '',
    signos_sintomas: historia?.signos_sintomas || '',
    relato_cronologico: historia?.relato_cronologico || '',
    funciones_biologicas: historia?.funciones_biologicas || '',
    alergia_si: check(historia?.alergia_medicamentos),
    alergia_no: check(!historia?.alergia_medicamentos || historia?.alergia_medicamentos === 'No'),
    hemorragia_si: check(historia?.propension_hemorragias),
    hemorragia_no: check(!historia?.propension_hemorragias || historia?.propension_hemorragias === 'No'),
    anestesia_si: check(historia?.complicaciones_anestesia),
    anestesia_no: check(!historia?.complicaciones_anestesia || historia?.complicaciones_anestesia === 'No'),
    pa_medicacion: historia?.presion_arterial_medicacion || '',
    cardiaca_si: check(historia?.cardiopatias_personales || historia?.cardiopatias_familiares),
    cardiaca_no: check(!historia?.cardiopatias_personales && !historia?.cardiopatias_familiares),
    diabetes_si: check(historia?.diabetes_personal || historia?.diabetes_familiar),
    diabetes_no: check(!historia?.diabetes_personal && !historia?.diabetes_familiar),
    hepatitis_si: check(historia?.hepatitis),
    hepatitis_no: check(!historia?.hepatitis || historia?.hepatitis === 'No'),
    otras_enfermedades: historia?.otras_enfermedades || '',
    enfermedad_actual_medicacion: historia?.enfermedad_actual_medicacion || '',
    presion_arterial: signos.presion_arterial || '',
    pulso: signos.pulso || '',
    temperatura: signos.temperatura || '',
    frecuencia_cardiaca: signos.frecuencia_cardiaca || '',
    frecuencia_respiratoria: signos.frecuencia_respiratoria || '',
    peso: peso,
    altura: altura,
    imc: imc,
    odontoestomatologico: signos.odontoestomatologico || '',
    examen_general: signos.examen_general || '',
    ...diagData,
    ...planData,
    odontograma_svg: renderOdontogramaSvg(odontoDatos),
    nec_cariados: necesidades.cariados,
    nec_curados: necesidades.curados,
    nec_por_extraer: necesidades.por_extraer,
    nec_ausentes: necesidades.ausentes,
    nec_protesis: necesidades.protesis,
    hay_recetas: recetas && recetas.length > 0,
    recetas_html: renderRecetas(recetas),
    doctor_nombre: doctor?.nombre || 'Doctor',
    doctor_titulo: doctor?.titulo || 'C.D Odontologia',
    ...tratData,
  };
}

function generateHistoriaConsultaHtml(pacienteId, consultaId) {
  const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(pacienteId);
  if (!paciente) throw new Error('Paciente no encontrado');

  const historia = db.prepare('SELECT * FROM historias_clinicas WHERE paciente_id = ?').get(pacienteId);
  const consulta = db.prepare('SELECT * FROM consultas WHERE id = ?').get(consultaId);
  if (!consulta) throw new Error('Consulta no encontrada');

  const odontograma = db.prepare('SELECT * FROM odontogramas WHERE consulta_id = ?').get(consultaId);
  const tratamientos = db.prepare('SELECT * FROM tratamientos WHERE consulta_id = ?').all(consultaId);
  const recetas = db.prepare('SELECT * FROM recetas WHERE consulta_id = ?').all(consultaId);
  const doctor = db.prepare('SELECT * FROM usuarios LIMIT 1').get();

  const templatePath = path.join(__dirname, 'historia-clinica-template.html');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const data = buildDataPorConsulta(paciente, historia, consulta, odontograma, tratamientos, recetas, doctor);
  return fillTemplate(template, data);
}

// Legacy: buildData for all-consultas PDF (kept for backwards compatibility)
function buildData(paciente, historia, consultas, pagos) {
  const ed = calcularEdad(paciente.fecha_nacimiento);
  const h = historia || {};
  const c = consultas?.[0] || {};
  const signos = typeof c.signos_vitales === 'string' ? JSON.parse(c.signos_vitales) : (c.signos_vitales || {});
  const diags = typeof c.diagnostico_lista === 'string' ? JSON.parse(c.diagnostico_lista) : (c.diagnostico_lista || []);

  const diagData = {};
  for (let i = 1; i <= 7; i++) {
    diagData[`diagnostico_${i}`] = diags[i - 1] ? (diags[i - 1].texto || diags[i - 1].descripcion || diags[i - 1]) : '';
  }

  const plan = parsePlanTratamiento(c.plan_tratamiento || c.tratamiento);
  const planData = {};
  for (let i = 1; i <= 10; i++) {
    planData[`plan_tratamiento_${i}`] = plan[i - 1] || '';
  }

  const odontoDatos = null;
  const necesidades = calcularNecesidades(odontoDatos);

  const peso = signos.peso || '';
  const altura = signos.altura || '';
  let imc = '';
  if (peso && altura) {
    const alturaM = parseFloat(altura) / 100;
    if (alturaM > 0) {
      const imcNum = (parseFloat(peso) / (alturaM * alturaM)).toFixed(1);
      let clasif = '';
      if (imcNum < 18.5) clasif = 'Bajo peso';
      else if (imcNum < 25) clasif = 'Normal';
      else if (imcNum < 30) clasif = 'Sobrepeso';
      else clasif = 'Obesidad';
      imc = `${imcNum} (${clasif})`;
    }
  }

  const tratData = {};
  for (let i = 1; i <= 12; i++) {
    const p = pagos?.[i - 1];
    tratData[`trat_fecha_${i}`] = p ? new Date(p.fecha).toLocaleDateString('es-PE') : '';
    tratData[`trat_pza_${i}`] = p ? (p.diente || p.pza || '') : '';
    tratData[`trat_proc_${i}`] = p ? (p.procedimiento || '') : '';
    tratData[`trat_total_${i}`] = p ? `$${(p.total || 0).toLocaleString()}` : '';
    tratData[`trat_cuenta_${i}`] = p ? `$${(p.a_cuenta || 0).toLocaleString()}` : '';
    tratData[`trat_saldo_${i}`] = p ? `$${(p.saldo || 0).toLocaleString()}` : '';
  }

  return {
    logo_base64: getLogoBase64(),
    fecha_hora: new Date().toLocaleString('es-PE'),
    numero_historia: h.numero_historia || '',
    apellido_paterno: paciente.apellido_paterno || '',
    apellido_materno: paciente.apellido_materno || '',
    nombres: paciente.nombres || '',
    dni: paciente.dni || '',
    fecha_nacimiento: paciente.fecha_nacimiento ? new Date(paciente.fecha_nacimiento).toLocaleDateString('es-PE') : '',
    telefono: paciente.telefono || '',
    email: paciente.email || '',
    direccion: paciente.direccion || '',
    lugar_nacimiento: paciente.lugar_nacimiento || '',
    edad: ed,
    sexo_m: check(paciente.sexo === 'M'),
    sexo_f: check(paciente.sexo === 'F'),
    estado_civil: paciente.estado_civil || '',
    ocupacion: paciente.ocupacion || '',
    dependiente: check(h.trabajo_tipo === 'dependiente'),
    independiente: check(h.trabajo_tipo === 'independiente'),
    grado_instruccion: paciente.grado_instruccion || '',
    lugar_procedencia: paciente.lugar_procedencia || '',
    nombre_acompanante: paciente.nombre_acompanante || '',
    motivo_consulta: c.motivo || h.motivo_consulta || '',
    tiempo_enfermedad: h.tiempo_enfermedad || '',
    signos_sintomas: h.signos_sintomas || '',
    relato_cronologico: h.relato_cronologico || '',
    funciones_biologicas: h.funciones_biologicas || '',
    alergia_si: check(h.alergia_medicamentos),
    alergia_no: check(!h.alergia_medicamentos || h.alergia_medicamentos === 'No'),
    hemorragia_si: check(h.propension_hemorragias),
    hemorragia_no: check(!h.propension_hemorragias || h.propension_hemorragias === 'No'),
    anestesia_si: check(h.complicaciones_anestesia),
    anestesia_no: check(!h.complicaciones_anestesia || h.complicaciones_anestesia === 'No'),
    pa_medicacion: h.presion_arterial_medicacion || '',
    cardiaca_si: check(h.cardiopatias_personales || h.cardiopatias_familiares),
    cardiaca_no: check(!h.cardiopatias_personales && !h.cardiopatias_familiares),
    diabetes_si: check(h.diabetes_personal || h.diabetes_familiar),
    diabetes_no: check(!h.diabetes_personal && !h.diabetes_familiar),
    hepatitis_si: check(h.hepatitis),
    hepatitis_no: check(!h.hepatitis || h.hepatitis === 'No'),
    otras_enfermedades: h.otras_enfermedades || '',
    enfermedad_actual_medicacion: h.enfermedad_actual_medicacion || '',
    presion_arterial: signos.presion_arterial || '',
    pulso: signos.pulso || '',
    temperatura: signos.temperatura || '',
    frecuencia_cardiaca: signos.frecuencia_cardiaca || '',
    frecuencia_respiratoria: signos.frecuencia_respiratoria || '',
    peso: peso,
    altura: altura,
    imc: imc,
    odontoestomatologico: signos.odontoestomatologico || '',
    examen_general: signos.examen_general || '',
    ...diagData,
    ...planData,
    odontograma_svg: '',
    nec_cariados: necesidades.cariados,
    nec_curados: necesidades.curados,
    nec_por_extraer: necesidades.por_extraer,
    nec_ausentes: necesidades.ausentes,
    nec_protesis: necesidades.protesis,
    hay_recetas: false,
    recetas_html: '',
    doctor_nombre: '',
    doctor_titulo: 'C.D Odontologia',
    ...tratData,
  };
}

function generateHistoriaHtml(paciente, historia, consultas, pagos) {
  const templatePath = path.join(__dirname, 'historia-clinica-template.html');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const data = buildData(paciente, historia, consultas, pagos);
  return fillTemplate(template, data);
}

module.exports = { generateHistoriaHtml, generateHistoriaConsultaHtml, fillTemplate, buildData, buildDataPorConsulta };
