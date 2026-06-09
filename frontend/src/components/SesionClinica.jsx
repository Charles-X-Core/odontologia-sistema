import { useState, useEffect } from 'react';
import { api } from '../services/api';
import Odontograma from './Odontograma';

const PASOS = [
  { id: 1, label: 'Paciente', icon: 'user' },
  { id: 2, label: 'Enfermedad', icon: 'clipboard' },
  { id: 3, label: 'Diagnostico', icon: 'search' },
  { id: 4, label: 'Odontograma', icon: 'activity' },
  { id: 5, label: 'Evidencias', icon: 'camera' },
  { id: 6, label: 'Recetas', icon: 'pill' },
  { id: 7, label: 'Tratamiento', icon: 'stethoscope' },
  { id: 8, label: 'Resumen', icon: 'filetext' },
];

function StepIcon({ name, size = 16 }) {
  const icons = {
    user: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    clipboard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
    activity: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    camera: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>,
    pill: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>,
    stethoscope: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/></svg>,
    filetext: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>,
  };
  return icons[name] || null;
}

const NECESIDADES_DEFAULT = {
  cariados: 0, curados: 0, por_extraer: 0, endodoncia: 0,
  ortodoncia: 0, protesis: 0, extraidos: 0, destartraje: 0,
};

const SIGNOS_VITALES_DEFAULT = {
  presion_arterial: '', pulso: '', temperatura: '', frecuencia_cardiaca: '', frecuencia_respiratoria: '', peso: '', altura: '',
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
  const [toast, setToast] = useState(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [consultaExpandida, setConsultaExpandida] = useState(null);

  const showToast = (msg, tipo = 'error') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

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
    setOdontograma(dientes);
    calcularNecesidades(dientes);
  };

  // Evidencias handlers
  const agregarEvidencias = (archivos) => {
    const nuevas = Array.from(archivos).map(file => ({
      file,
      tipo: file.type.startsWith('image/') ? 'foto' : 'documento',
      descripcion: '',
      preview: URL.createObjectURL(file),
    }));
    setEvidencias(prev => [...prev, ...nuevas]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) agregarEvidencias(e.dataTransfer.files);
  };

  const eliminarEvidencia = (index) => {
    setEvidencias(prev => {
      const nueva = [...prev];
      URL.revokeObjectURL(nueva[index].preview);
      nueva.splice(index, 1);
      return nueva;
    });
  };

  const actualizarEvidencia = (index, campo, valor) => {
    setEvidencias(prev => {
      const nueva = [...prev];
      nueva[index] = { ...nueva[index], [campo]: valor };
      return nueva;
    });
  };

  // Paso 5: Evidencias
  const [evidencias, setEvidencias] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  // Paso 6: Recetas (opcional)
  const [recetas, setRecetas] = useState([{ medicamentos: [{ nombre: '', dosis: '', frecuencia: '', duracion: '' }], indicaciones: '', archivos: [] }]);

  // Paso 6: Tratamiento
  const [tratamientos, setTratamientos] = useState([{ procedimiento_realizado: '', costo_total: '', monto_a_cuenta: '', pieza_dental: '', notas: '', realizado: false }]);

  // Antecedentes
  const [editandoAntecedentes, setEditandoAntecedentes] = useState(false);
  const [antecedentesForm, setAntecedentesForm] = useState({});
  const [guardandoAntecedentes, setGuardandoAntecedentes] = useState(false);

  useEffect(() => { cargarDatos(); }, [paciente.id]);

  const cargarDatos = async () => {
    try {
      const data = await api.pacientes.historial(paciente.id);
      setHistoria(data.historia);
      setConsultas(data.consultas || []);
      setNecesidadesPrevias(data.necesidades || null);
      if (data.historia) {
        setAntecedentesForm({
          alergia_medicamentos: data.historia.alergia_medicamentos || '',
          propension_hemorragias: data.historia.propension_hemorragias || '',
          complicaciones_anestesia: data.historia.complicaciones_anestesia || '',
          presion_arterial_medicacion: data.historia.presion_arterial_medicacion || '',
          cardiopatias_personales: data.historia.cardiopatias_personales || '',
          cardiopatias_familiares: data.historia.cardiopatias_familiares || '',
          diabetes_personal: data.historia.diabetes_personal || '',
          diabetes_familiar: data.historia.diabetes_familiar || '',
          hepatitis: data.historia.hepatitis || '',
          otras_enfermedades: data.historia.otras_enfermedades || '',
          enfermedad_actual_medicacion: data.historia.enfermedad_actual_medicacion || '',
        });
      }
    } catch {}
  };

  const guardarAntecedentes = async () => {
    if (!historia) return;
    setGuardandoAntecedentes(true);
    try {
      await api.historias.actualizar(historia.id, antecedentesForm);
      setHistoria({ ...historia, ...antecedentesForm });
      setEditandoAntecedentes(false);
      setMensaje('Antecedentes guardados correctamente');
      setTimeout(() => setMensaje(''), 3000);
    } catch (e) {
      setMensaje('Error al guardar antecedentes');
      setTimeout(() => setMensaje(''), 3000);
    }
    setGuardandoAntecedentes(false);
  };

  const siguiente = () => {
    if (paso === 2 && !motivo.trim()) {
      showToast('El motivo de consulta es obligatorio');
      return;
    }
    if (paso < PASOS.length) setPaso(paso + 1);
  };
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

  const agregarReceta = () => setRecetas([...recetas, { medicamentos: [{ nombre: '', dosis: '', frecuencia: '', duracion: '' }], indicaciones: '', archivos: [] }]);
  const eliminarReceta = (i) => { if (recetas.length > 1) setRecetas(recetas.filter((_, idx) => idx !== i)); };
  const actualizarReceta = (i, campo, valor) => { const n = [...recetas]; n[i][campo] = valor; setRecetas(n); };

  const PLANTILLAS = [
    { nombre: 'Analgesico', medicamentos: [{ nombre: 'Ibuprofeno', dosis: '600mg', frecuencia: 'Cada 8 horas', duracion: '5 dias' }, { nombre: 'Paracetamol', dosis: '500mg', frecuencia: 'Cada 6 horas', duracion: '3 dias' }], indicaciones: 'Tomar solo si hay dolor. No exceder la dosis recomendada.' },
    { nombre: 'Antibiotico', medicamentos: [{ nombre: 'Amoxicilina', dosis: '500mg', frecuencia: 'Cada 8 horas', duracion: '7 dias' }], indicaciones: 'Completar el tratamiento aunque mejore. No consumir alcohol.' },
    { nombre: 'Periodontal', medicamentos: [{ nombre: 'Clorhexidina 0.12%', dosis: '15ml', frecuencia: 'Cada 12 horas', duracion: '14 dias' }], indicaciones: 'Enjuague bucal 1 minuto. No ingerir nada por 30 min despues.' },
  ];

  const aplicarPlantilla = (ri, plantilla) => {
    const n = [...recetas];
    n[ri].medicamentos = plantilla.medicamentos.map(m => ({ ...m }));
    n[ri].indicaciones = plantilla.indicaciones;
    setRecetas(n);
  };

  const agregarMedicamentoReceta = (ri) => {
    const n = [...recetas];
    n[ri].medicamentos = [...n[ri].medicamentos, { nombre: '', dosis: '', frecuencia: '', duracion: '' }];
    setRecetas(n);
  };

  const actualizarMedicamentoReceta = (ri, mi, campo, valor) => {
    const n = [...recetas];
    n[ri].medicamentos[mi][campo] = valor;
    setRecetas(n);
  };

  const eliminarMedicamentoReceta = (ri, mi) => {
    const n = [...recetas];
    if (n[ri].medicamentos.length <= 1) return;
    n[ri].medicamentos = n[ri].medicamentos.filter((_, idx) => idx !== mi);
    setRecetas(n);
  };

  const handleSubirArchivoReceta = async (i, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('paciente_id', paciente.id);
    formData.append('tipo', 'foto');
    formData.append('descripcion', 'Imagen de receta');
    try {
      const res = await api.imagenes.subir(formData);
      if (res.id) {
        const n = [...recetas];
        n[i].archivos = [...(n[i].archivos || []), { id: res.id, nombre: res.archivo_nombre, original: res.archivo_original }];
        setRecetas(n);
      }
    } catch {}
    e.target.value = '';
  };

  const eliminarArchivoReceta = (ri, ai) => {
    const n = [...recetas];
    n[ri].archivos = n[ri].archivos.filter((_, idx) => idx !== ai);
    setRecetas(n);
  };

  const agregarTratamiento = () => {
    setTratamientos([...tratamientos, { procedimiento_realizado: '', costo_total: '', monto_a_cuenta: '', pieza_dental: '', notas: '', realizado: false }]);
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

      for (const r of recetas) {
        const meds = r.medicamentos.filter(m => m.nombre.trim());
        if (meds.length > 0 || r.indicaciones.trim()) {
          await api.recetas.crear({
            consulta_id: res.id,
            paciente_id: paciente.id,
            medicamentos: meds,
            indicaciones: r.indicaciones || '',
          });
        }
      }

      for (const ev of evidencias) {
        const formData = new FormData();
        formData.append('archivo', ev.file);
        formData.append('paciente_id', paciente.id);
        formData.append('consulta_id', res.id);
        formData.append('tipo', ev.tipo);
        formData.append('descripcion', ev.descripcion || '');
        await api.imagenes.subir(formData);
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
          estado: t.realizado ? 'realizado' : 'planificado',
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
            <div className="step-circle">
              {paso > p.id ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              ) : (
                <StepIcon name={p.icon} size={16} />
              )}
            </div>
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
                      <h4>Antecedentes Personales y Familiares</h4>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className="historia-numero">N° {historia.numero_historia || '-'}</span>
                        {!editandoAntecedentes ? (
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditandoAntecedentes(true)}>Editar</button>
                        ) : (
                          <>
                            <button className="btn btn-sm btn-primary" onClick={guardarAntecedentes} disabled={guardandoAntecedentes}>
                              {guardandoAntecedentes ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditandoAntecedentes(false)}>Cancelar</button>
                          </>
                        )}
                      </div>
                    </div>
                    {editandoAntecedentes ? (
                      <div className="antecedentes-form">
                        {[
                          { key: 'alergia_medicamentos', label: 'Alergia a medicamentos' },
                          { key: 'propension_hemorragias', label: 'Propension a hemorragia' },
                          { key: 'complicaciones_anestesia', label: 'Complicaciones con anestesia' },
                          { key: 'presion_arterial_medicacion', label: 'Presion Arterial / Medicacion' },
                          { key: 'cardiopatias_personales', label: 'Cardiopatias personales' },
                          { key: 'cardiopatias_familiares', label: 'Cardiopatias familiares' },
                          { key: 'diabetes_personal', label: 'Diabetes personal' },
                          { key: 'diabetes_familiar', label: 'Diabetes familiar' },
                          { key: 'hepatitis', label: 'Hepatitis (tipo A B C)' },
                          { key: 'otras_enfermedades', label: 'Otras enfermedades' },
                          { key: 'enfermedad_actual_medicacion', label: 'Enfermedad actual / Medicacion' },
                        ].map(({ key, label }) => {
                          const valor = antecedentesForm[key] || '';
                          const isYes = valor && valor !== 'No' && valor !== '';
                          return (
                            <div key={key} className="antecedente-field">
                              <label>{label}</label>
                              <div className="antecedente-sino">
                                <button
                                  type="button"
                                  className={`antecedente-btn ${isYes ? 'si-activo' : ''}`}
                                  onClick={() => setAntecedentesForm({ ...antecedentesForm, [key]: isYes ? '' : 'Si' })}
                                >
                                  Si
                                </button>
                                <button
                                  type="button"
                                  className={`antecedente-btn ${!isYes && valor === 'No' ? 'no-activo' : ''}`}
                                  onClick={() => setAntecedentesForm({ ...antecedentesForm, [key]: 'No' })}
                                >
                                  No
                                </button>
                              </div>
                              {isYes && (
                                <input
                                  type="text"
                                  value={valor === 'Si' ? '' : valor}
                                  onChange={e => setAntecedentesForm({ ...antecedentesForm, [key]: e.target.value || 'Si' })}
                                  placeholder="Observaciones (opcional)"
                                  className="antecedente-obs"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="paso-historia-datos">
                        {historia.alergia_medicamentos && historia.alergia_medicamentos !== 'No' && (
                          <div className="historia-dato alerta">
                            <span className="historia-dato-label">Alergias a Medicamentos</span>
                            <span className="historia-dato-value">{historia.alergia_medicamentos}</span>
                          </div>
                        )}
                        {historia.propension_hemorragias && historia.propension_hemorragias !== 'No' && (
                          <div className="historia-dato">
                            <span className="historia-dato-label">Propension a hemorragia</span>
                            <span className="historia-dato-value">{historia.propension_hemorragias}</span>
                          </div>
                        )}
                        {historia.complicaciones_anestesia && historia.complicaciones_anestesia !== 'No' && (
                          <div className="historia-dato">
                            <span className="historia-dato-label">Complicaciones con anestesia</span>
                            <span className="historia-dato-value">{historia.complicaciones_anestesia}</span>
                          </div>
                        )}
                        {historia.presion_arterial_medicacion && historia.presion_arterial_medicacion !== 'No' && (
                          <div className="historia-dato">
                            <span className="historia-dato-label">Presion Arterial / Medicacion</span>
                            <span className="historia-dato-value">{historia.presion_arterial_medicacion}</span>
                          </div>
                        )}
                        {historia.cardiopatias_personales && historia.cardiopatias_personales !== 'No' && (
                          <div className="historia-dato">
                            <span className="historia-dato-label">Cardiopatias Personales</span>
                            <span className="historia-dato-value">{historia.cardiopatias_personales}</span>
                          </div>
                        )}
                        {historia.cardiopatias_familiares && historia.cardiopatias_familiares !== 'No' && (
                          <div className="historia-dato">
                            <span className="historia-dato-label">Cardiopatias Familiares</span>
                            <span className="historia-dato-value">{historia.cardiopatias_familiares}</span>
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
                        {historia.hepatitis && historia.hepatitis !== 'No' && (
                          <div className="historia-dato">
                            <span className="historia-dato-label">Hepatitis</span>
                            <span className="historia-dato-value">{historia.hepatitis}</span>
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
                        {!historia.alergia_medicamentos && !historia.propension_hemorragias && !historia.complicaciones_anestesia && !historia.presion_arterial_medicacion && !historia.cardiopatias_personales && !historia.diabetes_personal && !historia.otras_enfermedades && (
                          <p className="paso-sin-historia">Sin antecedentes registrados. Haz click en Editar para agregar.</p>
                        )}
                      </div>
                    )}
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
              <div className="form-grid-3" style={{ marginTop: '12px' }}>
                <div className="field">
                  <label>Peso (kg)</label>
                  <input type="text" value={signosVitales.peso} onChange={e => setSignosVitales({...signosVitales, peso: e.target.value})} placeholder="Ej: 70" />
                </div>
                <div className="field">
                  <label>Altura (cm)</label>
                  <input type="text" value={signosVitales.altura} onChange={e => setSignosVitales({...signosVitales, altura: e.target.value})} placeholder="Ej: 170" />
                </div>
                {signosVitales.peso && signosVitales.altura && (
                  <div className="field">
                    <label>IMC</label>
                    <input type="text" readOnly className="field-readonly" value={(parseFloat(signosVitales.peso) / Math.pow(parseFloat(signosVitales.altura) / 100, 2)).toFixed(1)} />
                  </div>
                )}
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
                  <textarea className="diagnostico-input" placeholder="Diagnostico clinico" value={d.texto} onChange={e => actualizarDiagnostico(i, e.target.value)} rows={3} />
                  {diagnosticos.length > 1 && (
                    <button type="button" className="btn-remove-sesion" onClick={() => eliminarDiagnostico(i)}>×</button>
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
              onGuardar={handleOdontogramaChange}
              titulo="Estado dental actual"
            />
            <div className="sesion-necesidades">
              <h4>Necesidades Odontologicas {necesidadesAuto && <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 400 }}>(calculado del odontograma)</span>}</h4>
              <div className="necesidades-inline-grid">
                {Object.entries({ cariados: 'Cariados', curados: 'Curados', por_extraer: 'Por Extraer', endodoncia: 'Endodoncia', ortodoncia: 'Orto', protesis: 'Protesis', extraidos: 'Extraidos', destartraje: 'Destartraje' }).map(([key, label]) => (
                  <div key={key} className="necesidad-inline-item">
                    <label>{label}</label>
                    <input type="number" min="0" max="99" value={necesidades[key]} onChange={e => { setNecesidades({ ...necesidades, [key]: parseInt(e.target.value) || 0 }); setNecesidadesAuto(false); }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {paso === 5 && (
          <div className="sesion-card">
            <h3>Evidencias Clinicas</h3>
            <p className="sesion-hint">Fotos, radiografias u otros documentos de la consulta</p>
            <div
              className={`evidencias-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('evidencia-file-input').click()}
            >
              <input
                id="evidencia-file-input"
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files.length > 0) agregarEvidencias(e.target.files); e.target.value = ''; }}
              />
              <div className="evidencias-dropzone-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <p className="evidencias-dropzone-text">Arrastra imagenes aqui o haz clic para seleccionar</p>
              <p className="evidencias-dropzone-hint">Fotos, radiografias, panoramicas, intraorales</p>
            </div>
            {evidencias.length > 0 && (
              <div className="evidencias-grid">
                {evidencias.map((ev, i) => (
                  <div key={i} className="evidencia-card">
                    <div className="evidencia-preview">
                      <img src={ev.preview} alt={`Evidencia ${i + 1}`} />
                      <button type="button" className="evidencia-remove" onClick={() => eliminarEvidencia(i)}>×</button>
                    </div>
                    <div className="evidencia-fields">
                      <select value={ev.tipo} onChange={e => actualizarEvidencia(i, 'tipo', e.target.value)}>
                        <option value="foto">Foto</option>
                        <option value="radiografia">Radiografia</option>
                        <option value="panoramica">Panoramica</option>
                        <option value="intraoral">Intraoral</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Descripcion (opcional)"
                        value={ev.descripcion}
                        onChange={e => actualizarEvidencia(i, 'descripcion', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {paso === 6 && (
          <div className="sesion-card">
            <h3>Recetas Medicas <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--gray-400)' }}>(opcional)</span></h3>
            <p className="sesion-hint">Si no necesitas receta, puedes saltar este paso</p>
            {recetas.map((r, ri) => (
              <div key={ri} className="sesion-receta-card" style={{ border: '1px solid var(--gray-200)', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong>Receta {ri + 1}</strong>
                  {recetas.length > 1 && <button type="button" className="btn-remove-sesion" onClick={() => eliminarReceta(ri)}>×</button>}
                </div>

                <div className="field" style={{ marginBottom: '10px' }}>
                  <label>Plantillas rapidas</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {PLANTILLAS.map((p, pi) => (
                      <button key={pi} type="button" className="btn btn-sm btn-secondary" onClick={() => aplicarPlantilla(ri, p)}>{p.nombre}</button>
                    ))}
                  </div>
                </div>

                <div className="medicamentos-section" style={{ marginBottom: '10px' }}>
                  <label style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'block' }}>Medicamentos</label>
                  {r.medicamentos.map((med, mi) => (
                    <div key={mi} className="medicamento-row" style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                      <input type="text" placeholder="Nombre" value={med.nombre} onChange={e => actualizarMedicamentoReceta(ri, mi, 'nombre', e.target.value)} style={{ flex: 2, padding: '6px 10px', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px' }} />
                      <input type="text" placeholder="Dosis" value={med.dosis} onChange={e => actualizarMedicamentoReceta(ri, mi, 'dosis', e.target.value)} style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px' }} />
                      <input type="text" placeholder="Frecuencia" value={med.frecuencia} onChange={e => actualizarMedicamentoReceta(ri, mi, 'frecuencia', e.target.value)} style={{ flex: 1.5, padding: '6px 10px', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px' }} />
                      <input type="text" placeholder="Duracion" value={med.duracion} onChange={e => actualizarMedicamentoReceta(ri, mi, 'duracion', e.target.value)} style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px' }} />
                      {r.medicamentos.length > 1 && <button type="button" className="btn-remove-sesion" onClick={() => eliminarMedicamentoReceta(ri, mi)}>×</button>}
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => agregarMedicamentoReceta(ri)}>+ Agregar medicamento</button>
                </div>

                <div className="field" style={{ marginBottom: '10px' }}>
                  <label>Indicaciones</label>
                  <textarea className="sesion-textarea" value={r.indicaciones} onChange={e => actualizarReceta(ri, 'indicaciones', e.target.value)} placeholder="Instrucciones para el paciente..." rows={2} />
                </div>

                <div className="field">
                  <label>Imagenes adjuntas</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer' }}>
                      Adjuntar imagen
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleSubirArchivoReceta(ri, e)} />
                    </label>
                    {(r.archivos || []).map((a, ai) => (
                      <span key={ai} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--gray-100)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px' }}>
                        {a.original}
                        <button type="button" onClick={() => eliminarArchivoReceta(ri, ai)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 700 }}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-secondary btn-add-tratamiento" onClick={agregarReceta}>+ Agregar receta</button>
          </div>
        )}

        {paso === 7 && (
          <div className="sesion-card">
            <h3>Registro de Tratamientos</h3>
            <p className="sesion-hint">Define los procedimientos a realizar con sus costos</p>
            {tratamientos.map((t, i) => (
              <div key={i} className="sesion-tratamiento-row">
                <div className="sesion-tratamiento-fields">
                  <label className="sesion-tratamiento-check">
                    <input type="checkbox" checked={t.realizado} onChange={e => actualizarTratamiento(i, 'realizado', e.target.checked)} />
                    Se realizo
                  </label>
                  <input type="text" placeholder="Procedimiento (ej: Corona ceramica pieza 16)" value={t.procedimiento_realizado} onChange={e => actualizarTratamiento(i, 'procedimiento_realizado', e.target.value)} />
                  <input type="text" placeholder="Pieza dental" value={t.pieza_dental} onChange={e => actualizarTratamiento(i, 'pieza_dental', e.target.value)} className="input-diente" />
                  <input type="number" placeholder="Costo $" value={t.costo_total} onChange={e => actualizarTratamiento(i, 'costo_total', e.target.value)} min="0" step="0.01" className="input-costo" />
                  <input type="number" placeholder="A cuenta $" value={t.monto_a_cuenta} onChange={e => actualizarTratamiento(i, 'monto_a_cuenta', e.target.value)} min="0" step="0.01" className="input-costo" />
                </div>
                {tratamientos.length > 1 && (
                  <button type="button" className="btn-remove-sesion" onClick={() => eliminarTratamiento(i)}>×</button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-secondary btn-add-tratamiento" onClick={agregarTratamiento}>
              + Agregar tratamiento
            </button>
          </div>
        )}

        {paso === 8 && (
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
            {evidencias.length > 0 && (
              <div className="resumen-section">
                <h4>Evidencias ({evidencias.length})</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {evidencias.map((ev, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--gray-100)', padding: '4px 10px', borderRadius: '8px', fontSize: '13px' }}>
                      <span>{ev.tipo === 'foto' ? 'Foto' : ev.tipo === 'radiografia' ? 'Radiografia' : ev.tipo === 'panoramica' ? 'Panoramica' : 'Intraoral'}</span>
                      {ev.descripcion && <span style={{ color: 'var(--gray-500)' }}>- {ev.descripcion}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {recetas.some(r => r.medicamentos.some(m => m.nombre.trim()) || r.indicaciones.trim()) && (
              <div className="resumen-section">
                <h4>Recetas ({recetas.filter(r => r.medicamentos.some(m => m.nombre.trim()) || r.indicaciones.trim()).length})</h4>
                {recetas.filter(r => r.medicamentos.some(m => m.nombre.trim()) || r.indicaciones.trim()).map((r, i) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <strong>Receta {i + 1}:</strong>
                    {r.medicamentos.filter(m => m.nombre.trim()).map((m, mi) => (
                      <span key={mi} style={{ marginLeft: '6px', fontSize: '13px' }}>
                        {m.nombre} {m.dosis} {m.frecuencia} {m.duracion && `(${m.duracion})`}{mi < r.medicamentos.filter(mm => mm.nombre.trim()).length - 1 ? ',' : ''}
                      </span>
                    ))}
                    {r.indicaciones && <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '2px' }}>Indicaciones: {r.indicaciones.substring(0, 80)}{r.indicaciones.length > 80 ? '...' : ''}</div>}
                    {r.archivos && r.archivos.length > 0 && <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>({r.archivos.length} imagen{r.archivos.length > 1 ? 'es' : ''})</span>}
                  </div>
                ))}
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

      {toast && (
        <div className={`sesion-toast sesion-toast-${toast.tipo}`}>
          <span className="sesion-toast-icon">{toast.tipo === 'error' ? '\u26A0' : '\u2714'}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
