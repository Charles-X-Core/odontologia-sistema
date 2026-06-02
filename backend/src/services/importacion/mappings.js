const XLSX = require('xlsx');

function cleanPhone(val) {
  if (!val) return null;
  let str = String(val);
  if (str.endsWith('.0')) str = str.slice(0, -2);
  const digits = str.replace(/\D/g, '');
  if (digits.length < 6) return null;
  return digits;
}

function cleanDocument(val) {
  if (!val) return { tipo: null, numero: null };
  let str = String(val).trim();
  const upper = str.toUpperCase();
  let tipo = 'dni';
  let numero = str;

  if (upper.startsWith('CE') || upper.includes('CARNET')) {
    tipo = 'ce';
    numero = str.replace(/^(CE|CARNET\s*DE\s*EXTRANJERIA)\s*/i, '').trim();
  } else if (upper.startsWith('PASAPORTE') || upper.startsWith('PPT')) {
    tipo = 'pasaporte';
    numero = str.replace(/^(PASAPORTE|PPT)\s*/i, '').trim();
  } else if (upper.startsWith('DNI')) {
    tipo = 'dni';
    numero = str.replace(/^DNI\s*/i, '').trim();
  }

  numero = numero.replace(/\D/g, '').trim();
  if (numero.length < 4) return { tipo: null, numero: null };

  return { tipo, numero };
}

function cleanName(val) {
  if (!val) return '';
  return String(val).trim().replace(/\s+/g, ' ').replace(/(^|\s)\S/g, c => c.toUpperCase());
}

function cleanMoney(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^0-9.,\-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function parseExcelDate(val) {
  if (!val && val !== 0) return null;
  let num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.\-\/]/g, ''));
  if (!isNaN(num) && num > 30 && num < 200000 && String(val).match(/^[\d.\-\/]+$/)) {
    const date = XLSX.SSF.parse_date_code(num);
    if (date && date.y > 1900 && date.y < 2100) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  const str = String(val).trim();
  if (!str) return null;
  const parts = str.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let [p1, p2, p3] = parts.map(Number);
    if (p1 > 100 && p2 >= 1 && p2 <= 12 && p3 >= 1 && p3 <= 31) {
      return `${p1}-${String(p2).padStart(2, '0')}-${String(p3).padStart(2, '0')}`;
    }
    if (p3 > 100 && p1 >= 1 && p1 <= 12 && p2 >= 1 && p2 <= 31) {
      return `${p3}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
    }
    if (p3 > 100 && p2 >= 1 && p2 <= 12 && p1 >= 1 && p1 <= 31) {
      return `${p3}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    }
  }
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return str || null;
}

const PACIENTE_MAPPING = {
  'apellido paterno': 'apellido_paterno',
  'apellido_paterno': 'apellido_paterno',
  'ape paterno': 'apellido_paterno',
  'ap paterno': 'apellido_paterno',
  'apellido materno': 'apellido_materno',
  'apellido_materno': 'apellido_materno',
  'ape materno': 'apellido_materno',
  'ap materno': 'apellido_materno',
  'nombres': 'nombres',
  'nombre': 'nombres',
  'nombres completos': 'nombres',
  'dni': 'dni',
  'documento': 'dni',
  'num doc': 'dni',
  'telefono': 'telefono',
  'tel': 'telefono',
  'celular': 'telefono',
  'email': 'email',
  'correo': 'email',
  'e-mail': 'email',
  'fecha nacimiento': 'fecha_nacimiento',
  'fecha_nacimiento': 'fecha_nacimiento',
  'fec nac': 'fecha_nacimiento',
  'sexo': 'sexo',
  'genero': 'sexo',
  'estado civil': 'estado_civil',
  'estado_civil': 'estado_civil',
  'direccion': 'direccion',
  'domicilio': 'direccion',
  'dir': 'direccion',
  'lugar nacimiento': 'lugar_nacimiento',
  'lugar_nacimiento': 'lugar_nacimiento',
  'lugar de nacimiento': 'lugar_nacimiento',
  'lugar procedencia': 'lugar_procedencia',
  'lugar_procedencia': 'lugar_procedencia',
  'procedencia': 'lugar_procedencia',
  'grado instruccion': 'grado_instruccion',
  'grado_instruccion': 'grado_instruccion',
  'grado de instruccion': 'grado_instruccion',
  'educacion': 'grado_instruccion',
  'ocupacion': 'ocupacion',
  'profesion': 'ocupacion',
  'trabajo': 'ocupacion',
  'acompanante': 'nombre_acompanante',
  'nombre acompanante': 'nombre_acompanante',
  'contacto emergencia': 'contacto_emergencia',
  'contacto_emergencia': 'contacto_emergencia',
  'contacto de emergencia': 'contacto_emergencia',
  'tel emergencia': 'telefono_emergencia',
  'telefono emergencia': 'telefono_emergencia',
  'telefono_emergencia': 'telefono_emergencia',
};

const PACIENTE_REQUIRED = ['apellido_paterno', 'nombres', 'dni'];

const PACIENTE_TRANSFORMS = {
  sexo: (val) => {
    const v = (val || '').toLowerCase().trim();
    if (v === 'masculino' || v === 'm' || v === 'hombre') return 'M';
    if (v === 'femenino' || v === 'f' || v === 'mujer') return 'F';
    return val || '';
  },
  fecha_nacimiento: (val) => parseExcelDate(val),
  telefono: (val) => cleanPhone(val),
};

const TRATAMIENTO_MAPPING = {
  'paciente_dni': 'paciente_dni',
  'dni': 'paciente_dni',
  'documento': 'paciente_dni',
  'fecha': 'fecha',
  'fecha_tratamiento': 'fecha',
  'pieza': 'pieza_dental',
  'pieza dental': 'pieza_dental',
  'pieza_dental': 'pieza_dental',
  'diente': 'pieza_dental',
  'diente numero': 'pieza_dental',
  'procedimiento': 'procedimiento_realizado',
  'procedimiento realizado': 'procedimiento_realizado',
  'procedimiento_realizado': 'procedimiento_realizado',
  'descripcion': 'procedimiento_realizado',
  'tratamiento': 'procedimiento_realizado',
  'costo': 'costo_total',
  'costo total': 'costo_total',
  'costo_total': 'costo_total',
  'total': 'costo_total',
  'monto a cuenta': 'monto_a_cuenta',
  'monto_a_cuenta': 'monto_a_cuenta',
  'a cuenta': 'monto_a_cuenta',
  'pagado': 'monto_a_cuenta',
  'notas': 'notas',
  'observaciones': 'notas',
};

const TRATAMIENTO_REQUIRED = ['paciente_dni', 'procedimiento_realizado', 'fecha'];

const TRATAMIENTO_TRANSFORMS = {
  costo_total: (val) => cleanMoney(val),
  monto_a_cuenta: (val) => cleanMoney(val),
  fecha: (val) => parseExcelDate(val) || new Date().toISOString().split('T')[0],
};

const CONSULTA_MAPPING = {
  'paciente_dni': 'paciente_dni',
  'dni': 'paciente_dni',
  'documento': 'paciente_dni',
  'fecha': 'fecha',
  'motivo': 'motivo',
  'motivo consulta': 'motivo',
  'diagnostico': 'diagnostico',
  'diagnóstico': 'diagnostico',
  'tratamiento': 'tratamiento_texto',
  'notas': 'notas',
  'observaciones': 'notas',
};

const CONSULTA_REQUIRED = ['paciente_dni', 'motivo'];

const CONSULTA_TRANSFORMS = {
  fecha: (val) => parseExcelDate(val) || new Date().toISOString(),
};

const PAGO_MAPPING = {
  'paciente_dni': 'paciente_dni',
  'dni': 'paciente_dni',
  'documento': 'paciente_dni',
  'fecha': 'fecha',
  'procedimiento': 'procedimiento',
  'total': 'total',
  'monto total': 'total',
  'a cuenta': 'a_cuenta',
  'pagado': 'a_cuenta',
  'metodo': 'metodo_pago',
  'metodo pago': 'metodo_pago',
  'metodo_pago': 'metodo_pago',
  'notas': 'notas',
  'observaciones': 'notas',
};

const PAGO_REQUIRED = ['paciente_dni', 'fecha', 'total'];

const PAGO_TRANSFORMS = {
  total: (val) => cleanMoney(val),
  a_cuenta: (val) => cleanMoney(val),
  fecha: (val) => parseExcelDate(val) || new Date().toISOString().split('T')[0],
};

const HISTORIA_CLINICA_MAPPING = {
  'nhclx': 'numero_historia',
  'n°hclx': 'numero_historia',
  'n hclx': 'numero_historia',
  'hclx': 'numero_historia',
  'fecha': 'fecha',
  'dni': 'documento_raw',
  'cedula': 'documento_raw',
  'ce': 'documento_raw',
  'documento': 'documento_raw',
  'num doc': 'documento_raw',
  'edad': 'edad',
  'paciente': 'paciente_nombre',
  'nombre': 'paciente_nombre',
  'telefono': 'telefono',
  'tel': 'telefono',
  'celular': 'telefono',
  'alergias': 'alergias',
  'alergia': 'alergias',
  'antecedentes': 'antecedentes',
  'antecedente': 'antecedentes',
  'f.nac': 'fecha_nacimiento',
  'fnac': 'fecha_nacimiento',
  'fecha nacimiento': 'fecha_nacimiento',
  'cariados': 'cariados',
  'curados': 'curados',
  'por extraer': 'por_extraer',
  'por_extraer': 'por_extraer',
  'endodoncia': 'endodoncia',
  'orto': 'ortodoncia',
  'ortodoncia': 'ortodoncia',
  'protesis': 'protesis',
  'prótesis': 'protesis',
  'extraidos': 'extraidos',
  'extracciones': 'extraidos',
  'destartraje': 'destartraje',
  'detartraje': 'destartraje',
  'limpieza': 'destartraje',
};

const HISTORIA_CLINICA_REQUIRED = ['paciente_nombre'];

const HISTORIA_CLINICA_TRANSFORMS = {
  paciente_nombre: (val) => {
    const nombre = cleanName(val);
    if (!nombre) return { apellido_paterno: '', nombres: '' };
    const partes = nombre.split(/\s+/);
    if (partes.length === 1) return { apellido_paterno: partes[0], nombres: '' };
    return { apellido_paterno: partes[0], nombres: partes.slice(1).join(' ') };
  },
  fecha: (val) => parseExcelDate(val) || new Date().toISOString().split('T')[0],
  fecha_nacimiento: (val) => parseExcelDate(val),
  telefono: (val) => cleanPhone(val),
  documento_raw: (val) => cleanDocument(val),
};

const ANTECEDENTE_MAPPING = {
  'nhclx': 'numero_historia',
  'n°hclx': 'numero_historia',
  'n hclx': 'numero_historia',
  'hclx': 'numero_historia',
  'paciente': 'paciente_nombre',
  'nombre': 'paciente_nombre',
  'lista de diagnostico': 'diagnostico_lista',
  'diagnostico': 'diagnostico_lista',
  'diagnóstico': 'diagnostico_lista',
  'tratamiento': 'tratamiento',
  'tratamiento realizado': 'tratamiento',
  'procedimiento': 'tratamiento',
  'procedimiento realizado': 'tratamiento',
  'plan de trabajo': 'plan_trabajo',
  'plan': 'plan_trabajo',
  'plan_trabajo': 'plan_trabajo',
  'costo': 'costo_total',
  'costo total': 'costo_total',
  'total': 'costo_total',
  'monto': 'costo_total',
};

const ANTECEDENTE_REQUIRED = [];

const ANTECEDENTE_TRANSFORMS = {
  paciente_nombre: (val) => cleanName(val),
  costo_total: (val) => cleanMoney(val),
};

const SALDO_MAPPING = {
  'nhclx': 'numero_historia',
  'n°hclx': 'numero_historia',
  'n hclx': 'numero_historia',
  'hclx': 'numero_historia',
  'paciente': 'paciente_nombre',
  'nombre': 'paciente_nombre',
  'fecha': 'fecha',
  'procedimiento': 'procedimiento',
  'total': 'total',
  'a cuenta': 'a_cuenta',
  'acuenta': 'a_cuenta',
  'saldo': 'saldo',
};

const SALDO_REQUIRED = ['total'];

const SALDO_TRANSFORMS = {
  total: (val) => cleanMoney(val),
  a_cuenta: (val) => cleanMoney(val),
  saldo: (val) => cleanMoney(val),
  fecha: (val) => parseExcelDate(val) || new Date().toISOString().split('T')[0],
  paciente_nombre: (val) => cleanName(val),
};

function autoMapColumns(headers, entityType) {
  const mappings = {
    pacientes: PACIENTE_MAPPING,
    tratamientos: TRATAMIENTO_MAPPING,
    consultas: CONSULTA_MAPPING,
    pagos: PAGO_MAPPING,
    historias_clinicas: HISTORIA_CLINICA_MAPPING,
    antecedentes: ANTECEDENTE_MAPPING,
    saldos: SALDO_MAPPING,
  };
  const mapping = mappings[entityType] || {};
  const result = {};

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    if (mapping[normalized]) {
      result[header] = mapping[normalized];
    }
  }
  return result;
}

function applyTransforms(row, transforms) {
  const result = { ...row };
  for (const [field, transformFn] of Object.entries(transforms || {})) {
    if (result[field] !== undefined) {
      result[field] = transformFn(result[field]);
    }
  }
  return result;
}

function detectSheetType(sheetName, headers) {
  const name = (sheetName || '').toLowerCase();
  if (name.includes('historia') || name.includes('clinica') || name.includes('hcl')) return 'historia_clinica';
  if (name.includes('antecedente') || name.includes('diagnostico') || name.includes('tratamiento')) return 'antecedentes';
  if (name.includes('saldo') || name.includes('pago') || name.includes('cuenta')) return 'saldos';

  const headerStr = headers.join(' ').toLowerCase();
  if (headerStr.includes('cariados') || headerStr.includes('destartraje') || headerStr.includes('endodoncia')) return 'historia_clinica';
  if (headerStr.includes('plan de trabajo') || headerStr.includes('lista de diagnostico')) return 'antecedentes';
  if (headerStr.includes('a cuenta') && headerStr.includes('saldo')) return 'saldos';

  return null;
}

module.exports = {
  PACIENTE_MAPPING, PACIENTE_REQUIRED, PACIENTE_TRANSFORMS,
  TRATAMIENTO_MAPPING, TRATAMIENTO_REQUIRED, TRATAMIENTO_TRANSFORMS,
  CONSULTA_MAPPING, CONSULTA_REQUIRED, CONSULTA_TRANSFORMS,
  PAGO_MAPPING, PAGO_REQUIRED, PAGO_TRANSFORMS,
  HISTORIA_CLINICA_MAPPING, HISTORIA_CLINICA_REQUIRED, HISTORIA_CLINICA_TRANSFORMS,
  ANTECEDENTE_MAPPING, ANTECEDENTE_REQUIRED, ANTECEDENTE_TRANSFORMS,
  SALDO_MAPPING, SALDO_REQUIRED, SALDO_TRANSFORMS,
  autoMapColumns, applyTransforms, detectSheetType,
  cleanPhone, cleanDocument, cleanName, cleanMoney, parseExcelDate,
};
