const fs = require('fs');
const path = require('path');

function check(val) { return val && val !== 'No' && val !== 'no' && val !== '' ? '■' : '□'; }

function fillTemplate(template, data) {
  let html = template;
  for (const [key, value] of Object.entries(data)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return html;
}

function buildData(paciente, historia, consultas, pagos) {
  const ed = paciente.fecha_nacimiento ? (() => {
    const h = new Date(); const n = new Date(paciente.fecha_nacimiento);
    let e = h.getFullYear() - n.getFullYear();
    if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--;
    return e;
  })() : '';

  const h = historia || {};
  const c = consultas?.[0] || {};
  const signos = typeof c.signos_vitales === 'string' ? JSON.parse(c.signos_vitales) : (c.signos_vitales || {});
  const diags = typeof c.diagnostico_lista === 'string' ? JSON.parse(c.diagnostico_lista) : (c.diagnostico_lista || []);

  const diagData = {};
  for (let i = 1; i <= 7; i++) {
    diagData[`diagnostico_${i}`] = diags[i - 1] ? (diags[i - 1].texto || diags[i - 1].descripcion || diags[i - 1]) : '';
  }

  const plan = (c.plan_tratamiento || c.tratamiento || '').split('\n').filter(l => l.trim());
  const planData = {};
  for (let i = 1; i <= 10; i++) {
    planData[`plan_tratamiento_${i}`] = plan[i - 1] || '';
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
    odontoestomatologico: signos.odontoestomatologico || '',
    examen_general: signos.examen_general || '',
    ...diagData,
    ...planData,
    odontograma: h.odontograma_notas || '',
    ...tratData,
  };
}

function generateHistoriaHtml(paciente, historia, consultas, pagos) {
  const templatePath = path.join(__dirname, 'historia-clinica-template.html');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const data = buildData(paciente, historia, consultas, pagos);
  return fillTemplate(template, data);
}

module.exports = { generateHistoriaHtml, fillTemplate, buildData };
