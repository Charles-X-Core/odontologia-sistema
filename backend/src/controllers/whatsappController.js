const db = require('../database');
const path = require('path');
const fs = require('fs');
const openWaClient = require('../services/whatsapp/openWaClient');

// ============================================
// HELPERS
// ============================================
function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

function getConfig(clave, valorDefault) {
  const row = db.prepare('SELECT valor FROM whatsapp_config WHERE clave = ?').get(clave);
  return row ? row.valor : valorDefault;
}

function getConfigAll() {
  const rows = db.prepare('SELECT clave, valor, descripcion FROM whatsapp_config').all();
  const config = {};
  for (const r of rows) config[r.clave] = r.valor;
  return config;
}

function registrarEnvio(pacienteId, telefono, tipo, mensaje, estado, batchId, programado, messageId) {
  let msgId = '';
  if (messageId) {
    if (typeof messageId === 'string') msgId = messageId;
    else if (messageId._serialized) msgId = messageId._serialized;
    else if (messageId.id) msgId = messageId.id;
    else msgId = String(messageId);
  }
  const result = db.prepare(
    'INSERT INTO whatsapp_log (paciente_id, telefono, tipo, mensaje, estado, batch_id, programado, message_id, delivery_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(pacienteId, telefono, tipo, mensaje, estado, batchId || null, programado ? 1 : 0, msgId, 'enviado');
  return result.lastInsertRowid;
}

function actualizarDeliveryStatus(messageId, deliveryStatus) {
  if (!messageId) return;
  db.prepare('UPDATE whatsapp_log SET delivery_status = ? WHERE message_id = ?').run(deliveryStatus, messageId);
}

function getTelefonoFormateado(paciente) {
  if (!paciente.telefono) return null;
  const phone = paciente.telefono.replace(/[^0-9]/g, '');
  return phone.startsWith('51') ? phone : `51${phone}`;
}

function saludo() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos dias';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ============================================
// PLANTILLAS DEL SISTEMA (generacion de mensajes)
// ============================================
const PLANTILLAS = {
  receta: (p, data) => {
    const receta = data?.receta || db.prepare('SELECT * FROM recetas WHERE paciente_id = ? ORDER BY created_at DESC LIMIT 1').get(p.id);
    if (!receta) return null;
    const meds = typeof receta.medicamentos === 'string' ? JSON.parse(receta.medicamentos) : receta.medicamentos;
    const medsText = meds.map(m => `  *${m.nombre}* ${m.dosis}\n    Frecuencia: ${m.frecuencia}\n    Duracion: ${m.duracion}`).join('\n\n');
    return `${saludo()} ${nombreCompleto(p)}, le comparto su receta medica:\n\n*Receta Medica*\nFecha: ${new Date(receta.created_at || Date.now()).toLocaleDateString('es-PE')}\n\n${medsText}\n\n${receta.indicaciones ? `*Indicaciones:* ${receta.indicaciones}\n\n` : ''}Si tiene alguna duda, no dude en comunicarse.\n_Clinica Dental Pro - Clinica Odontologica_`;
  },

  plan: (p, data) => {
    const tratamientos = data?.tratamientos || db.prepare('SELECT * FROM tratamientos WHERE paciente_id = ? ORDER BY fecha DESC').all(p.id);
    if (tratamientos.length === 0) return null;
    const trats = tratamientos.map(t => {
      const icon = t.estado === 'realizado' ? '✅' : '⏳';
      return `${icon} *${t.procedimiento_realizado}*\n   Pza: ${t.pieza_dental || 'N/A'} | Costo: S/ ${(t.costo_total || 0).toFixed(2)}`;
    }).join('\n\n');
    const total = tratamientos.reduce((s, t) => s + (t.costo_total || 0), 0);
    const saldo = tratamientos.reduce((s, t) => s + (t.saldo_pendiente || 0), 0);
    return `${saludo()} ${nombreCompleto(p)}, este es su plan de tratamiento:\n\n${trats}\n\n*Total:* S/ ${total.toFixed(2)}\n*Saldo pendiente:* S/ ${saldo.toFixed(2)}\n\nPara agendar su proxima cita, responda este mensaje.\n_Clinica Dental Pro - Clinica Odontologica_`;
  },

  recordatorio_pago: (p, data) => {
    const saldo = data?.saldo ?? db.prepare('SELECT COALESCE(SUM(saldo), 0) as total FROM pagos WHERE paciente_id = ?').get(p.id)?.total ?? 0;
    return `${saludo()} ${nombreCompleto(p)}, le recordamos que tiene un saldo pendiente de *S/ ${saldo.toFixed(2)}*.\n\nPuede realizar su pago en clinica o comunicarse para coordinar una fecha.\n\n_Clinica Dental Pro - Clinica Odontologica_`;
  },

  proxima_cita: (p, data) => {
    const c = data?.consulta || db.prepare("SELECT * FROM consultas WHERE historia_id = (SELECT id FROM historias_clinicas WHERE paciente_id = ?) ORDER BY fecha DESC LIMIT 1").get(p.id);
    return `${saludo()} ${nombreCompleto(p)}, le recordamos su proxima cita:\n\n📅 *Fecha:* ${c?.fecha || 'Por confirmar'}\n🕐 *Hora:* ${c?.hora || 'Por confirmar'}\n🦷 *Procedimiento:* ${c?.motivo || 'Revision general'}\n\nSi necesita reprogramar, comuniquese con nosotros.\n_Clinica Dental Pro - Clinica Odontologica_`;
  },

  bienvenida: (p) => {
    return `Hola ${nombreCompleto(p)}, bienvenido(a) a *Clinica Dental Pro - Clinica Odontologica* 🦷\n\nNos complace tenerlo como paciente. Si tiene alguna consulta o desea agendar una cita, no dude en escribirnos.\n\nTelefono: 982-890-328\n_Clinica Dental Pro - Clinica Odontologica_`;
  },

  seguimiento: (p, data) => {
    const c = data?.consulta || db.prepare("SELECT * FROM consultas WHERE historia_id = (SELECT id FROM historias_clinicas WHERE paciente_id = ?) ORDER BY fecha DESC LIMIT 1").get(p.id);
    return `${saludo()} ${nombreCompleto(p)}, esperamos que se encuentre bien despues de su tratamiento.\n\nComo se siente? Tiene alguna molestia?\n\nSi tiene alguna consulta, estamos para servirle.\n_Clinica Dental Pro - Clinica Odontologica_`;
  },

  confirmacion_cita: (p, data) => {
    const c = data?.consulta || db.prepare("SELECT * FROM consultas WHERE historia_id = (SELECT id FROM historias_clinicas WHERE paciente_id = ?) ORDER BY fecha DESC LIMIT 1").get(p.id);
    return `${saludo()} ${nombreCompleto(p)}, tiene una cita programada para:\n\n📅 *Fecha:* ${c?.fecha || 'Por confirmar'}\n🕐 *Hora:* ${c?.hora || 'Por confirmar'}\n\nPor favor confirme su asistencia respondiendo SI o NO.\n_Clinica Dental Pro - Clinica Odontologica_`;
  },

  cumpleanos: (p) => {
    return `Feliz cumpleanos ${nombreCompleto(p)}! 🎂🎉\n\nDe parte de todo el equipo de *Clinica Dental Pro - Clinica Odontologica* le deseamos lo mejor en este dia tan especial.\n\nTelefono: 982-890-328\n_Clinica Dental Pro - Clinica Odontologica_`;
  },

  higiene: (p, data) => {
    const meses = data?.meses || 6;
    return `${saludo()} ${nombreCompleto(p)}, ya han pasado ${meses} meses desde su ultima limpieza dental.\n\nEs recomendable realizarse una limpieza cada 6 meses para mantener su salud bucal.\n\nAgende su cita: 982-890-328\n_Clinica Dental Pro - Clinica Odontologica_`;
  },

  credito: (p, data) => {
    const credito = data?.credito ?? 0;
    return `${saludo()} ${nombreCompleto(p)}, le informamos que cuenta con un saldo a favor de:\n\n*S/ ${credito.toFixed(2)}*\n\nEste credito puede ser utilizado en su proximo tratamiento.\n\n_Clinica Dental Pro - Clinica Odontologica_`;
  },

  custom: (p, mensaje) => {
    return `${saludo()} ${nombreCompleto(p)}, ${mensaje}`;
  },
};

// ============================================
// SUGERENCIAS INTELIGENTES (CONTEXTO CLINICO REAL)
// ============================================
exports.sugerencias = (req, res) => {
  try {
    const pacienteId = req.params.paciente_id;
    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(pacienteId);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const sugerencias = [];
    const historia = db.prepare('SELECT id FROM historias_clinicas WHERE paciente_id = ?').get(pacienteId);

    // 1. SALDO PENDIENTE (prioridad alta - mas especifico)
    const pagosPendientes = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(saldo), 0) as total FROM pagos WHERE paciente_id = ? AND saldo > 0").get(pacienteId);
    if (pagosPendientes.total > 0) {
      sugerencias.push({
        tipo: 'recordatorio_pago',
        razon: `S/${pagosPendientes.total.toFixed(2)} pendiente en ${pagosPendientes.count} pago(s)`,
        prioridad: 'alta',
        icono: '💰',
        data: { saldo: pagosPendientes.total, count: pagosPendientes.count }
      });
    }

    // 2. TRATAMIENTOS EN PROCESO (seguimiento real)
    if (historia) {
      const enProceso = db.prepare("SELECT COUNT(*) as count FROM tratamientos WHERE paciente_id = ? AND estado = 'en_proceso'").get(pacienteId);
      if (enProceso.count > 0) {
        sugerencias.push({
          tipo: 'seguimiento',
          razon: `${enProceso.count} tratamiento(s) en proceso - requiere seguimiento`,
          prioridad: 'alta',
          icono: '🩺',
          data: { en_proceso: enProceso.count }
        });
      }

      // 3. ULTIMA CONSULTA RECIENTE (0-3 dias) - confirmar proxima cita
      const ultimaConsulta = db.prepare('SELECT * FROM consultas WHERE historia_id = ? ORDER BY fecha DESC LIMIT 1').get(historia.id);
      if (ultimaConsulta) {
        const diasDesde = Math.floor((Date.now() - new Date(ultimaConsulta.fecha).getTime()) / 86400000);
        if (diasDesde >= 0 && diasDesde <= 3) {
          // Verificar si ya se le envio mensaje de seguimiento
          const yaSeguimiento = db.prepare("SELECT COUNT(*) as count FROM whatsapp_log WHERE paciente_id = ? AND tipo = 'seguimiento' AND DATE(created_at) >= DATE(ultimaConsulta.fecha)").get(pacienteId);
          if (yaSeguimiento.count === 0) {
            sugerencias.push({
              tipo: 'seguimiento',
              razon: `Consulta hace ${diasDesde} dia(s) - confirmar bienvenida`,
              prioridad: 'media',
              icono: '📋',
              data: { consulta_fecha: ultimaConsulta.fecha, motivo: ultimaConsulta.motivo }
            });
          }
        }
      }

      // 4. RECETA SIN ENVIAR (la ultima consulta tiene receta pero no se envio por WhatsApp)
      if (ultimaConsulta) {
        const recetaUltima = db.prepare("SELECT r.id FROM recetas r WHERE r.consulta_id = ? ORDER BY r.id DESC LIMIT 1").get(ultimaConsulta.id);
        if (recetaUltima) {
          const yaEnviada = db.prepare("SELECT COUNT(*) as count FROM whatsapp_log WHERE paciente_id = ? AND tipo = 'receta' AND id > 0").get(pacienteId);
          const recetaYaEnviada = db.prepare("SELECT COUNT(*) as count FROM whatsapp_log WHERE paciente_id = ? AND mensaje LIKE '%receta%' AND DATE(created_at) >= DATE(?)").get(pacienteId, ultimaConsulta.fecha);
          if (recetaYaEnviada.count === 0) {
            sugerencias.push({
              tipo: 'receta',
              razon: `Receta de la consulta del ${new Date(ultimaConsulta.fecha).toLocaleDateString('es-PE')} sin enviar`,
              prioridad: 'media',
              icono: '💊',
              data: { receta_id: recetaUltima.id, consulta_fecha: ultimaConsulta.fecha }
            });
          }
        }
      }
    }

    // 5. TRATAMIENTOS PENDIENTES (no iniciados)
    const pendientes = db.prepare("SELECT COUNT(*) as count FROM tratamientos WHERE paciente_id = ? AND estado = 'planificado'").get(pacienteId);
    if (pendientes.count > 0) {
      sugerencias.push({
        tipo: 'plan',
        razon: `${pendientes.count} tratamiento(s) sin iniciar`,
        prioridad: 'media',
        icono: '🦷',
        data: { pendientes: pendientes.count }
      });
    }

    // 6. CUMPLEANOS
    if (paciente.fecha_nacimiento) {
      const fn = new Date(paciente.fecha_nacimiento);
      const mesActual = new Date().getMonth();
      const diaActual = new Date().getDate();
      if (fn.getMonth() === mesActual) {
        const diasParaCumple = fn.getDate() - diaActual;
        if (diasParaCumple >= 0 && diasParaCumple <= 7) {
          sugerencias.push({
            tipo: 'cumpleanos',
            razon: diasParaCumple === 0 ? 'Hoy es su cumpleanos!' : `Cumpleanos en ${diasParaCumple} dia(s)`,
            prioridad: 'alta',
            icono: '🎂'
          });
        }
      }
    }

    // 7. SIN CONTACTO (ajustado: 90+ dias)
    const ultimoEnvio = db.prepare('SELECT created_at FROM whatsapp_log WHERE paciente_id = ? ORDER BY created_at DESC LIMIT 1').get(pacienteId);
    if (!ultimoEnvio) {
      if (historia) {
        sugerencias.push({ tipo: 'bienvenida', razon: 'Paciente activo sin mensajes enviados', prioridad: 'baja', icono: '👋' });
      }
    } else {
      const diasSinContacto = Math.floor((Date.now() - new Date(ultimoEnvio.created_at).getTime()) / 86400000);
      if (diasSinContacto >= 90) {
        sugerencias.push({
          tipo: 'bienvenida',
          razon: `Sin contacto en ${diasSinContacto} dias`,
          prioridad: 'baja',
          icono: '👋',
          data: { meses: Math.floor(diasSinContacto / 30) }
        });
      }
    }

    // 8. SALDO A FAVOR
    const totalPagado = db.prepare('SELECT COALESCE(SUM(a_cuenta), 0) as pagado FROM pagos WHERE paciente_id = ?').get(pacienteId);
    const totalTratamientos = db.prepare('SELECT COALESCE(SUM(costo_total), 0) as total FROM tratamientos WHERE paciente_id = ?').get(pacienteId);
    const diferencia = (totalPagado.pagado || 0) - (totalTratamientos.total || 0);
    if (diferencia > 0) {
      sugerencias.push({
        tipo: 'credito',
        razon: `Tiene S/${diferencia.toFixed(2)} a favor`,
        prioridad: 'baja',
        icono: '💵',
        data: { credito: diferencia }
      });
    }

    // Ordenar por prioridad
    const prioridad = { alta: 0, media: 1, baja: 2 };
    sugerencias.sort((a, b) => prioridad[a.prioridad] - prioridad[b.prioridad]);

    res.json({
      paciente: { id: paciente.id, nombre: nombreCompleto(paciente), telefono: paciente.telefono },
      sugerencias,
      total: sugerencias.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// ANALYTICS
// ============================================
exports.analytics = (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const inicio = fecha_inicio || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const fin = fecha_fin || new Date().toISOString().split('T')[0];

    const metricas = db.prepare(`
      SELECT COUNT(*) as total_enviados,
        SUM(CASE WHEN estado = 'enviado' THEN 1 ELSE 0 END) as exitosos,
        SUM(CASE WHEN estado = 'fallido' THEN 1 ELSE 0 END) as fallidos,
        COUNT(DISTINCT paciente_id) as pacientes_contactados
      FROM whatsapp_log WHERE DATE(created_at) BETWEEN ? AND ?
    `).get(inicio, fin);

    const porTipo = db.prepare(`
      SELECT tipo, COUNT(*) as cantidad,
        SUM(CASE WHEN estado = 'enviado' THEN 1 ELSE 0 END) as exitosos
      FROM whatsapp_log WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY tipo ORDER BY cantidad DESC
    `).all(inicio, fin);

    const tendencia = db.prepare(`
      SELECT DATE(created_at) as fecha, COUNT(*) as total,
        SUM(CASE WHEN estado = 'enviado' THEN 1 ELSE 0 END) as exitosos
      FROM whatsapp_log WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY DATE(created_at) ORDER BY fecha ASC
    `).all(inicio, fin);

    const topPacientes = db.prepare(`
      SELECT p.id, p.apellido_paterno || ' ' || p.apellido_materno || ' ' || p.nombres as nombre,
        COUNT(wl.id) as mensajes, MAX(wl.created_at) as ultimo_envio
      FROM whatsapp_log wl JOIN pacientes p ON wl.paciente_id = p.id
      WHERE DATE(wl.created_at) BETWEEN ? AND ?
      GROUP BY wl.paciente_id ORDER BY mensajes DESC LIMIT 10
    `).all(inicio, fin);

    const programados = db.prepare("SELECT COUNT(*) as total FROM whatsapp_cola WHERE estado = 'pendiente'").get();
    const tasaExito = metricas.total_enviados > 0 ? ((metricas.exitosos / metricas.total_enviados) * 100).toFixed(1) : '0';

    res.json({
      periodo: { inicio, fin },
      metricas: { ...metricas, tasa_exito: parseFloat(tasaExito) },
      por_tipo: porTipo,
      tendencia,
      top_pacientes: topPacientes,
      programados_pendientes: programados.total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// HISTORIAL POR PACIENTE
// ============================================
exports.historialPaciente = (req, res) => {
  try {
    const pacienteId = req.params.paciente_id;
    const logs = db.prepare(`
      SELECT l.*, p.apellido_paterno, p.apellido_materno, p.nombres
      FROM whatsapp_log l JOIN pacientes p ON p.id = l.paciente_id
      WHERE l.paciente_id = ?
      ORDER BY l.created_at DESC LIMIT 50
    `).all(pacienteId);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// PROGRAMACION DE ENVIOS
// ============================================
exports.programarEnvio = (req, res) => {
  try {
    const { paciente_id, tipo, mensaje, programado_para, mensaje_personalizado } = req.body;
    if (!paciente_id || !programado_para) {
      return res.status(400).json({ error: 'paciente_id y programado_para son obligatorios' });
    }

    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(paciente_id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    let mensajeFinal = mensaje;
    if (!mensajeFinal && tipo) {
      mensajeFinal = generarMensaje(tipo, paciente, {});
    }
    if (!mensajeFinal && mensaje_personalizado) {
      mensajeFinal = PLANTILLAS.custom(paciente, mensaje_personalizado);
    }
    if (!mensajeFinal) return res.status(400).json({ error: 'Mensaje requerido' });

    const resultado = db.prepare(
      'INSERT INTO whatsapp_cola (paciente_id, tipo, mensaje, programado_para) VALUES (?, ?, ?, ?)'
    ).run(paciente_id, tipo || 'custom', mensajeFinal, programado_para);

    // Ejecutar scheduler inmediatamente por si ya paso el tiempo
    setTimeout(() => exports._procesarCola(), 1000);

    res.json({ success: true, id: resultado.lastInsertRowid, message: 'Mensaje programado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cola = (req, res) => {
  try {
    const pendientes = db.prepare(`
      SELECT c.*, p.apellido_paterno, p.apellido_materno, p.nombres, p.telefono
      FROM whatsapp_cola c JOIN pacientes p ON c.paciente_id = p.id
      WHERE c.estado = 'pendiente' ORDER BY c.programado_para ASC
    `).all();
    res.json(pendientes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelarCola = (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("UPDATE whatsapp_cola SET estado = 'cancelado' WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// CRUD PLANTILLAS
// ============================================
exports.listarPlantillas = (req, res) => {
  try {
    const plantillas = db.prepare('SELECT * FROM whatsapp_plantillas WHERE activa = 1 ORDER BY categoria, nombre').all();
    res.json(plantillas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.crearPlantilla = (req, res) => {
  try {
    const { nombre, categoria, asunto, cuerpo } = req.body;
    if (!nombre || !cuerpo) return res.status(400).json({ error: 'nombre y cuerpo son obligatorios' });
    const resultado = db.prepare('INSERT INTO whatsapp_plantillas (nombre, categoria, asunto, cuerpo) VALUES (?, ?, ?, ?)').run(nombre, categoria || 'otro', asunto || '', cuerpo);
    res.json({ success: true, id: resultado.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.editarPlantilla = (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, categoria, asunto, cuerpo, activa } = req.body;
    db.prepare(`
      UPDATE whatsapp_plantillas SET
        nombre = COALESCE(?, nombre),
        categoria = COALESCE(?, categoria),
        asunto = COALESCE(?, asunto),
        cuerpo = COALESCE(?, cuerpo),
        activa = COALESCE(?, activa)
      WHERE id = ?
    `).run(nombre, categoria, asunto, cuerpo, activa, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.eliminarPlantilla = (req, res) => {
  try {
    db.prepare('UPDATE whatsapp_plantillas SET activa = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// BATCH: Filtrar pacientes para envio en lote
// ============================================
exports.filtrarPacientes = (req, res) => {
  try {
    const { saldo_pendiente, sin_cita_reciente, nuevos, con_telefono } = req.query;
    let query = 'SELECT p.* FROM pacientes p WHERE 1=1';
    const params = [];

    if (con_telefono === 'true') {
      query += " AND p.telefono IS NOT NULL AND p.telefono != ''";
    }

    if (saldo_pendiente === 'true') {
      query += ' AND p.id IN (SELECT paciente_id FROM pagos WHERE saldo > 0 GROUP BY paciente_id HAVING SUM(saldo) > 0)';
    }

    if (sin_cita_reciente === 'true') {
      query += " AND p.id NOT IN (SELECT hc.paciente_id FROM historias_clinicas hc JOIN consultas c ON c.historia_id = hc.id WHERE c.fecha >= date('now', '-6 months'))";
    }

    if (nuevos === 'true') {
      query += ' AND p.id NOT IN (SELECT DISTINCT paciente_id FROM whatsapp_log)';
    }

    query += ' ORDER BY p.apellido_paterno, p.apellido_materno, p.nombres';
    const pacientes = db.prepare(query).all(...params);
    res.json(pacientes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// BATCH: Enviar lote
// ============================================
exports.enviarLote = async (req, res) => {
  try {
    const { paciente_ids, tipo, mensaje, mensaje_personalizado } = req.body;
    if (!paciente_ids || !Array.isArray(paciente_ids) || paciente_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de paciente_ids' });
    }

    const status = await openWaClient.getStatus();
    if (!status.connected) return res.status(503).json({ error: 'WhatsApp no conectado' });

    // Crear registro batch
    const batch = db.prepare("INSERT INTO whatsapp_batch (nombre, tipo, total_pacientes, estado) VALUES (?, ?, ?, 'procesando')").run(
      `Lote ${new Date().toLocaleDateString('es-PE')}`, tipo || 'custom', paciente_ids.length
    );
    const batchId = batch.lastInsertRowid;

    const resultados = [];
    let enviados = 0;
    let fallidos = 0;

    for (const pid of paciente_ids) {
      try {
        const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(pid);
        if (!paciente) { resultados.push({ paciente_id: pid, success: false, error: 'No encontrado' }); fallidos++; continue; }

        const phone = getTelefonoFormateado(paciente);
        if (!phone) { resultados.push({ paciente_id: pid, success: false, error: 'Sin telefono' }); fallidos++; continue; }

        let msg = mensaje;
        if (!msg) msg = generarMensaje(tipo || 'custom', paciente, {});
        if (!msg && mensaje_personalizado) msg = PLANTILLAS.custom(paciente, mensaje_personalizado);
        if (!msg) { resultados.push({ paciente_id: pid, success: false, error: 'Sin mensaje' }); fallidos++; continue; }

        const result = await openWaClient.sendText(phone, msg);
        registrarEnvio(pid, phone, tipo || 'lote', msg, 'enviado', batchId, false, result?.id);
        resultados.push({ paciente_id: pid, success: true, to: nombreCompleto(paciente) });
        enviados++;

        if (paciente_ids.indexOf(pid) < paciente_ids.length - 1) {
          const delayMs = parseInt(getConfig('delay_envios', '2000'));
          await new Promise(r => setTimeout(r, delayMs + Math.random() * 1000));
        }
      } catch (err) {
        resultados.push({ paciente_id: pid, success: false, error: err.message });
        fallidos++;
      }
    }

    db.prepare('UPDATE whatsapp_batch SET enviados = ?, fallidos = ?, estado = ? WHERE id = ?').run(enviados, fallidos, 'completado', batchId);

    res.json({ success: true, batch_id: batchId, enviados, fallidos, total: paciente_ids.length, resultados });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// ENVIAR IMAGEN
// ============================================
exports.enviarImagen = async (req, res) => {
  try {
    const { paciente_id, imagen_base64, caption } = req.body;
    if (!paciente_id || !imagen_base64) return res.status(400).json({ error: 'paciente_id e imagen_base64 son obligatorios' });

    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(paciente_id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const phone = getTelefonoFormateado(paciente);
    if (!phone) return res.status(400).json({ error: 'Sin telefono' });

    const status = await openWaClient.getStatus();
    if (!status.connected) return res.status(503).json({ error: 'WhatsApp no conectado' });

    const result = await openWaClient.sendImage(phone, imagen_base64, caption || '');
    registrarEnvio(paciente_id, phone, 'imagen', caption || 'Imagen enviada', 'enviado', null, false, result?.id);

    res.json({ success: true, to: nombreCompleto(paciente) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// GENERAR MENSAJE (helper)
// ============================================
function generarMensaje(tipo, paciente, data) {
  const fn = PLANTILLAS[tipo];
  if (!fn) return null;
  if (['receta', 'plan', 'recordatorio_pago', 'proxima_cita', 'seguimiento', 'confirmacion_cita', 'higiene', 'credito'].includes(tipo)) {
    return fn(paciente, data);
  }
  return fn(paciente, data);
}

// ============================================
// ENVIAR (basico)
// ============================================
exports.enviar = async (req, res) => {
  try {
    const { paciente_id, tipo, mensaje } = req.body;
    if (!paciente_id || !mensaje) return res.status(400).json({ error: 'paciente_id y mensaje son obligatorios' });

    // Anti-bloqueo: verificar limite por hora
    const enviadosHora = contarMensajesUltimaHora();
    if (enviadosHora >= ANTI_BAN_MAX_POR_HORA) {
      return res.status(429).json({ error: `Limite de ${ANTI_BAN_MAX_POR_HORA} mensajes/hora alcanzado. Intente en unos minutos.` });
    }

    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(paciente_id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const phone = getTelefonoFormateado(paciente);
    if (!phone) return res.status(400).json({ error: 'El paciente no tiene telefono registrado' });

    const status = await openWaClient.getStatus();
    if (!status.connected) return res.status(503).json({ error: 'WhatsApp no conectado. Escanea el QR para conectar.' });

    const result = await openWaClient.sendText(phone, mensaje);
    const logId = registrarEnvio(paciente_id, phone, tipo || 'custom', mensaje, 'enviado', null, false, result?.id);

    // Anti-bloqueo: delay post-envio
    await new Promise(r => setTimeout(r, ANTI_BAN_DELAY_MS + Math.floor(Math.random() * 1500)));

    res.json({ success: true, message: 'Mensaje enviado', to: nombreCompleto(paciente), phone, logId });
  } catch (err) {
    if (req.body?.paciente_id) registrarEnvio(req.body.paciente_id, '', req.body.tipo || 'custom', req.body.mensaje || '', 'fallido', null, false);
    res.status(500).json({ error: 'Error al enviar: ' + err.message });
  }
};

// ============================================
// ENVIAR SMART (con template)
// ============================================
exports.enviarSmart = async (req, res) => {
  try {
    const { paciente_id, tipo, mensaje_personalizado, receta_id } = req.body;
    if (!paciente_id) return res.status(400).json({ error: 'paciente_id es obligatorio' });

    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(paciente_id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const phone = getTelefonoFormateado(paciente);
    if (!phone) return res.status(400).json({ error: 'El paciente no tiene telefono registrado' });

    const status = await openWaClient.getStatus();
    if (!status.connected) return res.status(503).json({ error: 'WhatsApp no conectado' });

    let mensaje = '';
    let tipoFinal = tipo || 'custom';

    if (tipo === 'custom') {
      mensaje = mensaje_personalizado || req.body.mensaje;
      if (!mensaje) return res.status(400).json({ error: 'Mensaje personalizado requerido' });
    } else if (tipo === 'cumpleanos') {
      mensaje = PLANTILLAS.cumpleanos(paciente);
    } else {
      const ctx = {};
      if (receta_id) ctx.receta = db.prepare('SELECT * FROM recetas WHERE id = ?').get(receta_id);
      mensaje = generarMensaje(tipo, paciente, ctx);
    }

    if (!mensaje) return res.status(400).json({ error: `No se pudo generar el mensaje para tipo: ${tipo}` });

    const result = await openWaClient.sendText(phone, mensaje);
    const logId = registrarEnvio(paciente_id, phone, tipoFinal, mensaje, 'enviado', null, false, result?.id);

    res.json({ success: true, message: 'Mensaje enviado', to: nombreCompleto(paciente), phone, tipo: tipoFinal, logId });
  } catch (err) {
    if (req.body?.paciente_id) registrarEnvio(req.body.paciente_id, '', req.body.tipo || 'smart', req.body.mensaje || '', 'fallido', null, false);
    res.status(500).json({ error: 'Error al enviar: ' + err.message });
  }
};

// ============================================
// ATAJOS DE ENVIO
// ============================================
exports.enviarReceta = async (req, res) => {
  req.body = { paciente_id: req.body.paciente_id, tipo: 'receta' };
  return exports.enviarSmart(req, res);
};

exports.enviarPlan = async (req, res) => {
  req.body = { paciente_id: req.body.paciente_id, tipo: 'plan' };
  return exports.enviarSmart(req, res);
};

exports.enviarRecordatorioPago = async (req, res) => {
  req.body = { paciente_id: req.body.paciente_id, tipo: 'recordatorio_pago' };
  return exports.enviarSmart(req, res);
};

exports.enviarProximaCita = async (req, res) => {
  req.body = { paciente_id: req.body.paciente_id, tipo: 'proxima_cita' };
  return exports.enviarSmart(req, res);
};

exports.enviarBienvenida = async (req, res) => {
  req.body = { paciente_id: req.body.paciente_id, tipo: 'bienvenida' };
  return exports.enviarSmart(req, res);
};

// ============================================
// ENVIAR PDF COMO DOCUMENTO ADJUNTO
// ============================================
exports.enviarPdf = async (req, res) => {
  try {
    const { paciente_id, tipo, receta_id, caption } = req.body;
    if (!paciente_id) return res.status(400).json({ error: 'paciente_id es obligatorio' });
    if (!tipo) return res.status(400).json({ error: 'tipo es obligatorio (receta, plan, pago, tratamientos)' });

    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(paciente_id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const phone = getTelefonoFormateado(paciente);
    if (!phone) return res.status(400).json({ error: 'El paciente no tiene telefono registrado' });

    const status = await openWaClient.getStatus();
    if (!status.connected) return res.status(503).json({ error: 'WhatsApp no conectado' });

    // Generate HTML based on tipo
    const { generateRecetaHtml } = require('../services/pdfTemplates/recetaHtml');
    const { generatePagoHtml } = require('../services/pdfTemplates/pagoHtml');
    const { generateTratamientosHtml } = require('../services/pdfTemplates/tratamientosHtml');
    const { generateHistoriaHtml } = require('../services/pdfTemplates/historiaHtmlPdf');

    let html = '';
    let filename = '';

    switch (tipo) {
      case 'receta': {
        const receta = receta_id
          ? db.prepare('SELECT * FROM recetas WHERE id = ?').get(receta_id)
          : db.prepare('SELECT * FROM recetas WHERE paciente_id = ? ORDER BY created_at DESC LIMIT 1').get(paciente_id);
        if (!receta) return res.status(404).json({ error: 'Receta no encontrada' });
        const doctor = db.prepare("SELECT nombre, titulo, cmp, firma_imagen FROM usuarios WHERE firma_imagen IS NOT NULL AND firma_imagen != '' LIMIT 1").get();
        html = generateRecetaHtml(paciente, receta, doctor);
        filename = `Receta_${nombreCompleto(paciente).replace(/\s+/g, '_')}.pdf`;
        break;
      }
      case 'pago': {
        const pago = db.prepare('SELECT * FROM pagos WHERE paciente_id = ? ORDER BY created_at DESC LIMIT 1').get(paciente_id);
        if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
        html = generatePagoHtml(paciente, pago);
        filename = `Comprobante_${nombreCompleto(paciente).replace(/\s+/g, '_')}.pdf`;
        break;
      }
      case 'plan':
      case 'tratamientos': {
        const pagos = db.prepare('SELECT * FROM pagos WHERE paciente_id = ? ORDER BY created_at DESC').all(paciente_id);
        const tratamientos = db.prepare('SELECT * FROM tratamientos WHERE paciente_id = ? ORDER BY fecha DESC').all(paciente_id);
        html = generateTratamientosHtml(paciente, tratamientos, []);
        filename = `Plan_${nombreCompleto(paciente).replace(/\s+/g, '_')}.pdf`;
        break;
      }
      case 'historia': {
        const historia = db.prepare('SELECT * FROM historias_clinicas WHERE paciente_id = ? ORDER BY id DESC LIMIT 1').get(paciente_id) || {};
        const consultas = db.prepare('SELECT c.*, o.datos_json as odontograma FROM consultas c LEFT JOIN odontogramas o ON o.consulta_id = c.id WHERE c.historia_id = ? ORDER BY c.fecha DESC').all(historia.id || 0);
        const pagosHistoria = db.prepare('SELECT * FROM pagos WHERE paciente_id = ? ORDER BY fecha DESC').all(paciente_id);
        html = await generateHistoriaHtml(paciente, historia, consultas, pagosHistoria);
        filename = `Historia_${nombreCompleto(paciente).replace(/\s+/g, '_')}.pdf`;
        break;
      }
      default:
        return res.status(400).json({ error: `Tipo '${tipo}' no soportado para envio PDF` });
    }

    // Convert HTML to PDF using puppeteer
    const { htmlToPdf } = require('../services/pdfTemplates/htmlToPdf');
    const pdfBuffer = await htmlToPdf(html);

    // Save PDF to temp file for WhatsApp sending (base64 too large for atob in puppeteer context)
    const fs = require('fs');
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), `wa_pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
    fs.writeFileSync(tmpFile, pdfBuffer);

    // Send as document using file path
    const result = await openWaClient.sendFile(phone, tmpFile, filename, caption || `${tipo} - ${nombreCompleto(paciente)}`);

    // Clean up temp file
    try { fs.unlinkSync(tmpFile); } catch {}

    const logId = registrarEnvio(paciente_id, phone, tipo, caption || `PDF: ${filename}`, 'enviado', null, true, result?.id);

    res.json({ success: true, message: 'PDF enviado', to: nombreCompleto(paciente), phone, tipo, filename, logId });
  } catch (err) {
    console.error('enviarPdf error:', err);
    res.status(500).json({ error: 'Error al enviar PDF: ' + err.message });
  }
};

exports.enviarSeguimiento = async (req, res) => {
  req.body = { paciente_id: req.body.paciente_id, tipo: 'seguimiento' };
  return exports.enviarSmart(req, res);
};

// ============================================
// ESTADO
// ============================================
exports.estado = async (req, res) => {
  try {
    const status = await openWaClient.getStatus();
    const hoy = new Date().toISOString().split('T')[0];
    const enviadosHoy = db.prepare("SELECT COUNT(*) as total FROM whatsapp_log WHERE created_at >= ? AND estado = 'enviado'").get(hoy)?.total || 0;
    res.json({ connected: status.connected, enviadosHoy, info: status.info || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.logout = async (req, res) => {
  try {
    await openWaClient.logout();
    res.json({ success: true, message: 'Sesion de WhatsApp cerrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.restart = async (req, res) => {
  try {
    await openWaClient.restart();
    res.json({ success: true, message: 'WhatsApp reiniciando...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// CONFIGURACION
// ============================================
exports.getConfig = (req, res) => {
  try {
    const rows = db.prepare('SELECT clave, valor, descripcion FROM whatsapp_config ORDER BY id').all();
    const config = {};
    for (const r of rows) config[r.clave] = { valor: r.valor, descripcion: r.descripcion };
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveConfig = (req, res) => {
  try {
    const updates = req.body;
    const stmt = db.prepare('UPDATE whatsapp_config SET valor = ?, datetime("now") = updated_at WHERE clave = ?');
    const upsert = db.prepare('INSERT OR REPLACE INTO whatsapp_config (clave, valor, updated_at) VALUES (?, ?, datetime("now"))');
    for (const [clave, valor] of Object.entries(updates)) {
      upsert.run(clave, String(valor));
    }
    res.json({ success: true, message: 'Configuracion guardada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Iniciar scheduler - usar intervalo de config
console.log('[WhatsApp Scheduler] Iniciando scheduler de mensajes programados...');
let schedulerIntervalMs = parseInt(getConfig('scheduler_interval', '60')) * 1000;
let schedulerTimer = setInterval(() => {
  console.log('[WhatsApp Scheduler] Verificando cola...');
  exports._procesarCola();
  // Re-read interval from config every cycle
  const newInterval = parseInt(getConfig('scheduler_interval', '60')) * 1000;
  if (newInterval !== schedulerIntervalMs) {
    schedulerIntervalMs = newInterval;
    clearInterval(schedulerTimer);
    schedulerTimer = setInterval(() => {
      console.log('[WhatsApp Scheduler] Verificando cola...');
      exports._procesarCola();
    }, schedulerIntervalMs);
    console.log(`[WhatsApp Scheduler] Intervalo actualizado a ${schedulerIntervalMs/1000}s`);
  }
}, schedulerIntervalMs);

// ============================================
// HISTORIAL GLOBAL
// ============================================
exports.historial = (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT l.*, p.apellido_paterno, p.apellido_materno, p.nombres
      FROM whatsapp_log l JOIN pacientes p ON p.id = l.paciente_id
      ORDER BY l.created_at DESC LIMIT 200
    `).all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// PREVIEW
// ============================================
exports.preview = (req, res) => {
  try {
    const { paciente_id, tipo, receta_id } = req.body;
    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(paciente_id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    let mensaje = '';
    if (tipo === 'cumpleanos') {
      mensaje = PLANTILLAS.cumpleanos(paciente);
    } else if (tipo === 'custom') {
      mensaje = '';
    } else {
      const ctx = {};
      if (receta_id) ctx.receta = db.prepare('SELECT * FROM recetas WHERE id = ?').get(receta_id);
      mensaje = generarMensaje(tipo, paciente, ctx);
    }

    res.json({ paciente: nombreCompleto(paciente), telefono: paciente.telefono, mensaje: mensaje || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// PLANTILLAS (metadata para frontend)
// ============================================
exports.plantillas = (req, res) => {
  res.json({
    tipos: [
      { id: 'receta', nombre: 'Receta Medica', icon: '💊', description: 'Receta mas reciente del paciente' },
      { id: 'plan', nombre: 'Plan de Tratamiento', icon: '🦷', description: 'Lista de tratamientos con costos' },
      { id: 'recordatorio_pago', nombre: 'Recordatorio de Pago', icon: '💰', description: 'Saldo pendiente' },
      { id: 'proxima_cita', nombre: 'Proxima Cita', icon: '📅', description: 'Recordatorio de cita' },
      { id: 'bienvenida', nombre: 'Bienvenida', icon: '👋', description: 'Nuevo paciente' },
      { id: 'seguimiento', nombre: 'Seguimiento', icon: '🩺', description: 'Post-tratamiento' },
      { id: 'confirmacion_cita', nombre: 'Confirmar Cita', icon: '✅', description: 'Confirmar asistencia' },
      { id: 'cumpleanos', nombre: 'Cumpleanos', icon: '🎂', description: 'Felicitacion' },
      { id: 'higiene', nombre: 'Limpieza', icon: '✨', description: 'Recordatorio de limpieza' },
      { id: 'credito', nombre: 'Saldo a Favor', icon: '💵', description: 'Credito del paciente' },
      { id: 'custom', nombre: 'Personalizado', icon: '✉️', description: 'Mensaje libre' },
    ],
  });
};

// ============================================
// SCHEDULER: Procesar cola cada 60 segundos
// Anti-bloqueo: max 20 mensajes/hora + delay 2-3s entre mensajes
// ============================================
const ANTI_BAN_MAX_POR_HORA = 20;
const ANTI_BAN_DELAY_MS = 2000;

function contarMensajesUltimaHora() {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as total FROM whatsapp_envios
      WHERE estado = 'enviado' AND fecha > datetime('now', '-1 hour')
    `).get();
    return row?.total || 0;
  } catch { return 0; }
}

exports._procesarCola = async () => {
  try {
    const maxRetries = parseInt(getConfig('max_reintentos', '3'));
    const pendientes = db.prepare(`
      SELECT c.*, p.telefono
      FROM whatsapp_cola c JOIN pacientes p ON c.paciente_id = p.id
      WHERE c.estado = 'pendiente' AND c.intentos < ?
    `).all(maxRetries);

    if (pendientes.length === 0) return;

    const now = new Date();
    const enviadosHora = contarMensajesUltimaHora();
    const restante = Math.max(0, ANTI_BAN_MAX_POR_HORA - enviadosHora);

    if (restante === 0) {
      console.log(`[Scheduler] Anti-bloqueo: ${enviadosHora} mensajes en la ultima hora. Saltando.`);
      return;
    }

    const aProcesar = pendientes.slice(0, restante);
    console.log(`[Scheduler] Procesando ${aProcesar.length} mensajes (${enviadosHora}/${ANTI_BAN_MAX_POR_HORA} esta hora)...`);

    for (const msg of aProcesar) {
      try {
        const fechaProgramada = new Date(msg.programado_para);

        if (fechaProgramada > now) {
          continue;
        }

        const phone = getTelefonoFormateado(msg);
        if (!phone) throw new Error('Sin telefono');

        const status = await openWaClient.getStatus();
        if (!status.connected) throw new Error('WhatsApp no conectado');

        const result = await openWaClient.sendText(phone, msg.mensaje);
        db.prepare("UPDATE whatsapp_cola SET estado = 'enviado' WHERE id = ?").run(msg.id);
        registrarEnvio(msg.paciente_id, phone, msg.tipo, msg.mensaje, 'enviado', null, true, result?.id);
        console.log(`[Scheduler] Msg #${msg.id}: ENVIADO a ${phone}`);

        // Anti-bloqueo: delay entre mensajes
        const delay = ANTI_BAN_DELAY_MS + Math.floor(Math.random() * 1500);
        await new Promise(r => setTimeout(r, delay));
      } catch (error) {
        console.error(`[Scheduler] Msg #${msg.id}: ERROR - ${error.message}`);
        db.prepare('UPDATE whatsapp_cola SET intentos = intentos + 1, error = ? WHERE id = ?').run(error.message, msg.id);
        if (msg.intentos + 1 >= maxRetries) {
          db.prepare("UPDATE whatsapp_cola SET estado = 'fallido' WHERE id = ?").run(msg.id);
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error general:', err.message);
  }
};

// ============================================
// ACK: Actualizar estado de entrega/lectura
// ============================================
exports.ack = (req, res) => {
  try {
    const { messageId, ack } = req.body;
    if (!messageId) return res.status(400).json({ error: 'messageId requerido' });

    // ack: 0=pending, 1=sent, 2=delivered, 3=read, 4=played
    const statusMap = { 0: 'pendiente', 1: 'enviado', 2: 'entregado', 3: 'leido', 4: 'leido' };
    const deliveryStatus = statusMap[ack] || 'enviado';

    db.prepare('UPDATE whatsapp_log SET delivery_status = ? WHERE message_id = ?').run(deliveryStatus, messageId);

    res.json({ success: true, deliveryStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// STATUS: Obtener estado de entrega de un mensaje
// ============================================
exports.deliveryStatus = (req, res) => {
  try {
    const { logId } = req.params;
    const log = db.prepare('SELECT delivery_status, message_id FROM whatsapp_log WHERE id = ?').get(logId);
    if (!log) return res.status(404).json({ error: 'Mensaje no encontrado' });
    res.json({ delivery_status: log.delivery_status, message_id: log.message_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================
// INGEST: Recibir imagenes entrantes de WhatsApp
// ============================================
exports.ingestImage = (req, res) => {
  try {
    const { phone, base64, filename, mimetype, caption, timestamp, fromMe, chatId } = req.body;

    if (!phone || !base64) {
      return res.status(400).json({ error: 'phone y base64 requeridos' });
    }

    // No procesar mensajes propios
    if (fromMe) {
      return res.json({ success: true, skipped: true, reason: 'fromMe' });
    }

    // Normalizar telefono peruano
    let phoneNorm = phone.replace(/[^0-9]/g, '');
    if (!phoneNorm.startsWith('51')) phoneNorm = '51' + phoneNorm.slice(-9);

    // Buscar paciente por telefono
    const paciente = db.prepare(
      "SELECT id, dni, nombres, apellido_paterno, apellido_materno FROM pacientes WHERE REPLACE(REPLACE(telefono, ' ', ''), '-', '') LIKE ? OR telefono LIKE ?"
    ).get(`%${phoneNorm.slice(-9)}%`, `%${phoneNorm}%`);

    if (!paciente) {
      console.log('[WHATSAPP-INGEST] Paciente no encontrado para telefono:', phoneNorm);
      return res.json({ success: true, skipped: true, reason: 'no_patient', phone: phoneNorm });
    }

    // Decodificar base64
    const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Guardar imagen
    const BASE_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
    const secStr = String(now.getSeconds()).padStart(2, '0');
    const msStr = String(now.getMilliseconds()).padStart(3, '0');
    const ext = mimetype === 'image/png' ? '.png' : '.jpg';
    const readableName = `${dateStr}_${timeStr}-${secStr}-${msStr}_whatsapp${ext}`;

    const pacienteDir = path.join(BASE_DIR, 'evidencias', String(paciente.id));
    if (!fs.existsSync(pacienteDir)) fs.mkdirSync(pacienteDir, { recursive: true });
    const finalPath = path.join(pacienteDir, readableName);

    fs.writeFileSync(finalPath, buffer);

    // Calcular hash
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Guardar en base de datos
    const archivoNombre = `evidencias/${paciente.id}/${readableName}`;
    const result = db.prepare(
      'INSERT INTO imagenes (paciente_id, archivo_nombre, archivo_original, tipo, descripcion, hash_sha256) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(paciente.id, archivoNombre, filename || readableName, 'foto_whatsapp', caption || `Imagen de WhatsApp - ${phoneNorm}`, hash);

    console.log(`[WHATSAPP-INGEST] Imagen guardada: paciente=${paciente.nombres} ${paciente.apellido_paterno}, id=${result.lastInsertRowid}`);

    res.json({
      success: true,
      imagen_id: result.lastInsertRowid,
      paciente_id: paciente.id,
      paciente_nombre: `${paciente.apellido_paterno} ${paciente.apellido_materno} ${paciente.nombres}`.trim(),
    });
  } catch (err) {
    console.error('[WHATSAPP-INGEST] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
