import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { nombreCompleto, tipoDocLabel, tipoDocPlaceholder, validarDocumento, validarFechaNacimiento } from '../utils/formatters';

const FORM_NUEVO = {
  apellido_paterno: '', apellido_materno: '', nombres: '', dni: '', tipo_documento: 'dni', telefono: '',
  email: '', fecha_nacimiento: '', sexo: '', estado_civil: '', direccion: '', lugar_nacimiento: '',
  lugar_procedencia: '', grado_instruccion: '', ocupacion: '', nombre_acompanante: '',
  contacto_emergencia: '', telefono_emergencia: '',
  alergias: '', antecedentes_personales: '', antecedentes_familiares: '',
};

const ANTECEDENTES_FIELDS = [
  { key: 'alergia_medicamentos', label: 'Alergia a medicamentos' },
  { key: 'propension_hemorragias', label: 'Propension a hemorragia' },
  { key: 'complicaciones_anestesia', label: 'Complicaciones con anestesia' },
  { key: 'presion_arterial_medicacion', label: 'Presion Arterial / Medicacion' },
  { key: 'cardiopatias_personales', label: 'Cardiopatias personales' },
  { key: 'cardiopatias_familiares', label: 'Cardiopatias familiares' },
  { key: 'diabetes_personal', label: 'Diabetes personal' },
  { key: 'diabetes_familiar', label: 'Diabetes familiar' },
  { key: 'hepatitis', label: 'Hepatitis (tipo A B C)' },
  { key: 'otras_enfermedades', label: 'Otras enfermedades' },
  { key: 'enfermedad_actual_medicacion', label: 'Enfermedad actual / Medicacion' },
];

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
  const [antecedentesForm, setAntecedentesForm] = useState({});

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

    if (!formNuevo.apellido_paterno?.trim() || !formNuevo.nombres?.trim()) {
      setErrorNuevo('Apellido paterno y nombres son obligatorios');
      setGuardandoNuevo(false);
      return;
    }

    const docTipo = formNuevo.tipo_documento || 'dni';
    if (docTipo !== 'sin_doc' && !formNuevo.dni?.trim()) {
      setErrorNuevo(`El numero de ${tipoDocLabel(docTipo)} es obligatorio`);
      setGuardandoNuevo(false);
      return;
    }

    if (formNuevo.dni && !validarDocumento(docTipo, formNuevo.dni)) {
      setErrorNuevo(`Formato invalido para ${tipoDocLabel(docTipo)}`);
      setGuardandoNuevo(false);
      return;
    }

    if (formNuevo.fecha_nacimiento) {
      const valFecha = validarFechaNacimiento(formNuevo.fecha_nacimiento);
      if (!valFecha.valido) { setErrorNuevo(valFecha.error); setGuardandoNuevo(false); return; }
    }

    setGuardandoNuevo(true);
    try {
      const res = await api.pacientes.crear(formNuevo);
      if (res.error) { setErrorNuevo(res.error); setGuardandoNuevo(false); return; }
      if (Object.values(antecedentesForm).some(v => v && v !== 'No')) {
        await api.historias.crear({ paciente_id: res.id, ...antecedentesForm });
      }
      const pacienteCreado = await api.pacientes.obtener(res.id);
      setMostrarFormNuevo(false);
      setFormNuevo({ ...FORM_NUEVO });
      setAntecedentesForm({});
      onStartSesion(pacienteCreado);
    } catch (err) {
      setErrorNuevo('Error al crear paciente: ' + err.message);
    }
    setGuardandoNuevo(false);
  };

  const abrirFormNuevo = () => {
    setFormNuevo({ ...FORM_NUEVO });
    setAntecedentesForm({});
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
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>Nuevo Paciente</h3>
              <button className="btn-close" onClick={() => setMostrarFormNuevo(false)}>&times;</button>
            </div>
            {errorNuevo && <div className="alert alert-error">{errorNuevo}</div>}
            <form onSubmit={handleSubmitNuevo} className="form">
              <div className="form-section">
                <h4>Identificacion del Paciente</h4>
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
                    <label>Tipo de Documento</label>
                    <select value={formNuevo.tipo_documento} onChange={(e) => setFormNuevo({...formNuevo, tipo_documento: e.target.value, dni: e.target.value === 'sin_doc' ? '' : formNuevo.dni})}>
                      <option value="dni">DNI</option>
                      <option value="ce">CE (Carnet de Extranjeria)</option>
                      <option value="pasaporte">Pasaporte</option>
                      <option value="sin_doc">Sin documento</option>
                    </select>
                  </div>
                  {formNuevo.tipo_documento !== 'sin_doc' && (
                    <div className="field">
                      <label>{tipoDocLabel(formNuevo.tipo_documento)} {formNuevo.tipo_documento === 'dni' ? '*' : ''}</label>
                      <input
                        type="text"
                        value={formNuevo.dni}
                        onChange={(e) => setFormNuevo({...formNuevo, dni: e.target.value})}
                        placeholder={tipoDocPlaceholder(formNuevo.tipo_documento)}
                        required={formNuevo.tipo_documento === 'dni'}
                        maxLength={formNuevo.tipo_documento === 'dni' ? 8 : 15}
                        pattern={formNuevo.tipo_documento === 'dni' ? '\\d{8}' : undefined}
                      />
                    </div>
                  )}
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
                  <div className="field">
                    <label>Estado Civil</label>
                    <select value={formNuevo.estado_civil} onChange={(e) => setFormNuevo({...formNuevo, estado_civil: e.target.value})}>
                      <option value="">Seleccionar...</option>
                      <option value="Soltero">Soltero/a</option>
                      <option value="Casado">Casado/a</option>
                      <option value="Divorciado">Divorciado/a</option>
                      <option value="Viudo">Viudo/a</option>
                      <option value="Conviviente">Conviviente</option>
                    </select>
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
                    <label>Direccion</label>
                    <input type="text" value={formNuevo.direccion} onChange={(e) => setFormNuevo({...formNuevo, direccion: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Lugar de Nacimiento</label>
                    <input type="text" value={formNuevo.lugar_nacimiento} onChange={(e) => setFormNuevo({...formNuevo, lugar_nacimiento: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Lugar de Procedencia</label>
                    <input type="text" value={formNuevo.lugar_procedencia} onChange={(e) => setFormNuevo({...formNuevo, lugar_procedencia: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Grado de Instruccion</label>
                    <select value={formNuevo.grado_instruccion} onChange={(e) => setFormNuevo({...formNuevo, grado_instruccion: e.target.value})}>
                      <option value="">Seleccionar...</option>
                      <option value="Primaria">Primaria</option>
                      <option value="Secundaria">Secundaria</option>
                      <option value="Tecnico">Tecnico</option>
                      <option value="Universitario">Universitario</option>
                      <option value="Postgrado">Postgrado</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Ocupacion</label>
                    <input type="text" value={formNuevo.ocupacion} onChange={(e) => setFormNuevo({...formNuevo, ocupacion: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Acompanante</label>
                    <input type="text" value={formNuevo.nombre_acompanante} onChange={(e) => setFormNuevo({...formNuevo, nombre_acompanante: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Contacto de Emergencia</label>
                    <input type="text" value={formNuevo.contacto_emergencia} onChange={(e) => setFormNuevo({...formNuevo, contacto_emergencia: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Telefono de Emergencia</label>
                    <input type="text" value={formNuevo.telefono_emergencia} onChange={(e) => setFormNuevo({...formNuevo, telefono_emergencia: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h4>Antecedentes Medicos</h4>
                <div className="antecedentes-form">
                  {ANTECEDENTES_FIELDS.map(({ key, label }) => {
                    const valor = antecedentesForm[key] || '';
                    const isYes = valor && valor !== 'No' && valor !== '';
                    return (
                      <div key={key} className="antecedente-field">
                        <label>{label}</label>
                        <div className="antecedente-sino">
                          <button
                            type="button"
                            className={`antecedente-btn ${isYes ? 'si-activo' : ''}`}
                            onClick={() => setAntecedentesForm({ ...antecedentesForm, [key]: isYes ? '' : 'Si' })}
                          >
                            Si
                          </button>
                          <button
                            type="button"
                            className={`antecedente-btn ${!isYes && valor === 'No' ? 'no-activo' : ''}`}
                            onClick={() => setAntecedentesForm({ ...antecedentesForm, [key]: 'No' })}
                          >
                            No
                          </button>
                        </div>
                        {isYes && (
                          <input
                            type="text"
                            value={valor === 'Si' ? '' : valor}
                            onChange={e => setAntecedentesForm({ ...antecedentesForm, [key]: e.target.value || 'Si' })}
                            placeholder="Observaciones (opcional)"
                            className="antecedente-obs"
                          />
                        )}
                      </div>
                    );
                  })}
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
