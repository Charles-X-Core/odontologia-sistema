import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import WhatsAppConfirm from './WhatsAppConfirm';
import ConfirmarPassword from './ConfirmarPassword';

const ESTADO_COLORS = {
  realizado: { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  planificado: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
};

const ESTADO_LABELS = {
  realizado: 'Realizado',
  planificado: 'Planificado',
};

const FORM_DEFAULT = { procedimiento_realizado: '', costo_total: '', monto_a_cuenta: '', pieza_dental: '', fecha: new Date().toISOString().split('T')[0], notas: '', consulta_id: '' };
const PAGE_SIZE = 10;

export default function Tratamientos({ pacienteId, consultas, paciente }) {
  const [tratamientos, setTratamientos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mostrarWhatsApp, setMostrarWhatsApp] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [accionPendiente, setAccionPendiente] = useState(null);

  const requerirPassword = (accion) => {
    setAccionPendiente(() => accion);
    setMostrarPassword(true);
  };

  const passwordConfirmado = () => {
    setMostrarPassword(false);
    if (accionPendiente) accionPendiente();
    setAccionPendiente(null);
  };

  useEffect(() => { cargar(); }, [pacienteId]);

  const cargar = async () => {
    const data = await api.tratamientos.listar(pacienteId);
    setTratamientos(data);
    setCargando(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const costo = parseFloat(form.costo_total) || 0;
      const monto = parseFloat(form.monto_a_cuenta) || 0;
      const payload = {
        paciente_id: pacienteId,
        consulta_id: form.consulta_id ? parseInt(form.consulta_id) : null,
        fecha: form.fecha,
        pieza_dental: form.pieza_dental,
        procedimiento_realizado: form.procedimiento_realizado,
        costo_total: costo,
        monto_a_cuenta: monto,
        notas: form.notas,
      };
      let res;
      if (editando) {
        res = await api.tratamientos.actualizar(editando.id, payload);
      } else {
        res = await api.tratamientos.crear(payload);
      }
      if (res?.error) { setError(res.error); setGuardando(false); return; }
      setMostrarForm(false);
      setEditando(null);
      setForm({ ...FORM_DEFAULT });
      cargar();
    } catch (err) {
      setError(err.message || 'Error al guardar tratamiento');
    }
    setGuardando(false);
  };

  const handleEditar = (t) => {
    setForm({
      procedimiento_realizado: t.procedimiento_realizado || '',
      costo_total: String(t.costo_total || ''),
      monto_a_cuenta: String(t.monto_a_cuenta || ''),
      pieza_dental: t.pieza_dental || '',
      fecha: t.fecha ? t.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
      notas: t.notas || '',
      consulta_id: t.consulta_id ? String(t.consulta_id) : '',
    });
    setEditando(t);
    setMostrarForm(true);
  };

  const cambiarEstado = async (id, nuevoEstado) => {
    await api.tratamientos.actualizar(id, { estado: nuevoEstado });
    cargar();
  };

  const eliminar = async (id) => {
    if (!confirm('Eliminar este tratamiento?')) return;
    await api.tratamientos.eliminar(id);
    cargar();
  };

  const totalCosto = tratamientos.reduce((sum, t) => sum + (t.costo_total || 0), 0);
  const totalMonto = tratamientos.reduce((sum, t) => sum + (t.monto_a_cuenta || 0), 0);
  const totalSaldo = tratamientos.reduce((sum, t) => sum + (t.saldo_pendiente || 0), 0);
  const realizados = tratamientos.filter(t => t.estado === 'realizado').length;
  const planificados = tratamientos.filter(t => t.estado === 'planificado').length;
  const pctRealizado = tratamientos.length > 0 ? Math.round((realizados / tratamientos.length) * 100) : 0;

  const filtrados = useMemo(() => {
    let result = [...tratamientos];
    if (filtroEstado !== 'todos') {
      result = result.filter(t => t.estado === filtroEstado);
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      result = result.filter(t =>
        (t.procedimiento_realizado || '').toLowerCase().includes(q) ||
        (t.pieza_dental || '').toLowerCase().includes(q) ||
        (t.notas || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [tratamientos, busqueda, filtroEstado]);

  const grupos = useMemo(() => {
    const map = {};
    for (const t of filtrados) {
      const key = t.consulta_id || '_sin_consulta_';
      if (!map[key]) {
        map[key] = {
          consulta_id: t.consulta_id,
          fecha: t.consulta_fecha || null,
          motivo: t.consulta_motivo || null,
          items: [],
        };
      }
      map[key].items.push(t);
    }
    const entries = Object.values(map).filter(g => g.consulta_id);
    const sinConsulta = map['_sin_consulta_'];
    if (sinConsulta) entries.push(sinConsulta);
    return entries;
  }, [filtrados]);

  const totalPaginas = Math.ceil(grupos.length / PAGE_SIZE);
  const paginados = grupos.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  useEffect(() => { setPagina(1); }, [busqueda, filtroEstado]);

  if (cargando) return <div className="loading">Cargando tratamientos...</div>;

  return (
    <div className="tratamientos-panel">
      <div className="tratamientos-stats">
        <span className="stat-badge realizado">{realizados} realizados</span>
        <span className="stat-badge planificado">{planificados} planificados</span>
        <span className="stat-badge total">Total: ${totalCosto.toLocaleString()}</span>
        <span className="stat-badge pagado">Pagado: ${totalMonto.toLocaleString()}</span>
        <span className="stat-badge planificado">Saldo: ${totalSaldo.toLocaleString()}</span>
      </div>

      {tratamientos.length > 0 && (
        <div className="trat-progress-bar">
          <div className="trat-progress-fill" style={{ width: `${pctRealizado}%` }}></div>
          <span className="trat-progress-label">{pctRealizado}% realizado</span>
        </div>
      )}

      <div className="tratamientos-header">
        <div className="trat-filtros">
          <input
            type="text"
            className="trat-busqueda"
            placeholder="Buscar por procedimiento, pieza..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <select className="trat-filtro-estado" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="realizado">Realizados</option>
            <option value="planificado">Planificados</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {paciente && <button className="btn btn-success btn-sm" onClick={() => setMostrarWhatsApp(true)}>WhatsApp</button>}
          {paciente && <a className="btn btn-secondary btn-sm" href={api.pdf.tratamientos(paciente.id)} target="_blank" rel="noopener noreferrer">PDF</a>}
          <button className="btn btn-primary btn-sm" onClick={() => { setEditando(null); setForm({ ...FORM_DEFAULT }); setMostrarForm(true); }}>
            + Nuevo Tratamiento
          </button>
        </div>
      </div>

      {mostrarForm && (
        <div className="tratamiento-form-card">
          <form onSubmit={handleSubmit} className="form-inline">
            <div className="form-grid">
              <div className="field">
                <label>Procedimiento Realizado *</label>
                <input type="text" value={form.procedimiento_realizado} onChange={e => setForm({...form, procedimiento_realizado: e.target.value})} required placeholder="Ej: Corona ceramica molar 16" />
              </div>
              <div className="field">
                <label>Pieza Dental</label>
                <input type="text" value={form.pieza_dental} onChange={e => setForm({...form, pieza_dental: e.target.value})} placeholder="Ej: 16, 35" />
              </div>
              <div className="field">
                <label>Fecha</label>
                <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
              </div>
              <div className="field">
                <label>Costo Total ($)</label>
                <input type="number" value={form.costo_total} onChange={e => setForm({...form, costo_total: e.target.value})} placeholder="0" min="0" step="0.01" />
              </div>
              <div className="field">
                <label>Monto a Cuenta ($)</label>
                <input type="number" value={form.monto_a_cuenta} onChange={e => setForm({...form, monto_a_cuenta: e.target.value})} placeholder="0" min="0" step="0.01" />
              </div>
              <div className="field">
                <label>Saldo Pendiente</label>
                <input type="text" value={`$${((parseFloat(form.costo_total) || 0) - (parseFloat(form.monto_a_cuenta) || 0)).toLocaleString()}`} readOnly className="field-readonly" />
              </div>
            </div>
            {consultas && consultas.length > 0 && (
              <div className="field">
                <label>Vincular a Consulta</label>
                <select value={form.consulta_id} onChange={e => setForm({...form, consulta_id: e.target.value})}>
                  <option value="">Sin vincular</option>
                  {consultas.map(c => (
                    <option key={c.id} value={c.id}>{new Date(c.fecha).toLocaleDateString()} - {c.motivo}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label>Notas</label>
              <textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Observaciones..." rows={2} style={{ resize: 'vertical' }} />
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: '8px' }}>{error}</div>}
            <div className="form-actions-inline">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setMostrarForm(false); setEditando(null); setError(''); }}>Cancelar</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>{guardando ? 'Guardando...' : (editando ? 'Guardar Cambios' : 'Crear')}</button>
            </div>
          </form>
        </div>
      )}

      {tratamientos.length === 0 ? (
        <p className="empty">No hay tratamientos registrados</p>
      ) : grupos.length === 0 ? (
        <p className="empty">No se encontraron tratamientos con esos filtros</p>
      ) : (
        <>
          <div className="trat-groups">
            {paginados.map((grupo, gi) => (
              <div key={grupo.consulta_id || `sin-${gi}`} className="trat-group">
                <div className="trat-group-header">
                  <div className="trat-group-header-left">
                    {grupo.consulta_id ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                        <span className="trat-group-fecha">
                          {grupo.fecha ? new Date(grupo.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                        </span>
                        {grupo.motivo && <span className="trat-group-motivo">{grupo.motivo}</span>}
                      </>
                    ) : (
                      <span className="trat-group-motivo">Sin consulta vinculada</span>
                    )}
                  </div>
                  <span className="trat-group-count">{grupo.items.length} tratamiento{grupo.items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="trat-group-items">
                  {grupo.items.map(t => {
                    const color = ESTADO_COLORS[t.estado] || ESTADO_COLORS.planificado;
                    return (
                      <div key={t.id} className="tratamiento-card" style={{ borderLeftColor: color.border }}>
                        <div className="tratamiento-card-header">
                          <div>
                            <strong>{t.procedimiento_realizado}</strong>
                            {t.pieza_dental && <span className="diente-badge">Pza {t.pieza_dental}</span>}
                          </div>
                          <span className="costo-badge">${(t.costo_total || 0).toLocaleString()}</span>
                        </div>
                        {t.notas && <div className="tratamiento-notas">{t.notas}</div>}
                        <div className="tratamiento-card-footer">
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span className="estado-badge" style={{ background: color.bg, color: color.text, borderColor: color.border }}>
                              {ESTADO_LABELS[t.estado]}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                              {t.created_at ? new Date(t.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            {t.monto_a_cuenta > 0 && (
                              <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                                Pagado: ${t.monto_a_cuenta.toLocaleString()}
                              </span>
                            )}
                            <span className={`saldo-badge ${(t.saldo_pendiente || 0) > 0 ? 'pendiente' : 'pagado'}`}>
                              Saldo: ${(t.saldo_pendiente || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="tratamiento-actions">
                            {t.estado === 'planificado' && (
                              <button className="btn btn-sm btn-success" onClick={() => cambiarEstado(t.id, 'realizado')}>Marcar Realizado</button>
                            )}
                            {t.estado === 'realizado' && (
                              <button className="btn btn-sm btn-secondary" onClick={() => cambiarEstado(t.id, 'planificado')}>Revertir</button>
                            )}
                            <button className="btn btn-sm btn-secondary" onClick={() => requerirPassword(() => handleEditar(t))} title="Editar">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => requerirPassword(() => eliminar(t.id))} title="Eliminar">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="trat-group-subtotal">
                  Subtotal: ${grupo.items.reduce((s, t) => s + (t.costo_total || 0), 0).toLocaleString()}
                  {' | '}Pagado: ${grupo.items.reduce((s, t) => s + (t.monto_a_cuenta || 0), 0).toLocaleString()}
                  {' | '}Saldo: ${grupo.items.reduce((s, t) => s + (t.saldo_pendiente || 0), 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {totalPaginas > 1 && (
            <div className="trat-pagination">
              <button className="btn btn-sm btn-secondary" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
              <span className="trat-pagination-info">{pagina} / {totalPaginas}</span>
              <button className="btn btn-sm btn-secondary" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}

      {mostrarWhatsApp && paciente && (
        <WhatsAppConfirm
          paciente={paciente}
          tipo="plan"
          onEnviar={() => setMostrarWhatsApp(false)}
          onCancelar={() => setMostrarWhatsApp(false)}
        />
      )}
      {mostrarPassword && (
        <ConfirmarPassword
          titulo="Confirmar accion"
          onConfirm={passwordConfirmado}
          onCancelar={() => { setMostrarPassword(false); setAccionPendiente(null); }}
        />
      )}
    </div>
  );
}
