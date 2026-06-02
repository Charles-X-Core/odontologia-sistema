import { useState, useEffect } from 'react';
import { api } from '../services/api';
import WhatsAppConfirm from './WhatsAppConfirm';

const ESTADO_COLORS = {
  pendiente: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  en_proceso: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  completado: { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
};

const ESTADO_LABELS = {
  pendiente: 'Pendiente',
  en_proceso: 'En Proceso',
  completado: 'Completado',
};

const FORM_DEFAULT = { procedimiento_realizado: '', costo_total: '', monto_a_cuenta: '', pieza_dental: '', fecha: new Date().toISOString().split('T')[0], notas: '', consulta_id: '' };

export default function Tratamientos({ pacienteId, consultas, paciente }) {
  const [tratamientos, setTratamientos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ ...FORM_DEFAULT });
  const [cargando, setCargando] = useState(true);
  const [mostrarWhatsApp, setMostrarWhatsApp] = useState(false);

  useEffect(() => { cargar(); }, [pacienteId]);

  const cargar = async () => {
    const data = await api.tratamientos.listar(pacienteId);
    setTratamientos(data);
    setCargando(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    if (editando) {
      await api.tratamientos.actualizar(editando.id, payload);
    } else {
      await api.tratamientos.crear(payload);
    }
    setMostrarForm(false);
    setEditando(null);
    setForm({ ...FORM_DEFAULT });
    cargar();
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
  const pendientes = tratamientos.filter(t => t.estado === 'pendiente').length;
  const enProceso = tratamientos.filter(t => t.estado === 'en_proceso').length;
  const completados = tratamientos.filter(t => t.estado === 'completado').length;

  if (cargando) return <div className="loading">Cargando tratamientos...</div>;

  return (
    <div className="tratamientos-panel">
      <div className="tratamientos-header">
        <div className="tratamientos-stats">
          <span className="stat-badge pendiente">{pendientes} pendientes</span>
          <span className="stat-badge en_proceso">{enProceso} en proceso</span>
          <span className="stat-badge completado">{completados} completados</span>
          <span className="stat-badge total">Total: ${totalCosto.toLocaleString()}</span>
          <span className="stat-badge pagado">Pagado: ${totalMonto.toLocaleString()}</span>
          <span className="stat-badge pendiente">Saldo: ${totalSaldo.toLocaleString()}</span>
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
              <input type="text" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Observaciones..." />
            </div>
            <div className="form-actions-inline">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setMostrarForm(false); setEditando(null); }}>Cancelar</button>
              <button type="submit" className="btn btn-primary btn-sm">{editando ? 'Guardar Cambios' : 'Crear'}</button>
            </div>
          </form>
        </div>
      )}

      {tratamientos.length === 0 ? (
        <p className="empty">No hay tratamientos registrados</p>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Pieza</th>
                <th>Procedimiento</th>
                <th>Costo</th>
                <th>A Cuenta</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tratamientos.map(t => {
                const color = ESTADO_COLORS[t.estado] || ESTADO_COLORS.pendiente;
                return (
                  <tr key={t.id}>
                    <td>{t.fecha ? new Date(t.fecha).toLocaleDateString() : '-'}</td>
                    <td>{t.pieza_dental || '-'}</td>
                    <td><strong>{t.procedimiento_realizado}</strong></td>
                    <td>${(t.costo_total || 0).toLocaleString()}</td>
                    <td>${(t.monto_a_cuenta || 0).toLocaleString()}</td>
                    <td>
                      <span className={`saldo-badge ${(t.saldo_pendiente || 0) > 0 ? 'pendiente' : 'pagado'}`}>
                        ${(t.saldo_pendiente || 0).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className="estado-badge" style={{ background: color.bg, color: color.text, borderColor: color.border }}>
                        {ESTADO_LABELS[t.estado]}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        {t.estado !== 'completado' && (
                          <button className="btn btn-sm btn-success" onClick={() => cambiarEstado(t.id, t.estado === 'pendiente' ? 'en_proceso' : 'completado')}>
                            {t.estado === 'pendiente' ? 'Iniciar' : 'Completar'}
                          </button>
                        )}
                        {t.estado === 'en_proceso' && (
                          <button className="btn btn-sm btn-secondary" onClick={() => cambiarEstado(t.id, 'pendiente')}>Pausar</button>
                        )}
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEditar(t)} title="Editar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => eliminar(t.id)}>X</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {mostrarWhatsApp && paciente && (
        <WhatsAppConfirm
          paciente={paciente}
          tipo="plan"
          onEnviar={() => setMostrarWhatsApp(false)}
          onCancelar={() => setMostrarWhatsApp(false)}
        />
      )}
    </div>
  );
}
