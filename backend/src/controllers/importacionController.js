const db = require('../database');
const XLSX = require('xlsx');
const crypto = require('crypto');
const {
  PACIENTE_REQUIRED, PACIENTE_TRANSFORMS,
  TRATAMIENTO_REQUIRED, TRATAMIENTO_TRANSFORMS,
  CONSULTA_REQUIRED, CONSULTA_TRANSFORMS,
  PAGO_REQUIRED, PAGO_TRANSFORMS,
  HISTORIA_CLINICA_REQUIRED, HISTORIA_CLINICA_TRANSFORMS,
  ANTECEDENTE_REQUIRED, ANTECEDENTE_TRANSFORMS,
  SALDO_REQUIRED, SALDO_TRANSFORMS,
  autoMapColumns, applyTransforms, detectSheetType,
  cleanDocument, cleanPhone, cleanName,
} = require('../services/importacion/mappings');

exports.preview = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envio archivo' });
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    res.json({ nombreHoja: sheetName, totalHojas: workbook.SheetNames.length, hojas: workbook.SheetNames, totalFilas: data.length, headers, preview: data.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ error: 'Error al leer archivo: ' + err.message });
  }
};

exports.previewCompleto = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envio archivo' });
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const hojas = {};
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const headers = data.length > 0 ? Object.keys(data[0]) : [];
      const detectedType = detectSheetType(name, headers);
      const autoMapping = detectedType ? autoMapColumns(headers, detectedType) : {};
      hojas[name] = { nombre: name, tipoDetectado: detectedType, totalFilas: data.length, headers, autoMapping, preview: data.slice(0, 5) };
    }
    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const historial = db.prepare('SELECT * FROM importaciones_historial WHERE archivo_hash = ?').all(fileHash);
    const stats = {
      totalPacientes: db.prepare('SELECT COUNT(*) as t FROM pacientes').get().t,
      totalConsultas: db.prepare('SELECT COUNT(*) as t FROM consultas').get().t,
      totalTratamientos: db.prepare('SELECT COUNT(*) as t FROM tratamientos').get().t,
      totalPagos: db.prepare('SELECT COUNT(*) as t FROM pagos').get().t,
      totalHistorias: db.prepare('SELECT COUNT(*) as t FROM historias_clinicas').get().t,
    };
    res.json({ hojas, fileHash, yaImportado: historial.length > 0, historialImportaciones: historial, estadisticasDB: stats });
  } catch (err) {
    res.status(500).json({ error: 'Error al leer archivo: ' + err.message });
  }
};

exports.analisis = (req, res) => {
  try {
    const stats = {
      totalPacientes: db.prepare('SELECT COUNT(*) as t FROM pacientes').get().t,
      totalConsultas: db.prepare('SELECT COUNT(*) as t FROM consultas').get().t,
      totalTratamientos: db.prepare('SELECT COUNT(*) as t FROM tratamientos').get().t,
      totalPagos: db.prepare('SELECT COUNT(*) as t FROM pagos').get().t,
      totalHistorias: db.prepare('SELECT COUNT(*) as t FROM historias_clinicas').get().t,
      totalNecesidades: db.prepare('SELECT COUNT(*) as t FROM necesidades_odontologicas').get().t,
      totalRecetas: db.prepare('SELECT COUNT(*) as t FROM recetas').get().t,
      pacientesPorTipoDoc: db.prepare('SELECT tipo_documento, COUNT(*) as t FROM pacientes GROUP BY tipo_documento').all(),
      ultimasImportaciones: db.prepare('SELECT * FROM importaciones_historial ORDER BY fecha_importacion DESC LIMIT 10').all(),
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener analisis: ' + err.message });
  }
};

exports.importarPacientes = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envio archivo' });
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const customMapping = req.body.mapping ? JSON.parse(req.body.mapping) : null;
    const results = { exitosos: 0, duplicados: 0, fallidos: 0, errores: [] };
    const stmt = db.prepare('INSERT OR IGNORE INTO pacientes (apellido_paterno, apellido_materno, nombres, dni, tipo_documento, telefono, email, fecha_nacimiento, sexo, estado_civil, direccion, lugar_nacimiento, lugar_procedencia, grado_instruccion, ocupacion, nombre_acompanante, contacto_emergencia, telefono_emergencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        const mapped = {};
        for (const [header, dbField] of Object.entries(customMapping || autoMapColumns(Object.keys(row), 'pacientes'))) {
          if (row[header] !== undefined && row[header] !== '') mapped[dbField] = row[header];
        }
        const missing = PACIENTE_REQUIRED.filter(f => !mapped[f]);
        if (missing.length > 0) throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
        const transformed = applyTransforms(mapped, PACIENTE_TRANSFORMS);
        const r = stmt.run(transformed.apellido_paterno || '', transformed.apellido_materno || '', transformed.nombres || '', transformed.dni || '', 'dni', transformed.telefono || null, transformed.email || null, transformed.fecha_nacimiento || null, transformed.sexo || null, transformed.estado_civil || '', transformed.direccion || null, transformed.lugar_nacimiento || '', transformed.lugar_procedencia || '', transformed.grado_instruccion || '', transformed.ocupacion || null, transformed.nombre_acompanante || '', transformed.contacto_emergencia || null, transformed.telefono_emergencia || null);
        if (r.changes > 0) results.exitosos++;
        else results.duplicados++;
      } catch (err) {
        results.fallidos++;
        results.errores.push({ fila: i + 2, error: err.message });
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Error al importar: ' + err.message });
  }
};

exports.importarTratamientos = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envio archivo' });
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const results = { exitosos: 0, fallidos: 0, errores: [] };
    const findPatient = db.prepare('SELECT id FROM pacientes WHERE dni = ?');
    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        const mapped = {};
        for (const [header, dbField] of Object.entries(autoMapColumns(Object.keys(row), 'tratamientos'))) {
          if (row[header] !== undefined && row[header] !== '') mapped[dbField] = row[header];
        }
        const missing = TRATAMIENTO_REQUIRED.filter(f => !mapped[f]);
        if (missing.length > 0) throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
        const paciente = findPatient.get(String(mapped.paciente_dni));
        if (!paciente) throw new Error(`Paciente con DNI ${mapped.paciente_dni} no encontrado`);
        const transformed = applyTransforms(mapped, TRATAMIENTO_TRANSFORMS);
        const costo = transformed.costo_total || 0;
        const monto = transformed.monto_a_cuenta || 0;
        db.prepare('INSERT INTO tratamientos (paciente_id, fecha, pieza_dental, procedimiento_realizado, costo_total, monto_a_cuenta, saldo_pendiente, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(paciente.id, transformed.fecha, transformed.pieza_dental || '', transformed.procedimiento_realizado, costo, monto, costo - monto, transformed.notas || '');
        results.exitosos++;
      } catch (err) {
        results.fallidos++;
        results.errores.push({ fila: i + 2, error: err.message });
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Error al importar: ' + err.message });
  }
};

exports.importarConsultas = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envio archivo' });
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const results = { exitosos: 0, fallidos: 0, errores: [] };
    const findPatient = db.prepare('SELECT id FROM pacientes WHERE dni = ?');
    const findHistoria = db.prepare('SELECT id FROM historias_clinicas WHERE paciente_id = ?');
    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        const mapped = {};
        for (const [header, dbField] of Object.entries(autoMapColumns(Object.keys(row), 'consultas'))) {
          if (row[header] !== undefined && row[header] !== '') mapped[dbField] = row[header];
        }
        const missing = CONSULTA_REQUIRED.filter(f => !mapped[f]);
        if (missing.length > 0) throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
        const paciente = findPatient.get(String(mapped.paciente_dni));
        if (!paciente) throw new Error(`Paciente con DNI ${mapped.paciente_dni} no encontrado`);
        let historia = findHistoria.get(paciente.id);
        if (!historia) {
          const ultimo = db.prepare('SELECT MAX(CAST(numero_historia AS INTEGER)) as max_num FROM historias_clinicas WHERE numero_historia IS NOT NULL AND numero_historia != ""').get();
          const num = (ultimo?.max_num || 0) + 1;
          const r = db.prepare('INSERT INTO historias_clinicas (paciente_id, numero_historia) VALUES (?, ?)').run(paciente.id, String(num));
          historia = { id: r.lastInsertRowid };
        }
        const transformed = applyTransforms(mapped, CONSULTA_TRANSFORMS);
        const diagLista = mapped.diagnostico ? [{ texto: mapped.diagnostico, tipo: 'clinico' }] : [];
        db.prepare('INSERT INTO consultas (historia_id, fecha, motivo, diagnostico_lista, notas) VALUES (?, ?, ?, ?, ?)').run(historia.id, transformed.fecha || new Date().toISOString(), transformed.motivo, JSON.stringify(diagLista), transformed.notas || '');
        results.exitosos++;
      } catch (err) {
        results.fallidos++;
        results.errores.push({ fila: i + 2, error: err.message });
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Error al importar: ' + err.message });
  }
};

exports.importarPagos = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envio archivo' });
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const results = { exitosos: 0, fallidos: 0, errores: [] };
    const findPatient = db.prepare('SELECT id FROM pacientes WHERE dni = ?');
    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        const mapped = {};
        for (const [header, dbField] of Object.entries(autoMapColumns(Object.keys(row), 'pagos'))) {
          if (row[header] !== undefined && row[header] !== '') mapped[dbField] = row[header];
        }
        const missing = PAGO_REQUIRED.filter(f => !mapped[f]);
        if (missing.length > 0) throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
        const paciente = findPatient.get(String(mapped.paciente_dni));
        if (!paciente) throw new Error(`Paciente con DNI ${mapped.paciente_dni} no encontrado`);
        const transformed = applyTransforms(mapped, PAGO_TRANSFORMS);
        const total = transformed.total || 0;
        const aCuenta = transformed.a_cuenta || 0;
        db.prepare('INSERT INTO pagos (paciente_id, fecha, procedimiento, total, a_cuenta, saldo, metodo_pago, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(paciente.id, transformed.fecha, transformed.procedimiento || '', total, aCuenta, total - aCuenta, transformed.metodo_pago || 'efectivo', transformed.notas || '');
        results.exitosos++;
      } catch (err) {
        results.fallidos++;
        results.errores.push({ fila: i + 2, error: err.message });
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Error al importar: ' + err.message });
  }
};

exports.importarCompleto = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envio archivo' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    const resultados = {
      pacientes: { exitosos: 0, duplicados: 0, fallidos: 0, errores: [] },
      consultas: { exitosos: 0, duplicados: 0, fallidos: 0, errores: [] },
      necesidades: { exitosos: 0, fallidos: 0, errores: [] },
      tratamientos: { exitosos: 0, fallidos: 0, errores: [] },
      pagos: { exitosos: 0, fallidos: 0, errores: [] },
      pacientesCreadosAutomaticamente: [],
    };

    let histSheet = null;
    let antSheet = null;
    let saldoSheet = null;

    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const headers = data.length > 0 ? Object.keys(data[0]) : [];
      const type = detectSheetType(name, headers);
      if (type === 'historia_clinica') histSheet = data;
      else if (type === 'antecedentes') antSheet = data;
      else if (type === 'saldos') saldoSheet = data;
    }

    const pacienteByHclx = new Map();
    const pacienteById = new Map();
    const historiaByPacienteId = new Map();
    const ultimaConsultaByHistoriaId = new Map();
    let autoDniCounter = 0;

    const stmtHistoria = db.prepare('INSERT INTO historias_clinicas (paciente_id, numero_historia, alergia_medicamentos, otras_enfermedades) VALUES (?, ?, ?, ?)');
    const stmtConsulta = db.prepare('INSERT INTO consultas (historia_id, fecha, motivo, notas) VALUES (?, ?, ?, ?)');
    const stmtNecesidades = db.prepare('INSERT INTO necesidades_odontologicas (consulta_id, cariados, curados, por_extraer, endodoncia, ortodoncia, protesis, extraidos, destartraje) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const stmtTratamiento = db.prepare('INSERT INTO tratamientos (paciente_id, consulta_id, fecha, procedimiento_realizado, notas, costo_total, monto_a_cuenta, saldo_pendiente) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const stmtPago = db.prepare('INSERT INTO pagos (paciente_id, consulta_id, fecha, procedimiento, total, a_cuenta, saldo, metodo_pago) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

    const findPatientByDni = db.prepare('SELECT id FROM pacientes WHERE dni = ?');
    const findPatientById = db.prepare('SELECT id, dni, tipo_documento FROM pacientes WHERE id = ?');
    const findHistoriaByPaciente = db.prepare('SELECT id FROM historias_clinicas WHERE paciente_id = ?');
    const findConsulta = db.prepare('SELECT id FROM consultas WHERE historia_id = ? ORDER BY id DESC LIMIT 1');
    const findHistoriaByHclx = db.prepare('SELECT id, paciente_id FROM historias_clinicas WHERE numero_historia = ?');
    const findPatientByName = db.prepare('SELECT id, dni FROM pacientes WHERE LOWER(apellido_paterno) = LOWER(?) AND LOWER(nombres) = LOWER(?)');
    const insertPaciente = db.prepare('INSERT OR IGNORE INTO pacientes (apellido_paterno, apellido_materno, nombres, dni, tipo_documento, telefono, fecha_nacimiento) VALUES (?, ?, ?, ?, ?, ?, ?)');

    function resolveHclx(row) {
      const keys = ['N°HCLX', 'nhclx', 'n°hclx', 'n hclx', 'hclx', 'HCLX', 'N. HCLX', 'N° HCLX', 'No. HCLX', 'No HCLX'];
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== '') return String(row[k]).trim();
      }
      return '';
    }

    function findOrCreatePaciente(apellidoP, nombres, dni, tipoDoc, telefono, fechaNac, sheetOrigin) {
      let paciente = null;

      if (dni) {
        paciente = findPatientByDni.get(dni);
        if (paciente) return { id: paciente.id, existing: true };
      }

      if (apellidoP && nombres) {
        paciente = findPatientByName.get(apellidoP, nombres);
        if (paciente) {
          if (dni && paciente.dni !== dni && (!paciente.dni || paciente.dni.startsWith('AUTO_'))) {
            try { db.prepare('UPDATE pacientes SET dni = ?, tipo_documento = ? WHERE id = ?').run(dni, tipoDoc || 'dni', paciente.id); } catch (e) {}
          }
          return { id: paciente.id, existing: true };
        }
      }

      if (!dni && apellidoP) {
        autoDniCounter++;
        const autoDni = `AUTO_${Date.now()}_${autoDniCounter}`;
        const r = insertPaciente.run(apellidoP, '', nombres || apellidoP, autoDni, 'sin_doc', telefono || null, fechaNac || null);
        if (r.changes > 0) {
          const newId = Number(r.lastInsertRowid);
          resultados.pacientes.exitosos++;
          resultados.pacientesCreadosAutomaticamente.push({ id: newId, nombre: `${apellidoP} ${nombres || ''}`.trim(), origen: sheetOrigin });
          return { id: newId, existing: false };
        }
      }

      if (dni) {
        const r = insertPaciente.run(apellidoP || '', '', nombres || apellidoP || '', dni, tipoDoc || 'dni', telefono || null, fechaNac || null);
        if (r.changes > 0) {
          const newId = Number(r.lastInsertRowid);
          resultados.pacientes.exitosos++;
          resultados.pacientesCreadosAutomaticamente.push({ id: newId, nombre: `${apellidoP || ''} ${nombres || ''}`.trim(), origen: sheetOrigin });
          return { id: newId, existing: false };
        }
        paciente = findPatientByDni.get(dni);
        if (paciente) return { id: paciente.id, existing: true };
      }

      return null;
    }

    function ensureHistoria(pacienteId, hclx) {
      let historia = historiaByPacienteId.get(pacienteId);
      if (historia) return historia;

      historia = findHistoriaByPaciente.get(pacienteId);
      if (historia) {
        historiaByPacienteId.set(pacienteId, historia);
        return historia;
      }

      const r = stmtHistoria.run(pacienteId, hclx || null, null, null);
      historia = { id: Number(r.lastInsertRowid) };
      historiaByPacienteId.set(pacienteId, historia);
      return historia;
    }

    function ensureConsulta(historiaId, motivo, fecha) {
      let existing = ultimaConsultaByHistoriaId.get(historiaId);
      if (existing) return existing;

      const fromDb = findConsulta.get(historiaId);
      if (fromDb) {
        ultimaConsultaByHistoriaId.set(historiaId, fromDb.id);
        return fromDb.id;
      }

      const r = stmtConsulta.run(historiaId, fecha || new Date().toISOString().split('T')[0], motivo || 'Consulta importada', null);
      const consultaId = Number(r.lastInsertRowid);
      ultimaConsultaByHistoriaId.set(historiaId, consultaId);
      return consultaId;
    }

    if (histSheet) {
      for (let i = 0; i < histSheet.length; i++) {
        try {
          const row = histSheet[i];
          const mapped = {};
          for (const [header, dbField] of Object.entries(autoMapColumns(Object.keys(row), 'historias_clinicas'))) {
            if (row[header] !== undefined && row[header] !== '') mapped[dbField] = row[header];
          }

          const missing = HISTORIA_CLINICA_REQUIRED.filter(f => !mapped[f]);
          if (missing.length > 0) throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);

          const transformed = applyTransforms(mapped, HISTORIA_CLINICA_TRANSFORMS);
          const nombreData = transformed.paciente_nombre;
          const apellidoP = nombreData.apellido_paterno || '';
          const nombres = nombreData.nombres || '';
          const docInfo = transformed.documento_raw || { tipo: 'dni', numero: null };
          const dni = docInfo.numero || null;
          const tipoDoc = docInfo.tipo || 'dni';
          const hclx = String(mapped.numero_historia || '').trim();
          const telefono = transformed.telefono || null;
          const fechaNac = transformed.fecha_nacimiento || null;
          const alergias = mapped.alergias || null;
          const antecedentes = mapped.antecedentes || null;

          if (!dni && !apellidoP) throw new Error(`Falta nombre o documento del paciente`);

          const result = findOrCreatePaciente(apellidoP, nombres, dni, tipoDoc, telefono, fechaNac, 'historia_clinica');
          if (!result) throw new Error(`No se pudo crear/encontrar paciente: ${apellidoP} ${nombres}`);

          const paciente = { id: result.id };
          if (result.existing) resultados.pacientes.duplicados++;

          pacienteById.set(paciente.id, paciente);
          if (hclx) {
            pacienteByHclx.set(hclx, paciente);
          }

          let historia = findHistoriaByPaciente.get(paciente.id);
          if (!historia) {
            const rHistoria = stmtHistoria.run(paciente.id, hclx || null, alergias, antecedentes);
            historia = { id: Number(rHistoria.lastInsertRowid) };
          } else {
            if (alergias || antecedentes) {
              try { db.prepare('UPDATE historias_clinicas SET alergia_medicamentos = COALESCE(?, alergia_medicamentos), otras_enfermedades = COALESCE(?, otras_enfermedades) WHERE id = ?').run(alergias, antecedentes, historia.id); } catch (e) {}
            }
            resultados.consultas.duplicados++;
          }
          historiaByPacienteId.set(paciente.id, historia);

          const fecha = transformed.fecha || new Date().toISOString().split('T')[0];
          const hoy = new Date().toISOString().split('T')[0];
          if (fecha > hoy) {
            resultados.consultas.fallidos++;
            resultados.consultas.errores.push({ fila: i + 2, error: `Fecha futura ignorada: ${fecha}` });
          } else {
            const rConsulta = stmtConsulta.run(historia.id, fecha, 'Historia clinica importada', null);
            const consultaId = Number(rConsulta.lastInsertRowid);
            ultimaConsultaByHistoriaId.set(historia.id, consultaId);

            const getVal = (keys) => { for (const k of keys) { if (row[k] !== undefined && row[k] !== '') return row[k]; } return null; };
            const cariados = getVal(['CARIADOS', 'cariados']);
            const curados = getVal(['CURADOS', 'curados']);
            const porExtraer = getVal(['POR EXTRAER', 'por_extraer']);
            const endodoncia = getVal(['ENDODONCIA', 'endodoncia']);
            const orto = getVal(['ORTO', 'ortodoncia']);
            const protesis = getVal(['PROTESIS', 'protesis']);
            const extraidos = getVal(['EXTRAIDOS', 'extraidos']);
            const destartraje = getVal(['DESTARTRAJE', 'destartraje']);

            if (cariados || curados || porExtraer || endodoncia || orto || protesis || extraidos || destartraje) {
              try {
                stmtNecesidades.run(consultaId, cariados ? String(cariados) : null, curados ? String(curados) : null, porExtraer ? String(porExtraer) : null, endodoncia ? String(endodoncia) : null, orto ? String(orto) : null, protesis ? String(protesis) : null, extraidos ? String(extraidos) : null, destartraje ? String(destartraje) : null);
                resultados.necesidades.exitosos++;
              } catch (e) {
                resultados.necesidades.fallidos++;
                resultados.necesidades.errores.push({ fila: i + 2, error: e.message });
              }
            }
          }
        } catch (err) {
          resultados.pacientes.fallidos++;
          resultados.pacientes.errores.push({ fila: i + 2, error: err.message });
        }
      }
    }

    if (antSheet) {
      for (let i = 0; i < antSheet.length; i++) {
        try {
          const row = antSheet[i];
          const mapped = {};
          for (const [header, dbField] of Object.entries(autoMapColumns(Object.keys(row), 'antecedentes'))) {
            if (row[header] !== undefined && row[header] !== '') mapped[dbField] = row[header];
          }

          let paciente = null;
          const hclx = resolveHclx(row);

          if (hclx) {
            const hist = findHistoriaByHclx.get(hclx);
            if (hist) paciente = findPatientById.get(hist.paciente_id);
            if (!paciente) {
              const byHclx = pacienteByHclx.get(hclx);
              if (byHclx) paciente = byHclx;
            }
          }

          if (!paciente && mapped.paciente_nombre) {
            const clean = cleanName(mapped.paciente_nombre);
            const parts = clean.split(/\s+/);
            const apellido = parts[0] || '';
            const nombresArr = parts.slice(1).join(' ');
            const result = findOrCreatePaciente(apellido, nombresArr, null, 'sin_doc', null, null, 'antecedentes');
            if (result) paciente = { id: result.id };
          }

          if (!paciente) throw new Error(`Paciente no encontrado (N°HCLX: ${hclx || 'N/A'}, Nombre: ${mapped.paciente_nombre || 'N/A'})`);

          pacienteById.set(paciente.id, paciente);

          const historia = ensureHistoria(paciente.id, hclx);
          const consultaId = ensureConsulta(historia.id, 'Consulta desde antecedentes', new Date().toISOString().split('T')[0]);

          const diagnostico = mapped.diagnostico_lista || '';
          const tratamiento = mapped.tratamiento || '';
          const planTrabajo = mapped.plan_trabajo || '';
          const costoTotal = mapped.costo_total || 0;

          const notasParts = [];
          if (diagnostico) notasParts.push(`Diagnostico: ${diagnostico}`);
          if (planTrabajo) notasParts.push(`Plan: ${planTrabajo}`);
          const notas = notasParts.join(' | ');

          stmtTratamiento.run(paciente.id, consultaId, new Date().toISOString().split('T')[0], tratamiento, notas, costoTotal, 0, costoTotal);
          resultados.tratamientos.exitosos++;
        } catch (err) {
          resultados.tratamientos.fallidos++;
          resultados.tratamientos.errores.push({ fila: i + 2, error: err.message });
        }
      }
    }

    if (saldoSheet) {
      for (let i = 0; i < saldoSheet.length; i++) {
        try {
          const row = saldoSheet[i];
          const mapped = {};
          for (const [header, dbField] of Object.entries(autoMapColumns(Object.keys(row), 'saldos'))) {
            if (row[header] !== undefined && row[header] !== '') mapped[dbField] = row[header];
          }

          const missing = SALDO_REQUIRED.filter(f => !mapped[f]);
          if (missing.length > 0) throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);

          let paciente = null;
          const hclx = resolveHclx(row);

          if (hclx) {
            const hist = findHistoriaByHclx.get(hclx);
            if (hist) paciente = findPatientById.get(hist.paciente_id);
            if (!paciente) {
              const byHclx = pacienteByHclx.get(hclx);
              if (byHclx) paciente = byHclx;
            }
          }

          if (!paciente && mapped.paciente_nombre) {
            const clean = cleanName(mapped.paciente_nombre);
            const parts = clean.split(/\s+/);
            const apellido = parts[0] || '';
            const nombresArr = parts.slice(1).join(' ');
            const result = findOrCreatePaciente(apellido, nombresArr, null, 'sin_doc', null, null, 'saldos');
            if (result) paciente = { id: result.id };
          }

          if (!paciente) throw new Error(`Paciente no encontrado (N°HCLX: ${hclx || 'N/A'}, Nombre: ${mapped.paciente_nombre || 'N/A'})`);

          const historia = ensureHistoria(paciente.id, hclx);
          const consultaId = ultimaConsultaByHistoriaId.get(historia.id) || null;

          const transformed = applyTransforms(mapped, SALDO_TRANSFORMS);
          const total = transformed.total || 0;
          const aCuenta = transformed.a_cuenta || 0;
          const saldo = transformed.saldo || (total - aCuenta);
          const fechaPago = transformed.fecha || new Date().toISOString().split('T')[0];
          const hoy = new Date().toISOString().split('T')[0];
          if (fechaPago > hoy) {
            resultados.pagos.fallidos++;
            resultados.pagos.errores.push({ fila: i + 2, error: `Fecha futura ignorada: ${fechaPago}` });
          } else {
            stmtPago.run(paciente.id, consultaId, fechaPago, transformed.procedimiento || '', total, aCuenta, saldo, 'efectivo');
            resultados.pagos.exitosos++;
          }
        } catch (err) {
          resultados.pagos.fallidos++;
          resultados.pagos.errores.push({ fila: i + 2, error: err.message });
        }
      }
    }

    try {
      db.prepare('INSERT INTO importaciones_historial (archivo_nombre, archivo_hash, pacientes_creados, pacientes_duplicados, consultas_creadas, tratamientos_creados, pagos_creados, total_errores) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        req.file.originalname || 'desconocido',
        fileHash,
        resultados.pacientes.exitosos,
        resultados.pacientes.duplicados,
        resultados.consultas.exitosos,
        resultados.tratamientos.exitosos,
        resultados.pagos.exitosos,
        resultados.pacientes.fallidos + resultados.tratamientos.fallidos + resultados.pagos.fallidos
      );
    } catch (e) { /* ignore */ }

    res.json(resultados);
  } catch (err) {
    res.status(500).json({ error: 'Error al importar: ' + err.message });
  }
};

exports.devReset = (req, res) => {
  if (req.body.confirmation !== 'BORRAR TODO') {
    return res.status(400).json({ error: 'Confirmacion incorrecta' });
  }
  try {
    const tables = [
      'whatsapp_cola', 'whatsapp_batch', 'whatsapp_log', 'whatsapp_plantillas', 'whatsapp_config',
      'importaciones_historial', 'imagenes', 'recetas', 'necesidades_odontologicas',
      'pagos', 'tratamientos', 'odontogramas', 'consultas', 'historias_clinicas',
      'pacientes'
    ];
    for (const table of tables) {
      try { db.prepare(`DELETE FROM ${table}`).run(); } catch (e) {}
    }
    try { db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('" + tables.join("','") + "')").run(); } catch (e) {}

    const bcrypt = require('bcryptjs');
    const insertUsuario = db.prepare('INSERT OR IGNORE INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)');
    insertUsuario.run('Admin', 'admin', bcrypt.hashSync('admin', 10), 'admin');
    insertUsuario.run('Dr. Carlos Alonso', 'doctor', bcrypt.hashSync('doctor', 10), 'odontologo');

    res.json({ mensaje: 'Base de datos reiniciada correctamente. Credenciales: admin/admin, doctor/doctor' });
  } catch (err) {
    res.status(500).json({ error: 'Error al reiniciar: ' + err.message });
  }
};
