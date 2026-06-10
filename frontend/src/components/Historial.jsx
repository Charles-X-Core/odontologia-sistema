import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import Tratamientos from './Tratamientos';
import Recetas from './Recetas';
import Galeria from './Galeria';
import DiagnosticoPlan from './DiagnosticoPlan';
import Pagos from './Pagos';
import Odontograma from './Odontograma';
import ConfirmarPassword from './ConfirmarPassword';
import { nombreCompleto, tipoDocLabel } from '../utils/formatters';

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
        <span className="resumen-label">Por realizar</span>
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
// CONSULTA TIMELINE (enriquecido)
// ============================================
function ConsultaTimeline({ c, onRecargar }) {
  const [expandido, setExpandido] = useState(false);
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [imagenes, setImagenes] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [accionPendiente, setAccionPendiente] = useState(null);

  const requerirPassword = (accion) => {
    setAccionPendiente(() => accion);
    setMostrarPassword(true);
  };

  const passwordConfirmado = () => {
    setMostrarPassword(false);
    if (accionPendiente) accionPendiente();
    setAccionPendiente(null);
  };

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
  const totalPagado = pagosArr.reduce((s, p) => s + (p.a_cuenta || 0), 0);
  const signos = typeof c.signos_vitales === 'string' ? parseJson(c.signos_vitales) : (c.signos_vitales || {});
  const plan = typeof c.plan_tratamiento === 'string' ? parseJson(c.plan_tratamiento) : (c.plan_tratamiento || {});

  const toggleExpand = async () => {
    const next = !expandido;
    setExpandido(next);
    if (next && imagenes.length === 0 && c.id) {
      try {
        const imgs = await api.imagenes.porConsulta(c.id);
        setImagenes(imgs || []);
      } catch { setImagenes([]); }
    }
  };

  const isElectron = window.location.protocol === 'file:' || window.electronAPI?.isElectron;
  const IMG_BASE = isElectron ? 'http://localhost:18234' : (import.meta.env.VITE_API_URL || window.location.origin);

  const getImageUrl = (filename) => {
    const token = localStorage.getItem('token');
    return `${IMG_BASE}/api/imagenes/file/${filename}?token=${token}`;
  };

  return (
    <div className="timeline-item">
      <div className="timeline-dot"></div>
      <div className="timeline-content">
        <div className="timeline-date" onClick={toggleExpand} style={{ cursor: 'pointer' }}>
          {new Date(c.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}{c.hora ? ` - ${c.hora}` : ''}
          <span className="timeline-expand-icon">{expandido ? '▼' : '▶'}</span>
        </div>

        <h4 onClick={toggleExpand} style={{ cursor: 'pointer' }}>{c.motivo}</h4>

        <div className="timeline-badges">
          {trats.length > 0 && <span className="badge badge-tratamientos" onClick={() => setExpandido(true)}>🦷 {trats.length} tratamiento(s)</span>}
          {recetasArr.length > 0 && <span className="badge badge-recetas" onClick={() => setExpandido(true)}>💊 {recetasArr.length} receta(s)</span>}
          {pagosArr.length > 0 && <span className="badge badge-pagos" onClick={() => setExpandido(true)}>💰 S/ {totalPagado.toFixed(0)}</span>}
          {c.odontograma && <span className="badge badge-odontograma" onClick={() => setExpandido(true)}>🩺 Odontograma</span>}
          {imagenes.length > 0 && <span className="badge badge-fotos" onClick={() => setExpandido(true)}>🖼️ {imagenes.length} foto(s)</span>}
        </div>

        <div className="timeline-details">
          {c.tiempo_enfermedad && <div><strong>Tiempo:</strong> {c.tiempo_enfermedad}</div>}
          {c.signos_sintomas && <div><strong>Sintomas:</strong> {c.signos_sintomas}</div>}
          <div><strong>Diagnostico:</strong> {parseJson(c.diagnostico_lista).map(d => d.texto).join('; ') || 'Sin diagnostico'}</div>
          {c.notas && <div className="notas"><em>{c.notas}</em></div>}
        </div>

        {expandido && !editando && (
          <div className="timeline-expanded">
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

            {parseJson(c.diagnostico_lista).length > 0 && (
              <div className="timeline-section">
                <h5>Diagnosticos</h5>
                <ul>{parseJson(c.diagnostico_lista).map((d, i) => <li key={i}>{d.texto}</li>)}</ul>
              </div>
            )}

            {(plan.descripcion || plan.procedimientos || plan.secuencia) && (
              <div className="timeline-section">
                <h5>Plan de Tratamiento</h5>
                {plan.descripcion && <p>{plan.descripcion}</p>}
                {plan.procedimientos && <p><strong>Procedimientos:</strong> {plan.procedimientos}</p>}
                {plan.secuencia && <p><strong>Secuencia:</strong> {plan.secuencia}</p>}
              </div>
            )}

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

            {c.odontograma && (
              <div className="timeline-section">
                <h5>Odontograma ({Object.keys(c.odontograma.dientes || c.odontograma).filter(k => k !== 'version').length} piezas registradas)</h5>
                <Odontograma datos={c.odontograma} soloLectura={true} />
              </div>
            )}

            {imagenes.length > 0 && (
              <div className="timeline-section">
                <h5>Evidencias ({imagenes.length})</h5>
                <div className="timeline-evidencias-grid">
                  {imagenes.map((img, i) => (
                    <div key={img.id} className="timeline-evidencia-thumb" onClick={() => setViewerIndex(i)}>
                      <img
                        src={getImageUrl(img.archivo_nombre)}
                        alt={img.descripcion || img.archivo_original}
                        loading="lazy"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div className="timeline-evidencia-overlay">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="timeline-actions">
              <button className="btn btn-sm btn-secondary" onClick={() => requerirPassword(iniciarEdicion)}>Editar</button>
              <button className="btn btn-sm btn-danger" onClick={() => requerirPassword(eliminarConsulta)}>Eliminar</button>
            </div>
          </div>
        )}

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
      {viewerIndex !== null && imagenes.length > 0 && (
        <div className="image-viewer-overlay" onClick={() => setViewerIndex(null)}>
          <div className="image-viewer" onClick={e => e.stopPropagation()}>
            <div className="image-viewer-toolbar">
              <div className="image-viewer-toolbar-left">
                <span className="image-viewer-counter">{viewerIndex + 1} / {imagenes.length}</span>
              </div>
              <div className="image-viewer-toolbar-center">
                <button className="image-viewer-close" onClick={() => setViewerIndex(null)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            <div className="image-viewer-canvas">
              <img
                src={getImageUrl(imagenes[viewerIndex]?.archivo_nombre)}
                alt={imagenes[viewerIndex]?.descripcion || ''}
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            </div>
            {imagenes.length > 1 && (
              <>
                <button className="image-viewer-nav image-viewer-nav-prev" onClick={() => setViewerIndex(i => Math.max(0, i - 1))} disabled={viewerIndex === 0}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button className="image-viewer-nav image-viewer-nav-next" onClick={() => setViewerIndex(i => Math.min(imagenes.length - 1, i + 1))} disabled={viewerIndex === imagenes.length - 1}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {mostrarPassword && (
        <ConfirmarPassword
          titulo="Confirmar accion"
          onConfirm={passwordConfirmado}
          onCancelar={() => { setMostrarPassword(false); setAccionPendiente(null); }}
        />
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function Historial({ paciente, onVolver, onNuevaConsulta }) {
  const [historia, setHistoria] = useState(null);
  const [consultas, setConsultas] = useState([]);
  const [resumen, setResumen] = useState({});
  const [tab, setTab] = useState('consultas');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

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
          <p>{tipoDocLabel(paciente.tipo_documento)}: {paciente.dni} {paciente.telefono ? `| Tel: ${paciente.telefono}` : ''}</p>
        </div>
        {historia && (
          <button className="btn btn-primary" onClick={() => onNuevaConsulta?.()}>
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
              <div className="historial-filtros">
                <input type="text" className="busqueda-input" placeholder="Buscar por motivo, diagnostico, sintomas..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                <input type="date" className="busqueda-fecha" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} title="Desde" />
                <input type="date" className="busqueda-fecha" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} title="Hasta" />
                <span className="busqueda-count">{consultasFiltradas.length} de {consultas.length}</span>
              </div>
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
    </div>
  );
}
