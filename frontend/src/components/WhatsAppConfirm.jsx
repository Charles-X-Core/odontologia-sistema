import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const isElectron = window.electronAPI?.isElectron;

function nombreCompleto(p) {
  return `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`.trim();
}

const TIPOS_MENSAJE = [
  { id: 'receta', nombre: 'Receta Medica', icon: '💊' },
  { id: 'plan', nombre: 'Plan de Tratamiento', icon: '🦷' },
  { id: 'recordatorio_pago', nombre: 'Recordatorio de Pago', icon: '💰' },
  { id: 'proxima_cita', nombre: 'Proxima Cita', icon: '📅' },
  { id: 'bienvenida', nombre: 'Bienvenida', icon: '👋' },
  { id: 'seguimiento', nombre: 'Seguimiento', icon: '🩺' },
  { id: 'confirmacion_cita', nombre: 'Confirmar Cita', icon: '✅' },
  { id: 'cumpleanos', nombre: 'Cumpleanos', icon: '🎂' },
  { id: 'higiene', nombre: 'Limpieza', icon: '✨' },
  { id: 'credito', nombre: 'Saldo a Favor', icon: '💵' },
  { id: 'custom', nombre: 'Personalizado', icon: '✉️' },
];

export default function WhatsAppConfirm({ paciente, tipo, recetaId, sugerenciaData, onEnviar, onCancelar, onSetup }) {
  const [tipoSeleccion, setTipoSeleccion] = useState(tipo || 'custom');
  const [mensaje, setMensaje] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [estado, setEstado] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarProgramar, setMostrarProgramar] = useState(false);
  const [formProgramar, setFormProgramar] = useState({ fecha: '', hora: '' });
  const [programando, setProgramando] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const enviandoRef = useRef(false);

  useEffect(() => {
    api.whatsapp.estado().then(setEstado).catch(() => {});
    api.whatsapp.sugerencias(paciente.id).then(data => setSugerencias(data?.sugerencias || [])).catch(() => {});
  }, [paciente.id]);

  useEffect(() => {
    if (tipo) setTipoSeleccion(tipo);
  }, [tipo]);

  useEffect(() => {
    if (tipoSeleccion === 'custom') {
      setMensaje(customMessage);
      return;
    }
    setPreviewLoading(true);
    const previewPayload = { paciente_id: paciente.id, tipo: tipoSeleccion };
    if (sugerenciaData?.receta_id) previewPayload.receta_id = sugerenciaData.receta_id;
    api.whatsapp.preview(previewPayload).then(data => {
      if (data.mensaje) setMensaje(data.mensaje);
    }).catch(() => {}).finally(() => setPreviewLoading(false));
  }, [tipoSeleccion, paciente.id]);

  const handleEnviar = async () => {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const payload = {
        paciente_id: paciente.id,
        tipo: tipoSeleccion === 'custom' ? 'custom' : tipoSeleccion,
        mensaje_personalizado: tipoSeleccion === 'custom' ? customMessage : undefined,
      };
      if (recetaId) payload.receta_id = recetaId;
      if (sugerenciaData?.receta_id) payload.receta_id = sugerenciaData.receta_id;
      const res = tipo === 'custom'
        ? await api.whatsapp.enviar({ paciente_id: paciente.id, tipo: 'custom', mensaje })
        : await api.whatsapp.enviarSmart(payload);

      if (res.error) {
        setResultado({ exito: false, mensaje: res.error });
      } else {
        setResultado({ exito: true, mensaje: `Mensaje enviado a ${nombreCompleto(paciente)}`, logId: res.logId });
        setTimeout(() => onEnviar?.(), 2000);
      }
    } catch (err) {
      setResultado({ exito: false, mensaje: 'Error: ' + err.message });
    }
    setEnviando(false);
    enviandoRef.current = false;
  };

  const handleProgramar = async () => {
    if (!formProgramar.fecha || !formProgramar.hora || programando) return;
    setProgramando(true);
    try {
      await api.whatsapp.programar({
        paciente_id: paciente.id,
        tipo: tipoSeleccion,
        mensaje,
        programado_para: `${formProgramar.fecha}T${formProgramar.hora}:00`,
      });
      setResultado({
        exito: true,
        mensaje: `Mensaje programado para el ${formProgramar.fecha} a las ${formProgramar.hora} para ${nombreCompleto(paciente)}`,
      });
      setTimeout(() => onEnviar?.(), 2500);
    } catch (err) {
      setResultado({ exito: false, mensaje: 'Error: ' + err.message });
    }
    setProgramando(false);
  };

  const aplicarSugerencia = (s) => {
    setTipoSeleccion(s.tipo);
    setMostrarProgramar(false);
  };

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Enviar por WhatsApp</h3>
          <button className="btn-close" onClick={onCancelar}>&times;</button>
        </div>

        {resultado ? (
          <div className={`whatsapp-result ${resultado.exito ? 'exito' : 'error'}`}>
            <span className="whatsapp-result-icon">{resultado.exito ? '✔' : '✘'}</span>
            <p>{resultado.mensaje}</p>
          </div>
        ) : (
          <>
            {estado && !estado.connected && (
              <div className="alert alert-error" style={{ marginBottom: '12px' }}>
                <strong>WhatsApp no conectado.</strong><br/>
                {isElectron ? 'Haz clic en "Configurar WhatsApp" para conectar.' : 'WhatsApp solo funciona en la version de escritorio.'}
                {isElectron && (
                  <button className="btn btn-primary btn-sm" style={{ marginTop: '8px' }} onClick={() => onSetup?.()}>
                    Configurar WhatsApp
                  </button>
                )}
              </div>
            )}

            {sugerencias.length > 0 && (
              <div className="wa-sugerencias">
                <label>Sugerencias:</label>
                <div className="wa-sugerencias-grid">
                  {sugerencias.slice(0, 5).map((s, i) => (
                    <button key={i} className={`wa-sugerencia-btn prioridad-${s.prioridad}`} onClick={() => aplicarSugerencia(s)}>
                      <span className="wa-sugerencia-icon">{s.icono}</span>
                      <span className="wa-sugerencia-texto">{s.razon}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="whatsapp-preview-info">
              <div className="whatsapp-preview-paciente">
                <div className="patient-avatar-sm">{(paciente.apellido_paterno || '?').charAt(0)}</div>
                <div>
                  <strong>{nombreCompleto(paciente)}</strong>
                  <span>{paciente.telefono || 'Sin telefono'}</span>
                </div>
              </div>
            </div>

            {tipo !== 'custom' && (
              <div className="whatsapp-tipo-selector">
                <label>Tipo de mensaje:</label>
                <div className="tipo-grid">
                  {TIPOS_MENSAJE.map(t => (
                    <button
                      key={t.id}
                      className={`tipo-btn ${tipoSeleccion === t.id ? 'active' : ''}`}
                      onClick={() => setTipoSeleccion(t.id)}
                    >
                      <span>{t.icon}</span> {t.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="whatsapp-preview-mensaje">
              <label>Vista previa:</label>
              {tipoSeleccion === 'custom' ? (
                <textarea
                  value={customMessage}
                  onChange={(e) => { setCustomMessage(e.target.value); setMensaje(e.target.value); }}
                  rows={6}
                  className="sesion-textarea"
                  placeholder="Escribe tu mensaje personalizado..."
                />
              ) : (
                <div className="mensaje-preview-box">
                  {previewLoading ? <span className="spinner-sm"></span> : (mensaje || 'Selecciona un tipo de mensaje...')}
                </div>
              )}
              {tipoSeleccion === 'custom' && <span className="char-count">{customMessage.length} caracteres</span>}
            </div>

            {mostrarProgramar && (
              <div className="wa-programar-inline">
                <label>Programar para:</label>
                <div className="wa-programar-campos">
                  <input type="date" value={formProgramar.fecha} onChange={e => setFormProgramar({...formProgramar, fecha: e.target.value})} />
                  <input type="time" value={formProgramar.hora} onChange={e => setFormProgramar({...formProgramar, hora: e.target.value})} />
                  <button className="btn btn-primary btn-sm" onClick={handleProgramar} disabled={programando || !formProgramar.fecha || !formProgramar.hora}>
                    {programando ? <><span className="spinner-sm"></span> Programando...</> : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}

            {estado?.enviadosHoy > 0 && (
              <p style={{ fontSize: '0.85em', color: '#888', margin: '8px 0' }}>
                Enviados hoy: {estado.enviadosHoy}
              </p>
            )}

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={onCancelar} disabled={enviando}>Cancelar</button>
              {!mostrarProgramar && (
                <button className="btn btn-secondary" onClick={() => setMostrarProgramar(true)} disabled={enviando}>
                  Programar
                </button>
              )}
              <button
                className="btn btn-success"
                onClick={handleEnviar}
                disabled={enviando || !mensaje.trim() || (estado && !estado.connected)}
              >
                {enviando ? <><span className="spinner-sm"></span> Enviando...</> : 'Enviar Ahora'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
