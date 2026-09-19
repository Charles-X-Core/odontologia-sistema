import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { nombreCompleto, calcularEdad, tipoDocLabel } from '../utils/formatters';

const TIPOS_CITA = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'control', label: 'Control' },
  { value: 'tratamiento', label: 'Tratamiento' },
  { value: 'urgencia', label: 'Urgencia' },
  { value: 'limpieza', label: 'Limpieza' },
];

const ESTADOS_COLORS = {
  pendiente: { bg: '#fef3c7', text: '#92400e', label: 'Pendiente' },
  confirmada: { bg: '#dbeafe', text: '#1e40af', label: 'Confirmada' },
  asistio: { bg: '#dcfce7', text: '#166534', label: 'Asistio' },
  completada: { bg: '#e0e7ff', text: '#3730a3', label: 'Completada' },
  cancelada: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelada' },
  no_asistio: { bg: '#f3f4f6', text: '#6b7280', label: 'No asistio' },
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function Citas({ onAbrirSesion }) {
  const isMobile = useIsMobile();
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroFecha, setFiltroFecha] = useState(new Date().toISOString().split('T')[0]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ paciente_id: '', fecha: '', hora: '', duracion_minutos: 30, tipo: 'consulta', motivo: '', notas: '' });
  const [error, setError] = useState('');

  const [buscandoPaciente, setBuscandoPaciente] = useState(false);
  const [resultadoBusqueda, setResultadoBusqueda] = useState([]);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');

  const [mostrarRegistroRapido, setMostrarRegistroRapido] = useState(false);
  const [formRapido, setFormRapido] = useState({ nombres: '', dni: '', telefono: '' });
  const [errorRapido, setErrorRapido] = useState('');

  const [mostrarMotivo, setMostrarMotivo] = useState(null);
  const [motivoEdit, setMotivoEdit] = useState('');
  const [guardandoMotivo, setGuardandoMotivo] = useState(false);

  useEffect(() => { cargarCitas(); }, [filtroFecha, filtroEstado]);

  const cargarCitas = async () => {
    setCargando(true);
    try {
      const params = {};
      if (filtroFecha) params.fecha = filtroFecha;
      if (filtroEstado) params.estado = filtroEstado;
      const data = await api.citas.listar(params);
      setCitas(Array.isArray(data) ? data : []);
    } catch {}
    setCargando(false);
  };

  const buscarPaciente = async (q) => {
    setTerminoBusqueda(q);
    if (q.length < 2) { setResultadoBusqueda([]); return; }
    try {
      const data = await api.pacientes.buscar(q);
      setResultadoBusqueda(Array.isArray(data) ? data : []);
    } catch {}
  };

  const seleccionarPaciente = (p) => {
    setPacienteSeleccionado(p);
    setForm({ ...form, paciente_id: p.id });
    setBuscandoPaciente(false);
    setTerminoBusqueda('');
    setResultadoBusqueda([]);
  };

  const registrarPacienteRapido = async () => {
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
      const nuevo = { id: res.id, apellido_paterno: apellidoPaterno, apellido_materno: '', nombres: nombresResto || apellidoPaterno, dni: formRapido.dni.trim(), telefono: formRapido.telefono || '' };
      seleccionarPaciente(nuevo);
      setMostrarRegistroRapido(false);
      setFormRapido({ nombres: '', dni: '', telefono: '' });
    } catch (e) {
      setErrorRapido('Error al registrar: ' + e.message);
    }
  };

  const abrirNuevaCita = () => {
    setEditando(null);
    setForm({ paciente_id: '', fecha: filtroFecha || new Date().toISOString().split('T')[0], hora: '', duracion_minutos: 30, tipo: 'consulta', motivo: '', notas: '' });
    setPacienteSeleccionado(null);
    setBuscandoPaciente(true);
    setMostrarForm(true);
    setError('');
  };

  const abrirEditarCita = (cita) => {
    setEditando(cita);
    setPacienteSeleccionado({ id: cita.paciente_id, apellido_paterno: cita.paciente_nombre?.split(' ')[0] || '', nombres: cita.paciente_nombre || '', dni: cita.paciente_dni || '' });
    setForm({
      paciente_id: cita.paciente_id,
      fecha: cita.fecha,
      hora: cita.hora,
      duracion_minutos: cita.duracion_minutos || 30,
      tipo: cita.tipo || 'consulta',
      motivo: cita.motivo_usar || cita.motivo || '',
      notas: cita.notas || '',
    });
    setBuscandoPaciente(false);
    setMostrarForm(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.paciente_id) { setError('Selecciona un paciente'); return; }
    if (!form.fecha || !form.hora) { setError('Fecha y hora son obligatorias'); return; }

    try {
      if (editando) {
        const res = await api.citas.actualizar(editando.id, form);
        if (res.error) { setError(res.error); return; }
      } else {
        const res = await api.citas.crear(form);
        if (res.error) { setError(res.error); return; }
      }
      setMostrarForm(false);
      setEditando(null);
      setPacienteSeleccionado(null);
      cargarCitas();
    } catch (e) {
      setError('Error: ' + e.message);
    }
  };

  const handleConfirmar = async (cita) => {
    setMotivoEdit(cita.motivo_usar || cita.motivo || '');
    setMostrarMotivo(cita);
  };

  const confirmarConMotivo = async () => {
    if (!mostrarMotivo) return;
    setGuardandoMotivo(true);
    try {
      if (mostrarMotivo.estado === 'pendiente') {
        await api.citas.confirmar(mostrarMotivo.id, { motivo_editado: motivoEdit });
      } else if (mostrarMotivo.estado === 'confirmada') {
        await api.citas.asistio(mostrarMotivo.id, { motivo_editado: motivoEdit });
      }
      setMostrarMotivo(null);
      cargarCitas();
    } catch {}
    setGuardandoMotivo(false);
  };

  const handleAsistio = async (cita) => {
    try {
      await api.citas.asistio(cita.id, {});
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

  const handleAbrirSesion = async (cita) => {
    try {
      const data = await api.citas.prepararSesion(cita.id);
      if (data.error) { alert(data.error); return; }
      onAbrirSesion?.(data);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const citasFiltradas = citas.filter(c => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (c.paciente_nombre || '').toLowerCase().includes(q) ||
           (c.paciente_dni || '').includes(q) ||
           (c.motivo_usar || c.motivo || '').toLowerCase().includes(q);
  });

  const hoy = new Date().toISOString().split('T')[0];

  const renderEstadoBadge = (estado) => {
    const conf = ESTADOS_COLORS[estado] || ESTADOS_COLORS.pendiente;
    return <span style={{ background: conf.bg, color: conf.text, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>{conf.label}</span>;
  };

  const renderAcciones = (cita) => {
    if (cita.estado === 'completada' || cita.estado === 'cancelada' || cita.estado === 'no_asistio') {
      return <span style={{ color: 'var(--gray-400)', fontSize: '12px' }}>-</span>;
    }
    if (cita.estado === 'asistio') {
      return (
        <button className="btn btn-sm btn-primary" onClick={() => handleAbrirSesion(cita)} style={{ fontSize: '12px', padding: '4px 10px' }}>
          Abrir Sesion
        </button>
      );
    }
    return (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {(cita.estado === 'pendiente') && (
          <button className="btn btn-sm btn-primary" onClick={() => handleConfirmar(cita)} style={{ fontSize: '11px', padding: '3px 8px' }}>
            Confirmar
          </button>
        )}
        {(cita.estado === 'confirmada') && (
          <button className="btn btn-sm btn-success" onClick={() => handleConfirmar(cita)} style={{ fontSize: '11px', padding: '3px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Asistio
          </button>
        )}
        <button className="btn btn-sm btn-secondary" onClick={() => abrirEditarCita(cita)} style={{ fontSize: '11px', padding: '3px 8px' }}>
          Editar
        </button>
        <button className="btn btn-sm btn-secondary" onClick={() => handleCancelar(cita)} style={{ fontSize: '11px', padding: '3px 8px', color: '#dc2626' }}>
          X
        </button>
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className="citas-container" style={{ padding: '16px', paddingBottom: '80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Citas</h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--gray-500)' }}>
              {new Date(filtroFecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button className="btn btn-primary" onClick={abrirNuevaCita} style={{ padding: '8px 14px', fontSize: '13px' }}>+ Nueva</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} style={{ flex: 1, padding: '8px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px' }} />
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ padding: '8px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px' }}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <input type="text" placeholder="Buscar paciente, DNI o motivo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px', marginBottom: '12px', boxSizing: 'border-box' }} />

        {cargando ? (
          <p style={{ textAlign: 'center', color: 'var(--gray-400)' }}>Cargando...</p>
        ) : citasFiltradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--gray-400)' }}>
            <p style={{ fontSize: '40px', margin: '0 0 8px' }}> </p>
            <p style={{ fontSize: '14px' }}>No hay citas para este dia</p>
            <button className="btn btn-primary" onClick={abrirNuevaCita} style={{ marginTop: '12px' }}>Crear primera cita</button>
          </div>
        ) : (
          citasFiltradas.map(cita => (
            <div key={cita.id} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '14px', marginBottom: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gray-800)' }}>{cita.hora}</span>
                  <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--gray-500)' }}>{cita.duracion_minutos}min</span>
                </div>
                {renderEstadoBadge(cita.estado)}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px' }}>{cita.paciente_nombre}</div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>{tipoDocLabel(cita.paciente_dni)}: {cita.paciente_dni}</div>
              {cita.motivo_usar && <div style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '4px', fontStyle: 'italic' }}>"{cita.motivo_usar}"</div>}
              {cita.paciente_alergias && <div style={{ fontSize: '11px', color: '#dc2626', marginBottom: '4px' }}>⚠ {cita.paciente_alergias}</div>}
              {cita.paciente_telefono && <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}> {cita.paciente_telefono}</div>}
              <div style={{ marginTop: '8px' }}>{renderAcciones(cita)}</div>
            </div>
          ))
        )}

        {mostrarForm && renderModalForm()}
        {mostrarMotivo && renderModalMotivo()}
        {mostrarRegistroRapido && renderModalRegistroRapido()}
      </div>
    );
  }

  return (
    <div className="citas-container" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Citas</h2>
        <button className="btn btn-primary" onClick={abrirNuevaCita}>+ Nueva Cita</button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px' }} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px' }}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input type="text" placeholder="Buscar paciente, DNI o motivo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px', minWidth: '250px' }} />
      </div>

      {cargando ? (
        <p style={{ textAlign: 'center', color: 'var(--gray-400)' }}>Cargando...</p>
      ) : citasFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray-400)' }}>
          <p style={{ fontSize: '48px', margin: '0 0 12px' }}> </p>
          <p style={{ fontSize: '16px' }}>No hay citas para este dia</p>
          <button className="btn btn-primary" onClick={abrirNuevaCita} style={{ marginTop: '12px' }}>Crear primera cita</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Hora</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Paciente</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Tipo</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Motivo</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Estado</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Accion</th>
              </tr>
            </thead>
            <tbody>
              {citasFiltradas.map(cita => (
                <tr key={cita.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{cita.hora}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600 }}>{cita.paciente_nombre}</div>
                    <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{cita.paciente_dni}</div>
                  </td>
                  <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>{cita.tipo}</td>
                  <td style={{ padding: '10px 14px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cita.motivo_usar || '-'}</td>
                  <td style={{ padding: '10px 14px' }}>{renderEstadoBadge(cita.estado)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{renderAcciones(cita)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mostrarForm && renderModalForm()}
      {mostrarMotivo && renderModalMotivo()}
      {mostrarRegistroRapido && renderModalRegistroRapido()}
    </div>
  );

  function renderModalForm() {
    return (
      <div className="modal-overlay" onClick={() => setMostrarForm(false)}>
        <div className="modal" style={{ maxWidth: '500px', width: '95%' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{editando ? 'Editar Cita' : 'Nueva Cita'}</h3>
            <button className="btn-close" onClick={() => setMostrarForm(false)}>&times;</button>
          </div>
          {error && <div style={{ padding: '8px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', margin: '12px 14px 0', fontSize: '13px' }}>{error}</div>}

          {buscandoPaciente && !pacienteSeleccionado && (
            <div style={{ padding: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Buscar paciente *</label>
              <input type="text" placeholder="Nombre, DNI o telefono..." value={terminoBusqueda} onChange={e => buscarPaciente(e.target.value)} autoFocus style={{ width: '100%', padding: '10px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
              {resultadoBusqueda.length > 0 && (
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: '8px', marginTop: '6px' }}>
                  {resultadoBusqueda.map(p => (
                    <div key={p.id} onClick={() => seleccionarPaciente(p)} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', fontSize: '13px' }}>
                      <strong>{nombreCompleto(p)}</strong> <span style={{ color: 'var(--gray-500)' }}>DNI: {p.dni}</span>
                      {p.telefono && <span style={{ color: 'var(--gray-400)', marginLeft: '8px' }}> {p.telefono}</span>}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => { setMostrarRegistroRapido(true); setBuscandoPaciente(false); }} style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>+ Registrar nuevo paciente</button>
            </div>
          )}

          {pacienteSeleccionado && (
            <form onSubmit={handleSubmit}>
              <div style={{ padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'var(--gray-50)', borderRadius: '8px', marginBottom: '14px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                    {(pacienteSeleccionado.apellido_paterno || '?').charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{nombreCompleto(pacienteSeleccionado)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>DNI: {pacienteSeleccionado.dni}</div>
                  </div>
                  <button type="button" onClick={() => { setPacienteSeleccionado(null); setBuscandoPaciente(true); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px' }}>Cambiar</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Fecha *</label>
                    <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required style={{ width: '100%', padding: '8px', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Hora *</label>
                    <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} required style={{ width: '100%', padding: '8px', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tipo</label>
                    <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}>
                      {TIPOS_CITA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Duracion</label>
                    <select value={form.duracion_minutos} onChange={e => setForm({ ...form, duracion_minutos: parseInt(e.target.value) })} style={{ width: '100%', padding: '8px', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}>
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Motivo de la consulta *</label>
                  <textarea value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} placeholder="Describe el motivo de la cita..." rows={3} required style={{ width: '100%', padding: '8px', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Notas (opcional)</label>
                  <input type="text" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Notas internas..." style={{ width: '100%', padding: '8px', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setMostrarForm(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">{editando ? 'Guardar Cambios' : 'Crear Cita'}</button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  function renderModalMotivo() {
    return (
      <div className="modal-overlay" onClick={() => setMostrarMotivo(null)}>
        <div className="modal" style={{ maxWidth: '420px', width: '95%' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{mostrarMotivo.estado === 'pendiente' ? 'Confirmar Cita' : 'Registrar Asistencia'}</h3>
            <button className="btn-close" onClick={() => setMostrarMotivo(null)}>&times;</button>
          </div>
          <div style={{ padding: '14px' }}>
            <div style={{ padding: '10px', background: 'var(--gray-50)', borderRadius: '8px', marginBottom: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{mostrarMotivo.paciente_nombre}</div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{mostrarMotivo.hora} - {mostrarMotivo.tipo}</div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Motivo de la consulta</label>
              <textarea value={motivoEdit} onChange={e => setMotivoEdit(e.target.value)} placeholder="Describe el motivo de la consulta..." rows={4} style={{ width: '100%', padding: '10px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setMostrarMotivo(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarConMotivo} disabled={guardandoMotivo}>
                {guardandoMotivo ? 'Guardando...' : mostrarMotivo.estado === 'pendiente' ? 'Confirmar' : 'Marcar Asistio'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderModalRegistroRapido() {
    return (
      <div className="modal-overlay" onClick={() => setMostrarRegistroRapido(false)}>
        <div className="modal" style={{ maxWidth: '400px', width: '95%' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Nuevo Paciente</h3>
            <button className="btn-close" onClick={() => setMostrarRegistroRapido(false)}>&times;</button>
          </div>
          {errorRapido && <div style={{ padding: '8px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', margin: '12px 14px 0', fontSize: '13px' }}>{errorRapido}</div>}
          <div style={{ padding: '14px' }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nombre completo *</label>
              <input type="text" value={formRapido.nombres} onChange={e => setFormRapido({ ...formRapido, nombres: e.target.value })} placeholder="Nombre y apellido" autoFocus style={{ width: '100%', padding: '10px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>DNI *</label>
              <input type="text" value={formRapido.dni} onChange={e => setFormRapido({ ...formRapido, dni: e.target.value })} placeholder="8 digitos" maxLength={8} style={{ width: '100%', padding: '10px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Telefono (opcional)</label>
              <input type="text" value={formRapido.telefono} onChange={e => setFormRapido({ ...formRapido, telefono: e.target.value })} placeholder="982-123-456" style={{ width: '100%', padding: '10px', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setMostrarRegistroRapido(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={registrarPacienteRapido}>Registrar y continuar</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
