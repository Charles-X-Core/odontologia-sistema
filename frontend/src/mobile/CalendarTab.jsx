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

const DIAS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function CalendarTab({ onViewPatient, onNewAppointment, onEditAppointment }) {
  const [fechaActual, setFechaActual] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date());
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [citasPorDia, setCitasPorDia] = useState({});

  const anio = fechaActual.getFullYear();
  const mes = fechaActual.getMonth();
  const primerDia = new Date(anio, mes, 1).getDay();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();

  useEffect(() => { cargarCitasMes(); }, [anio, mes]);
  useEffect(() => { cargarCitasDia(); }, [diaSeleccionado]);

  const cargarCitasMes = async () => {
    try {
      const fechaInicio = `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
      const fechaFin = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(diasEnMes).padStart(2, '0')}`;
      const data = await api.citas.listar({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
      const porDia = {};
      (Array.isArray(data) ? data : []).forEach(c => {
        if (!porDia[c.fecha]) porDia[c.fecha] = [];
        porDia[c.fecha].push(c);
      });
      setCitasPorDia(porDia);
    } catch {}
  };

  const cargarCitasDia = async () => {
    setCargando(true);
    const fechaStr = diaSeleccionado.toISOString().split('T')[0];
    try {
      const data = await api.citas.listar({ fecha: fechaStr });
      setCitas(Array.isArray(data) ? data : []);
    } catch { setCitas([]); }
    setCargando(false);
  };

  const mesAnterior = () => setFechaActual(new Date(anio, mes - 1, 1));
  const mesSiguiente = () => setFechaActual(new Date(anio, mes + 1, 1));

  const seleccionarDia = (dia) => {
    setDiaSeleccionado(new Date(anio, mes, dia));
  };

  const esHoy = (dia) => {
    const hoy = new Date();
    return hoy.getFullYear() === anio && hoy.getMonth() === mes && hoy.getDate() === dia;
  };

  const esSeleccionado = (dia) => {
    return diaSeleccionado.getFullYear() === anio && diaSeleccionado.getMonth() === mes && diaSeleccionado.getDate() === dia;
  };

  const getCitasCount = (dia) => {
    const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    return citasPorDia[fechaStr]?.length || 0;
  };

  const diasCalendario = [];
  for (let i = 0; i < primerDia; i++) diasCalendario.push(null);
  for (let d = 1; d <= diasEnMes; d++) diasCalendario.push(d);

  return (
    <div className="calendar-tab">
      <div className="calendar-header">
        <button className="cal-nav" onClick={mesAnterior}>&lt;</button>
        <h2 className="cal-title">{MESES[mes]} {anio}</h2>
        <button className="cal-nav" onClick={mesSiguiente}>&gt;</button>
      </div>

      <div className="cal-weekdays">
        {DIAS.map(d => <div key={d} className="cal-weekday">{d}</div>)}
      </div>

      <div className="cal-grid">
        {diasCalendario.map((dia, i) => {
          if (dia === null) return <div key={`empty-${i}`} className="cal-day empty" />;
          const count = getCitasCount(dia);
          return (
            <div
              key={dia}
              className={`cal-day ${esHoy(dia) ? 'today' : ''} ${esSeleccionado(dia) ? 'selected' : ''} ${count > 0 ? 'has-citas' : ''}`}
              onClick={() => seleccionarDia(dia)}
            >
              <span>{dia}</span>
              {count > 0 && <span className="cal-dot">{count}</span>}
            </div>
          );
        })}
      </div>

      <div className="day-header">
        <h3>{diaSeleccionado.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
        <button className="btn-add-day" onClick={() => onNewAppointment({ fecha: diaSeleccionado.toISOString().split('T')[0] })}>+</button>
      </div>

      {cargando ? (
        <div className="empty-state">Cargando...</div>
      ) : citas.length === 0 ? (
        <div className="empty-state">
          <p>Sin citas este dia</p>
        </div>
      ) : (
        <div className="citas-list">
          {citas.map(cita => {
            const estado = ESTADOS[cita.estado] || ESTADOS.pendiente;
            return (
              <div key={cita.id} className="cita-card">
                <div className="cita-card-header">
                  <span className="cita-time">{cita.hora}</span>
                  <span className="cita-badge" style={{ background: estado.bg, color: estado.text }}>{estado.label}</span>
                </div>
                <div className="cita-card-body" onClick={() => onViewPatient({ id: cita.paciente_id, dni: cita.paciente_dni })}>
                  <div className="cita-patient">{cita.paciente_nombre}</div>
                  <div className="cita-dni">DNI: {cita.paciente_dni}</div>
                  {cita.motivo_usar && <div className="cita-motivo">"{cita.motivo_usar}"</div>}
                </div>
                <div className="cita-card-actions">
                  {cita.estado !== 'completada' && cita.estado !== 'cancelada' && (
                    <button className="btn-sm btn-edit" onClick={() => onEditAppointment(cita)}>Editar</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
