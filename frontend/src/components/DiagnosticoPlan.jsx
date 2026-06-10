import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { nombreCompleto } from '../utils/formatters';

export default function DiagnosticoPlan({ paciente, onVolver }) {
  const [consultas, setConsultas] = useState([]);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [planTratamiento, setPlanTratamiento] = useState({ descripcion: '', procedimientos: '', secuencia: '' });
  const [consultaSeleccionada, setConsultaSeleccionada] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargar(); }, [paciente.id]);

  const cargar = async () => {
    try {
      const data = await api.pacientes.historial(paciente.id);
      setConsultas(data.consultas || []);
    } catch {}
    setCargando(false);
  };

  const seleccionarConsulta = (c) => {
    setConsultaSeleccionada(c);
    try {
      const diag = typeof c.diagnostico_lista === 'string' ? JSON.parse(c.diagnostico_lista) : (c.diagnostico_lista || []);
      setDiagnosticos(diag.length > 0 ? diag : [{ texto: '', tipo: 'clinico' }]);
    } catch { setDiagnosticos([{ texto: '', tipo: 'clinico' }]); }
    try {
      const plan = typeof c.plan_tratamiento === 'string' ? JSON.parse(c.plan_tratamiento) : (c.plan_tratamiento || {});
      setPlanTratamiento(plan);
    } catch { setPlanTratamiento({ descripcion: '', procedimientos: '', secuencia: '' }); }
  };

  const agregarDiagnostico = () => setDiagnosticos([...diagnosticos, { texto: '', tipo: 'clinico' }]);
  const actualizarDiagnostico = (i, v) => { const n = [...diagnosticos]; n[i].texto = v; setDiagnosticos(n); };
  const eliminarDiagnostico = (i) => { if (diagnosticos.length > 1) setDiagnosticos(diagnosticos.filter((_, idx) => idx !== i)); };

  const guardar = async () => {
    if (!consultaSeleccionada) return;
    setGuardando(true);
    setMensaje('');
    try {
      const res = await api.consultas.actualizar(consultaSeleccionada.id, {
        ...consultaSeleccionada,
        diagnostico_lista: diagnosticos.filter(d => d.texto.trim()),
        plan_tratamiento: planTratamiento,
      });
      if (res.error) { setMensaje('Error: ' + res.error); }
      else { setMensaje('Guardado correctamente'); cargar(); }
    } catch (err) { setMensaje('Error: ' + err.message); }
    setGuardando(false);
  };

  if (cargando) return <div className="loading">Cargando...</div>;

  return (
    <div className="diagnostico-panel">
      <div className="diagnostico-header">
        <button className="btn-back" onClick={onVolver}>&larr; Volver</button>
        <h3>Diagnostico y Plan de Tratamiento</h3>
      </div>

      <div className="diagnostico-body">
        <div className="diagnostico-consultas">
          <h4>Consultas ({consultas.length})</h4>
          {consultas.length === 0 ? (
            <p className="empty">No hay consultas</p>
          ) : (
            consultas.map(c => (
              <div key={c.id} className={`diagnostico-consulta-item ${consultaSeleccionada?.id === c.id ? 'selected' : ''}`} onClick={() => seleccionarConsulta(c)}>
                <span className="consulta-fecha">{new Date(c.fecha).toLocaleDateString()}</span>
                <span className="consulta-motivo">{c.motivo}</span>
              </div>
            ))
          )}
        </div>

        <div className="diagnostico-editor">
          {consultaSeleccionada ? (
            <>
              <h4>Consulta del {new Date(consultaSeleccionada.fecha).toLocaleDateString()}</h4>
              <p><strong>Motivo:</strong> {consultaSeleccionada.motivo}</p>

              <div className="field">
                <label>Diagnosticos</label>
                {diagnosticos.map((d, i) => (
                  <div key={i} className="sesion-tratamiento-row">
                    <input type="text" value={d.texto} onChange={e => actualizarDiagnostico(i, e.target.value)} placeholder="Diagnostico clinico" />
                    {diagnosticos.length > 1 && <button className="btn-remove-sesion" onClick={() => eliminarDiagnostico(i)}>×</button>}
                  </div>
                ))}
                <button type="button" className="btn btn-sm btn-secondary" onClick={agregarDiagnostico}>+ Diagnostico</button>
              </div>

              <div className="field">
                <label>Descripcion del Plan</label>
                <textarea value={planTratamiento.descripcion || ''} onChange={e => setPlanTratamiento({...planTratamiento, descripcion: e.target.value})} rows={5} placeholder="Describe el plan de tratamiento..." />
              </div>
              <div className="field">
                <label>Procedimientos</label>
                <textarea value={planTratamiento.procedimientos || ''} onChange={e => setPlanTratamiento({...planTratamiento, procedimientos: e.target.value})} rows={5} placeholder="Lista de procedimientos (uno por linea)..." />
              </div>
              <div className="field">
                <label>Secuencia</label>
                <textarea value={planTratamiento.secuencia || ''} onChange={e => setPlanTratamiento({...planTratamiento, secuencia: e.target.value})} rows={3} placeholder="Orden de los procedimientos..." />
              </div>

              {mensaje && <div className={`alert ${mensaje.includes('Error') ? 'alert-error' : 'alert-success'}`}>{mensaje}</div>}

              <div className="form-actions-inline">
                <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </>
          ) : (
            <div className="diagnostico-empty">
              <p>Selecciona una consulta para editar su diagnostico y plan</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
