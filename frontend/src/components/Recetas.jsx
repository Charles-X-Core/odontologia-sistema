import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function Recetas({ pacienteId, consultas }) {
  const [recetas, setRecetas] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState('');
  const [medicamentos, setMedicamentos] = useState([{ nombre: '', dosis: '', frecuencia: '', duracion: '' }]);
  const [indicaciones, setIndicaciones] = useState('');
  const [cargando, setCargando] = useState(true);
  const [recetaDetalle, setRecetaDetalle] = useState(null);

  useEffect(() => { cargar(); }, [pacienteId]);

  const cargar = async () => {
    const data = await api.recetas.porPaciente(pacienteId);
    setRecetas(data);
    setCargando(false);
  };

  const agregarMedicamento = () => {
    setMedicamentos([...medicamentos, { nombre: '', dosis: '', frecuencia: '', duracion: '' }]);
  };

  const actualizarMedicamento = (index, campo, valor) => {
    const nuevos = [...medicamentos];
    nuevos[index][campo] = valor;
    setMedicamentos(nuevos);
  };

  const eliminarMedicamento = (index) => {
    if (medicamentos.length <= 1) return;
    setMedicamentos(medicamentos.filter((_, i) => i !== index));
  };

  const crear = async (e) => {
    e.preventDefault();
    if (!consultaSeleccionada) return;
    const meds = medicamentos.filter(m => m.nombre.trim());
    if (meds.length === 0) return;
    await api.recetas.crear({
      consulta_id: parseInt(consultaSeleccionada),
      paciente_id: pacienteId,
      medicamentos: meds,
      indicaciones,
    });
    setMostrarForm(false);
    setConsultaSeleccionada('');
    setMedicamentos([{ nombre: '', dosis: '', frecuencia: '', duracion: '' }]);
    setIndicaciones('');
    cargar();
  };

  const verDetalle = async (id) => {
    const data = await api.recetas.obtener(id);
    setRecetaDetalle(data);
  };

  if (cargando) return <div className="loading">Cargando recetas...</div>;

  return (
    <div className="recetas-panel">
      <div className="tratamientos-header">
        <span className="recetas-count">{recetas.length} receta{recetas.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-primary btn-sm" onClick={() => setMostrarForm(true)}>
          + Nueva Receta
        </button>
      </div>

      {mostrarForm && (
        <div className="tratamiento-form-card">
          <form onSubmit={crear}>
            <div className="field">
              <label>Consulta *</label>
              <select value={consultaSeleccionada} onChange={e => setConsultaSeleccionada(e.target.value)} required>
                <option value="">Seleccionar consulta...</option>
                {consultas?.map(c => (
                  <option key={c.id} value={c.id}>
                    {new Date(c.fecha).toLocaleDateString()} - {c.motivo}
                  </option>
                ))}
              </select>
            </div>

            <div className="medicamentos-section">
              <label>Medicamentos *</label>
              {medicamentos.map((med, i) => (
                <div key={i} className="medicamento-row">
                  <input type="text" placeholder="Nombre" value={med.nombre} onChange={e => actualizarMedicamento(i, 'nombre', e.target.value)} required={i === 0} />
                  <input type="text" placeholder="Dosis" value={med.dosis} onChange={e => actualizarMedicamento(i, 'dosis', e.target.value)} />
                  <input type="text" placeholder="Frecuencia" value={med.frecuencia} onChange={e => actualizarMedicamento(i, 'frecuencia', e.target.value)} />
                  <input type="text" placeholder="Duracion" value={med.duracion} onChange={e => actualizarMedicamento(i, 'duracion', e.target.value)} />
                  {medicamentos.length > 1 && (
                    <button type="button" className="btn-remove" onClick={() => eliminarMedicamento(i)}>X</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-secondary" onClick={agregarMedicamento}>+ Agregar medicamento</button>
            </div>

            <div className="field">
              <label>Indicaciones</label>
              <textarea value={indicaciones} onChange={e => setIndicaciones(e.target.value)} rows={2} placeholder="Instrucciones para el paciente..." />
            </div>

            <div className="form-actions-inline">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary btn-sm">Crear Receta</button>
            </div>
          </form>
        </div>
      )}

      {recetaDetalle && (
        <div className="modal-overlay" onClick={() => setRecetaDetalle(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Receta Medica</h3>
              <button className="btn-close" onClick={() => setRecetaDetalle(null)}>&times;</button>
            </div>
            <div className="receta-print">
              <div className="receta-header-print">
                <h2>Receta Medica</h2>
                <p>Dr. Carlos Lopez - Odontologia</p>
                <p>Fecha: {new Date(recetaDetalle.consulta_fecha).toLocaleDateString()}</p>
              </div>
              <div className="receta-paciente">
                <strong>Paciente:</strong> {recetaDetalle.paciente_nombre}<br/>
                <strong>DNI:</strong> {recetaDetalle.paciente_dni}
              </div>
              <table className="receta-table">
                <thead>
                  <tr><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Duracion</th></tr>
                </thead>
                <tbody>
                  {recetaDetalle.medicamentos.map((m, i) => (
                    <tr key={i}>
                      <td><strong>{m.nombre}</strong></td>
                      <td>{m.dosis}</td>
                      <td>{m.frecuencia}</td>
                      <td>{m.duracion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recetaDetalle.indicaciones && (
                <div className="receta-indicaciones">
                  <strong>Indicaciones:</strong>
                  <p>{recetaDetalle.indicaciones}</p>
                </div>
              )}
              <div className="receta-firma">
                <div className="firma-linea"></div>
                <p>Dr. Carlos Lopez</p>
                <p>Lic. en Odontologia</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {recetas.length === 0 ? (
        <p className="empty">No hay recetas registradas</p>
      ) : (
        <div className="recetas-lista">
          {recetas.map(r => (
            <div key={r.id} className="receta-card" onClick={() => verDetalle(r.id)}>
              <div className="receta-card-fecha">{new Date(r.consulta_fecha).toLocaleDateString()}</div>
              <div className="receta-card-body">
                <strong>{r.medicamentos.length} medicamento{r.medicamentos.length !== 1 ? 's' : ''}</strong>
                <span className="receta-card-motivo">{r.consulta_motivo}</span>
              </div>
              <span className="receta-card-arrow">&rsaquo;</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
