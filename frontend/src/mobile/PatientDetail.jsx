import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { nombreCompleto, calcularEdad, tipoDocLabel } from '../utils/formatters';

export default function PatientDetail({ patient, onBack, onNewAppointment }) {
  const [datos, setDatos] = useState(null);
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('info');

  useEffect(() => { cargarDatos(); }, [patient?.id]);

  const cargarDatos = async () => {
    if (!patient?.id) { setCargando(false); return; }
    setCargando(true);
    try {
      const [pData, cData] = await Promise.allSettled([
        api.pacientes.obtener(patient.id),
        api.citas.listar({ paciente_id: patient.id })
      ]);
      if (pData.status === 'fulfilled') setDatos(pData.value);
      if (cData.status === 'fulfilled') setCitas(Array.isArray(cData.value) ? cData.value : []);
    } catch {}
    setCargando(false);
  };

  if (cargando) return <div className="empty-state">Cargando...</div>;
  if (!datos) return <div className="empty-state">Paciente no encontrado</div>;

  return (
    <div className="patient-detail">
      <div className="pd-header">
        <button className="pd-back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="pd-name">{nombreCompleto(datos)}</h2>
        <button className="pd-action" onClick={() => onNewAppointment(datos)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <div className="pd-tabs">
        <button className={`pd-tab ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>Info</button>
        <button className={`pd-tab ${tab === 'citas' ? 'active' : ''}`} onClick={() => setTab('citas')}>Citas ({citas.length})</button>
      </div>

      {tab === 'info' && (
        <div className="pd-info">
          <div className="pd-info-row">
            <span className="pd-label">DNI</span>
            <span className="pd-value">{tipoDocLabel(datos.tipo_documento)}: {datos.dni}</span>
          </div>
          {datos.fecha_nacimiento && (
            <div className="pd-info-row">
              <span className="pd-label">Edad</span>
              <span className="pd-value">{calcularEdad(datos.fecha_nacimiento)} anos</span>
            </div>
          )}
          {datos.sexo && (
            <div className="pd-info-row">
              <span className="pd-label">Sexo</span>
              <span className="pd-value">{datos.sexo}</span>
            </div>
          )}
          {datos.telefono && (
            <div className="pd-info-row">
              <span className="pd-label">Telefono</span>
              <span className="pd-value"> {datos.telefono}</span>
            </div>
          )}
          {datos.email && (
            <div className="pd-info-row">
              <span className="pd-label">Email</span>
              <span className="pd-value">{datos.email}</span>
            </div>
          )}
          {datos.direccion && (
            <div className="pd-info-row">
              <span className="pd-label">Direccion</span>
              <span className="pd-value">{datos.direccion}</span>
            </div>
          )}
          {datos.alergias && (
            <div className="pd-info-row alert">
              <span className="pd-label">Alergias</span>
              <span className="pd-value">{datos.alergias}</span>
            </div>
          )}
          {datos.enfermedades_cronicas && (
            <div className="pd-info-row">
              <span className="pd-label">Enfermedades</span>
              <span className="pd-value">{datos.enfermedades_cronicas}</span>
            </div>
          )}
          {datos.medicamentos && (
            <div className="pd-info-row">
              <span className="pd-label">Medicamentos</span>
              <span className="pd-value">{datos.medicamentos}</span>
            </div>
          )}
          {datos.observaciones && (
            <div className="pd-info-row">
              <span className="pd-label">Observaciones</span>
              <span className="pd-value">{datos.observaciones}</span>
            </div>
          )}
        </div>
      )}

      {tab === 'citas' && (
        <div className="citas-list">
          {citas.length === 0 ? (
            <div className="empty-state"><p>Sin citas registradas</p></div>
          ) : (
            citas.map(cita => (
              <div key={cita.id} className="cita-card">
                <div className="cita-card-header">
                  <span className="cita-time">{cita.fecha} {cita.hora}</span>
                  <span className="cita-badge" style={{
                    background: cita.estado === 'completada' ? '#e0e7ff' : cita.estado === 'cancelada' ? '#fee2e2' : '#dbeafe',
                    color: cita.estado === 'completada' ? '#3730a3' : cita.estado === 'cancelada' ? '#991b1b' : '#1e40af'
                  }}>{cita.estado}</span>
                </div>
                <div className="cita-card-body">
                  <div className="cita-motivo">{cita.motivo_usar || cita.motivo || 'Sin motivo'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
