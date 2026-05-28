import { useState, useEffect } from 'react';
import { api } from '../services/api';

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

export default function Tratamientos({ pacienteId }) {
  const [tratamientos, setTratamientos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ descripcion: '', costo: '', diente_numero: '', notas: '' });
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargar(); }, [pacienteId]);

  const cargar = async () => {
    const data = await api.tratamientos.listar(pacienteId);
    setTratamientos(data);
    setCargando(false);
  };

  const crear = async (e) => {
    e.preventDefault();
    await api.tratamientos.crear({
      paciente_id: pacienteId,
      descripcion: form.descripcion,
      costo: form.costo ? parseFloat(form.costo) : 0,
      diente_numero: form.diente_numero ? parseInt(form.diente_numero) : null,
      notas: form.notas,
    });
    setMostrarForm(false);
    setForm({ descripcion: '', costo: '', diente_numero: '', notas: '' });
    cargar();
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

  const totalCosto = tratamientos.reduce((sum, t) => sum + (t.costo || 0), 0);
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
          <span className="stat-badge total">${totalCosto.toLocaleString()}</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setMostrarForm(true)}>
          + Nuevo Tratamiento
        </button>
      </div>

      {mostrarForm && (
        <div className="tratamiento-form-card">
          <form onSubmit={crear} className="form-inline">
            <div className="form-grid-3">
              <div className="field">
                <label>Descripcion *</label>
                <input type="text" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} required placeholder="Ej: Corona ceramica molar 16" />
              </div>
              <div className="field">
                <label>Costo ($)</label>
                <input type="number" value={form.costo} onChange={e => setForm({...form, costo: e.target.value})} placeholder="0" min="0" step="0.01" />
              </div>
              <div className="field">
                <label>Diente #</label>
                <input type="number" value={form.diente_numero} onChange={e => setForm({...form, diente_numero: e.target.value})} placeholder="Opcional" min="1" max="48" />
              </div>
            </div>
            <div className="field">
              <label>Notas</label>
              <input type="text" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Observaciones..." />
            </div>
            <div className="form-actions-inline">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary btn-sm">Crear</button>
            </div>
          </form>
        </div>
      )}

      {tratamientos.length === 0 ? (
        <p className="empty">No hay tratamientos registrados</p>
      ) : (
        <div className="tratamientos-lista">
          {tratamientos.map(t => {
            const color = ESTADO_COLORS[t.estado] || ESTADO_COLORS.pendiente;
            return (
              <div key={t.id} className="tratamiento-card" style={{ borderLeftColor: color.border }}>
                <div className="tratamiento-card-header">
                  <div>
                    <strong>{t.descripcion}</strong>
                    {t.diente_numero && <span className="diente-badge">Diente {t.diente_numero}</span>}
                  </div>
                  <span className="costo-badge">${(t.costo || 0).toLocaleString()}</span>
                </div>
                {t.notas && <p className="tratamiento-notas">{t.notas}</p>}
                <div className="tratamiento-card-footer">
                  <span className="estado-badge" style={{ background: color.bg, color: color.text, borderColor: color.border }}>
                    {ESTADO_LABELS[t.estado]}
                  </span>
                  <div className="tratamiento-actions">
                    {t.estado !== 'completado' && (
                      <button className="btn btn-sm btn-success" onClick={() => cambiarEstado(t.id, t.estado === 'pendiente' ? 'en_proceso' : 'completado')}>
                        {t.estado === 'pendiente' ? 'Iniciar' : 'Completar'}
                      </button>
                    )}
                    {t.estado === 'en_proceso' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => cambiarEstado(t.id, 'pendiente')}>Pausar</button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => eliminar(t.id)}>X</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
