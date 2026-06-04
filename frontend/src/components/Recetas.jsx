import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import WhatsAppConfirm from './WhatsAppConfirm';

const PLANTILLAS = [
  {
    nombre: 'Analgesico post-operatorio',
    medicamentos: [
      { nombre: 'Ibuprofeno', dosis: '600mg', frecuencia: 'Cada 8 horas', duracion: '5 dias' },
      { nombre: 'Paracetamol', dosis: '500mg', frecuencia: 'Cada 6 horas', duracion: '3 dias' },
    ],
    indicaciones: 'Tomar solo si hay dolor. No exceder la dosis recomendada. Evitar alimentos calientes por 24 horas.',
  },
  {
    nombre: 'Antibiotico post-extraccion',
    medicamentos: [
      { nombre: 'Amoxicilina', dosis: '500mg', frecuencia: 'Cada 8 horas', duracion: '7 dias' },
      { nombre: 'Metronidazol', dosis: '250mg', frecuencia: 'Cada 8 horas', duracion: '7 dias' },
    ],
    indicaciones: 'Completar el tratamiento antibiotico aunque mejore. No consumir alcohol.',
  },
  {
    nombre: 'Tratamiento periodontal',
    medicamentos: [
      { nombre: 'Clorhexidina 0.12%', dosis: '15ml', frecuencia: 'Cada 12 horas (enjuague)', duracion: '14 dias' },
    ],
    indicaciones: 'Enjuague bucal durante 1 minuto. No ingerir agua ni alimentos por 30 minutos despues del enjuague.',
  },
  {
    nombre: 'Dolor dental agudo',
    medicamentos: [
      { nombre: 'Ibuprofeno', dosis: '400mg', frecuencia: 'Cada 6 horas', duracion: '3 dias' },
      { nombre: 'Naproxeno', dosis: '250mg', frecuencia: 'Cada 12 horas', duracion: '5 dias' },
    ],
    indicaciones: 'Tomar con alimentos. Acudir a consulta si el dolor persiste mas de 48 horas.',
  },
];

export default function Recetas({ pacienteId, paciente, consultas }) {
  const { usuario } = useAuth();
  const [recetas, setRecetas] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState('');
  const [medicamentos, setMedicamentos] = useState([{ nombre: '', dosis: '', frecuencia: '', duracion: '' }]);
  const [indicaciones, setIndicaciones] = useState('');
  const [cargando, setCargando] = useState(true);
  const [recetaDetalle, setRecetaDetalle] = useState(null);
  const [mostrarWhatsApp, setMostrarWhatsApp] = useState(false);
  const [enviandoPdf, setEnviandoPdf] = useState(false);

  useEffect(() => { cargar(); }, [pacienteId]);

  const cargar = async () => {
    const data = await api.recetas.porPaciente(pacienteId);
    setRecetas(data);
    setCargando(false);
  };

  const aplicarPlantilla = (plantilla) => {
    setMedicamentos(plantilla.medicamentos.map(m => ({ ...m })));
    setIndicaciones(plantilla.indicaciones);
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

  const imprimirReceta = () => {
    const printContent = document.querySelector('.receta-print');
    if (!printContent) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Receta Medica</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        .receta-header-print { text-align: center; margin-bottom: 20px; }
        .receta-header-print h2 { margin: 0; }
        .receta-paciente { margin: 15px 0; padding: 10px; border: 1px solid #ddd; }
        .receta-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .receta-table th, .receta-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .receta-table th { background: #f5f5f5; }
        .receta-indicaciones { margin: 15px 0; }
        .receta-firma { margin-top: 40px; text-align: center; }
        .firma-linea { width: 200px; border-top: 1px solid #333; margin: 0 auto 10px; }
      </style></head><body>
      ${printContent.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
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

            <div className="field">
              <label>Plantillas rapidas</label>
              <div className="plantillas-grid">
                {PLANTILLAS.map((p, i) => (
                  <button key={i} type="button" className="btn btn-sm btn-secondary" onClick={() => aplicarPlantilla(p)}>
                    {p.nombre}
                  </button>
                ))}
              </div>
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="btn btn-primary btn-sm" onClick={imprimirReceta}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Imprimir
                </button>
                <button className="btn-close" onClick={() => setRecetaDetalle(null)}>&times;</button>
              </div>
            </div>
            <div className="receta-print">
              <div className="receta-header-print">
                <h2>Receta Medica</h2>
                <p>{usuario?.nombre || 'Dr.'} - {usuario?.titulo || 'C.D Odontologia'}</p>
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
                <p>{usuario?.nombre || 'Dr.'}</p>
                <p>{usuario?.titulo || 'C.D Odontologia'}</p>
              </div>
              <div className="form-actions" style={{ marginTop: '12px' }}>
                <button className="btn btn-success btn-sm" onClick={() => setMostrarWhatsApp(true)}>
                  Enviar por WhatsApp
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={enviandoPdf}
                  onClick={async () => {
                    if (enviandoPdf) return;
                    setEnviandoPdf(true);
                    try {
                      const res = await api.whatsapp.enviarPdf({ paciente_id: paciente.id, tipo: 'receta', receta_id: recetaDetalle.id });
                      if (res.error) alert('Error: ' + res.error);
                      else alert('PDF enviado a ' + res.to);
                    } catch (e) { alert('Error: ' + e.message); }
                    setEnviandoPdf(false);
                  }}
                >
                  {enviandoPdf ? <><span className="spinner-sm"></span> Enviando...</> : 'Enviar PDF por WhatsApp'}
                </button>
                <a className="btn btn-secondary btn-sm" href={api.pdf.receta(recetaDetalle.id)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  Descargar PDF
                </a>
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

      {mostrarWhatsApp && recetaDetalle && (
        <WhatsAppConfirm
          paciente={paciente}
          tipo="receta"
          recetaId={recetaDetalle.id}
          onEnviar={() => { setMostrarWhatsApp(false); setRecetaDetalle(null); }}
          onCancelar={() => setMostrarWhatsApp(false)}
        />
      )}
    </div>
  );
}
