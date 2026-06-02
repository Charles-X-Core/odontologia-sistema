import { useState, useEffect } from 'react';
import { api } from '../services/api';

const CATEGORIAS = ['salud', 'tratamiento', 'pago', 'cita', 'marketing', 'otro'];
const TIPOS_LISTA = [
  { id: 'recordatorio_pago', label: 'Recordatorio de Pago' },
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'bienvenida', label: 'Bienvenida' },
  { id: 'proxima_cita', label: 'Proxima Cita' },
  { id: 'confirmacion_cita', label: 'Confirmar Cita' },
  { id: 'higiene', label: 'Limpieza' },
  { id: 'plan', label: 'Plan de Tratamiento' },
  { id: 'receta', label: 'Receta' },
  { id: 'cumpleanos', label: 'Cumpleanos' },
  { id: 'credito', label: 'Saldo a Favor' },
  { id: 'custom', label: 'Personalizado' },
];

export default function WhatsAppPanel({ onVolver }) {
  const [tab, setTab] = useState('analytics');
  const [analytics, setAnalytics] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [periodo, setPeriodo] = useState({ inicio: '', fin: '' });

  // Batch
  const [filtrosBatch, setFiltrosBatch] = useState({ con_telefono: 'true', saldo_pendiente: false, sin_cita_reciente: false, nuevos: false });
  const [pacientesBatch, setPacientesBatch] = useState([]);
  const [seleccionados, setSeleccionados] = useState({});
  const [tipoBatch, setTipoBatch] = useState('recordatorio_pago');
  const [customBatch, setCustomBatch] = useState('');
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [resultadoLote, setResultadoLote] = useState(null);

  // Cola
  const [cola, setCola] = useState([]);
  const [programando, setProgramando] = useState(false);
  const [formProgramar, setFormProgramar] = useState({ paciente_id: '', tipo: 'recordatorio_pago', fecha: '', hora: '' });

  // Plantillas
  const [plantillas, setPlantillas] = useState([]);
  const [editando, setEditando] = useState(null);
  const [formPlantilla, setFormPlantilla] = useState({ nombre: '', categoria: 'salud', asunto: '', cuerpo: '' });

  // Historial
  const [historial, setHistorial] = useState([]);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const [a, c, h] = await Promise.allSettled([
        api.whatsapp.analytics(),
        api.whatsapp.cola(),
        api.whatsapp.historial(),
      ]);
      if (a.status === 'fulfilled') setAnalytics(a.value);
      if (c.status === 'fulfilled') setCola(c.value);
      if (h.status === 'fulfilled') setHistorial(h.value);
    } catch {}
    setCargando(false);
  };

  // Analytics
  const recargarAnalytics = async () => {
    const params = {};
    if (periodo.inicio) params.fecha_inicio = periodo.inicio;
    if (periodo.fin) params.fecha_fin = periodo.fin;
    const data = await api.whatsapp.analytics(params);
    setAnalytics(data);
  };

  // Batch
  const buscarBatch = async () => {
    const params = {};
    Object.entries(filtrosBatch).forEach(([k, v]) => { if (v) params[k] = 'true'; });
    const data = await api.whatsapp.filtrarPacientes(params);
    setPacientesBatch(data);
    setSeleccionados({});
    setResultadoLote(null);
  };

  const toggleSeleccion = (id) => setSeleccionados(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleTodos = () => {
    const allSelected = pacientesBatch.every(p => seleccionados[p.id]);
    const nuevo = {};
    if (!allSelected) pacientesBatch.forEach(p => { nuevo[p.id] = true; });
    setSeleccionados(nuevo);
  };

  const enviarLote = async () => {
    const ids = Object.keys(seleccionados).filter(id => seleccionados[id]);
    if (ids.length === 0) return;
    setEnviandoLote(true);
    try {
      const data = await api.whatsapp.enviarLote({
        paciente_ids: ids.map(Number),
        tipo: tipoBatch,
        mensaje_personalizado: tipoBatch === 'custom' ? customBatch : undefined,
      });
      setResultadoLote(data);
      cargar();
    } catch (err) {
      setResultadoLote({ error: err.message });
    }
    setEnviandoLote(false);
  };

  // Cola
  const programar = async () => {
    if (!formProgramar.paciente_id || !formProgramar.fecha || !formProgramar.hora) return;
    setProgramando(true);
    try {
      await api.whatsapp.programar({
        paciente_id: Number(formProgramar.paciente_id),
        tipo: formProgramar.tipo,
        programado_para: `${formProgramar.fecha}T${formProgramar.hora}:00`,
      });
      const c = await api.whatsapp.cola();
      setCola(c);
      setFormProgramar({ paciente_id: '', tipo: 'recordatorio_pago', fecha: '', hora: '' });
    } catch {}
    setProgramando(false);
  };

  const cancelarCola = async (id) => {
    await api.whatsapp.cancelarCola(id);
    const c = await api.whatsapp.cola();
    setCola(c);
  };

  // Plantillas
  const cargarPlantillas = async () => {
    const data = await api.whatsapp.listarPlantillas();
    setPlantillas(data);
  };

  const guardarPlantilla = async () => {
    if (!formPlantilla.nombre || !formPlantilla.cuerpo) return;
    if (editando) {
      await api.whatsapp.editarPlantilla(editando.id, formPlantilla);
    } else {
      await api.whatsapp.crearPlantilla(formPlantilla);
    }
    setEditando(null);
    setFormPlantilla({ nombre: '', categoria: 'salud', asunto: '', cuerpo: '' });
    cargarPlantillas();
  };

  const eliminarPlantilla = async (id) => {
    await api.whatsapp.eliminarPlantilla(id);
    cargarPlantillas();
  };

  if (cargando) return <div className="loading">Cargando panel de mensajeria...</div>;

  const countSeleccionados = Object.values(seleccionados).filter(Boolean).length;

  return (
    <div className="whatsapp-panel">
      <div className="page-header">
        <div>
          <button className="btn-back" onClick={onVolver}>&larr; Volver</button>
          <h2>Mensajeria WhatsApp</h2>
          <p>Analytics, envios en lote, programacion y plantillas</p>
        </div>
      </div>

      <div className="paciente360-tabs">
        <button className={`tab-btn ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>📊 Analytics</button>
        <button className={`tab-btn ${tab === 'batch' ? 'active' : ''}`} onClick={() => setTab('batch')}>📤 Envio en Lote</button>
        <button className={`tab-btn ${tab === 'cola' ? 'active' : ''}`} onClick={() => setTab('cola')}>⏰ Programados</button>
        <button className={`tab-btn ${tab === 'plantillas' ? 'active' : ''}`} onClick={() => { setTab('plantillas'); cargarPlantillas(); }}>📝 Plantillas</button>
        <button className={`tab-btn ${tab === 'historial' ? 'active' : ''}`} onClick={() => setTab('historial')}>📋 Historial</button>
      </div>

      {/* ===== ANALYTICS ===== */}
      {tab === 'analytics' && analytics && (
        <div className="wa-analytics">
          <div className="wa-filtros-periodo">
            <label>Desde:</label>
            <input type="date" value={periodo.inicio} onChange={e => setPeriodo({...periodo, inicio: e.target.value})} />
            <label>Hasta:</label>
            <input type="date" value={periodo.fin} onChange={e => setPeriodo({...periodo, fin: e.target.value})} />
            <button className="btn btn-primary btn-sm" onClick={recargarAnalytics}>Filtrar</button>
          </div>

          <div className="wa-metricas-grid">
            <div className="wa-metrica-card">
              <span className="wa-metrica-icon">📨</span>
              <span className="wa-metrica-valor">{analytics.metricas?.total_enviados || 0}</span>
              <span className="wa-metrica-label">Enviados</span>
            </div>
            <div className="wa-metrica-card exitoso">
              <span className="wa-metrica-icon">✅</span>
              <span className="wa-metrica-valor">{analytics.metricas?.tasa_exito || 0}%</span>
              <span className="wa-metrica-label">Exito</span>
            </div>
            <div className="wa-metrica-card">
              <span className="wa-metrica-icon">👥</span>
              <span className="wa-metrica-valor">{analytics.metricas?.pacientes_contactados || 0}</span>
              <span className="wa-metrica-label">Pacientes</span>
            </div>
            <div className="wa-metrica-card">
              <span className="wa-metrica-icon">⏰</span>
              <span className="wa-metrica-valor">{analytics.programados_pendientes || 0}</span>
              <span className="wa-metrica-label">Programados</span>
            </div>
          </div>

          {analytics.por_tipo?.length > 0 && (
            <div className="wa-card">
              <h4>Por Tipo de Mensaje</h4>
              <div className="wa-chart-bars">
                {analytics.por_tipo.map(t => {
                  const max = Math.max(...analytics.por_tipo.map(x => x.cantidad));
                  return (
                    <div key={t.tipo} className="wa-bar-row">
                      <span className="wa-bar-label">{t.tipo}</span>
                      <div className="wa-bar-track">
                        <div className="wa-bar-fill" style={{ width: `${(t.cantidad / max) * 100}%` }} />
                      </div>
                      <span className="wa-bar-value">{t.cantidad}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {analytics.top_pacientes?.length > 0 && (
            <div className="wa-card">
              <h4>Top Pacientes Contactados</h4>
              <table className="table">
                <thead><tr><th>Paciente</th><th>Mensajes</th><th>Ultimo Envio</th></tr></thead>
                <tbody>
                  {analytics.top_pacientes.map(p => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td><strong>{p.mensajes}</strong></td>
                      <td>{new Date(p.ultimo_envio).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== BATCH ===== */}
      {tab === 'batch' && (
        <div className="wa-batch">
          <div className="wa-card">
            <h4>Filtrar Pacientes</h4>
            <div className="wa-filtros-grid">
              <label className="wa-filtro-check">
                <input type="checkbox" checked={filtrosBatch.con_telefono === 'true'} onChange={e => setFiltrosBatch({...filtrosBatch, con_telefono: e.target.checked ? 'true' : 'false'})} />
                Con telefono
              </label>
              <label className="wa-filtro-check">
                <input type="checkbox" checked={filtrosBatch.saldo_pendiente} onChange={e => setFiltrosBatch({...filtrosBatch, saldo_pendiente: e.target.checked})} />
                Saldo pendiente
              </label>
              <label className="wa-filtro-check">
                <input type="checkbox" checked={filtrosBatch.sin_cita_reciente} onChange={e => setFiltrosBatch({...filtrosBatch, sin_cita_reciente: e.target.checked})} />
                Sin cita 6+ meses
              </label>
              <label className="wa-filtro-check">
                <input type="checkbox" checked={filtrosBatch.nuevos} onChange={e => setFiltrosBatch({...filtrosBatch, nuevos: e.target.checked})} />
                Sin mensajes enviados
              </label>
              <button className="btn btn-primary btn-sm" onClick={buscarBatch}>Buscar</button>
            </div>
          </div>

          {pacientesBatch.length > 0 && (
            <>
              <div className="wa-batch-header">
                <span>{pacientesBatch.length} pacientes encontrados | {countSeleccionados} seleccionados</span>
                <button className="btn btn-secondary btn-sm" onClick={toggleTodos}>{pacientesBatch.every(p => seleccionados[p.id]) ? 'Deseleccionar todos' : 'Seleccionar todos'}</button>
              </div>

              <div className="wa-batch-select">
                <label>Tipo de mensaje:</label>
                <select value={tipoBatch} onChange={e => setTipoBatch(e.target.value)}>
                  {TIPOS_LISTA.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                {tipoBatch === 'custom' && (
                  <input type="text" placeholder="Escribe tu mensaje..." value={customBatch} onChange={e => setCustomBatch(e.target.value)} className="wa-batch-custom" />
                )}
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" onChange={toggleTodos} checked={pacientesBatch.length > 0 && pacientesBatch.every(p => seleccionados[p.id])} /></th>
                      <th>Paciente</th>
                      <th>Telefono</th>
                      <th>DNI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pacientesBatch.slice(0, 50).map(p => (
                      <tr key={p.id} className={seleccionados[p.id] ? 'row-selected' : ''}>
                        <td><input type="checkbox" checked={!!seleccionados[p.id]} onChange={() => toggleSeleccion(p.id)} /></td>
                        <td>{p.apellido_paterno} {p.apellido_materno} {p.nombres}</td>
                        <td>{p.telefono || '-'}</td>
                        <td>{p.dni}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {countSeleccionados > 0 && (
                <div className="wa-batch-actions">
                  <button className="btn btn-success" onClick={enviarLote} disabled={enviandoLote}>
                    {enviandoLote ? 'Enviando...' : `Enviar a ${countSeleccionados} pacientes`}
                  </button>
                </div>
              )}
            </>
          )}

          {resultadoLote && (
            <div className={`wa-lote-resultado ${resultadoLote.error ? 'error' : 'exito'}`}>
              {resultadoLote.error ? (
                <p>Error: {resultadoLote.error}</p>
              ) : (
                <p>Enviados: {resultadoLote.enviados} | Fallidos: {resultadoLote.fallidos} | Total: {resultadoLote.total}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== COLA ===== */}
      {tab === 'cola' && (
        <div className="wa-cola">
          <div className="wa-card">
            <h4>Programar Mensaje</h4>
            <div className="wa-programar-form">
              <input type="number" placeholder="ID Paciente" value={formProgramar.paciente_id} onChange={e => setFormProgramar({...formProgramar, paciente_id: e.target.value})} />
              <select value={formProgramar.tipo} onChange={e => setFormProgramar({...formProgramar, tipo: e.target.value})}>
                {TIPOS_LISTA.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <input type="date" value={formProgramar.fecha} onChange={e => setFormProgramar({...formProgramar, fecha: e.target.value})} />
              <input type="time" value={formProgramar.hora} onChange={e => setFormProgramar({...formProgramar, hora: e.target.value})} />
              <button className="btn btn-primary btn-sm" onClick={programar} disabled={programando}>
                {programando ? 'Programando...' : 'Programar'}
              </button>
            </div>
          </div>

          {cola.length > 0 ? (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr><th>Paciente</th><th>Tipo</th><th>Programado Para</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {cola.map(c => (
                    <tr key={c.id}>
                      <td>{c.apellido_paterno} {c.apellido_materno} {c.nombres}</td>
                      <td>{c.tipo}</td>
                      <td>{new Date(c.programado_para).toLocaleString()}</td>
                      <td><span className={`stat-badge ${c.estado}`}>{c.estado}</span></td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => cancelarCola(c.id)}>Cancelar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No hay mensajes programados</div>
          )}
        </div>
      )}

      {/* ===== PLANTILLAS ===== */}
      {tab === 'plantillas' && (
        <div className="wa-plantillas">
          <div className="wa-plantillas-layout">
            <div className="wa-plantillas-list">
              <h4>Plantillas del Sistema</h4>
              {plantillas.map(p => (
                <div key={p.id} className={`wa-plantilla-card ${editando?.id === p.id ? 'editando' : ''}`}>
                  <div className="wa-plantilla-header">
                    <strong>{p.nombre}</strong>
                    <span className="wa-plantilla-cat">{p.categoria}</span>
                  </div>
                  <p>{p.cuerpo.substring(0, 120)}...</p>
                  <div className="wa-plantilla-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditando(p); setFormPlantilla({ nombre: p.nombre, categoria: p.categoria, asunto: p.asunto, cuerpo: p.cuerpo }); }}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => eliminarPlantilla(p.id)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="wa-plantilla-editor">
              <h4>{editando ? 'Editar Plantilla' : 'Nueva Plantilla'}</h4>
              <div className="field">
                <label>Nombre</label>
                <input type="text" value={formPlantilla.nombre} onChange={e => setFormPlantilla({...formPlantilla, nombre: e.target.value})} placeholder="Nombre de la plantilla" />
              </div>
              <div className="field">
                <label>Categoria</label>
                <select value={formPlantilla.categoria} onChange={e => setFormPlantilla({...formPlantilla, categoria: e.target.value})}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Asunto</label>
                <input type="text" value={formPlantilla.asunto} onChange={e => setFormPlantilla({...formPlantilla, asunto: e.target.value})} placeholder="Asunto del mensaje" />
              </div>
              <div className="field">
                <label>Cuerpo (usa {'{variables}'})</label>
                <textarea rows={10} value={formPlantilla.cuerpo} onChange={e => setFormPlantilla({...formPlantilla, cuerpo: e.target.value})} placeholder="Escribe el mensaje..." className="sesion-textarea-sm" />
              </div>
              <div className="wa-plantilla-variables">
                <span>Variables: {'{nombre}'}, {'{apellido}'}, {'{nombre_completo}'}, {'{saldo_pendiente}'}, {'{costo_total}'}, {'{clinica_telefono}'}</span>
              </div>
              <div className="form-actions">
                {editando && <button className="btn btn-secondary" onClick={() => { setEditando(null); setFormPlantilla({ nombre: '', categoria: 'salud', asunto: '', cuerpo: '' }); }}>Cancelar</button>}
                <button className="btn btn-primary" onClick={guardarPlantilla}>{editando ? 'Actualizar' : 'Crear'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== HISTORIAL ===== */}
      {tab === 'historial' && (
        <div className="wa-historial">
          {historial.length > 0 ? (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr><th>Fecha</th><th>Paciente</th><th>Tipo</th><th>Estado</th><th>Entrega</th><th>Mensaje</th></tr>
                </thead>
                <tbody>
                  {historial.map(h => (
                    <tr key={h.id}>
                      <td>{new Date(h.created_at).toLocaleString()}</td>
                      <td>{h.apellido_paterno} {h.apellido_materno} {h.nombres}</td>
                      <td><span className="stat-badge">{h.tipo}</span></td>
                      <td><span className={`stat-badge ${h.estado}`}>{h.estado}</span></td>
                      <td>
                        <span className={`delivery-status delivery-${h.delivery_status || 'enviado'}`}>
                          {h.delivery_status === 'leido' && '✓✓ Leido'}
                          {h.delivery_status === 'entregado' && '✓✓ Entregado'}
                          {h.delivery_status === 'enviado' && '✓ Enviado'}
                          {h.delivery_status === 'pendiente' && '○ Pendiente'}
                          {!h.delivery_status && '✓ Enviado'}
                        </span>
                      </td>
                      <td className="wa-historial-msg">{h.mensaje.substring(0, 80)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No hay mensajes enviados aun</div>
          )}
        </div>
      )}
    </div>
  );
}
