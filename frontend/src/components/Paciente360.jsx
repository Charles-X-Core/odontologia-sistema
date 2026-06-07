import { useState, useEffect } from 'react';
import { api } from '../services/api';
import WhatsAppConfirm from './WhatsAppConfirm';
import WhatsAppSetup from './WhatsAppSetup';

const ESTADO_COLORS = {
  pendiente: { bg: '#fef3c7', text: '#92400e' },
  en_proceso: { bg: '#dbeafe', text: '#1e40af' },
  completado: { bg: '#dcfce7', text: '#166534' },
};

function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

export default function Paciente360({ paciente, onVolver, onVerHistorial }) {
  const [datos, setDatos] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [resumenPagos, setResumenPagos] = useState({ total_general: 0, total_pagado: 0, total_pendiente: 0 });
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('general');
  const [mostrarWhatsApp, setMostrarWhatsApp] = useState(false);
  const [mostrarSetup, setMostrarSetup] = useState(false);
  const [sugerencias, setSugerencias] = useState([]);
  const [mensajesWhatsApp, setMensajesWhatsApp] = useState([]);
  const [tipoSugerencia, setTipoSugerencia] = useState(null);
  const [dataSugerencia, setDataSugerencia] = useState(null);
  const [enviandoPdf, setEnviandoPdf] = useState(null);

  useEffect(() => { cargar(); }, [paciente.id]);

  const cargar = async () => {
    const [historialRes, pagosRes, resumenRes, sugRes, mensajesRes] = await Promise.allSettled([
      api.pacientes.historial(paciente.id),
      api.pagos.listarPorPaciente(paciente.id),
      api.pagos.resumen(paciente.id),
      api.whatsapp.sugerencias(paciente.id),
      api.whatsapp.historialPaciente(paciente.id),
    ]);

    if (historialRes.status === 'fulfilled') setDatos(historialRes.value);
    if (pagosRes.status === 'fulfilled') setPagos(pagosRes.value);
    if (resumenRes.status === 'fulfilled') setResumenPagos(resumenRes.value);
    if (sugRes.status === 'fulfilled') setSugerencias(sugRes.value?.sugerencias || []);
    if (mensajesRes.status === 'fulfilled') setMensajesWhatsApp(Array.isArray(mensajesRes.value) ? mensajesRes.value : []);

    setCargando(false);
  };

  if (cargando) return <div className="loading">Cargando perfil del paciente...</div>;
  if (!datos) return <div className="loading">Error al cargar datos</div>;

  const { historia, consultas = [] } = datos;
  const ultimasConsultas = consultas.slice(0, 3);

  const parseDiagnosticos = (d) => {
    if (!d) return [];
    try { return typeof d === 'string' ? JSON.parse(d) : d; } catch { return []; }
  };

  const edad = paciente.fecha_nacimiento ? (() => {
    const h = new Date(); const n = new Date(paciente.fecha_nacimiento);
    let e = h.getFullYear() - n.getFullYear();
    if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--;
    return e;
  })() : null;

  return (
    <div className="paciente360">
      <div className="page-header">
        <div>
          <button className="btn-back" onClick={onVolver}>&larr; Volver</button>
          <h2>{nombreCompleto(paciente)}</h2>
          <p>DNI: {paciente.dni} {paciente.telefono ? `| Tel: ${paciente.telefono}` : ''} {paciente.email ? `| ${paciente.email}` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => onVerHistorial(paciente)}>
            Ver Historial Completo
          </button>
          <button className="btn btn-success" onClick={() => setMostrarWhatsApp(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </button>
          <a className="btn btn-secondary" href={api.pdf.historia(paciente.id)} target="_blank" rel="noopener noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Historia Clinica
          </a>
        </div>
      </div>

      {sugerencias.length > 0 && (
        <div className="wa-sugerencias-paciente">
          <label>Mensajes sugeridos:</label>
          <div className="wa-sugerencias-grid">
            {sugerencias.slice(0, 4).map((s, i) => (
              <button key={i} className={`wa-sugerencia-btn prioridad-${s.prioridad}`} onClick={() => { setTipoSugerencia(s.tipo); setDataSugerencia(s.data || null); setMostrarWhatsApp(true); }}>
                <span className="wa-sugerencia-icon">{s.icono}</span>
                <div className="wa-sugerencia-info">
                  <span className="wa-sugerencia-tipo">{s.tipo.replace(/_/g, ' ')}</span>
                  <span className="wa-sugerencia-razon">{s.razon}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="paciente360-tabs">
        <button className={`tab-btn ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}>Informacion</button>
        <button className={`tab-btn ${tab === 'clinico' ? 'active' : ''}`} onClick={() => setTab('clinico')}>Clinico</button>
        <button className={`tab-btn ${tab === 'reciente' ? 'active' : ''}`} onClick={() => setTab('reciente')}>Actividad Reciente</button>
        <button className={`tab-btn ${tab === 'financiero' ? 'active' : ''}`} onClick={() => setTab('financiero')}>Financiero</button>
        <button className={`tab-btn ${tab === 'mensajes' ? 'active' : ''}`} onClick={() => setTab('mensajes')}>📱 Mensajes ({mensajesWhatsApp.length})</button>
      </div>

      {tab === 'general' && (
        <div className="paciente360-grid">
          <div className="paciente360-card">
            <h4>Datos Personales</h4>
            <div className="paciente360-fields">
              <div className="field-row"><span className="field-label">Nombre:</span><span>{nombreCompleto(paciente)}</span></div>
              <div className="field-row"><span className="field-label">DNI:</span><span>{paciente.dni}</span></div>
              <div className="field-row"><span className="field-label">Fecha Nac:</span><span>{paciente.fecha_nacimiento ? new Date(paciente.fecha_nacimiento).toLocaleDateString() : '-'}</span></div>
              <div className="field-row"><span className="field-label">Edad:</span><span>{edad ? `${edad} anos` : '-'}</span></div>
              <div className="field-row"><span className="field-label">Sexo:</span><span>{paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : '-'}</span></div>
              <div className="field-row"><span className="field-label">Estado Civil:</span><span>{paciente.estado_civil || '-'}</span></div>
              <div className="field-row"><span className="field-label">Telefono:</span><span>{paciente.telefono || '-'}</span></div>
              <div className="field-row"><span className="field-label">Email:</span><span>{paciente.email || '-'}</span></div>
              <div className="field-row"><span className="field-label">Direccion:</span><span>{paciente.direccion || '-'}</span></div>
              <div className="field-row"><span className="field-label">Ocupacion:</span><span>{paciente.ocupacion || '-'}</span></div>
              <div className="field-row"><span className="field-label">Lugar Nacimiento:</span><span>{paciente.lugar_nacimiento || '-'}</span></div>
              <div className="field-row"><span className="field-label">Lugar Procedencia:</span><span>{paciente.lugar_procedencia || '-'}</span></div>
              <div className="field-row"><span className="field-label">Grado Instruccion:</span><span>{paciente.grado_instruccion || '-'}</span></div>
            </div>
          </div>

          <div className="paciente360-card">
            <h4>Contacto de Emergencia</h4>
            <div className="paciente360-fields">
              <div className="field-row"><span className="field-label">Acompanante:</span><span>{paciente.nombre_acompanante || '-'}</span></div>
              <div className="field-row"><span className="field-label">Contacto:</span><span>{paciente.contacto_emergencia || '-'}</span></div>
              <div className="field-row"><span className="field-label">Telefono:</span><span>{paciente.telefono_emergencia || '-'}</span></div>
            </div>
          </div>

          <div className="paciente360-card">
            <h4>Historia Clinica</h4>
            {historia ? (
              <div className="paciente360-fields">
                <div className="field-row"><span className="field-label">N HCLX:</span><span>{historia.numero_historia || '-'}</span></div>
                {historia.alergia_medicamentos && historia.alergia_medicamentos !== 'No' && (
                  <div className="field-row alerta"><span className="field-label">Alergias:</span><span>{historia.alergia_medicamentos}</span></div>
                )}
                {historia.presion_arterial_medicacion && historia.presion_arterial_medicacion !== 'No' && (
                  <div className="field-row"><span className="field-label">P.A. / Medicacion:</span><span>{historia.presion_arterial_medicacion}</span></div>
                )}
                {historia.diabetes_personal && historia.diabetes_personal !== 'No' && (
                  <div className="field-row"><span className="field-label">Diabetes:</span><span>{historia.diabetes_personal}</span></div>
                )}
                {historia.otras_enfermedades && (
                  <div className="field-row"><span className="field-label">Otras:</span><span>{historia.otras_enfermedades}</span></div>
                )}
                {historia.enfermedad_actual_medicacion && (
                  <div className="field-row"><span className="field-label">Medicacion:</span><span>{historia.enfermedad_actual_medicacion}</span></div>
                )}
              </div>
            ) : (
              <p className="empty">No tiene historia clinica registrada</p>
            )}
          </div>

          <div className="paciente360-card">
            <h4>Resumen Financiero</h4>
            <div className="paciente360-fields">
              <div className="field-row"><span className="field-label">Total:</span><span><strong>${resumenPagos.total_general.toLocaleString()}</strong></span></div>
              <div className="field-row"><span className="field-label">Pagado:</span><span style={{ color: 'var(--success)' }}>${resumenPagos.total_pagado.toLocaleString()}</span></div>
              <div className="field-row"><span className="field-label">Pendiente:</span><span style={{ color: 'var(--danger)' }}>${resumenPagos.total_pendiente.toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'clinico' && (
        <div className="paciente360-grid">
          <div className="paciente360-card full-width">
            <h4>Ultimas Consultas ({consultas.length} total)</h4>
            {consultas.length === 0 ? (
              <p className="empty">No hay consultas registradas</p>
            ) : (
              <div className="timeline">
                {consultas.slice(0, 10).map(c => (
                  <div key={c.id} className="timeline-item">
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <div className="timeline-date">{new Date(c.fecha).toLocaleDateString()}</div>
                      <h4>{c.motivo}</h4>
                      <div className="timeline-details">
                        <div>
                          <strong>Diagnostico:</strong>{' '}
                          {parseDiagnosticos(c.diagnostico_lista).map(d => d.texto).join('; ') || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'reciente' && (
        <div className="paciente360-grid">
          <div className="paciente360-card full-width">
            <h4>Actividad Reciente</h4>
            <div className="actividad-lista">
              {consultas.length === 0 && pagos.length === 0 ? (
                <p className="empty">No hay actividad registrada</p>
              ) : (
                [...consultas.map(c => ({ tipo: 'consulta', fecha: c.fecha, texto: `Consulta: ${c.motivo}`, id: c.id, consultaId: c.id })),
                  ...pagos.map(p => ({ tipo: 'pago', fecha: p.fecha, texto: `Pago: $${(p.total || 0).toLocaleString()} - ${p.procedimiento || 'Sin descripcion'}`, id: p.id }))]
                  .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                  .slice(0, 15)
                  .map((item, i) => (
                    <div key={`${item.tipo}-${item.id}`} className="actividad-item">
                      <span className={`actividad-tipo ${item.tipo}`}>{item.tipo === 'consulta' ? 'Consulta' : 'Pago'}</span>
                      <span className="actividad-texto">{item.texto}</span>
                      <span className="actividad-fecha">{new Date(item.fecha).toLocaleDateString()}</span>
                      {item.tipo === 'consulta' && (
                        <a className="btn btn-sm btn-secondary" href={api.pdf.historiaConsulta(paciente.id, item.consultaId)} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '11px' }}>
                          PDF
                        </a>
                      )}
                    </div>
                  ))
                )}
            </div>
          </div>
        </div>
      )}

      {tab === 'financiero' && (
        <div className="paciente360-grid">
          <div className="paciente360-card full-width">
            <h4>Historial de Pagos ({pagos.length} registros)</h4>
            {pagos.length === 0 ? (
              <p className="empty">No hay pagos registrados</p>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr><th>Fecha</th><th>Procedimiento</th><th>Total</th><th>A Cuenta</th><th>Saldo</th><th>Metodo</th></tr>
                  </thead>
                  <tbody>
                    {pagos.map(p => (
                      <tr key={p.id}>
                        <td>{new Date(p.fecha).toLocaleDateString()}</td>
                        <td>{p.procedimiento || '-'}</td>
                        <td><strong>${(p.total || 0).toLocaleString()}</strong></td>
                        <td>${(p.a_cuenta || 0).toLocaleString()}</td>
                        <td>
                          <span className={`saldo-badge ${(p.saldo || 0) > 0 ? 'pendiente' : 'pagado'}`}>
                            ${(p.saldo || 0).toLocaleString()}
                          </span>
                        </td>
                        <td>{p.metodo_pago}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'mensajes' && (
        <div className="paciente360-grid">
          <div className="paciente360-card full-width">
            <h4>Enviar Documentos PDF</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px' }}>
              {[
                { tipo: 'receta', label: 'Receta', icon: '💊' },
                { tipo: 'plan', label: 'Plan Tratamiento', icon: '🦷' },
                { tipo: 'pago', label: 'Comprobante Pago', icon: '💰' },
                { tipo: 'historia', label: 'Historia Clinica', icon: '📋' },
              ].map(doc => (
                <button
                  key={doc.tipo}
                  className="btn btn-sm btn-primary"
                  disabled={enviandoPdf === doc.tipo}
                  onClick={async () => {
                    if (enviandoPdf) return;
                    setEnviandoPdf(doc.tipo);
                    try {
                      const res = await api.whatsapp.enviarPdf({ paciente_id: paciente.id, tipo: doc.tipo });
                      if (res.error) alert('Error: ' + res.error);
                      else alert(`${doc.label} enviado a ${res.to}`);
                    } catch (e) { alert('Error: ' + e.message); }
                    setEnviandoPdf(null);
                  }}
                >
                  {enviandoPdf === doc.tipo ? (
                    <><span className="spinner-sm"></span> Enviando...</>
                  ) : (
                    <>{doc.icon} Enviar {doc.label}</>
                  )}
                </button>
              ))}
            </div>

            <h4>Mensajes WhatsApp ({mensajesWhatsApp.length} registros)</h4>
            {mensajesWhatsApp.length === 0 ? (
              <p className="empty">No hay mensajes WhatsApp enviados a este paciente</p>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr><th>Fecha</th><th>Tipo</th><th>Estado</th><th>Entrega</th><th>Mensaje</th></tr>
                  </thead>
                  <tbody>
                    {mensajesWhatsApp.map(m => (
                      <tr key={m.id}>
                        <td>{new Date(m.created_at).toLocaleString()}</td>
                        <td><span className="stat-badge">{m.tipo}</span></td>
                        <td><span className={`stat-badge ${m.estado}`}>{m.estado}</span></td>
                        <td>
                          <span className={`delivery-status delivery-${m.delivery_status || 'enviado'}`}>
                            {m.delivery_status === 'leido' && '✓✓ Leido'}
                            {m.delivery_status === 'entregado' && '✓✓ Entregado'}
                            {m.delivery_status === 'enviado' && '✓ Enviado'}
                            {m.delivery_status === 'pendiente' && '○ Pendiente'}
                            {!m.delivery_status && '✓ Enviado'}
                          </span>
                        </td>
                        <td className="wa-historial-msg">{m.mensaje.substring(0, 100)}{m.mensaje.length > 100 ? '...' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {mostrarWhatsApp && (
        <WhatsAppConfirm
          paciente={paciente}
          tipo={tipoSugerencia || 'custom'}
          sugerenciaData={dataSugerencia}
          onEnviar={() => { setTipoSugerencia(null); setDataSugerencia(null); setMostrarWhatsApp(false); }}
          onCancelar={() => { setTipoSugerencia(null); setDataSugerencia(null); setMostrarWhatsApp(false); }}
          onSetup={() => { setTipoSugerencia(null); setDataSugerencia(null); setMostrarWhatsApp(false); setMostrarSetup(true); }}
        />
      )}

      {mostrarSetup && (
        <WhatsAppSetup
          onCompleto={() => setMostrarSetup(false)}
          onCancelar={() => setMostrarSetup(false)}
        />
      )}
    </div>
  );
}
