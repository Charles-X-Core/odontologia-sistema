import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { nombreCompleto } from '../utils/formatters';

const TIPOS_CITA = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'control', label: 'Control' },
  { value: 'tratamiento', label: 'Tratamiento' },
  { value: 'urgencia', label: 'Urgencia' },
  { value: 'limpieza', label: 'Limpieza' },
];

export default function AppointmentForm({ prefilled, onDone, onBack }) {
  const editMode = prefilled?.editMode;
  const existingCita = prefilled?.cita;

  const [form, setForm] = useState({
    paciente_id: existingCita?.paciente_id || prefilled?.paciente?.id || '',
    fecha: existingCita?.fecha || prefilled?.fecha || new Date().toISOString().split('T')[0],
    hora: existingCita?.hora || '',
    duracion_minutos: existingCita?.duracion_minutos || 30,
    tipo: existingCita?.tipo || 'consulta',
    motivo: existingCita?.motivo_usar || existingCita?.motivo || prefilled?.motivo || '',
    notas: existingCita?.notas || '',
  });

  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(
    existingCita ? { id: existingCita.paciente_id, apellido_paterno: existingCita.paciente_nombre?.split(' ')[0] || '', nombres: existingCita.paciente_nombre || '', dni: existingCita.paciente_dni || '' }
    : prefilled?.paciente || null
  );

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  const [formRapido, setFormRapido] = useState({ nombres: '', dni: '', telefono: '' });
  const [errorRapido, setErrorRapido] = useState('');

  const buscarPaciente = async (q) => {
    setBusqueda(q);
    if (q.length < 2) { setResultados([]); return; }
    try {
      const data = await api.pacientes.buscar(q);
      setResultados(Array.isArray(data) ? data : []);
    } catch {}
  };

  const seleccionarPaciente = (p) => {
    setPacienteSeleccionado(p);
    setForm({ ...form, paciente_id: p.id });
    setBusqueda('');
    setResultados([]);
  };

  const registrarRapido = async () => {
    setErrorRapido('');
    if (!formRapido.nombres.trim() || !formRapido.dni.trim()) {
      setErrorRapido('Nombre y DNI son obligatorios');
      return;
    }
    try {
      const parts = formRapido.nombres.trim().split(/\s+/);
      const apellidoPaterno = parts.length > 1 ? parts[0] : formRapido.nombres;
      const nombresResto = parts.length > 1 ? parts.slice(1).join(' ') : '';
      const res = await api.pacientes.crear({
        apellido_paterno: apellidoPaterno,
        apellido_materno: '',
        nombres: nombresResto || apellidoPaterno,
        dni: formRapido.dni.trim(),
        telefono: formRapido.telefono || '',
        tipo_documento: 'dni',
      });
      if (res.error) { setErrorRapido(res.error); return; }
      seleccionarPaciente({ id: res.id, apellido_paterno: apellidoPaterno, apellido_materno: '', nombres: nombresResto || apellidoPaterno, dni: formRapido.dni.trim() });
      setMostrarRegistro(false);
      setFormRapido({ nombres: '', dni: '', telefono: '' });
    } catch (e) { setErrorRapido('Error: ' + e.message); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.paciente_id) { setError('Selecciona un paciente'); return; }
    if (!form.fecha || !form.hora) { setError('Fecha y hora son obligatorias'); return; }

    setGuardando(true);
    try {
      let res;
      if (editMode && existingCita) {
        res = await api.citas.actualizar(existingCita.id, form);
      } else {
        res = await api.citas.crear(form);
      }
      if (res.error) { setError(res.error); setGuardando(false); return; }
      onDone();
    } catch (e) { setError('Error: ' + e.message); }
    setGuardando(false);
  };

  return (
    <div className="appointment-form">
      <div className="pd-header">
        <button className="pd-back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="pd-name">{editMode ? 'Editar Cita' : 'Nueva Cita'}</h2>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!pacienteSeleccionado ? (
        <div className="form-section">
          <label className="form-label">Buscar paciente *</label>
          <input
            type="text"
            className="search-input"
            placeholder="Nombre, DNI o telefono..."
            value={busqueda}
            onChange={e => buscarPaciente(e.target.value)}
            autoFocus
          />
          {resultados.length > 0 && (
            <div className="search-results">
              {resultados.map(p => (
                <div key={p.id} className="search-result-item" onClick={() => seleccionarPaciente(p)}>
                  <strong>{nombreCompleto(p)}</strong>
                  <span>DNI: {p.dni}</span>
                </div>
              ))}
            </div>
          )}
          <button className="btn-text" onClick={() => setMostrarRegistro(true)}>+ Registrar nuevo paciente</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="selected-patient">
            <div className="patient-avatar">{(pacienteSeleccionado.apellido_paterno || '?').charAt(0)}</div>
            <div>
              <div className="patient-name">{nombreCompleto(pacienteSeleccionado)}</div>
              <div className="patient-meta">DNI: {pacienteSeleccionado.dni}</div>
            </div>
            <button type="button" className="btn-text" onClick={() => setPacienteSeleccionado(null)}>Cambiar</button>
          </div>

          <div className="form-section">
            <div className="form-row-2">
              <div>
                <label className="form-label">Fecha *</label>
                <input type="date" className="form-input" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">Hora *</label>
                <input type="time" className="form-input" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} required />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-row-2">
              <div>
                <label className="form-label">Tipo</label>
                <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                  {TIPOS_CITA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Duracion</label>
                <select className="form-input" value={form.duracion_minutos} onChange={e => setForm({ ...form, duracion_minutos: parseInt(e.target.value) })}>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Motivo de la consulta *</label>
            <textarea
              className="form-input form-textarea"
              value={form.motivo}
              onChange={e => setForm({ ...form, motivo: e.target.value })}
              placeholder="Describe el motivo..."
              rows={3}
              required
            />
          </div>

          <div className="form-section">
            <label className="form-label">Notas (opcional)</label>
            <input
              type="text"
              className="form-input"
              value={form.notas}
              onChange={e => setForm({ ...form, notas: e.target.value })}
              placeholder="Notas internas..."
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onBack}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando ? 'Guardando...' : editMode ? 'Guardar Cambios' : 'Crear Cita'}
            </button>
          </div>
        </form>
      )}

      {mostrarRegistro && (
        <div className="modal-overlay" onClick={() => setMostrarRegistro(false)}>
          <div className="modal-mobile" onClick={e => e.stopPropagation()}>
            <h3>Nuevo Paciente</h3>
            {errorRapido && <div className="form-error">{errorRapido}</div>}
            <div className="form-section">
              <label className="form-label">Nombre completo *</label>
              <input type="text" className="form-input" value={formRapido.nombres} onChange={e => setFormRapido({ ...formRapido, nombres: e.target.value })} placeholder="Nombre y apellido" autoFocus />
            </div>
            <div className="form-section">
              <label className="form-label">DNI *</label>
              <input type="text" className="form-input" value={formRapido.dni} onChange={e => setFormRapido({ ...formRapido, dni: e.target.value })} placeholder="8 digitos" maxLength={8} />
            </div>
            <div className="form-section">
              <label className="form-label">Telefono</label>
              <input type="text" className="form-input" value={formRapido.telefono} onChange={e => setFormRapido({ ...formRapido, telefono: e.target.value })} placeholder="982-123-456" />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setMostrarRegistro(false)}>Cancelar</button>
              <button className="btn-primary" onClick={registrarRapido}>Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
