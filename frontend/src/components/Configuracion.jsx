import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const isElectron = window.electronAPI?.isElectron;

const STATUS_LABELS = {
  starting: 'Iniciando...',
  qr: 'Esperando escaneo QR',
  authenticated: 'Autenticado (cargando)',
  ready: 'Conectado',
  auth_failure: 'Error de autenticacion',
  disconnected: 'Desconectado',
};

const STATUS_COLORS = {
  starting: '#f59e0b',
  qr: '#3b82f6',
  authenticated: '#8b5cf6',
  ready: '#10b981',
  auth_failure: '#ef4444',
  disconnected: '#6b7280',
};

export default function Configuracion({ onVolver }) {
  const { usuario, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('perfil');
  const [devMode, setDevMode] = useState(false);
  const [devClicks, setDevClicks] = useState(0);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [resetError, setResetError] = useState('');

  const handleTitleClick = () => {
    const next = devClicks + 1;
    setDevClicks(next);
    if (next >= 5) {
      setDevMode(true);
      setDevClicks(0);
    }
  };

  const handleDevReset = async () => {
    if (resetConfirm !== 'BORRAR TODO') return;
    setResetting(true); setResetError(''); setResetMsg('');
    try {
      const res = await api.importacion.devReset('BORRAR TODO');
      if (res.error) { setResetError(res.error); }
      else { setResetMsg('Base de datos reiniciada. Reiniciando app...'); setTimeout(() => window.location.reload(), 2000); }
    } catch (err) { setResetError('Error: ' + err.message); }
    setResetting(false);
  };

  return (
    <div className="configuracion-container">
      <div className="page-header">
        <div>
          <button className="btn-back" onClick={onVolver}>&larr; Volver</button>
          <h2 onClick={handleTitleClick} style={{ cursor: devMode ? 'default' : 'default', userSelect: 'none' }}>Configuracion</h2>
          <p>Gestionar perfil, password y WhatsApp</p>
        </div>
      </div>

      <div className="configuracion-tabs">
        <button className={`tab-btn ${activeTab === 'perfil' ? 'active' : ''}`} onClick={() => setActiveTab('perfil')}>Mi Perfil</button>
        <button className={`tab-btn ${activeTab === 'password' ? 'active' : ''}`} onClick={() => setActiveTab('password')}>Cambiar Password</button>
        <button className={`tab-btn ${activeTab === 'whatsapp' ? 'active' : ''}`} onClick={() => setActiveTab('whatsapp')}>WhatsApp</button>
        {devMode && <button className={`tab-btn tab-dev ${activeTab === 'dev' ? 'active' : ''}`} onClick={() => setActiveTab('dev')}>Dev</button>}
      </div>

      {activeTab === 'perfil' && <PerfilTab usuario={usuario} />}
      {activeTab === 'password' && <PasswordTab />}
      {activeTab === 'whatsapp' && <WhatsAppTab />}
      {activeTab === 'dev' && devMode && (
        <div className="dev-panel">
          <div className="dev-panel-header">
            <h3>Zona de Desarrollador</h3>
            <span className="dev-badge">MODO DESARROLLADOR</span>
          </div>
          <div className="dev-section">
            <h4>Reiniciar Base de Datos</h4>
            <p>Esto eliminara TODOS los datos (pacientes, consultas, tratamientos, pagos, etc.) y dejara la base de datos vacia con solo los usuarios por defecto.</p>
            <button className="btn btn-danger" onClick={() => { setShowResetModal(true); setResetConfirm(''); setResetMsg(''); setResetError(''); }}>
              Borrar Todos los Datos
            </button>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="modal-overlay" onClick={() => !resetting && setShowResetModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Confirmar Borrado Total</h3>
            <p>Esta accion es <strong>IRREVERSIBLE</strong>. Se eliminaran:</p>
            <ul className="reset-list">
              <li>Todos los pacientes</li>
              <li>Todas las historias clinicas</li>
              <li>Todas las consultas</li>
              <li>Todos los tratamientos</li>
              <li>Todos los pagos</li>
              <li>Todas las recetas e imagenes</li>
              <li>Todo el historial de WhatsApp</li>
              <li>Todo el historial de importaciones</li>
            </ul>
            <p>Escribe <strong>BORRAR TODO</strong> para confirmar:</p>
            <input
              type="text"
              value={resetConfirm}
              onChange={e => setResetConfirm(e.target.value)}
              placeholder="Escribe BORRAR TODO"
              className="reset-input"
              disabled={resetting}
              autoFocus
            />
            {resetError && <div className="alert alert-error">{resetError}</div>}
            {resetMsg && <div className="alert alert-success">{resetMsg}</div>}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowResetModal(false)} disabled={resetting}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDevReset} disabled={resetting || resetConfirm !== 'BORRAR TODO'}>
                {resetting ? 'Borrando...' : 'Borrar Todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// TAB: MI PERFIL
// ============================================
function PerfilTab({ usuario }) {
  const [perfil, setPerfil] = useState({ nombre: usuario?.nombre || '', email: usuario?.email || '', titulo: usuario?.titulo || 'C.D Odontologia' });
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardarPerfil = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(''); setMensaje('');
    const res = await api.auth.actualizarPerfil(perfil);
    if (res.error) { setError(res.error); setGuardando(false); return; }
    localStorage.setItem('usuario', JSON.stringify(res.usuario));
    setMensaje('Perfil actualizado correctamente');
    setGuardando(false);
  };

  return (
    <div className="card">
      {mensaje && <div className="alert alert-success">{mensaje}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={guardarPerfil} className="form">
        <div className="form-grid">
          <div className="field">
            <label>Nombre *</label>
            <input type="text" value={perfil.nombre} onChange={e => setPerfil({ ...perfil, nombre: e.target.value })} required />
          </div>
          <div className="field">
            <label>Email *</label>
            <input type="email" value={perfil.email} onChange={e => setPerfil({ ...perfil, email: e.target.value })} required />
          </div>
        </div>
        <div className="field">
          <label>Titulo Profesional</label>
          <input type="text" value={perfil.titulo} onChange={e => setPerfil({ ...perfil, titulo: e.target.value })} placeholder="Ej: C.D Odontologia" />
        </div>
        <div className="field">
          <label>Rol</label>
          <input type="text" value={usuario?.rol === 'admin' ? 'Administrador' : 'Odontologo'} readOnly className="field-readonly" />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar Perfil'}</button>
        </div>
      </form>
    </div>
  );
}

// ============================================
// TAB: CAMBIAR PASSWORD
// ============================================
function PasswordTab() {
  const [password, setPassword] = useState({ actual: '', nuevo: '', confirmar: '' });
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiarPassword = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(''); setMensaje('');
    if (password.nuevo !== password.confirmar) { setError('Los passwords no coinciden'); setGuardando(false); return; }
    if (password.nuevo.length < 4) { setError('El password debe tener al menos 4 caracteres'); setGuardando(false); return; }
    const res = await api.auth.cambiarPassword({ password_actual: password.actual, password_nuevo: password.nuevo });
    if (res.error) { setError(res.error); setGuardando(false); return; }
    setMensaje('Password actualizado correctamente');
    setPassword({ actual: '', nuevo: '', confirmar: '' });
    setGuardando(false);
  };

  return (
    <div className="card">
      {mensaje && <div className="alert alert-success">{mensaje}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={cambiarPassword} className="form">
        <div className="form-grid">
          <div className="field">
            <label>Password Actual *</label>
            <input type="password" value={password.actual} onChange={e => setPassword({ ...password, actual: e.target.value })} required />
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Password Nuevo *</label>
            <input type="password" value={password.nuevo} onChange={e => setPassword({ ...password, nuevo: e.target.value })} required minLength={4} />
          </div>
          <div className="field">
            <label>Confirmar Password *</label>
            <input type="password" value={password.confirmar} onChange={e => setPassword({ ...password, confirmar: e.target.value })} required minLength={4} />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Cambiando...' : 'Cambiar Password'}</button>
        </div>
      </form>
    </div>
  );
}

// ============================================
// TAB: WHATSAPP
// ============================================
function WhatsAppTab() {
  const [estado, setEstado] = useState(null);
  const [config, setConfig] = useState(null);
  const [qr, setQr] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [reiniciando, setReiniciando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    cargarTodo();
    pollingRef.current = setInterval(() => {
      api.whatsapp.estado().then(s => {
        setEstado(s);
        if (s?.connected && mensaje.includes('reiniciando')) {
          setMensaje('');
        }
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(pollingRef.current);
  }, [mensaje]);

  const cargarTodo = async () => {
    setCargando(true);
    try {
      const [estadoRes, configRes, statsRes] = await Promise.allSettled([
        api.whatsapp.estado(),
        api.whatsapp.getConfig(),
        api.whatsapp.analytics({}),
      ]);
      if (estadoRes.status === 'fulfilled') setEstado(estadoRes.value);
      if (configRes.status === 'fulfilled') setConfig(configRes.value);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
    } catch {}
    setCargando(false);
  };

  const cargarQR = async () => {
    try {
      const data = await window.electronAPI?.getQR();
      if (data?.qr) setQr(data.qr);
    } catch {}
  };

  const reconectar = async () => {
    setReiniciando(true); setError(''); setMensaje('');
    try {
      await api.whatsapp.restart();
      setMensaje('WhatsApp reiniciando... espera unos segundos');
      setTimeout(() => { api.whatsapp.estado().then(setEstado); }, 5000);
      setTimeout(() => { setMensaje(''); }, 15000);
    } catch (err) { setError('Error: ' + err.message); }
    setReiniciando(false);
  };

  const cerrarSesion = async () => {
    if (!confirm('Cerrar sesion de WhatsApp? Necesitare escanear el QR nuevamente.')) return;
    setCerrando(true); setError(''); setMensaje('');
    try {
      await api.whatsapp.logout();
      setMensaje('Sesion cerrada correctamente');
      setEstado({ connected: false, enviadosHoy: 0 });
    } catch (err) { setError('Error: ' + err.message); }
    setCerrando(false);
  };

  const guardarConfig = async () => {
    setGuardando(true); setError(''); setMensaje('');
    try {
      const data = {};
      for (const [k, v] of Object.entries(config)) data[k] = v.valor;
      await api.whatsapp.saveConfig(data);
      setMensaje('Configuracion guardada correctamente');
    } catch (err) { setError('Error: ' + err.message); }
    setGuardando(false);
  };

  const updateConfig = (clave, valor) => {
    setConfig(prev => ({ ...prev, [clave]: { ...prev[clave], valor } }));
  };

  if (cargando) return <div className="loading">Cargando configuracion de WhatsApp...</div>;

  const connected = estado?.connected || false;
  const statusLabel = STATUS_LABELS[estado?.info?.status || (connected ? 'ready' : 'disconnected')] || 'Desconocido';
  const statusColor = STATUS_COLORS[estado?.info?.status || (connected ? 'ready' : 'disconnected')] || '#6b7280';

  return (
    <div className="wa-config">
      {mensaje && <div className="alert alert-success">{mensaje}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* SECCION 1: ESTADO DE CONEXION */}
      <div className="wa-config-section">
        <h3>Estado de Conexion</h3>
        <div className="wa-status-card">
          <div className="wa-status-main">
            <div className="wa-status-indicator" style={{ backgroundColor: statusColor }}></div>
            <div className="wa-status-info">
              <span className="wa-status-label">{statusLabel}</span>
              {estado?.enviadosHoy > 0 && (
                <span className="wa-status-detail">Enviados hoy: {estado.enviadosHoy}</span>
              )}
            </div>
            <div className="wa-status-actions">
              <button className="btn btn-secondary btn-sm" onClick={reconectar} disabled={reiniciando || cerrando}>
                {reiniciando ? <><span className="spinner-sm"></span> Reconectando...</> : 'Reconectar'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={cerrarSesion} disabled={cerrando || reiniciando}>
                {cerrando ? <><span className="spinner-sm"></span> Cerrando...</> : 'Cerrar Sesion'}
              </button>
            </div>
          </div>

          {!connected && isElectron && (
            <div className="wa-qr-section">
              {qr ? (
                <div className="qr-container">
                  <img src={qr} alt="QR WhatsApp" style={{ maxWidth: '200px' }} />
                </div>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={cargarQR}>Mostrar QR</button>
              )}
            </div>
          )}

          {stats && (
            <div className="wa-stats-row">
              <div className="wa-stat">
                <span className="wa-stat-value">{stats.metricas?.enviados || 0}</span>
                <span className="wa-stat-label">Enviados</span>
              </div>
              <div className="wa-stat">
                <span className="wa-stat-value">{stats.metricas?.tasa_exito || '0%'}</span>
                <span className="wa-stat-label">Exito</span>
              </div>
              <div className="wa-stat">
                <span className="wa-stat-value">{stats.metricas?.pacientes_contactados || 0}</span>
                <span className="wa-stat-label">Pacientes</span>
              </div>
              <div className="wa-stat">
                <span className="wa-stat-value">{stats.metricas?.programados_pendientes || 0}</span>
                <span className="wa-stat-label">Programados</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECCION 2: CONFIGURACION DE ENVIOS */}
      {config && (
        <div className="wa-config-section">
          <h3>Configuracion de Envios</h3>
          <div className="card">
            <div className="form-grid-3">
              <div className="field">
                <label>Delay entre mensajes (ms)</label>
                <input type="number" value={config.delay_envios?.valor || '2000'} onChange={e => updateConfig('delay_envios', e.target.value)} min="500" max="10000" step="100" />
                <span className="field-hint">Tiempo de espera entre cada envio (minimo 500ms)</span>
              </div>
              <div className="field">
                <label>Max mensajes por dia</label>
                <input type="number" value={config.max_mensajes_dia?.valor || '100'} onChange={e => updateConfig('max_mensajes_dia', e.target.value)} min="1" max="1000" />
                <span className="field-hint">Limite diario de mensajes</span>
              </div>
              <div className="field">
                <label>Intervalo scheduler (seg)</label>
                <input type="number" value={config.scheduler_interval?.valor || '60'} onChange={e => updateConfig('scheduler_interval', e.target.value)} min="10" max="600" />
                <span className="field-hint">Frecuencia de verificacion de cola</span>
              </div>
              <div className="field">
                <label>Reintentos maximos</label>
                <input type="number" value={config.max_reintentos?.valor || '3'} onChange={e => updateConfig('max_reintentos', e.target.value)} min="1" max="10" />
                <span className="field-hint">Veces que reintenta un mensaje fallido</span>
              </div>
              <div className="field">
                <label>Codigo de pais</label>
                <input type="text" value={config.codigo_pais?.valor || '51'} onChange={e => updateConfig('codigo_pais', e.target.value)} maxLength="4" />
                <span className="field-hint">51 = Peru</span>
              </div>
            </div>

            <h4 style={{ marginTop: '20px', marginBottom: '12px' }}>Horario de Envios</h4>
            <div className="form-grid-3">
              <div className="field">
                <label>Hora inicio</label>
                <input type="time" value={config.hora_inicio_envios?.valor || '08:00'} onChange={e => updateConfig('hora_inicio_envios', e.target.value)} />
              </div>
              <div className="field">
                <label>Hora fin</label>
                <input type="time" value={config.hora_fin_envios?.valor || '20:00'} onChange={e => updateConfig('hora_fin_envios', e.target.value)} />
              </div>
              <div className="field">
                <label>Dias permitidos</label>
                <div className="wa-checkbox-row">
                  <label className="wa-checkbox">
                    <input type="checkbox" checked={config.enviar_sabados?.valor === 'true'} onChange={e => updateConfig('enviar_sabados', e.target.checked ? 'true' : 'false')} />
                    Sabados
                  </label>
                  <label className="wa-checkbox">
                    <input type="checkbox" checked={config.enviar_domingos?.valor === 'true'} onChange={e => updateConfig('enviar_domingos', e.target.checked ? 'true' : 'false')} />
                    Domingos
                  </label>
                </div>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={guardarConfig} disabled={guardando}>
                {guardando ? <><span className="spinner-sm"></span> Guardando...</> : 'Guardar Configuracion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
