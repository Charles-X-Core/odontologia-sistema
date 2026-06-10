import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const isElectron = window.electronAPI?.isElectron;

export default function WhatsAppSetup({ onCompleto, onCancelar }) {
  const [step, setStep] = useState('checking');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState(null);
  const [estado, setEstado] = useState(null);
  const [cerrando, setCerrando] = useState(false);
  const pollingRef = useRef(null);

  useEffect(() => {
    if (!isElectron) { setStep('no-electron'); return; }
    verificarEstado();

    if (window.electronAPI?.onSetupProgress) {
      window.electronAPI.onSetupProgress((data) => {
        setProgress(data);
        if (data.phase === 'starting') setStep('installing');
      });
    }

    return () => { clearInterval(pollingRef.current); };
  }, []);

  const verificarEstado = async () => {
    setStep('checking');
    try {
      const openwa = await window.electronAPI.checkOpenWA();
      setEstado(openwa);
      if (openwa.running && openwa.connected) { setStep('ready'); return; }
      if (openwa.running && !openwa.connected) { setStep('scan-qr'); iniciarPollingQR(); return; }
      iniciarOpenWA();
    } catch (err) { setError(err.message); setStep('error'); }
  };

  const iniciarOpenWA = async () => {
    setStep('installing');
    setProgress({ phase: 'starting', message: 'Iniciando WhatsApp... (puede tardar 1-2 minutos la primera vez)' });
    try {
      const result = await window.electronAPI.setupWhatsApp();
      if (result.success) {
        setStep('scan-qr');
        iniciarPollingQR();
      } else {
        setError(result.error || 'Error al iniciar WhatsApp');
        setStep('error');
      }
    } catch (err) { setError(err.message); setStep('error'); }
  };

  const iniciarPollingQR = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const data = await window.electronAPI.getQR();
        if (data?.qr) { setQr(data.qr); setStep('scan-qr'); }
        const status = await window.electronAPI.checkOpenWA();
        setEstado(status);
        if (status.connected) { clearInterval(pollingRef.current); setStep('ready'); }
      } catch {}
    }, 3000);
  };

  const cerrarSesion = async () => {
    if (cerrando) return;
    setCerrando(true);
    try {
      await api.whatsapp.logout();
      clearInterval(pollingRef.current);
      setStep('logged-out');
      setEstado(null);
    } catch (err) {
      setError('Error al cerrar sesion: ' + err.message);
      setStep('error');
    }
    setCerrando(false);
  };

  const reiniciar = async () => {
    try {
      await api.whatsapp.restart();
      clearInterval(pollingRef.current);
      setStep('installing');
      setProgress({ phase: 'starting', message: 'Reiniciando WhatsApp...' });
      setTimeout(() => verificarEstado(), 5000);
    } catch (err) {
      setError('Error al reiniciar: ' + err.message);
      setStep('error');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3>Configuracion de WhatsApp</h3>
          <button className="btn-close" onClick={onCancelar}>&times;</button>
        </div>

        {step === 'no-electron' && (
          <div className="whatsapp-setup-step">
            <div className="setup-icon">⚠️</div>
            <p>WhatsApp solo funciona en la version de escritorio.</p>
          </div>
        )}

        {step === 'checking' && (
          <div className="whatsapp-setup-step">
            <div className="spinner"></div>
            <p>Verificando estado de WhatsApp...</p>
          </div>
        )}

        {step === 'installing' && (
          <div className="whatsapp-setup-step">
            <div className="spinner"></div>
            <h4>{progress?.message || 'Procesando...'}</h4>
            {progress?.percent !== undefined && (
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress.percent}%` }}></div></div>
            )}
            <p style={{ fontSize: '0.85em', color: '#888', marginTop: '10px' }}>WhatsApp Web se esta iniciando, esto puede tardar unos minutos.</p>
          </div>
        )}

        {step === 'scan-qr' && (
          <div className="whatsapp-setup-step">
            <h4>Escanea el QR con tu celular</h4>
            <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '12px' }}>
              WhatsApp → Menu → Dispositivos vinculados → Vincular dispositivo
            </p>
            {qr ? (
              <div className="qr-container">
                <img src={qr} alt="QR WhatsApp" style={{ maxWidth: '250px', borderRadius: '8px' }} />
              </div>
            ) : (
              <div className="qr-loading">
                <div className="spinner"></div>
                <p style={{ fontSize: '0.85em', color: '#888' }}>Generando codigo QR...</p>
              </div>
            )}
            <div className="form-actions" style={{ marginTop: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={verificarEstado}>
                Actualizar QR
              </button>
            </div>
          </div>
        )}

        {step === 'ready' && (
          <div className="whatsapp-setup-step">
            <div className="setup-icon">✅</div>
            <h4>WhatsApp Conectado!</h4>
            <p style={{ fontSize: '0.9em', color: '#666', margin: '8px 0 16px' }}>
              Tu sesion esta activa y lista para enviar mensajes.
            </p>
            <div className="form-actions" style={{ flexDirection: 'column', gap: '8px' }}>
              <button className="btn btn-primary" onClick={onCompleto} style={{ width: '100%' }}>
                Listo
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" onClick={reiniciar} style={{ flex: 1 }}>
                  Reconectar
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={cerrarSesion}
                  disabled={cerrando}
                  style={{ flex: 1 }}
                >
                  {cerrando ? <><span className="spinner-sm"></span> Cerrando...</> : 'Cerrar Sesion'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'logged-out' && (
          <div className="whatsapp-setup-step">
            <div className="setup-icon">👋</div>
            <h4>Sesion Cerrada</h4>
            <p style={{ fontSize: '0.9em', color: '#666', margin: '8px 0 16px' }}>
              La sesion de WhatsApp ha sido cerrada correctamente.
            </p>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={onCancelar}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => { setStep('checking'); verificarEstado(); }}>
                Volver a Conectar
              </button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="whatsapp-setup-step">
            <div className="setup-icon">❌</div>
            <h4>Error</h4>
            <p style={{ fontSize: '0.9em', color: '#666', margin: '8px 0' }}>{error}</p>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={onCancelar}>Cancelar</button>
              <button className="btn btn-primary" onClick={verificarEstado}>Reintentar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
