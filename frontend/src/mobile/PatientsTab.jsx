import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { nombreCompleto, calcularEdad, tipoDocLabel } from '../utils/formatters';

export default function PatientsTab({ onViewPatient, onNewAppointment }) {
  const [pacientes, setPacientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [resultado, setResultado] = useState([]);

  useEffect(() => { cargarPacientes(); }, []);

  const cargarPacientes = async () => {
    setCargando(true);
    try {
      const data = await api.pacientes.listar();
      setPacientes(Array.isArray(data) ? data : []);
    } catch {}
    setCargando(false);
  };

  const buscar = async (q) => {
    setBusqueda(q);
    if (q.length < 2) { setResultado([]); return; }
    try {
      const data = await api.pacientes.buscar(q);
      setResultado(Array.isArray(data) ? data : []);
    } catch {}
  };

  const lista = busqueda.length >= 2 ? resultado : pacientes;

  return (
    <div className="patients-tab">
      <div className="patients-header">
        <h1 className="home-title">Pacientes</h1>
      </div>

      <input
        type="text"
        className="search-input"
        placeholder="Buscar por nombre, DNI o telefono..."
        value={busqueda}
        onChange={e => buscar(e.target.value)}
      />

      {cargando ? (
        <div className="empty-state">Cargando pacientes...</div>
      ) : lista.length === 0 ? (
        <div className="empty-state">
          <p>No se encontraron pacientes</p>
        </div>
      ) : (
        <div className="patients-list">
          {lista.map(p => (
            <div key={p.id} className="patient-card" onClick={() => onViewPatient(p)}>
              <div className="patient-avatar">{(p.apellido_paterno || '?').charAt(0)}</div>
              <div className="patient-info">
                <div className="patient-name">{nombreCompleto(p)}</div>
                <div className="patient-meta">
                  {tipoDocLabel(p.tipo_documento)}: {p.dni}
                  {p.fecha_nacimiento && <> | {calcularEdad(p.fecha_nacimiento)} anos</>}
                </div>
                {p.telefono && <div className="patient-phone"> {p.telefono}</div>}
              </div>
              <svg className="patient-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
