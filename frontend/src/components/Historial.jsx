import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import Odontograma from './Odontograma';
import Tratamientos from './Tratamientos';
import Recetas from './Recetas';
import Galeria from './Galeria';
import DiagnosticoPlan from './DiagnosticoPlan';
import Pagos from './Pagos';

const NECESIDADES_DEFAULT = { cariados: 0, curados: 0, por_extraer: 0, endodoncia: 0, ortodoncia: 0, protesis: 0, extraidos: 0, destartraje: 0 };
const SIGNOS_VITALES_DEFAULT = { presion_arterial: '', pulso: '', temperatura: '', frecuencia_cardiaca: '', frecuencia_respiratoria: '', peso: '', altura: '' };

function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

function parseJson(d) {
  if (!d) return [];
  try { return typeof d === 'string' ? JSON.parse(d) : d; } catch { return []; }
}

// ============================================
// RESUMEN CARDS
// ============================================
function ResumenCards({ resumen, onTab }) {
  if (!resumen || !resumen.total_consultas) return null;
  return (
    <div className="historial-resumen">
      <div className="resumen-card" onClick={() => onTab('consultas')}>
        <span className="resumen-num">{resumen.total_consultas}</span>
        <span className="resumen-label">Consultas</span>
      </div>
      <div className="resumen-card" onClick={() => onTab('tratamientos')}>
        <span className="resumen-num">{resumen.tratamientos_pendientes}/{resumen.total_tratamientos}</span>
        <span className="resumen-label">Tratamientos pendientes</span>
      </div>
      <div className="resumen-card" onClick={() => onTab('pagos')}>
        <span className="resumen-num">S/ {(resumen.total_pendiente || 0).toFixed(0)}</span>
        <span className="resumen-label">Saldo pendiente</span>
      </div>
      <div className="resumen-card" onClick={() => onTab('recetas')}>
        <span className="resumen-num">{resumen.total_recetas}</span>
        <span className="resumen-label">Recetas</span>
      </div>
    </div>
  );
}

// ============================================
// WIZARD NUEVA CONSULTA (4 pasos)
// ============================================
function WizardConsulta({ historia, consultas, onCerrar, onGuardado }) {
  const [paso, setPaso] = useState(1);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Paso 1: Motivo y signos
  const [motivo, setMotivo] = useState('');
  const [tiempoEnfermedad, setTiempoEnfermedad] = useState('');
  const [signosSintomas, setSignosSintomas] = useState('');
  const [relatoCronologico, setRelatoCronologico] = useState('');
  const [funcionesBiologicas, setFuncionesBiologicas] = useState('');
  const [signosVitales, setSignosVitales] = useState({ ...SIGNOS_VITALES_DEFAULT });
  const [examenClinico, setExamenClinico] = useState('');
  const [evaluacionOdonto, setEvaluacionOdonto] = useState('');

  // Paso 2: Diagnostico + Odontograma + Necesidades
  const [diagnosticos, setDiagnosticos] = useState([{ texto: '', tipo: 'clinico' }]);
  const [odontogramaForm, setOdontogramaForm] = useState({});
  const [necesidades, setNecesidades] = useState({ ...NECESIDADES_DEFAULT });
  const [necesidadesAuto, setNecesidadesAuto] = useState(false);

  const calcularNecesidades = (dientes) => {
    const nec = { cariados: 0, curados: 0, por_extraer: 0, endodoncia: 0, ortodoncia: 0, protesis: 0, extraidos: 0, destartraje: 0 };
    Object.values(dientes).forEach(estado => {
      if (estado === 'caries') nec.cariados++;
      else if (estado === 'obturado') nec.curados++;
      else if (estado === 'extraccion') nec.por_extraer++;
      else if (estado === 'endodoncia') nec.endodoncia++;
      else if (estado === 'ausente') nec.extraidos++;
      else if (['corona', 'implante', 'puente', 'provisional'].includes(estado)) nec.protesis++;
    });
    setNecesidades(nec);
    setNecesidadesAuto(true);
  };

  const handleOdontogramaChange = (dientes) => {
    setOdontogramaForm(dientes);
    calcularNecesidades(dientes);
  };

  // Paso 3: Tratamientos
  const [tratamientos, setTratamientos] = useState([{ procedimiento_realizado: '', pieza_dental: '', costo_total: '', monto_a_cuenta: '', notas: '' }]);

  // Paso 4: Recetas
  const [recetas, setRecetas] = useState([{ medicamentos: [{ nombre: '', dosis: '', frecuencia: '', duracion: '' }], indicaciones: '' }]);

  const PASOS = [
    { num: 1, label: 'Consulta', icon: '📋' },
    { num: 2, label: 'Diagnostico', icon: '🔍' },
    { num: 3, label: 'Tratamientos', icon: '🦷' },
    { num: 4, label: 'Recetas', icon: '💊' },
  ];

  const agregarDiagnostico = () => setDiagnosticos([...diagnosticos, { texto: '', tipo: 'clinico' }]);
  const eliminarDiagnostico = (i) => { if (diagnosticos.length > 1) setDiagnosticos(diagnosticos.filter((_, idx) => idx !== i)); };

  const agregarTratamiento = () => setTratamientos([...tratamientos, { procedimiento_realizado: '', pieza_dental: '', costo_total: '', monto_a_cuenta: '', notas: '' }]);
  const eliminarTratamiento = (i) => { if (tratamientos.length > 1) setTratamientos(tratamientos.filter((_, idx) => idx !== i)); };
  const actualizarTratamiento = (i, campo, valor) => {
    const n = [...tratamientos];
    n[i][campo] = valor;
    setTratamientos(n);
  };

  const agregarReceta = () => setRecetas([...recetas, { medicamentos: [{ nombre: '', dosis: '', frecuencia: '', duracion: '' }], indicaciones: '' }]);
  const eliminarReceta = (i) => { if (recetas.length > 1) setRecetas(recetas.filter((_, idx) => idx !== i)); };
  const agregarMedicamento = (ri) => {
    const n = [...recetas];
    n[ri].medicamentos = [...n[ri].medicamentos, { nombre: '', dosis: '', frecuencia: '', duracion: '' }];
    setRecetas(n);
  };
  const actualizarMedicamento = (ri, mi, campo, valor) => {
    const n = [...recetas];
    n[ri].medicamentos[mi][campo] = valor;
    setRecetas(n);
  };

  const guardar = async () => {
    if (!motivo.trim()) { setError('El motivo es obligatorio'); setPaso(1); return; }
    setGuardando(true);
    setError('');
    try {
      const now = new Date();
      const res = await api.consultas.crear({
        historia_id: historia.id,
        fecha: now.toISOString(),
        hora: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        motivo, tiempo_enfermedad: tiempoEnfermedad, signos_sintomas: signosSintomas,
        relato_cronologico: relatoCronologico, funciones_biologicas: funcionesBiologicas,
        signos_vitales: signosVitales, examen_clinico_general: examenClinico,
        evaluacion_odontoestomatologica: evaluacionOdonto,
        diagnostico_lista: diagnosticos.filter(d => d.texto.trim()),
        plan_tratamiento: { descripcion: '', procedimientos: '', secuencia: '' },
        notas: '',
      });
      if (res.error) { setError(res.error); setGuardando(false); return; }
      const consultaId = res.id;

      // Odontograma
      if (Object.keys(odontogramaForm).length > 0) {
        await api.odontogramas.crear({ consulta_id: consultaId, datos_json: { version: consultas.length + 1, dientes: odontogramaForm } });
      }

      // Necesidades
      if (Object.values(necesidades).some(v => v > 0)) {
        await api.necesidades.crear({ consulta_id: consultaId, ...necesidades });
      }

      // Tratamientos
      for (const t of tratamientos) {
        if (!t.procedimiento_realizado.trim()) continue;
        await api.tratamientos.crear({
          paciente_id: historia.paciente_id,
          consulta_id: consultaId,
          fecha: now.toISOString().split('T')[0],
          pieza_dental: t.pieza_dental,
          procedimiento_realizado: t.procedimiento_realizado,
          costo_total: parseFloat(t.costo_total) || 0,
          monto_a_cuenta: parseFloat(t.monto_a_cuenta) || 0,
          notas: t.notas,
        });
      }

      // Recetas
      for (const r of recetas) {
        const meds = r.medicamentos.filter(m => m.nombre.trim());
        if (meds.length === 0) continue;
        await api.recetas.crear({
          consulta_id: consultaId,
          paciente_id: historia.paciente_id,
          medicamentos: meds,
          indicaciones: r.indicaciones,
        });
      }

      onGuardado?.();
    } catch (err) {
      setError('Error: ' + err.message);
    }
    setGuardando(false);
  };

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Nueva Consulta</h3>
          <button className="btn-close" onClick={onCerrar}>&times;</button>
        </div>

        <div className="wizard-steps">
          {PASOS.map(p => (
            <div key={p.num} className={`wizard-step ${paso === p.num ? 'active' : paso > p.num ? 'completed' : ''}`} onClick={() => { if (paso > p.num) setPaso(p.num); }}>
              <span className="wizard-step-icon">{paso > p.num ? '✓' : p.icon}</span>
              <span className="wizard-step-label">{p.label}</span>
            </div>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* PASO 1: Consulta */}
        {paso === 1 && (
          <div className="wizard-body">
            <div className="field"><label>Motivo de consulta *</label><textarea value={motivo} onChange={e => setMotivo(e.target.value)} required rows={2} placeholder="Motivo de la consulta..." /></div>
            <div className="field"><label>Tiempo de Enfermedad</label><input type="text" value={tiempoEnfermedad} onChange={e => setTiempoEnfermedad(e.target.value)} placeholder="Ej: 3 dias" /></div>
            <div className="field"><label>Signos y Sintomas</label><textarea value={signosSintomas} onChange={e => setSignosSintomas(e.target.value)} rows={2} /></div>
            <div className="field"><label>Relato Cronologico</label><textarea value={relatoCronologico} onChange={e => setRelatoCronologico(e.target.value)} rows={2} /></div>
            <div className="field"><label>Funciones Biologicas</label><textarea value={funcionesBiologicas} onChange={e => setFuncionesBiologicas(e.target.value)} rows={2} /></div>
            <h4>Signos Vitales</h4>
            <div className="form-grid-5">
              <div className="field"><label>PA</label><input type="text" value={signosVitales.presion_arterial} onChange={e => setSignosVitales({...signosVitales, presion_arterial: e.target.value})} placeholder="120/80" /></div>
              <div className="field"><label>Pulso</label><input type="text" value={signosVitales.pulso} onChange={e => setSignosVitales({...signosVitales, pulso: e.target.value})} placeholder="78" /></div>
              <div className="field"><label>Temp</label><input type="text" value={signosVitales.temperatura} onChange={e => setSignosVitales({...signosVitales, temperatura: e.target.value})} placeholder="36.5" /></div>
              <div className="field"><label>FC</label><input type="text" value={signosVitales.frecuencia_cardiaca} onChange={e => setSignosVitales({...signosVitales, frecuencia_cardiaca: e.target.value})} placeholder="72" /></div>
              <div className="field"><label>FR</label><input type="text" value={signosVitales.frecuencia_respiratoria} onChange={e => setSignosVitales({...signosVitales, frecuencia_respiratoria: e.target.value})} placeholder="16" /></div>
            </div>
            <div className="form-grid-3" style={{ marginTop: '12px' }}>
              <div className="field"><label>Peso (kg)</label><input type="text" value={signosVitales.peso || ''} onChange={e => setSignosVitales({...signosVitales, peso: e.target.value})} placeholder="70" /></div>
              <div className="field"><label>Altura (cm)</label><input type="text" value={signosVitales.altura || ''} onChange={e => setSignosVitales({...signosVitales, altura: e.target.value})} placeholder="170" /></div>
              {signosVitales.peso && signosVitales.altura && (
                <div className="field"><label>IMC</label><input type="text" readOnly className="field-readonly" value={(parseFloat(signosVitales.peso) / Math.pow(parseFloat(signosVitales.altura) / 100, 2)).toFixed(1)} /></div>
              )}
            </div>
            <div className="field"><label>Examen Clinico General</label><textarea value={examenClinico} onChange={e => setExamenClinico(e.target.value)} rows={2} /></div>
            <div className="field"><label>Evaluacion Odontoestomatologica</label><textarea value={evaluacionOdonto} onChange={e => setEvaluacionOdonto(e.target.value)} rows={2} /></div>
          </div>
        )}

        {/* PASO 2: Diagnostico + Odontograma */}
        {paso === 2 && (
          <div className="wizard-body">
            <h4>Diagnosticos</h4>
            {diagnosticos.map((d, i) => (
              <div key={i} className="sesion-tratamiento-row">
                <textarea className="diagnostico-input" placeholder="Diagnostico" value={d.texto} onChange={e => { const n = [...diagnosticos]; n[i].texto = e.target.value; setDiagnosticos(n); }} rows={3} />
                {diagnosticos.length > 1 && <button type="button" className="btn-remove-sesion" onClick={() => eliminarDiagnostico(i)}>&times;</button>}
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-secondary" onClick={agregarDiagnostico}>+ Diagnostico</button>

            <div className="necesidades-inline" style={{ marginTop: '16px' }}>
              <label className="necesidades-inline-label">Necesidades Odontologicas {necesidadesAuto && <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 400 }}>(calculado del odontograma)</span>}</label>
              <div className="necesidades-inline-grid">
                {Object.entries({ cariados: 'Cariados', curados: 'Curados', por_extraer: 'Por Extraer', endodoncia: 'Endodoncia', ortodoncia: 'Orto', protesis: 'Protesis', extraidos: 'Extraidos', destartraje: 'Destartraje' }).map(([key, label]) => (
                  <div key={key} className="necesidad-inline-item">
                    <label>{label}</label>
                    <input type="number" min="0" max="99" value={necesidades[key]} onChange={e => { setNecesidades({ ...necesidades, [key]: parseInt(e.target.value) || 0 }); setNecesidadesAuto(false); }} />
                  </div>
                ))}
              </div>
            </div>

            <Odontograma datos={odontogramaForm} onGuardar={handleOdontogramaChange} titulo="Odontograma de la consulta (opcional)" />
          </div>
        )}

        {/* PASO 3: Tratamientos */}
        {paso === 3 && (
          <div className="wizard-body">
            <p className="text-muted">Agrega los tratamientos realizados en esta consulta. Todos deben estar vinculados.</p>
            {tratamientos.map((t, i) => (
              <div key={i} className="wizard-tratamiento-card">
                <div className="wizard-tratamiento-header">
                  <span>Tratamiento {i + 1}</span>
                  {tratamientos.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => eliminarTratamiento(i)}>X</button>}
                </div>
                <div className="form-grid-3">
                  <div className="field"><label>Procedimiento *</label><input type="text" value={t.procedimiento_realizado} onChange={e => actualizarTratamiento(i, 'procedimiento_realizado', e.target.value)} placeholder="Ej: Corona ceramica" /></div>
                  <div className="field"><label>Pieza Dental</label><input type="text" value={t.pieza_dental} onChange={e => actualizarTratamiento(i, 'pieza_dental', e.target.value)} placeholder="Ej: 16" /></div>
                  <div className="field"><label>Costo (S/)</label><input type="number" value={t.costo_total} onChange={e => actualizarTratamiento(i, 'costo_total', e.target.value)} min="0" step="0.01" /></div>
                </div>
                <div className="form-grid-2">
                  <div className="field"><label>A Cuenta (S/)</label><input type="number" value={t.monto_a_cuenta} onChange={e => actualizarTratamiento(i, 'monto_a_cuenta', e.target.value)} min="0" step="0.01" /></div>
                  <div className="field"><label>Notas</label><input type="text" value={t.notas} onChange={e => actualizarTratamiento(i, 'notas', e.target.value)} placeholder="Observaciones..." /></div>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-secondary" onClick={agregarTratamiento}>+ Agregar Tratamiento</button>
          </div>
        )}

        {/* PASO 4: Recetas */}
        {paso === 4 && (
          <div className="wizard-body">
            <p className="text-muted">Agrega las recetas medicas para esta consulta.</p>
            {recetas.map((r, ri) => (
              <div key={ri} className="wizard-receta-card">
                <div className="wizard-tratamiento-header">
                  <span>Receta {ri + 1}</span>
                  {recetas.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => eliminarReceta(ri)}>X</button>}
                </div>
                {r.medicamentos.map((m, mi) => (
                  <div key={mi} className="medicamento-row">
                    <input type="text" placeholder="Nombre" value={m.nombre} onChange={e => actualizarMedicamento(ri, mi, 'nombre', e.target.value)} />
                    <input type="text" placeholder="Dosis" value={m.dosis} onChange={e => actualizarMedicamento(ri, mi, 'dosis', e.target.value)} />
                    <input type="text" placeholder="Frecuencia" value={m.frecuencia} onChange={e => actualizarMedicamento(ri, mi, 'frecuencia', e.target.value)} />
                    <input type="text" placeholder="Duracion" value={m.duracion} onChange={e => actualizarMedicamento(ri, mi, 'duracion', e.target.value)} />
                    {r.medicamentos.length > 1 && <button type="button" className="btn-remove" onClick={() => { const n = [...recetas]; n[ri].medicamentos = n[ri].medicamentos.filter((_, idx) => idx !== mi); setRecetas(n); }}>X</button>}
                  </div>
                ))}
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => agregarMedicamento(ri)}>+ Medicamento</button>
                <div className="field" style={{ marginTop: '8px' }}><label>Indicaciones</label><textarea value={r.indicaciones} onChange={e => { const n = [...recetas]; n[ri].indicaciones = e.target.value; setRecetas(n); }} rows={2} placeholder="Instrucciones para el paciente..." /></div>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-secondary" onClick={agregarReceta}>+ Agregar Receta</button>
          </div>
        )}

        <div className="wizard-footer">
          {paso > 1 && <button className="btn btn-secondary" onClick={() => setPaso(paso - 1)}>Anterior</button>}
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onCerrar}>Cancelar</button>
          {paso < 4 ? (
            <button className="btn btn-primary" onClick={() => setPaso(paso + 1)}>Siguiente</button>
          ) : (
            <button className="btn btn-success" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar Consulta'}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// CONSULTA TIMELINE (enriquecido)
// ============================================
function ConsultaTimeline({ c, onRecargar }) {
  const [expandido, setExpandido] = useState(false);
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [guardando, setGuardando] = useState(false);

  const iniciarEdicion = () => {
    setEditando(true);
    setEditForm({
      motivo: c.motivo || '',
      tiempo_enfermedad: c.tiempo_enfermedad || '',
      signos_sintomas: c.signos_sintomas || '',
      relato_cronologico: c.relato_cronologico || '',
      funciones_biologicas: c.funciones_biologicas || '',
      examen_clinico_general: c.examen_clinico_general || '',
      evaluacion_odontoestomatologica: c.evaluacion_odontoestomatologica || '',
      signos_vitales: typeof c.signos_vitales === 'string' ? parseJson(c.signos_vitales) : (c.signos_vitales || {}),
      notas: c.notas || '',
      diagnostico_lista: parseJson(c.diagnostico_lista),
      plan_tratamiento: typeof c.plan_tratamiento === 'string' ? parseJson(c.plan_tratamiento) : (c.plan_tratamiento || {}),
    });
  };

  const guardarEdicion = async () => {
    setGuardando(true);
    try {
      await api.consultas.actualizar(c.id, {
        motivo: editForm.motivo,
        tiempo_enfermedad: editForm.tiempo_enfermedad,
        signos_sintomas: editForm.signos_sintomas,
        relato_cronologico: editForm.relato_cronologico,
        funciones_biologicas: editForm.funciones_biologicas,
        examen_clinico_general: editForm.examen_clinico_general,
        evaluacion_odontoestomatologica: editForm.evaluacion_odontoestomatologica,
        signos_vitales: editForm.signos_vitales,
        notas: editForm.notas,
        diagnostico_lista: editForm.diagnostico_lista.filter(d => d.texto?.trim()),
        plan_tratamiento: editForm.plan_tratamiento,
      });
      setEditando(false);
      onRecargar?.();
    } catch (e) { alert('Error: ' + e.message); }
    setGuardando(false);
  };

  const eliminarConsulta = async () => {
    if (!confirm('Eliminar esta consulta? Se eliminaran sus odontogramas, necesidades y recetas vinculadas.')) return;
    try { await api.consultas.eliminar(c.id); onRecargar?.(); } catch (e) { alert('Error: ' + e.message); }
  };

  const trats = c.tratamientos || [];
  const recetasArr = c.recetas || [];
  const pagosArr = c.pagos || [];
  const totalTrat = trats.reduce((s, t) => s + (t.costo_total || 0), 0);
  const totalPagado = pagosArr.reduce((s, p) => s + (p.a_cuenta || 0), 0);
  const signos = typeof c.signos_vitales === 'string' ? parseJson(c.signos_vitales) : (c.signos_vitales || {});
  const plan = typeof c.plan_tratamiento === 'string' ? parseJson(c.plan_tratamiento) : (c.plan_tratamiento || {});

  return (
    <div className="timeline-item">
      <div className="timeline-dot"></div>
      <div className="timeline-content">
        <div className="timeline-date" onClick={() => setExpandido(!expandido)} style={{ cursor: 'pointer' }}>
          {new Date(c.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}{c.hora ? ` - ${c.hora}` : ''}
          <span className="timeline-expand-icon">{expandido ? '▼' : '▶'}</span>
        </div>

        <h4 onClick={() => setExpandido(!expandido)} style={{ cursor: 'pointer' }}>{c.motivo}</h4>

        {/* Badges de resumen */}
        <div className="timeline-badges">
          {trats.length > 0 && <span className="badge badge-tratamientos" onClick={() => setExpandido(true)}>🦷 {trats.length} tratamiento(s)</span>}
          {recetasArr.length > 0 && <span className="badge badge-recetas" onClick={() => setExpandido(true)}>💊 {recetasArr.length} receta(s)</span>}
          {pagosArr.length > 0 && <span className="badge badge-pagos" onClick={() => setExpandido(true)}>💰 S/ {totalPagado.toFixed(0)}</span>}
          {c.odontograma && <span className="badge badge-odontograma" onClick={() => setExpandido(true)}>🩺 Odontograma</span>}
        </div>

        {/* Detalle rapido (siempre visible) */}
        <div className="timeline-details">
          {c.tiempo_enfermedad && <div><strong>Tiempo:</strong> {c.tiempo_enfermedad}</div>}
          {c.signos_sintomas && <div><strong>Sintomas:</strong> {c.signos_sintomas}</div>}
          <div><strong>Diagnostico:</strong> {parseJson(c.diagnostico_lista).map(d => d.texto).join('; ') || 'Sin diagnostico'}</div>
          {c.notas && <div className="notas"><em>{c.notas}</em></div>}
        </div>

        {/* Detalle expandido */}
        {expandido && !editando && (
          <div className="timeline-expanded">
            {/* Signos vitales */}
            {Object.values(signos).some(v => v) && (
              <div className="timeline-section">
                <h5>Signos Vitales</h5>
                <div className="signos-grid">
                  {signos.presion_arterial && <span><strong>PA:</strong> {signos.presion_arterial}</span>}
                  {signos.pulso && <span><strong>Pulso:</strong> {signos.pulso}</span>}
                  {signos.temperatura && <span><strong>Temp:</strong> {signos.temperatura}</span>}
                  {signos.frecuencia_cardiaca && <span><strong>FC:</strong> {signos.frecuencia_cardiaca}</span>}
                  {signos.frecuencia_respiratoria && <span><strong>FR:</strong> {signos.frecuencia_respiratoria}</span>}
                </div>
              </div>
            )}

            {/* Diagnostico completo */}
            {parseJson(c.diagnostico_lista).length > 0 && (
              <div className="timeline-section">
                <h5>Diagnosticos</h5>
                <ul>{parseJson(c.diagnostico_lista).map((d, i) => <li key={i}>{d.texto}</li>)}</ul>
              </div>
            )}

            {/* Plan de tratamiento */}
            {(plan.descripcion || plan.procedimientos || plan.secuencia) && (
              <div className="timeline-section">
                <h5>Plan de Tratamiento</h5>
                {plan.descripcion && <p>{plan.descripcion}</p>}
                {plan.procedimientos && <p><strong>Procedimientos:</strong> {plan.procedimientos}</p>}
                {plan.secuencia && <p><strong>Secuencia:</strong> {plan.secuencia}</p>}
              </div>
            )}

            {/* Tratamientos vinculados */}
            {trats.length > 0 && (
              <div className="timeline-section">
                <h5>Tratamientos ({trats.length})</h5>
                <table className="timeline-table">
                  <thead><tr><th>Procedimiento</th><th>Pza</th><th>Costo</th><th>Estado</th></tr></thead>
                  <tbody>{trats.map(t => (
                    <tr key={t.id}>
                      <td>{t.procedimiento_realizado}</td>
                      <td>{t.pieza_dental || '-'}</td>
                      <td>S/ {(t.costo_total || 0).toFixed(2)}</td>
                      <td><span className={`estado-badge ${t.estado}`}>{t.estado}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {/* Recetas vinculadas */}
            {recetasArr.length > 0 && (
              <div className="timeline-section">
                <h5>Recetas ({recetasArr.length})</h5>
                {recetasArr.map((r, i) => (
                  <div key={i} className="timeline-receta">
                    {r.medicamentos.map((m, j) => <div key={j}><strong>{m.nombre}</strong> {m.dosis} - {m.frecuencia}</div>)}
                    {r.indicaciones && <div className="text-muted"><em>{r.indicaciones}</em></div>}
                  </div>
                ))}
              </div>
            )}

            {/* Pagos vinculados */}
            {pagosArr.length > 0 && (
              <div className="timeline-section">
                <h5>Pagos ({pagosArr.length})</h5>
                <table className="timeline-table">
                  <thead><tr><th>Fecha</th><th>Total</th><th>A Cuenta</th><th>Saldo</th><th>Metodo</th></tr></thead>
                  <tbody>{pagosArr.map(p => (
                    <tr key={p.id}>
                      <td>{new Date(p.fecha).toLocaleDateString()}</td>
                      <td>S/ {(p.total || 0).toFixed(2)}</td>
                      <td>S/ {(p.a_cuenta || 0).toFixed(2)}</td>
                      <td>S/ {(p.saldo || 0).toFixed(2)}</td>
                      <td>{p.metodo_pago}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {/* Necesidades */}
            {c.necesidades && Object.values(c.necesidades).some((v, i) => i > 0 && v > 0) && (
              <div className="timeline-section">
                <h5>Necesidades Odontologicas</h5>
                <div className="signos-grid">
                  {c.necesidades.cariados > 0 && <span>Cariados: {c.necesidades.cariados}</span>}
                  {c.necesidades.curados > 0 && <span>Curados: {c.necesidades.curados}</span>}
                  {c.necesidades.por_extraer > 0 && <span>Por Extraer: {c.necesidades.por_extraer}</span>}
                  {c.necesidades.extraidos > 0 && <span>Extraidos: {c.necesidades.extraidos}</span>}
                  {c.necesidades.endodoncia > 0 && <span>Endodoncia: {c.necesidades.endodoncia}</span>}
                  {c.necesidades.ortodoncia > 0 && <span>Ortodoncia: {c.necesidades.ortodoncia}</span>}
                  {c.necesidades.protesis > 0 && <span>Protesis: {c.necesidades.protesis}</span>}
                  {c.necesidades.destartraje > 0 && <span>Destartraje: {c.necesidades.destartraje}</span>}
                </div>
              </div>
            )}

            {/* Odontograma */}
            {c.odontograma && (
              <div className="timeline-section">
                <Odontograma datos={typeof c.odontograma === 'string' ? JSON.parse(c.odontograma) : c.odontograma} titulo="Odontograma" />
              </div>
            )}

            {/* Acciones */}
            <div className="timeline-actions">
              <button className="btn btn-sm btn-secondary" onClick={iniciarEdicion}>Editar</button>
              <button className="btn btn-sm btn-danger" onClick={eliminarConsulta}>Eliminar</button>
            </div>
          </div>
        )}

        {/* Modo edicion inline */}
        {editando && (
          <div className="consulta-inline-edit">
            <div className="field"><label>Motivo</label><input type="text" value={editForm.motivo} onChange={e => setEditForm({...editForm, motivo: e.target.value})} /></div>
            <div className="field"><label>Tiempo Enfermedad</label><input type="text" value={editForm.tiempo_enfermedad} onChange={e => setEditForm({...editForm, tiempo_enfermedad: e.target.value})} /></div>
            <div className="field"><label>Sintomas</label><textarea value={editForm.signos_sintomas} onChange={e => setEditForm({...editForm, signos_sintomas: e.target.value})} rows={2} /></div>
            <div className="field"><label>Relato Cronologico</label><textarea value={editForm.relato_cronologico} onChange={e => setEditForm({...editForm, relato_cronologico: e.target.value})} rows={2} /></div>
            <div className="field"><label>Examen Clinico</label><textarea value={editForm.examen_clinico_general} onChange={e => setEditForm({...editForm, examen_clinico_general: e.target.value})} rows={2} /></div>

            <h4>Signos Vitales</h4>
            <div className="form-grid-5">
              <div className="field"><label>PA</label><input type="text" value={editForm.signos_vitales?.presion_arterial || ''} onChange={e => setEditForm({...editForm, signos_vitales: {...editForm.signos_vitales, presion_arterial: e.target.value}})} /></div>
              <div className="field"><label>Pulso</label><input type="text" value={editForm.signos_vitales?.pulso || ''} onChange={e => setEditForm({...editForm, signos_vitales: {...editForm.signos_vitales, pulso: e.target.value}})} /></div>
              <div className="field"><label>Temp</label><input type="text" value={editForm.signos_vitales?.temperatura || ''} onChange={e => setEditForm({...editForm, signos_vitales: {...editForm.signos_vitales, temperatura: e.target.value}})} /></div>
              <div className="field"><label>FC</label><input type="text" value={editForm.signos_vitales?.frecuencia_cardiaca || ''} onChange={e => setEditForm({...editForm, signos_vitales: {...editForm.signos_vitales, frecuencia_cardiaca: e.target.value}})} /></div>
              <div className="field"><label>FR</label><input type="text" value={editForm.signos_vitales?.frecuencia_respiratoria || ''} onChange={e => setEditForm({...editForm, signos_vitales: {...editForm.signos_vitales, frecuencia_respiratoria: e.target.value}})} /></div>
            </div>
            <div className="form-grid-3" style={{ marginTop: '12px' }}>
              <div className="field"><label>Peso (kg)</label><input type="text" value={editForm.signos_vitales?.peso || ''} onChange={e => setEditForm({...editForm, signos_vitales: {...editForm.signos_vitales, peso: e.target.value}})} /></div>
              <div className="field"><label>Altura (cm)</label><input type="text" value={editForm.signos_vitales?.altura || ''} onChange={e => setEditForm({...editForm, signos_vitales: {...editForm.signos_vitales, altura: e.target.value}})} /></div>
              {editForm.signos_vitales?.peso && editForm.signos_vitales?.altura && (
                <div className="field"><label>IMC</label><input type="text" readOnly className="field-readonly" value={(parseFloat(editForm.signos_vitales.peso) / Math.pow(parseFloat(editForm.signos_vitales.altura) / 100, 2)).toFixed(1)} /></div>
              )}
            </div>

            <div className="field">
              <label>Diagnosticos</label>
              {editForm.diagnostico_lista.map((d, i) => (
                <div key={i} className="sesion-tratamiento-row">
                  <textarea className="diagnostico-input" value={d.texto} onChange={e => { const n = [...editForm.diagnostico_lista]; n[i].texto = e.target.value; setEditForm({...editForm, diagnostico_lista: n}); }} rows={3} />
                  {editForm.diagnostico_lista.length > 1 && <button type="button" className="btn-remove-sesion" onClick={() => setEditForm({...editForm, diagnostico_lista: editForm.diagnostico_lista.filter((_, idx) => idx !== i)})}>x</button>}
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditForm({...editForm, diagnostico_lista: [...editForm.diagnostico_lista, { texto: '', tipo: 'clinico' }]})}>+ Diagnostico</button>
            </div>

            <div className="field"><label>Notas</label><input type="text" value={editForm.notas} onChange={e => setEditForm({...editForm, notas: e.target.value})} /></div>

            <div className="form-actions-inline" style={{ marginTop: '8px' }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setEditando(false)}>Cancelar</button>
              <button className="btn btn-sm btn-primary" onClick={guardarEdicion} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function Historial({ paciente, onVolver }) {
  const [historia, setHistoria] = useState(null);
  const [consultas, setConsultas] = useState([]);
  const [resumen, setResumen] = useState({});
  const [tab, setTab] = useState('consultas');
  const [mostrarConsulta, setMostrarConsulta] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Busqueda y filtros
  const [busqueda, setBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  useEffect(() => { cargarHistorial(); }, []);

  const cargarHistorial = async () => {
    try {
      const data = await api.pacientes.historial(paciente.id);
      setHistoria(data.historia);
      setConsultas(data.consultas || []);
      setResumen(data.resumen || {});
      setError('');
    } catch (err) {
      setError('Error al cargar historial: ' + err.message);
    }
    setCargando(false);
  };

  // Filtrado de consultas
  const consultasFiltradas = useMemo(() => {
    let result = consultas;
    if (busqueda.trim()) {
      const term = busqueda.toLowerCase();
      result = result.filter(c => {
        const diags = parseJson(c.diagnostico_lista).map(d => d.texto?.toLowerCase()).join(' ');
        return (c.motivo?.toLowerCase().includes(term) || diags.includes(term) || c.signos_sintomas?.toLowerCase().includes(term) || c.notas?.toLowerCase().includes(term));
      });
    }
    if (fechaDesde) result = result.filter(c => c.fecha >= fechaDesde);
    if (fechaHasta) result = result.filter(c => c.fecha <= fechaHasta + 'T23:59:59');
    return result;
  }, [consultas, busqueda, fechaDesde, fechaHasta]);

  if (cargando) return <div className="loading">Cargando historial...</div>;

  const tabs = [
    { key: 'consultas', label: 'Consultas', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { key: 'diagnostico', label: 'Diagnostico/Plan', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'tratamientos', label: 'Tratamientos', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { key: 'recetas', label: 'Recetas', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'galeria', label: 'Galeria', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { key: 'pagos', label: 'Pagos', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn-back" onClick={onVolver}>&larr; Volver</button>
          <h2>{nombreCompleto(paciente)}</h2>
          <p>DNI: {paciente.dni} {paciente.telefono ? `| Tel: ${paciente.telefono}` : ''}</p>
        </div>
        {historia && (
          <button className="btn btn-primary" onClick={() => setMostrarConsulta(true)}>
            + Nueva Consulta
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {historia && <ResumenCards resumen={resumen} onTab={setTab} />}

      {historia && (
        <div className="info-cards">
          {historia.alergia_medicamentos && historia.alergia_medicamentos !== 'No' && (
            <div className="info-card alerta"><h4>Alergias a Medicamentos</h4><p>{historia.alergia_medicamentos}</p></div>
          )}
          {historia.presion_arterial_medicacion && historia.presion_arterial_medicacion !== 'No' && (
            <div className="info-card"><h4>Presion Arterial / Medicacion</h4><p>{historia.presion_arterial_medicacion}</p></div>
          )}
          {historia.diabetes_personal && historia.diabetes_personal !== 'No' && (
            <div className="info-card"><h4>Diabetes Personal</h4><p>{historia.diabetes_personal}</p></div>
          )}
          {historia.otras_enfermedades && (
            <div className="info-card"><h4>Otras Enfermedades</h4><p>{historia.otras_enfermedades}</p></div>
          )}
          {historia.enfermedad_actual_medicacion && (
            <div className="info-card"><h4>Medicacion Actual</h4><p>{historia.enfermedad_actual_medicacion}</p></div>
          )}
          {historia.observaciones && (
            <div className="info-card"><h4>Observaciones</h4><p>{historia.observaciones}</p></div>
          )}
        </div>
      )}

      {!historia && (
        <div className="card">
          <div className="card-body-center">
            <p>Este paciente no tiene historia clinica.</p>
            <button className="btn btn-primary" onClick={async () => {
              await api.historias.crear({ paciente_id: paciente.id });
              cargarHistorial();
            }}>Crear Historia Clinica</button>
          </div>
        </div>
      )}

      <div className="tabs-container">
        <div className="tabs-nav">
          {tabs.map(t => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon}/></svg>
              {t.label}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {tab === 'consultas' && (
            <div>
              {/* Busqueda y filtros */}
              <div className="historial-filtros">
                <input type="text" className="busqueda-input" placeholder="Buscar por motivo, diagnostico, sintomas..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                <input type="date" className="busqueda-fecha" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} title="Desde" />
                <input type="date" className="busqueda-fecha" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} title="Hasta" />
                <span className="busqueda-count">{consultasFiltradas.length} de {consultas.length}</span>
              </div>
              {/* Timeline */}
              {consultasFiltradas.length === 0 ? (
                <p className="empty">{consultas.length === 0 ? 'No hay consultas registradas' : 'No se encontraron consultas con esos filtros'}</p>
              ) : (
                <div className="timeline">
                  {consultasFiltradas.map(c => (
                    <ConsultaTimeline key={c.id} c={c} onRecargar={cargarHistorial} />
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'diagnostico' && (
            <DiagnosticoPlan paciente={paciente} onVolver={() => setTab('consultas')} />
          )}
          {tab === 'tratamientos' && (
            <Tratamientos pacienteId={paciente.id} consultas={consultas} paciente={paciente} />
          )}
          {tab === 'recetas' && (
            <Recetas pacienteId={paciente.id} paciente={paciente} consultas={consultas} />
          )}
          {tab === 'galeria' && (
            <Galeria pacienteId={paciente.id} />
          )}
          {tab === 'pagos' && (
            <Pagos pacienteId={paciente.id} paciente={paciente} consultas={consultas} />
          )}
        </div>
      </div>

      {mostrarConsulta && historia && (
        <WizardConsulta historia={historia} consultas={consultas} onCerrar={() => setMostrarConsulta(false)} onGuardado={() => { setMostrarConsulta(false); cargarHistorial(); }} />
      )}
    </div>
  );
}
