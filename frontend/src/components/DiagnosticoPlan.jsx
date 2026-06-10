import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { nombreCompleto } from '../utils/formatters';

function parseJson(d) {
  if (!d) return [];
  try { return typeof d === 'string' ? JSON.parse(d) : d; } catch { return []; }
}

export default function DiagnosticoPlan({ paciente, onVolver }) {
  const [consultas, setConsultas] = useState([]);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [planTratamiento, setPlanTratamiento] = useState({ descripcion: '', procedimientos: '', secuencia: '' });
  const [consultaSeleccionada, setConsultaSeleccionada] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [toast, setToast] = useState(null);
  const [cargando, setCargando] = useState(true);

  const showToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

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
    setMensaje('');
    try {
      const diag = parseJson(c.diagnostico_lista);
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
      if (res.error) {
        showToast('Error: ' + res.error, 'error');
      } else {
        showToast('Guardado correctamente');
        cargar();
      }
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    setGuardando(false);
  };

  const getDiagCount = (c) => {
    return parseJson(c.diagnostico_lista).length;
  };

  const hasPlan = (c) => {
    try {
      const plan = typeof c.plan_tratamiento === 'string' ? JSON.parse(c.plan_tratamiento) : (c.plan_tratamiento || {});
      return plan.descripcion || plan.procedimientos || plan.secuencia;
    } catch { return false; }
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
            consultas.map(c => {
              const diagCount = getDiagCount(c);
              const hasPlanData = hasPlan(c);
              const tieneDatos = diagCount > 0 || hasPlanData;
              return (
                <div key={c.id} className={`diagnostico-consulta-item ${consultaSeleccionada?.id === c.id ? 'selected' : ''}`} onClick={() => seleccionarConsulta(c)}>
                  <div className="consulta-item-left">
                    <span className="consulta-fecha">{new Date(c.fecha).toLocaleDateString()}</span>
                    <span className="consulta-motivo">{c.motivo}</span>
                  </div>
                  <div className="consulta-item-right">
                    {tieneDatos && (
                      <span className="diag-check-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      </span>
                    )}
                    {diagCount > 0 && (
                      <span className="diag-count-badge">{diagCount}</span>
                    )}
                  </div>
                </div>
              );
            })
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

      {toast && (
        <div className={`sesion-toast sesion-toast-${toast.tipo}`}>
          <span className="sesion-toast-icon">{toast.tipo === 'error' ? '\u26A0' : '\u2714'}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
