import { useState, useEffect } from 'react';
import { api } from '../services/api';

const ESTADOS_DIENTE = ['sano', 'caries', 'endodoncia', 'corona', 'restaurado', 'extraccion', 'protesis', 'ausente'];

export default function Historial({ paciente, onVolver }) {
  const [historia, setHistoria] = useState(null);
  const [consultas, setConsultas] = useState([]);
  const [mostrarConsulta, setMostrarConsulta] = useState(false);
  const [mostrarOdontograma, setMostrarOdontograma] = useState(false);
  const [odontogramaActual, setOdontogramaActual] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [formConsulta, setFormConsulta] = useState({ motivo: '', diagnostico: '', tratamiento: '', notas: '' });
  const [odontogramaForm, setOdontogramaForm] = useState({});
  const [dienteSeleccionado, setDienteSeleccionado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { cargarHistorial(); }, []);

  const cargarHistorial = async () => {
    try {
      const data = await api.pacientes.historial(paciente.id);
      setHistoria(data.historia);
      setConsultas(data.consultas || []);
      if (data.historia) {
        const odont = await api.odontogramas.obtener(data.historia.id).catch(() => []);
        if (odont.length > 0) setOdontogramaActual(odont[0]);
      }
    } catch {}
    setCargando(false);
  };

  const crearConsulta = async (e) => {
    e.preventDefault();
    setError('');
    if (!historia) {
      setError('Primero debes crear la historia clinica del paciente');
      return;
    }
    const res = await api.consultas.crear({ historia_id: historia.id, ...formConsulta });
    if (res.error) { setError(res.error); return; }

    if (Object.keys(odontogramaForm).length > 0) {
      await api.odontogramas.crear({
        consulta_id: res.id,
        datos_json: { version: consultas.length + 1, dientes: odontogramaForm }
      });
    }

    setMostrarConsulta(false);
    setFormConsulta({ motivo: '', diagnostico: '', tratamiento: '', notas: '' });
    setOdontogramaForm({});
    cargarHistorial();
  };

  const toggleDiente = (num) => {
    setDienteSeleccionado(num === dienteSeleccionado ? null : num);
  };

  const setEstadoDiente = (estado) => {
    if (!dienteSeleccionado) return;
    setOdontogramaForm(prev => ({ ...prev, [dienteSeleccionado]: { estado, procedimientos: [] } }));
    setDienteSeleccionado(null);
  };

  if (cargando) return <div className="loading">Cargando historial...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn-back" onClick={onVolver}>&larr; Volver</button>
          <h2>{paciente.nombre}</h2>
          <p>DNI: {paciente.dni} {paciente.telefono ? `| Tel: ${paciente.telefono}` : ''}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setMostrarConsulta(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva Consulta
          </button>
        </div>
      </div>

      {historia && (
        <div className="info-cards">
          <div className="info-card">
            <h4>Antecedentes</h4>
            <p>{historia.antecedentes || 'Sin antecedentes'}</p>
          </div>
          <div className="info-card">
            <h4>Alergias</h4>
            <p>{historia.alergias || 'Sin alergias conocidas'}</p>
          </div>
          {historia.observaciones && (
            <div className="info-card">
              <h4>Observaciones</h4>
              <p>{historia.observaciones}</p>
            </div>
          )}
        </div>
      )}

      {!historia && (
        <div className="card">
          <div className="card-body-center">
            <p>Este paciente no tiene historia clinica.</p>
            <button className="btn btn-primary" onClick={async () => {
              await api.historias.crear ? null : null;
              const res = await fetch(`http://localhost:3001/api/historias`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ paciente_id: paciente.id, antecedentes: '', alergias: '' })
              });
              cargarHistorial();
            }}>Crear Historia Clinica</button>
          </div>
        </div>
      )}

      {mostrarConsulta && (
        <div className="modal-overlay" onClick={() => setMostrarConsulta(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nueva Consulta</h3>
              <button className="btn-close" onClick={() => setMostrarConsulta(false)}>&times;</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={crearConsulta} className="form">
              <div className="field">
                <label>Motivo de consulta *</label>
                <textarea value={formConsulta.motivo} onChange={(e) => setFormConsulta({...formConsulta, motivo: e.target.value})} required rows={2} />
              </div>
              <div className="field">
                <label>Diagnostico *</label>
                <textarea value={formConsulta.diagnostico} onChange={(e) => setFormConsulta({...formConsulta, diagnostico: e.target.value})} required rows={2} />
              </div>
              <div className="field">
                <label>Tratamiento *</label>
                <textarea value={formConsulta.tratamiento} onChange={(e) => setFormConsulta({...formConsulta, tratamiento: e.target.value})} required rows={2} />
              </div>
              <div className="field">
                <label>Notas</label>
                <textarea value={formConsulta.notas} onChange={(e) => setFormConsulta({...formConsulta, notas: e.target.value})} rows={2} />
              </div>

              <div className="odontograma-section">
                <h4>Odontograma (opcional) - Clic en un diente para marcar</h4>
                <div className="dientes-editor">
                  {Array.from({ length: 32 }, (_, i) => {
                    const num = i + 1;
                    const estado = odontogramaForm[num]?.estado || 'sano';
                    return (
                      <button
                        key={num}
                        type="button"
                        className={`diente-btn ${estado} ${dienteSeleccionado === num ? 'selected' : ''}`}
                        onClick={() => toggleDiente(num)}
                        title={`Diente ${num}`}
                      >
                        <span className="diente-num">{num}</span>
                      </button>
                    );
                  })}
                </div>
                {dienteSeleccionado && (
                  <div className="estado-selector">
                    <span>Diente {dienteSeleccionado} - Estado:</span>
                    {ESTADOS_DIENTE.map((e) => (
                      <button key={e} type="button" className={`btn btn-sm ${odontogramaForm[dienteSeleccionado]?.estado === e ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEstadoDiente(e)}>
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setMostrarConsulta(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Consulta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Historial de Consultas ({consultas.length})</h3>
        </div>
        {consultas.length === 0 ? (
          <p className="empty">No hay consultas registradas</p>
        ) : (
          <div className="timeline">
            {consultas.map((c) => (
              <div key={c.id} className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <div className="timeline-date">{new Date(c.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  <h4>{c.motivo}</h4>
                  <div className="timeline-details">
                    <div><strong>Diagnostico:</strong> {c.diagnostico}</div>
                    <div><strong>Tratamiento:</strong> {c.tratamiento}</div>
                    {c.notas && <div className="notas"><em>{c.notas}</em></div>}
                  </div>
                  {c.odontograma && (
                    <div className="odontograma-preview">
                      <strong>Odontograma:</strong>
                      <div className="dientes-mini">
                        {Object.entries(c.odontograma.dientes || {}).map(([num, datos]) => (
                          <span key={num} className={`diente-tag ${datos.estado}`} title={`Diente ${num}: ${datos.estado}`}>
                            {num}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
