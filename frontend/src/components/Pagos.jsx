import { useState, useEffect } from 'react';
import { api } from '../services/api';
import WhatsAppConfirm from './WhatsAppConfirm';
import ConfirmarPassword from './ConfirmarPassword';

const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'seguro', label: 'Seguro' },
  { value: 'otro', label: 'Otro' },
];

export default function Pagos({ pacienteId, paciente, consultas }) {
  const [pagos, setPagos] = useState([]);
  const [resumen, setResumen] = useState({ total_general: 0, total_pagado: 0, total_pendiente: 0, saldo_tratamientos: 0, cantidad_tratamientos: 0 });
  const [tratamientos, setTratamientos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ fecha: new Date().toISOString().split('T')[0], procedimiento: '', total: '', a_cuenta: '', metodo_pago: 'efectivo', notas: '', consulta_id: '', tratamiento_id: '' });
  const [editando, setEditando] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarWhatsApp, setMostrarWhatsApp] = useState(false);
  const [pagoParaWhatsApp, setPagoParaWhatsApp] = useState(null);
  const [enviandoPdf, setEnviandoPdf] = useState(null);
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
    const [pagosData, resumenData, tratsData] = await Promise.all([
      api.pagos.listarPorPaciente(pacienteId),
      api.pagos.resumen(pacienteId),
      api.tratamientos.listar(pacienteId),
    ]);
    setPagos(pagosData);
    setResumen(resumenData);
    setTratamientos(tratsData.filter(t => t.saldo_pendiente > 0));
    setCargando(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      paciente_id: pacienteId,
      consulta_id: form.consulta_id ? parseInt(form.consulta_id) : null,
      tratamiento_id: form.tratamiento_id ? parseInt(form.tratamiento_id) : null,
      fecha: form.fecha,
      procedimiento: form.procedimiento,
      total: parseFloat(form.total) || 0,
      a_cuenta: parseFloat(form.a_cuenta) || 0,
      metodo_pago: form.metodo_pago,
      notas: form.notas,
    };
    if (editando) {
      const res = await api.pagos.actualizar(editando.id, payload);
      if (res.error) { setError(res.error); return; }
    } else {
      const res = await api.pagos.crear(payload);
      if (res.error) { setError(res.error); return; }
    }
    setMostrarForm(false);
    setEditando(null);
    setForm({ fecha: new Date().toISOString().split('T')[0], procedimiento: '', total: '', a_cuenta: '', metodo_pago: 'efectivo', notas: '', consulta_id: '', tratamiento_id: '' });
    cargar();
  };

  const handleEditar = (p) => {
    setForm({
      fecha: p.fecha,
      procedimiento: p.procedimiento || '',
      total: String(p.total || ''),
      a_cuenta: String(p.a_cuenta || ''),
      metodo_pago: p.metodo_pago || 'efectivo',
      notas: p.notas || '',
      consulta_id: p.consulta_id ? String(p.consulta_id) : '',
      tratamiento_id: p.tratamiento_id ? String(p.tratamiento_id) : '',
    });
    setEditando(p);
    setMostrarForm(true);
  };

  const handleEliminar = async (id) => {
    if (!confirm('Eliminar este registro de pago?')) return;
    await api.pagos.eliminar(id);
    cargar();
  };

  const abrirNuevo = () => {
    setForm({ fecha: new Date().toISOString().split('T')[0], procedimiento: '', total: '', a_cuenta: '', metodo_pago: 'efectivo', notas: '', consulta_id: '', tratamiento_id: '' });
    setEditando(null);
    setMostrarForm(true);
  };

  const handleTratamientoSelect = (e) => {
    const val = e.target.value;
    if (val) {
      const t = tratamientos.find(tr => tr.id === parseInt(val));
      if (t) {
        setForm(prev => ({
          ...prev,
          tratamiento_id: val,
          procedimiento: t.procedimiento_realizado || '',
          total: String(t.saldo_pendiente || t.costo_total || ''),
        }));
        return;
      }
    }
    setForm(prev => ({ ...prev, tratamiento_id: val }));
  };

  if (cargando) return <div className="loading">Cargando pagos...</div>;

  return (
    <div className="pagos-panel">
      <div className="pagos-resumen">
        <div className="pago-resumen-card">
          <span className="pago-resumen-label">Total Pagos</span>
          <span className="pago-resumen-valor">${resumen.total_general?.toLocaleString() || '0'}</span>
        </div>
        <div className="pago-resumen-card pagado">
          <span className="pago-resumen-label">Pagado</span>
          <span className="pago-resumen-valor">${resumen.total_pagado?.toLocaleString() || '0'}</span>
        </div>
        <div className="pago-resumen-card pendiente">
          <span className="pago-resumen-label">Pendiente</span>
          <span className="pago-resumen-valor">${resumen.total_pendiente?.toLocaleString() || '0'}</span>
        </div>
        {resumen.saldo_tratamientos > 0 && (
          <div className="pago-resumen-card">
            <span className="pago-resumen-label">Saldo Tratamientos</span>
            <span className="pago-resumen-valor" style={{ color: '#92400e' }}>${resumen.saldo_tratamientos?.toLocaleString() || '0'}</span>
          </div>
        )}
      </div>

      <div className="pagos-header">
        <span className="recetas-count">{pagos.length} registro{pagos.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-primary btn-sm" onClick={abrirNuevo}>
          + Nuevo Pago
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {mostrarForm && (
        <div className="tratamiento-form-card">
          <form onSubmit={handleSubmit}>
            <div className="form-grid-3">
              <div className="field">
                <label>Vincular a Tratamiento</label>
                <select value={form.tratamiento_id} onChange={handleTratamientoSelect}>
                  <option value="">Sin vincular</option>
                  {tratamientos.map(t => (
                    <option key={t.id} value={t.id}>{t.procedimiento_realizado} — ${t.saldo_pendiente.toLocaleString()} pend.</option>
                  ))}
                </select>
              </div>
              {consultas && consultas.length > 0 && (
                <div className="field">
                  <label>Consulta vinculada</label>
                  <select value={form.consulta_id} onChange={e => setForm({ ...form, consulta_id: e.target.value })}>
                    <option value="">Seleccionar consulta...</option>
                    {consultas.map(c => (
                      <option key={c.id} value={c.id}>{new Date(c.fecha).toLocaleDateString()} - {c.motivo}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label>Metodo de Pago</label>
                <select value={form.metodo_pago} onChange={e => setForm({ ...form, metodo_pago: e.target.value })}>
                  {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid-3">
              <div className="field">
                <label>Fecha *</label>
                <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div className="field">
                <label>Procedimiento</label>
                <input type="text" value={form.procedimiento} onChange={e => setForm({ ...form, procedimiento: e.target.value })} placeholder="Descripcion del procedimiento" />
              </div>
              <div className="field">
                <label>Total ($)</label>
                <input type="number" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} min="0" step="0.01" placeholder="0.00" />
              </div>
            </div>
            <div className="form-grid-3">
              <div className="field">
                <label>A Cuenta ($)</label>
                <input type="number" value={form.a_cuenta} onChange={e => setForm({ ...form, a_cuenta: e.target.value })} min="0" step="0.01" placeholder="0.00" />
              </div>
              <div className="field">
                <label>Saldo</label>
                <input type="text" value={`$${((parseFloat(form.total) || 0) - (parseFloat(form.a_cuenta) || 0)).toLocaleString()}`} readOnly className="field-readonly" />
              </div>
              <div className="field">
                <label>Notas</label>
                <input type="text" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones..." />
              </div>
            </div>
            <div className="form-actions-inline">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary btn-sm">{editando ? 'Guardar Cambios' : 'Registrar Pago'}</button>
            </div>
          </form>
        </div>
      )}

      {pagos.length === 0 ? (
        <p className="empty">No hay registros de pagos</p>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Procedimiento</th>
                <th>Tratamiento</th>
                <th>Total</th>
                <th>A Cuenta</th>
                <th>Saldo</th>
                <th>Metodo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map(p => (
                <tr key={p.id}>
                  <td>{new Date(p.fecha).toLocaleDateString()}</td>
                  <td>{p.procedimiento || '-'}</td>
                  <td>{p.tratamiento_descripcion || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                  <td><strong>${(p.total || 0).toLocaleString()}</strong></td>
                  <td>${(p.a_cuenta || 0).toLocaleString()}</td>
                  <td>
                    <span className={`saldo-badge ${(p.saldo || 0) > 0 ? 'pendiente' : 'pagado'}`}>
                      ${(p.saldo || 0).toLocaleString()}
                    </span>
                  </td>
                  <td>{METODOS_PAGO.find(m => m.value === p.metodo_pago)?.label || p.metodo_pago}</td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => requerirPassword(() => handleEditar(p))} title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      {p.saldo > 0 && <button className="btn btn-sm btn-success" onClick={() => { setPagoParaWhatsApp(p); setMostrarWhatsApp(true); }} title="WhatsApp">W</button>}
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={enviandoPdf === p.id}
                        onClick={async () => {
                          if (enviandoPdf) return;
                          setEnviandoPdf(p.id);
                          try {
                            const res = await api.whatsapp.enviarPdf({ paciente_id: paciente.id, tipo: 'pago' });
                            if (res.error) alert('Error: ' + res.error);
                            else alert('Comprobante PDF enviado a ' + res.to);
                          } catch (e) { alert('Error: ' + e.message); }
                          setEnviandoPdf(null);
                        }}
                        title="Enviar PDF por WhatsApp"
                      >
                        {enviandoPdf === p.id ? (
                          <span className="spinner-sm"></span>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        )}
                      </button>
                      <a className="btn btn-sm btn-secondary" href={api.pdf.pago(p.id)} target="_blank" rel="noopener noreferrer" title="PDF">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </a>
                      <button className="btn btn-sm btn-danger" onClick={() => requerirPassword(() => handleEliminar(p.id))} title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mostrarWhatsApp && paciente && (
        <WhatsAppConfirm
          paciente={paciente}
          tipo="recordatorio_pago"
          onEnviar={() => { setMostrarWhatsApp(false); setPagoParaWhatsApp(null); }}
          onCancelar={() => { setMostrarWhatsApp(false); setPagoParaWhatsApp(null); }}
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
