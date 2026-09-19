import { useState, useEffect } from 'react';
import { api } from '../services/api';

const ESTADOS = {
  pendiente: { bg: '#fef3c7', text: '#92400e', label: 'Pendiente' },
  confirmada: { bg: '#dbeafe', text: '#1e40af', label: 'Confirmada' },
  asistio: { bg: '#dcfce7', text: '#166534', label: 'Asistio' },
  completada: { bg: '#e0e7ff', text: '#3730a3', label: 'Completada' },
  cancelada: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelada' },
  no_asistio: { bg: '#f3f4f6', text: '#6b7280', label: 'No asistio' },
};

export default function HomeTab({ onViewPatient, onNewAppointment, onEditAppointment }) {
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [motivoModal, setMotivoModal] = useState(null);
  const [motivoText, setMotivoText] = useState('');

  const hoy = new Date().toISOString().split('T')[0];
  const hoyLabel = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => { cargarCitas(); }, []);

  const cargarCitas = async () => {
    setCargando(true);
    try {
      const data = await api.citas.listar({ fecha: hoy });
      setCitas(Array.isArray(data) ? data : []);
    } catch {}
    setCargando(false);
  };

  const handleRefresh = async () => {
    setRefrescando(true);
    await cargarCitas();
    setRefrescando(false);
  };

  const handleConfirmar = async (cita) => {
    setMotivoText(cita.motivo_usar || cita.motivo || '');
    setMotivoModal(cita);
  };

  const confirmarConMotivo = async () => {
    if (!motivoModal) return;
    try {
      if (motivoModal.estado === 'pendiente') {
        await api.citas.confirmar(motivoModal.id, { motivo_editado: motivoText });
      } else if (motivoModal.estado === 'confirmada') {
        await api.citas.asistio(motivoModal.id, { motivo_editado: motivoText });
      }
      setMotivoModal(null);
      cargarCitas();
    } catch {}
  };

  const handleCancelar = async (cita) => {
    if (!confirm('Cancelar esta cita?')) return;
    try {
      await api.citas.actualizar(cita.id, { estado: 'cancelada' });
      cargarCitas();
    } catch {}
  };

  const citasFiltradas = citas.filter(c => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (c.paciente_nombre || '').toLowerCase().includes(q) ||
           (c.paciente_dni || '').includes(q);
  });

  const totalHoy = citas.length;
  const pendientes = citas.filter(c => c.estado === 'pendiente').length;
  const confirmadas = citas.filter(c => c.estado === 'confirmada').length;

  return (
    <div className="home-tab">
      <div className="home-header">
        <div>
          <h1 className="home-title">Citas de hoy</h1>
          <p className="home-date">{hoyLabel}</p>
        </div>
        <button className="fab" onClick={() => onNewAppointment()}>+</button>
      </div>

      <div className="home-stats">
        <div className="stat-pill total">{totalHoy} total</div>
        <div className="stat-pill pending">{pendientes} pendientes</div>
        <div className="stat-pill confirmed">{confirmadas} confirmadas</div>
      </div>

      <input
        type="text"
        className="search-input"
        placeholder="Buscar por nombre o DNI..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
      />

      <button className="refresh-btn" onClick={handleRefresh} disabled={refrescando}>
        {refrescando ? 'Actualizando...' : 'Actualizar'}
      </button>

      {cargando ? (
        <div className="empty-state">Cargando citas...</div>
      ) : citasFiltradas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">&#128197;</div>
          <p>No hay citas para hoy</p>
          <button className="btn-primary" onClick={() => onNewAppointment()}>Crear primera cita</button>
        </div>
      ) : (
        <div className="citas-list">
          {citasFiltradas.map(cita => {
            const estado = ESTADOS[cita.estado] || ESTADOS.pendiente;
            return (
              <div key={cita.id} className="cita-card">
                <div className="cita-card-header">
                  <span className="cita-time">{cita.hora}</span>
                  <span className="cita-duration">{cita.duracion_minutos || 30}min</span>
                  <span className="cita-badge" style={{ background: estado.bg, color: estado.text }}>{estado.label}</span>
                </div>
                <div className="cita-card-body" onClick={() => onViewPatient({ id: cita.paciente_id, dni: cita.paciente_dni })}>
                  <div className="cita-patient">{cita.paciente_nombre}</div>
                  <div className="cita-dni">DNI: {cita.paciente_dni}</div>
                  {cita.motivo_usar && <div className="cita-motivo">"{cita.motivo_usar}"</div>}
                  {cita.paciente_alergias && <div className="cita-alergia">Alergias: {cita.paciente_alergias}</div>}
                </div>
                <div className="cita-card-actions">
                  {cita.estado === 'pendiente' && (
                    <button className="btn-sm btn-confirm" onClick={() => handleConfirmar(cita)}>Confirmar</button>
                  )}
                  {cita.estado === 'confirmada' && (
                    <button className="btn-sm btn-checkin" onClick={() => handleConfirmar(cita)}>Asistio</button>
                  )}
                  {cita.estado !== 'completada' && cita.estado !== 'cancelada' && cita.estado !== 'no_asistio' && (
                    <>
                      <button className="btn-sm btn-edit" onClick={() => onEditAppointment(cita)}>Editar</button>
                      <button className="btn-sm btn-cancel" onClick={() => handleCancelar(cita)}>X</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {motivoModal && (
        <div className="modal-overlay" onClick={() => setMotivoModal(null)}>
          <div className="modal-mobile" onClick={e => e.stopPropagation()}>
            <h3>{motivoModal.estado === 'pendiente' ? 'Confirmar Cita' : 'Registrar Asistencia'}</h3>
            <div className="modal-patient-info">
              <strong>{motivoModal.paciente_nombre}</strong>
              <span>{motivoModal.hora} - {motivoModal.tipo}</span>
            </div>
            <textarea
              placeholder="Motivo de la consulta..."
              value={motivoText}
              onChange={e => setMotivoText(e.target.value)}
              rows={4}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setMotivoModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmarConMotivo}>
                {motivoModal.estado === 'pendiente' ? 'Confirmar' : 'Marcar Asistio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
