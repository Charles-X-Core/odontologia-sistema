import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function Pacientes({ onVerHistorial }) {
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState({ nombre: '', dni: '', telefono: '', email: '', fecha_nacimiento: '', sexo: '' });
  const [error, setError] = useState('');

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    const data = await api.pacientes.listar();
    setPacientes(data);
    setCargando(false);
  };

  const filtrados = pacientes.filter(
    (p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.dni.includes(busqueda)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (editando) {
      const res = await api.pacientes.actualizar(editando.id, form);
      if (res.error) { setError(res.error); return; }
    } else {
      const res = await api.pacientes.crear(form);
      if (res.error) { setError(res.error); return; }
      await api.historias.obtener(res.id).catch(() =>
        api.historias.crear ? null : null
      );
    }
    setMostrarForm(false);
    setEditando(null);
    setForm({ nombre: '', dni: '', telefono: '', email: '', fecha_nacimiento: '', sexo: '' });
    cargar();
  };

  const handleEditar = (p) => {
    setForm({ nombre: p.nombre, dni: p.dni, telefono: p.telefono || '', email: p.email || '', fecha_nacimiento: p.fecha_nacimiento || '', sexo: p.sexo || '' });
    setEditando(p);
    setMostrarForm(true);
  };

  const handleEliminar = async (id) => {
    if (!confirm('Eliminar paciente y todo su historial?')) return;
    await api.pacientes.eliminar(id);
    cargar();
  };

  const abrirNuevo = () => {
    setForm({ nombre: '', dni: '', telefono: '', email: '', fecha_nacimiento: '', sexo: '' });
    setEditando(null);
    setMostrarForm(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Pacientes</h2>
          <p>{pacientes.length} registros</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo Paciente
        </button>
      </div>

      {mostrarForm && (
        <div className="modal-overlay" onClick={() => setMostrarForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editando ? 'Editar Paciente' : 'Nuevo Paciente'}</h3>
              <button className="btn-close" onClick={() => setMostrarForm(false)}>&times;</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit} className="form">
              <div className="form-grid">
                <div className="field">
                  <label>Nombre completo *</label>
                  <input type="text" value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} required />
                </div>
                <div className="field">
                  <label>DNI *</label>
                  <input type="text" value={form.dni} onChange={(e) => setForm({...form, dni: e.target.value})} required />
                </div>
                <div className="field">
                  <label>Telefono</label>
                  <input type="text" value={form.telefono} onChange={(e) => setForm({...form, telefono: e.target.value})} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
                </div>
                <div className="field">
                  <label>Fecha de nacimiento</label>
                  <input type="date" value={form.fecha_nacimiento} onChange={(e) => setForm({...form, fecha_nacimiento: e.target.value})} />
                </div>
                <div className="field">
                  <label>Sexo</label>
                  <select value={form.sexo} onChange={(e) => setForm({...form, sexo: e.target.value})}>
                    <option value="">Seleccionar...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setMostrarForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editando ? 'Guardar Cambios' : 'Crear Paciente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Buscar por nombre o DNI..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </div>

        {cargando ? (
          <div className="loading">Cargando pacientes...</div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>DNI</th>
                  <th>Telefono</th>
                  <th>Email</th>
                  <th>Sexo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan="6" className="empty">No se encontraron pacientes</td></tr>
                ) : (
                  filtrados.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.nombre}</strong></td>
                      <td>{p.dni}</td>
                      <td>{p.telefono || '-'}</td>
                      <td>{p.email || '-'}</td>
                      <td>{p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : '-'}</td>
                      <td>
                        <div className="actions">
                          <button className="btn btn-sm btn-primary" onClick={() => onVerHistorial(p)} title="Ver historial">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          </button>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEditar(p)} title="Editar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleEliminar(p.id)} title="Eliminar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
