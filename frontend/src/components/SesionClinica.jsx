import { useState, useEffect } from 'react';
import { api } from '../services/api';
import Odontograma from './Odontograma';

const PASOS = [
  { id: 1, label: 'Paciente', icon: '\u{1F464}' },
  { id: 2, label: 'Enfermedad', icon: '\u{1F4CB}' },
  { id: 3, label: 'Diagnostico', icon: '\u{1F50D}' },
  { id: 4, label: 'Odontograma', icon: '\u{1F9B7}' },
  { id: 5, label: 'Tratamiento', icon: '\u{1F48A}' },
  { id: 6, label: 'Resumen', icon: '\u{1F4CB}' },
];

const NECESIDADES_DEFAULT = {
  cariados: 0, curados: 0, por_extraer: 0, endodoncia: 0,
  ortodoncia: 0, protesis: 0, extraidos: 0, destartraje: 0,
};

const SIGNOS_VITALES_DEFAULT = {
  presion_arterial: '', pulso: '', temperatura: '', frecuencia_cardiaca: '', frecuencia_respiratoria: '',
};

function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

export default function SesionClinica({ paciente, onVolver, onCompletado }) {
  const [paso, setPaso] = useState(1);
  const [historia, setHistoria] = useState(null);
  const [consultas, setConsultas] = useState([]);
  const [necesidadesPrevias, setNecesidadesPrevias] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [verHistorial, setVerHistorial] = useState(false);
  const [consultaExpandida, setConsultaExpandida] = useState(null);

  // Paso 2: Enfermedad Actual
  const [motivo, setMotivo] = useState('');
  const [tiempoEnfermedad, setTiempoEnfermedad] = useState('');
  const [signosSintomas, setSignosSintomas] = useState('');
  const [relatoCronologico, setRelatoCronologico] = useState('');
  const [funcionesBiologicas, setFuncionesBiologicas] = useState('');

  // Paso 3: Exploracion + Diagnostico
  const [signosVitales, setSignosVitales] = useState({ ...SIGNOS_VITALES_DEFAULT });
  const [examenClinico, setExamenClinico] = useState('');
  const [evaluacionOdonto, setEvaluacionOdonto] = useState('');
  const [diagnosticos, setDiagnosticos] = useState([{ texto: '', tipo: 'clinico' }]);
  const [planTratamiento, setPlanTratamiento] = useState({ descripcion: '', procedimientos: '', secuencia: '' });

  // Paso 4: Odontograma
  const [odontograma, setOdontograma] = useState({});
  const [necesidades, setNecesidades] = useState({ ...NECESIDADES_DEFAULT });

  // Paso 5: Tratamiento
  const [tratamientos, setTratamientos] = useState([{ procedimiento_realizado: '', costo_total: '', monto_a_cuenta: '', pieza_dental: '', notas: '' }]);

  useEffect(() => { cargarDatos(); }, [paciente.id]);

  const cargarDatos = async () => {
    try {
      const data = await api.pacientes.historial(paciente.id);
      setHistoria(data.historia);
      setConsultas(data.consultas || []);
      setNecesidadesPrevias(data.necesidades || null);
    } catch {}
  };

  const siguiente = () => { if (paso < PASOS.length) setPaso(paso + 1); };
  const anterior = () => { if (paso > 1) setPaso(paso - 1); };

  const agregarDiagnostico = () => {
    setDiagnosticos([...diagnosticos, { texto: '', tipo: 'clinico' }]);
  };

  const actualizarDiagnostico = (index, valor) => {
    const nuevos = [...diagnosticos];
    nuevos[index].texto = valor;
    setDiagnosticos(nuevos);
  };

  const eliminarDiagnostico = (index) => {
    if (diagnosticos.length <= 1) return;
    setDiagnosticos(diagnosticos.filter((_, i) => i !== index));
  };

  const agregarTratamiento = () => {
    setTratamientos([...tratamientos, { procedimiento_realizado: '', costo_total: '', monto_a_cuenta: '', pieza_dental: '', notas: '' }]);
  };

  const actualizarTratamiento = (index, campo, valor) => {
    const nuevos = [...tratamientos];
    nuevos[index][campo] = valor;
    setTratamientos(nuevos);
  };

  const eliminarTratamiento = (index) => {
    if (tratamientos.length <= 1) return;
    setTratamientos(tratamientos.filter((_, i) => i !== index));
  };

  const guardarSesion = async () => {
    setGuardando(true);
    setMensaje('');
    try {
      let historiaActual = historia;
      if (!historiaActual) {
        const nh = await api.historias.crear({
          paciente_id: paciente.id,
          observaciones: '',
        });
        historiaActual = nh;
        setHistoria(nh);
      }

      const now = new Date();
      const res = await api.consultas.crear({
        historia_id: historiaActual.id,
        fecha: now.toISOString(),
        hora: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        motivo,
        tiempo_enfermedad: tiempoEnfermedad,
        signos_sintomas: signosSintomas,
        relato_cronologico: relatoCronologico,
        funciones_biologicas: funcionesBiologicas,
        signos_vitales: signosVitales,
        examen_clinico_general: examenClinico,
        evaluacion_odontoestomatologica: evaluacionOdonto,
        diagnostico_lista: diagnosticos.filter(d => d.texto.trim()),
        plan_tratamiento: planTratamiento,
        notas: '',
      });

      if (res.error) { setMensaje('Error: ' + res.error); setGuardando(false); return; }

      if (Object.keys(odontograma).length > 0) {
        await api.odontogramas.crear({
          consulta_id: res.id,
          datos_json: { version: 1, dientes: odontograma }
        });
      }

      const tieneNecesidades = Object.values(necesidades).some(v => v > 0);
      if (tieneNecesidades) {
        await api.necesidades.crear({ consulta_id: res.id, ...necesidades });
      }

      const TratsValidos = tratamientos.filter(t => t.procedimiento_realizado.trim());
      for (const t of TratsValidos) {
        const costo = parseFloat(t.costo_total) || 0;
        const monto = parseFloat(t.monto_a_cuenta) || 0;
        await api.tratamientos.crear({
          paciente_id: paciente.id,
          consulta_id: res.id,
          fecha: now.toISOString().split('T')[0],
          pieza_dental: t.pieza_dental || '',
          procedimiento_realizado: t.procedimiento_realizado,
          costo_total: costo,
          monto_a_cuenta: monto,
          notas: t.notas || '',
        });
      }

      setMensaje('Sesion guardada correctamente');
      setTimeout(() => { onCompletado?.(); }, 1500);
    } catch (err) {
      setMensaje('Error al guardar: ' + err.message);
    }
    setGuardando(false);
  };

  const edad = paciente.fecha_nacimiento ? (() => {
    const h = new Date(); const n = new Date(paciente.fecha_nacimiento);
    let e = h.getFullYear() - n.getFullYear();
    if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--;
    return e;
  })() : null;

  const totalConsultas = consultas.length;
  const ultimaConsulta = consultas.length > 0 ? consultas[0] : null;

  return (
    <div className="sesion-container">
      <div className="sesion-header">
        <div className="sesion-header-left">
          <button className="btn-back" onClick={onVolver}>&larr;</button>
          <div className="sesion-paciente-info">
            <h2>{nombreCompleto(paciente)}</h2>
            <span>DNI: {paciente.dni}{edad ? ` | ${edad} anos` : ''}{paciente.telefono ? ` | Tel: ${paciente.telefono}` : ''}</span>
          </div>
        </div>
        <div className="sesion-header-right">
          {mensaje && <span className={`sesion-mensaje ${mensaje.includes('Error') ? 'error' : 'exito'}`}>{mensaje}</span>}
          <span className="sesion-paso-label">Paso {paso} de {PASOS.length}</span>
        </div>
      </div>

      <div className="sesion-progress">
        {PASOS.map((p, i) => (
          <div key={p.id} className={`sesion-progress-step ${paso === p.id ? 'active' : ''} ${paso > p.id ? 'completed' : ''}`}>
            <div className="step-circle">{paso > p.id ? '\u2713' : p.icon}</div>
            <span className="step-label">{p.label}</span>
            {i < PASOS.length - 1 && <div className={`step-line ${paso > p.id ? 'completed' : ''}`}></div>}
          </div>
        ))}
      </div>

      <div className="sesion-content">
        {paso === 1 && (
          <div className="paso-paciente">
            <div className="paso-paciente-grid">
              <div className="paso-paciente-col-izq">
                <div className="paso-paciente-card">
                  <div className="paso-paciente-avatar">
                    {(paciente.apellido_paterno || paciente.nombre || '?').charAt(0)}
                  </div>
                  <h3>{nombreCompleto(paciente)}</h3>
                  <span className="paso-paciente-dni">DNI {paciente.dni}</span>
                  <div className="paso-paciente-meta-grid">
                    <div className="paso-paciente-meta-item">
                      <span className="meta-label">Edad</span>
                      <span className="meta-value">{edad ? `${edad} anos` : '-'}</span>
                    </div>
                    <div className="paso-paciente-meta-item">
                      <span className="meta-label">Sexo</span>
                      <span className="meta-value">{paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : '-'}</span>
                    </div>
                    <div className="paso-paciente-meta-item">
                      <span className="meta-label">Estado Civil</span>
                      <span className="meta-value">{paciente.estado_civil || '-'}</span>
                    </div>
                    <div className="paso-paciente-meta-item">
                      <span className="meta-label">Telefono</span>
                      <span className="meta-value">{paciente.telefono || '-'}</span>
                    </div>
                    <div className="paso-paciente-meta-item">
                      <span className="meta-label">Email</span>
                      <span className="meta-value">{paciente.email || '-'}</span>
                    </div>
                    <div className="paso-paciente-meta-item">
                      <span className="meta-label">Direccion</span>
                      <span className="meta-value">{paciente.direccion || '-'}</span>
                    </div>
                    <div className="paso-paciente-meta-item">
                      <span className="meta-label">Ocupacion</span>
                      <span className="meta-value">{paciente.ocupacion || '-'}</span>
                    </div>
                    <div className="paso-paciente-meta-item">
                      <span className="meta-label">Lugar Nacimiento</span>
                      <span className="meta-value">{paciente.lugar_nacimiento || '-'}</span>
                    </div>
                  </div>
                  {paciente.contacto_emergencia && (
                    <div className="paso-paciente-emergencia">
                      <span className="emergencia-label">Contacto de emergencia</span>
                      <span className="emergencia-value">{paciente.contacto_emergencia} {paciente.telefono_emergencia ? `- ${paciente.telefono_emergencia}` : ''}</span>
                    </div>
                  )}
                </div>

                {historia && (
                  <div className="paso-paciente-card paso-historia-card">
                    <div className="paso-historia-header">
                      <h4>Historia Clinica</h4>
                      <span className="historia-numero">N\u00ba {historia.numero_historia || '-'}</span>
                    </div>
                    <div className="paso-historia-datos">
                      {historia.alergia_medicamentos && historia.alergia_medicamentos !== 'No' && (
                        <div className="historia-dato alerta">
                          <span className="historia-dato-label">Alergias a Medicamentos</span>
                          <span className="historia-dato-value">{historia.alergia_medicamentos}</span>
                        </div>
                      )}
                      {historia.presion_arterial_medicacion && historia.presion_arterial_medicacion !== 'No' && (
                        <div className="historia-dato">
                          <span className="historia-dato-label">Presion Arterial / Medicacion</span>
                          <span className="historia-dato-value">{historia.presion_arterial_medicacion}</span>
                        </div>
                      )}
                      {historia.diabetes_personal && historia.diabetes_personal !== 'No' && (
                        <div className="historia-dato">
                          <span className="historia-dato-label">Diabetes Personal</span>
                          <span className="historia-dato-value">{historia.diabetes_personal}</span>
                        </div>
                      )}
                      {historia.diabetes_familiar && historia.diabetes_familiar !== 'No' && (
                        <div className="historia-dato">
                          <span className="historia-dato-label">Diabetes Familiar</span>
                          <span className="historia-dato-value">{historia.diabetes_familiar}</span>
                        </div>
                      )}
                      {historia.cardiopatias_personales && historia.cardiopatias_personales !== 'No' && (
                        <div className="historia-dato">
                          <span className="historia-dato-label">Cardiopatias Personales</span>
                          <span className="historia-dato-value">{historia.cardiopatias_personales}</span>
                        </div>
                      )}
                      {historia.otras_enfermedades && (
                        <div className="historia-dato">
                          <span className="historia-dato-label">Otras Enfermedades</span>
                          <span className="historia-dato-value">{historia.otras_enfermedades}</span>
                        </div>
                      )}
                      {historia.enfermedad_actual_medicacion && (
                        <div className="historia-dato">
                          <span className="historia-dato-label">Medicacion Actual</span>
                          <span className="historia-dato-value">{historia.enfermedad_actual_medicacion}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!historia && (
                  <div className="paso-paciente-card paso-historia-card">
                    <p className="paso-sin-historia">Este paciente no tiene historia clinica. Se creara automaticamente al guardar la sesion.</p>
                  </div>
                )}
              </div>

              <div className="paso-paciente-col-der">
                <div className="paso-paciente-card">
                  <div className="paso-consultas-header">
                    <h4>Ultima Consulta</h4>
                    <span className="consulta-counter">{totalConsultas} consulta{totalConsultas !== 1 ? 's' : ''} previa{totalConsultas !== 1 ? 's' : ''}</span>
                  </div>

                  {ultimaConsulta && (
                    <div className="ultima-consulta-card">
                      <span className="ultima-label">Ultima consulta</span>
                      <span className="ultima-fecha">{new Date(ultimaConsulta.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      <span className="ultima-motivo">{ultimaConsulta.motivo}</span>
                      {ultimaConsulta.diagnostico_lista && (() => {
                        try {
                          const lista = typeof ultimaConsulta.diagnostico_lista === 'string' ? JSON.parse(ultimaConsulta.diagnostico_lista) : ultimaConsulta.diagnostico_lista;
                          return lista.length > 0 && <span className="ultima-diag">{lista[0].texto}</span>;
                        } catch { return null; }
                      })()}
                    </div>
                  )}

                  {necesidadesPrevias && (
                    <div className="necesidades-previas">
                      <span className="necesidades-previas-label">Necesidades registradas</span>
                      <div className="necesidades-previas-grid">
                        {Object.entries({ cariados: 'Cariados', curados: 'Curados', por_extraer: 'Por Extraer', endodoncia: 'Endodoncia', ortodoncia: 'Orto', protesis: 'Protesis', extraidos: 'Extraidos', destartraje: 'Destartraje' })
                          .filter(([k]) => necesidadesPrevias[k] > 0)
                          .map(([k, label]) => (
                            <span key={k} className="necesidad-previa-badge">{label}: {necesidadesPrevias[k]}</span>
                          ))
                        }
                        {Object.values(necesidadesPrevias).every(v => v === 0) && (
                          <span className="necesidades-vacias">Sin necesidades registradas</span>
                        )}
                      </div>
                    </div>
                  )}

                  <button className="btn btn-sm btn-secondary btn-ver-historial" onClick={() => setVerHistorial(!verHistorial)}>
                    {verHistorial ? 'Ocultar historial' : `Ver historial completo (${totalConsultas})`}
                  </button>

                  {verHistorial && (
                    <div className="historial-completo">
                      {consultas.length === 0 ? (
                        <p className="historial-vacio">No hay consultas previas</p>
                      ) : (
                        consultas.map(c => (
                          <div key={c.id} className="historial-item" onClick={() => setConsultaExpandida(consultaExpandida === c.id ? null : c.id)}>
                            <div className="historial-item-header">
                              <span className="historial-item-fecha">{new Date(c.fecha).toLocaleDateString()}</span>
                              <span className="historial-item-motivo">{c.motivo}</span>
                              <span className="historial-item-arrow">{consultaExpandida === c.id ? '\u2212' : '+'}</span>
                            </div>
                            {consultaExpandida === c.id && (
                              <div className="historial-item-detalle">
                                {c.diagnostico_lista && (() => {
                                  try {
                                    const lista = typeof c.diagnostico_lista === 'string' ? JSON.parse(c.diagnostico_lista) : c.diagnostico_lista;
                                    return lista.length > 0 && <div><strong>Diagnostico:</strong> {lista.map(d => d.texto).join('; ')}</div>;
                                  } catch { return null; }
                                })()}
                                {c.notas && <div><strong>Notas:</strong> {c.notas}</div>}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="paso-motivo">
            <div className="paso-motivo-card">
              <h3>Enfermedad Actual</h3>
              <p className="sesion-hint">Informacion sobre el motivo de consulta y sintomas</p>

              <div className="motivo-rapidos">
                <label className="motivo-rapidos-label">Acceso rapido</label>
                <div className="motivo-rapidos-grid">
                  {[
                    { icono: '\u{1F9B7}', texto: 'Dolor dental' },
                    { icono: '\u{1FA78}', texto: 'Sangrado de encias' },
                    { icono: '\u{1F50D}', texto: 'Revision general' },
                    { icono: '\u2728', texto: 'Limpieza / Destartraje' },
                    { icono: '\u{1F489}', texto: 'Endodoncia' },
                    { icono: '\u{1F527}', texto: 'Restauracion' },
                    { icono: '\u{1FA9E}', texto: 'Estetica dental' },
                    { icono: '\u26A1', texto: 'Emergencia' },
                    { icono: '\u{1F4CB}', texto: 'Seguimiento' },
                    { icono: '\u{1F9B7}', texto: 'Extraccion' },
                  ].map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`motivo-rapido-btn ${motivo === item.texto ? 'active' : ''}`}
                      onClick={() => setMotivo(item.texto)}
                    >
                      <span className="motivo-rapido-icono">{item.icono}</span>
                      <span className="motivo-rapido-texto">{item.texto}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="motivo-detalle">
                <label>Motivo de consulta *</label>
                <textarea
                  className="sesion-textarea"
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Describe los sintomas, tiempo de evolucion, zona afectada, factores desencadenantes..."
                  rows={4}
                />
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>Tiempo de Enfermedad</label>
                  <input type="text" value={tiempoEnfermedad} onChange={e => setTiempoEnfermedad(e.target.value)} placeholder="Ej: 3 dias, 2 semanas, 1 mes" />
                </div>
              </div>

              <div className="field">
                <label>Signos y Sintomas Principales</label>
                <textarea
                  className="sesion-textarea"
                  value={signosSintomas}
                  onChange={e => setSignosSintomas(e.target.value)}
                  placeholder="Describe los signos y sintomas principales que presenta el paciente..."
                  rows={3}
                />
              </div>

              <div className="field">
                <label>Relato Cronologico</label>
                <textarea
                  className="sesion-textarea"
                  value={relatoCronologico}
                  onChange={e => setRelatoCronologico(e.target.value)}
                  placeholder="Describe la evolucion temporal de la enfermedad..."
                  rows={3}
                />
              </div>

              <div className="field">
                <label>Funciones Biologicas</label>
                <textarea
                  className="sesion-textarea"
                  value={funcionesBiologicas}
                  onChange={e => setFuncionesBiologicas(e.target.value)}
                  placeholder="Sueno, apetito, evacuaciones, orina..."
                  rows={2}
                />
              </div>
            </div>

            <div className="paso-motivo-sidebar">
              <div className="paso-paciente-card paso-motivo-paciente-mini">
                <div className="motivo-paciente-row">
                  <div className="patient-avatar-sm">{(paciente.apellido_paterno || paciente.nombre || '?').charAt(0)}</div>
                  <div>
                    <span className="motivo-paciente-nombre">{nombreCompleto(paciente)}</span>
                    <span className="motivo-paciente-dni">DNI: {paciente.dni}</span>
                  </div>
                </div>
                {historia?.alergia_medicamentos && historia.alergia_medicamentos !== 'No' && (
                  <div className="motivo-alergia-alerta">
                    <span className="motivo-alergia-icono">\u26A0</span>
                    <span>Alergias: {historia.alergia_medicamentos}</span>
                  </div>
                )}
                {ultimaConsulta && (
                  <div className="motivo-ultima-consulta">
                    <span className="motivo-ultima-label">Ultima visita</span>
                    <span className="motivo-ultima-texto">{new Date(ultimaConsulta.fecha).toLocaleDateString()} - {ultimaConsulta.motivo}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {paso === 3 && (
          <div className="sesion-card">
            <h3>Exploracion Fisica y Diagnostico</h3>

            <div className="sesion-section">
              <h4>Signos Vitales</h4>
              <div className="form-grid-5">
                <div className="field">
                  <label>Presion Arterial</label>
                  <input type="text" value={signosVitales.presion_arterial} onChange={e => setSignosVitales({...signosVitales, presion_arterial: e.target.value})} placeholder="Ej: 120/80" />
                </div>
                <div className="field">
                  <label>Pulso</label>
                  <input type="text" value={signosVitales.pulso} onChange={e => setSignosVitales({...signosVitales, pulso: e.target.value})} placeholder="Ej: 78" />
                </div>
                <div className="field">
                  <label>Temperatura</label>
                  <input type="text" value={signosVitales.temperatura} onChange={e => setSignosVitales({...signosVitales, temperatura: e.target.value})} placeholder="Ej: 36.5" />
                </div>
                <div className="field">
                  <label>Frec. Cardiaca</label>
                  <input type="text" value={signosVitales.frecuencia_cardiaca} onChange={e => setSignosVitales({...signosVitales, frecuencia_cardiaca: e.target.value})} placeholder="Ej: 72" />
                </div>
                <div className="field">
                  <label>Frec. Respiratoria</label>
                  <input type="text" value={signosVitales.frecuencia_respiratoria} onChange={e => setSignosVitales({...signosVitales, frecuencia_respiratoria: e.target.value})} placeholder="Ej: 16" />
                </div>
              </div>
            </div>

            <div className="sesion-section">
              <h4>Evaluacion Clinica</h4>
              <div className="field">
                <label>Examen Clinico General</label>
                <textarea className="sesion-textarea" value={examenClinico} onChange={e => setExamenClinico(e.target.value)} placeholder="Hallazgos del examen clinico general..." rows={3} />
              </div>
              <div className="field">
                <label>Evaluacion Odontoestomatologica</label>
                <textarea className="sesion-textarea" value={evaluacionOdonto} onChange={e => setEvaluacionOdonto(e.target.value)} placeholder="Evaluacion bucal y dental..." rows={3} />
              </div>
            </div>

            <div className="sesion-section">
              <h4>Diagnostico</h4>
              {diagnosticos.map((d, i) => (
                <div key={i} className="sesion-tratamiento-row">
                  <input type="text" placeholder="Diagnostico clinico" value={d.texto} onChange={e => actualizarDiagnostico(i, e.target.value)} />
                  {diagnosticos.length > 1 && (
                    <button type="button" className="btn-remove-sesion" onClick={() => eliminarDiagnostico(i)}>\u00D7</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-secondary btn-add-tratamiento" onClick={agregarDiagnostico}>+ Agregar diagnostico</button>
            </div>

            <div className="sesion-section">
              <h4>Plan de Tratamiento</h4>
              <div className="field">
                <label>Descripcion del plan</label>
                <textarea className="sesion-textarea" value={planTratamiento.descripcion} onChange={e => setPlanTratamiento({...planTratamiento, descripcion: e.target.value})} placeholder="Describe el plan de tratamiento propuesto..." rows={3} />
              </div>
              <div className="field">
                <label>Procedimientos a realizar</label>
                <textarea className="sesion-textarea" value={planTratamiento.procedimientos} onChange={e => setPlanTratamiento({...planTratamiento, procedimientos: e.target.value})} placeholder="Lista los procedimientos (uno por linea)..." rows={3} />
              </div>
              <div className="field">
                <label>Secuencia del tratamiento</label>
                <textarea className="sesion-textarea-sm" value={planTratamiento.secuencia} onChange={e => setPlanTratamiento({...planTratamiento, secuencia: e.target.value})} placeholder="Orden de los procedimientos..." rows={2} />
              </div>
            </div>
          </div>
        )}

        {paso === 4 && (
          <div className="sesion-card">
            <h3>Odontograma</h3>
            <p className="sesion-hint">Registra el estado actual de las piezas dentales</p>
            <Odontograma
              datos={odontograma}
              onGuardar={(dientes) => setOdontograma(dientes)}
              titulo="Estado dental actual"
            />
            <div className="sesion-necesidades">
              <h4>Necesidades Odontologicas</h4>
              <div className="necesidades-inline-grid">
                {Object.entries({ cariados: 'Cariados', curados: 'Curados', por_extraer: 'Por Extraer', endodoncia: 'Endodoncia', ortodoncia: 'Orto', protesis: 'Protesis', extraidos: 'Extraidos', destartraje: 'Destartraje' }).map(([key, label]) => (
                  <div key={key} className="necesidad-inline-item">
                    <label>{label}</label>
                    <input type="number" min="0" max="99" value={necesidades[key]} onChange={e => setNecesidades({ ...necesidades, [key]: parseInt(e.target.value) || 0 })} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {paso === 5 && (
          <div className="sesion-card">
            <h3>Registro de Tratamientos</h3>
            <p className="sesion-hint">Define los procedimientos a realizar con sus costos</p>
            {tratamientos.map((t, i) => (
              <div key={i} className="sesion-tratamiento-row">
                <div className="sesion-tratamiento-fields">
                  <input type="text" placeholder="Procedimiento (ej: Corona ceramica pieza 16)" value={t.procedimiento_realizado} onChange={e => actualizarTratamiento(i, 'procedimiento_realizado', e.target.value)} />
                  <input type="text" placeholder="Pieza dental" value={t.pieza_dental} onChange={e => actualizarTratamiento(i, 'pieza_dental', e.target.value)} className="input-diente" />
                  <input type="number" placeholder="Costo $" value={t.costo_total} onChange={e => actualizarTratamiento(i, 'costo_total', e.target.value)} min="0" step="0.01" className="input-costo" />
                  <input type="number" placeholder="A cuenta $" value={t.monto_a_cuenta} onChange={e => actualizarTratamiento(i, 'monto_a_cuenta', e.target.value)} min="0" step="0.01" className="input-costo" />
                </div>
                {tratamientos.length > 1 && (
                  <button type="button" className="btn-remove-sesion" onClick={() => eliminarTratamiento(i)}>\u00D7</button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-secondary btn-add-tratamiento" onClick={agregarTratamiento}>
              + Agregar tratamiento
            </button>
          </div>
        )}

        {paso === 6 && (
          <div className="sesion-card">
            <h3>Resumen de la Sesion</h3>
            <div className="resumen-section">
              <h4>Motivo</h4>
              <p>{motivo || <em>No registrado</em>}</p>
            </div>
            {tiempoEnfermedad && (
              <div className="resumen-section">
                <h4>Tiempo de Enfermedad</h4>
                <p>{tiempoEnfermedad}</p>
              </div>
            )}
            <div className="resumen-section">
              <h4>Diagnostico</h4>
              {diagnosticos.filter(d => d.texto.trim()).length > 0 ? (
                <ul>{diagnosticos.filter(d => d.texto.trim()).map((d, i) => <li key={i}>{d.texto}</li>)}</ul>
              ) : <p><em>No registrado</em></p>}
            </div>
            {planTratamiento.descripcion && (
              <div className="resumen-section">
                <h4>Plan de Tratamiento</h4>
                <p>{planTratamiento.descripcion}</p>
                {planTratamiento.procedimientos && <p><strong>Procedimientos:</strong> {planTratamiento.procedimientos}</p>}
                {planTratamiento.secuencia && <p><strong>Secuencia:</strong> {planTratamiento.secuencia}</p>}
              </div>
            )}
            {Object.keys(odontograma).length > 0 && (
              <div className="resumen-section">
                <h4>Odontograma</h4>
                <p>{Object.keys(odontograma).length} pieza{Object.keys(odontograma).length !== 1 ? 's' : ''} con tratamiento</p>
              </div>
            )}
            {Object.values(necesidades).some(v => v > 0) && (
              <div className="resumen-section">
                <h4>Necesidades</h4>
                <div className="resumen-necesidades">
                  {Object.entries(necesidades).filter(([_, v]) => v > 0).map(([k, v]) => (
                    <span key={k} className="resumen-badge">{k.replace(/_/g, ' ')}: {v}</span>
                  ))}
                </div>
              </div>
            )}
            {tratamientos.filter(t => t.procedimiento_realizado.trim()).length > 0 && (
              <div className="resumen-section">
                <h4>Tratamientos ({tratamientos.filter(t => t.procedimiento_realizado.trim()).length})</h4>
                {tratamientos.filter(t => t.procedimiento_realizado.trim()).map((t, i) => (
                  <div key={i} className="resumen-tratamiento">
                    <span>{t.procedimiento_realizado}</span>
                    {t.pieza_dental && <span className="diente-badge">Pza {t.pieza_dental}</span>}
                    {t.costo_total && <span className="resumen-costo">${parseFloat(t.costo_total).toLocaleString()}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sesion-footer">
        <button className="btn btn-secondary" onClick={anterior} disabled={paso === 1}>
          Anterior
        </button>
        <div className="sesion-footer-right">
          {paso < PASOS.length ? (
            <button className="btn btn-primary" onClick={siguiente}>
              Siguiente
            </button>
          ) : (
            <button className="btn btn-primary btn-guardar-sesion" onClick={guardarSesion} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar Sesion Completa'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
