import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { nombreCompleto, tipoDocLabel } from '../utils/formatters';

const FORM_NUEVO = {
  apellido_paterno: '', apellido_materno: '', nombres: '', dni: '', tipo_documento: 'dni', telefono: '',
  email: '', fecha_nacimiento: '', sexo: '',
};

export default function Recepcion({ onVolver, onStartSesion }) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [pacientesRecientes, setPacientesRecientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false);
  const [formNuevo, setFormNuevo] = useState({ ...FORM_NUEVO });
  const [errorNuevo, setErrorNuevo] = useState('');
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);

  useEffect(() => { cargarRecientes(); }, []);

  const cargarRecientes = async () => {
    try {
      const data = await api.pacientes.listar();
      setPacientesRecientes(data.slice(0, 8));
    } catch {}
    setCargando(false);
  };

  const buscar = async (q) => {
    setBusqueda(q);
    if (q.trim().length < 1) { setResultados([]); return; }
    setBuscando(true);
    try {
      const data = await api.pacientes.buscar(q.trim());
      setResultados(data);
    } catch {}
    setBuscando(false);
  };

  const seleccionarPaciente = (p) => {
    onStartSesion(p);
  };

  const handleSubmitNuevo = async (e) => {
    e.preventDefault();
    setErrorNuevo('');
    setGuardandoNuevo(true);
    try {
      const res = await api.pacientes.crear(formNuevo);
      if (res.error) { setErrorNuevo(res.error); setGuardandoNuevo(false); return; }
      const pacienteCreado = await api.pacientes.obtener(res.id);
      setMostrarFormNuevo(false);
      setFormNuevo({ ...FORM_NUEVO });
      onStartSesion(pacienteCreado);
    } catch (err) {
      setErrorNuevo('Error al crear paciente: ' + err.message);
    }
    setGuardandoNuevo(false);
  };

  const abrirFormNuevo = () => {
    setFormNuevo({ ...FORM_NUEVO });
    setErrorNuevo('');
    setMostrarFormNuevo(true);
  };

  return (
    <div className="recepcion-moderna">
      <div className="recepcion-moderna-header">
        <div>
          <h2>Nueva Sesion Clinica</h2>
          <p>Selecciona un paciente o crea uno nuevo</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary btn-sm" onClick={abrirFormNuevo}>
            + Nuevo Paciente
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onVolver}>Volver al Dashboard</button>
        </div>
      </div>

      <div className="recepcion-search-section">
        <div className="recepcion-search-bar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            value={busqueda}
            onChange={e => buscar(e.target.value)}
            placeholder="Buscar por nombre, DNI o telefono..."
            autoFocus
          />
          {buscando && <span className="search-spinner"></span>}
        </div>
      </div>

      {busqueda.trim().length > 0 && resultados.length > 0 && (
        <div className="recepcion-resultados">
          <h3>Resultados ({resultados.length})</h3>
          <div className="recepcion-patient-grid">
            {resultados.map(p => (
              <div key={p.id} className="recepcion-patient-card" onClick={() => seleccionarPaciente(p)}>
                <div className="patient-avatar">{(p.apellido_paterno || p.nombre || '?').charAt(0)}</div>
                <div className="patient-info">
                  <span className="patient-name">{nombreCompleto(p)}</span>
                  <span className="patient-meta">DNI: {p.dni}</span>
                  {p.telefono && <span className="patient-meta">Tel: {p.telefono}</span>}
                </div>
                <div className="patient-action">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {busqueda.trim().length > 0 && resultados.length === 0 && !buscando && (
        <div className="recepcion-empty-search">
          <p>No se encontraron pacientes con "{busqueda}"</p>
          <button className="btn btn-primary btn-sm" onClick={abrirFormNuevo}>
            + Crear nuevo paciente
          </button>
        </div>
      )}

      {busqueda.trim().length === 0 && (
        <div className="recepcion-recientes">
          <h3>Pacientes Recientes</h3>
          {cargando ? (
            <div className="loading">Cargando...</div>
          ) : pacientesRecientes.length === 0 ? (
            <div className="recepcion-empty">
              <p>No hay pacientes registrados</p>
              <button className="btn btn-primary btn-sm" onClick={abrirFormNuevo}>
                + Crear primer paciente
              </button>
            </div>
          ) : (
            <div className="recepcion-patient-grid">
              {pacientesRecientes.map(p => (
                <div key={p.id} className="recepcion-patient-card" onClick={() => seleccionarPaciente(p)}>
                  <div className="patient-avatar">{(p.apellido_paterno || p.nombre || '?').charAt(0)}</div>
                  <div className="patient-info">
                    <span className="patient-name">{nombreCompleto(p)}</span>
                  <span className="patient-meta">{tipoDocLabel(p.tipo_documento)}: {p.dni}</span>
                    {p.telefono && <span className="patient-meta">Tel: {p.telefono}</span>}
                  </div>
                  <div className="patient-action">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mostrarFormNuevo && (
        <div className="modal-overlay" onClick={() => setMostrarFormNuevo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nuevo Paciente</h3>
              <button className="btn-close" onClick={() => setMostrarFormNuevo(false)}>&times;</button>
            </div>
            {errorNuevo && <div className="alert alert-error">{errorNuevo}</div>}
            <form onSubmit={handleSubmitNuevo} className="form">
              <div className="form-grid">
                <div className="field">
                  <label>Apellido Paterno *</label>
                  <input type="text" value={formNuevo.apellido_paterno} onChange={(e) => setFormNuevo({...formNuevo, apellido_paterno: e.target.value})} required />
                </div>
                <div className="field">
                  <label>Apellido Materno</label>
                  <input type="text" value={formNuevo.apellido_materno} onChange={(e) => setFormNuevo({...formNuevo, apellido_materno: e.target.value})} />
                </div>
                <div className="field">
                  <label>Nombres *</label>
                  <input type="text" value={formNuevo.nombres} onChange={(e) => setFormNuevo({...formNuevo, nombres: e.target.value})} required />
                </div>
                <div className="field">
                  <label>DNI *</label>
                  <input type="text" value={formNuevo.dni} onChange={(e) => setFormNuevo({...formNuevo, dni: e.target.value})} required />
                </div>
                <div className="field">
                  <label>Telefono</label>
                  <input type="text" value={formNuevo.telefono} onChange={(e) => setFormNuevo({...formNuevo, telefono: e.target.value})} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={formNuevo.email} onChange={(e) => setFormNuevo({...formNuevo, email: e.target.value})} />
                </div>
                <div className="field">
                  <label>Fecha de Nacimiento</label>
                  <input type="date" value={formNuevo.fecha_nacimiento} onChange={(e) => setFormNuevo({...formNuevo, fecha_nacimiento: e.target.value})} />
                </div>
                <div className="field">
                  <label>Sexo</label>
                  <select value={formNuevo.sexo} onChange={(e) => setFormNuevo({...formNuevo, sexo: e.target.value})}>
                    <option value="">Seleccionar...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setMostrarFormNuevo(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardandoNuevo}>
                  {guardandoNuevo ? 'Creando...' : 'Crear e Iniciar Sesion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
