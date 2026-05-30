import { useState, useEffect } from 'react';
import { api } from '../services/api';
import OdontogramaSVG from './OdontogramaSVG';
import Tratamientos from './Tratamientos';
import Recetas from './Recetas';
import Galeria from './Galeria';

const ESTADOS_DIENTE = ['sano', 'caries', 'endodoncia', 'corona', 'restaurado', 'extraccion', 'protesis', 'ausente'];

export default function Historial({ paciente, onVolver }) {
  const [historia, setHistoria] = useState(null);
  const [consultas, setConsultas] = useState([]);
  const [odontogramas, setOdontogramas] = useState([]);
  const [tab, setTab] = useState('consultas');
  const [mostrarConsulta, setMostrarConsulta] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [formConsulta, setFormConsulta] = useState({ motivo: '', diagnostico: '', tratamiento: '', notas: '' });
  const [odontogramaForm, setOdontogramaForm] = useState({});
  const [error, setError] = useState('');

  useEffect(() => { cargarHistorial(); }, []);

  const cargarHistorial = async () => {
    try {
      const data = await api.pacientes.historial(paciente.id);
      setHistoria(data.historia);
      setConsultas(data.consultas || []);
    } catch {}
    setCargando(false);
  };

  const crearConsulta = async (e) => {
    e.preventDefault();
    setError('');
    if (!historia) {
      setError('Primero debes crear la historia clinica');
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

  if (cargando) return <div className="loading">Cargando historial...</div>;

  const tabs = [
    { key: 'consultas', label: 'Consultas', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { key: 'tratamientos', label: 'Tratamientos', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { key: 'recetas', label: 'Recetas', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'galeria', label: 'Galeria', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn-back" onClick={onVolver}>&larr; Volver</button>
          <h2>{paciente.nombre}</h2>
          <p>DNI: {paciente.dni} {paciente.telefono ? `| Tel: ${paciente.telefono}` : ''}</p>
        </div>
        {tab === 'consultas' && (
          <button className="btn btn-primary" onClick={() => setMostrarConsulta(true)}>
            + Nueva Consulta
          </button>
        )}
      </div>

      {historia && (
        <div className="info-cards">
          <div className="info-card"><h4>Antecedentes</h4><p>{historia.antecedentes || 'Sin antecedentes'}</p></div>
          <div className="info-card"><h4>Alergias</h4><p>{historia.alergias || 'Sin alergias conocidas'}</p></div>
          {historia.observaciones && <div className="info-card"><h4>Observaciones</h4><p>{historia.observaciones}</p></div>}
        </div>
      )}

      {!historia && (
        <div className="card">
          <div className="card-body-center">
            <p>Este paciente no tiene historia clinica.</p>
            <button className="btn btn-primary" onClick={async () => {
              const token = localStorage.getItem('token');
              const isElec = window.location.protocol === 'file:';
              const base = isElec ? 'http://localhost:18234' : 'http://localhost:3001';
              await fetch(`${base}/api/historias`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ paciente_id: paciente.id, antecedentes: '', alergias: '' })
              });
              cargarHistorial();
            }}>Crear Historia Clinica</button>
          </div>
        </div>
      )}

      <div className="tabs-container">
        <div className="tabs-nav">
          {tabs.map(t => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon}/></svg>
              {t.label}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {tab === 'consultas' && (
            <ConsultasTab consultas={consultas} />
          )}
          {tab === 'tratamientos' && (
            <Tratamientos pacienteId={paciente.id} />
          )}
          {tab === 'recetas' && (
            <Recetas pacienteId={paciente.id} consultas={consultas} />
          )}
          {tab === 'galeria' && (
            <Galeria pacienteId={paciente.id} />
          )}
        </div>
      </div>

      {mostrarConsulta && (
        <div className="modal-overlay" onClick={() => setMostrarConsulta(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nueva Consulta</h3>
              <button className="btn-close" onClick={() => setMostrarConsulta(false)}>&times;</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={crearConsulta} className="form">
              <div className="field">
                <label>Motivo de consulta *</label>
                <textarea value={formConsulta.motivo} onChange={e => setFormConsulta({...formConsulta, motivo: e.target.value})} required rows={2} />
              </div>
              <div className="field">
                <label>Diagnostico *</label>
                <textarea value={formConsulta.diagnostico} onChange={e => setFormConsulta({...formConsulta, diagnostico: e.target.value})} required rows={2} />
              </div>
              <div className="field">
                <label>Tratamiento *</label>
                <textarea value={formConsulta.tratamiento} onChange={e => setFormConsulta({...formConsulta, tratamiento: e.target.value})} required rows={2} />
              </div>
              <div className="field">
                <label>Notas</label>
                <textarea value={formConsulta.notas} onChange={e => setFormConsulta({...formConsulta, notas: e.target.value})} rows={2} />
              </div>

              <OdontogramaSVG
                datos={{ dientes: odontogramaForm }}
                editable={true}
                onCambio={(dientes) => setOdontogramaForm(dientes)}
                titulo="Odontograma de la consulta (opcional)"
              />

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setMostrarConsulta(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Consulta</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ConsultasTab({ consultas }) {
  if (consultas.length === 0) return <p className="empty">No hay consultas registradas</p>;

  return (
    <div className="timeline">
      {consultas.map(c => (
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
              <div className="odontograma-preview-inline">
                <OdontogramaSVG datos={typeof c.odontograma === 'string' ? JSON.parse(c.odontograma) : c.odontograma} editable={false} titulo="Odontograma de la consulta" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
