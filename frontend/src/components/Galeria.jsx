import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import ConfirmarPassword from './ConfirmarPassword';

const isElectron = window.location.protocol === 'file:' || window.electronAPI?.isElectron;
const API_BASE = isElectron
  ? `http://localhost:18234`
  : (import.meta.env.VITE_API_URL || window.location.origin);

function getImageUrl(filename) {
  const token = localStorage.getItem('token');
  return `${API_BASE}/api/imagenes/file/${filename}?token=${token}`;
}

const TIPO_COLORS = {
  radiografia: { bg: '#dbeafe', text: '#1e40af', label: 'Radiografia' },
  foto: { bg: '#dcfce7', text: '#166534', label: 'Foto' },
  panoramica: { bg: '#fef3c7', text: '#92400e', label: 'Panoramica' },
  intraoral: { bg: '#ede9fe', text: '#5b21b6', label: 'Intraoral' },
  documento: { bg: '#f3f4f6', text: '#374151', label: 'Documento' },
};

function ImageViewer({ imagenes, index, onClose, onNavigate }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  const img = imagenes[index];
  const imageUrl = img ? getImageUrl(img.archivo_nombre) : '';

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, [index]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNavigate(-1);
      if (e.key === 'ArrowRight') onNavigate(1);
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 5));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.25));
      if (e.key === 'r') setRotation(r => r + 90);
      if (e.key === '0') { setZoom(1); setRotation(0); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onNavigate]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(Math.max(z + delta, 0.25), 5));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setDragging(false);

  const handleDoubleClick = () => {
    if (zoom === 1) {
      setZoom(2);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = img.archivo_original || `imagen-${img.id}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!img) return null;

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <div className="image-viewer" onClick={e => e.stopPropagation()}>
        <div className="image-viewer-toolbar">
          <div className="image-viewer-toolbar-left">
            <span className="image-viewer-counter">{index + 1} / {imagenes.length}</span>
            <span className="image-viewer-filename">{img.archivo_original}</span>
          </div>
          <div className="image-viewer-toolbar-center">
            <button onClick={() => setZoom(z => Math.min(z + 0.25, 5))} title="Acercar (+)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>
            </button>
            <span className="image-viewer-zoom">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))} title="Alejar (-)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
            </button>
            <div className="image-viewer-toolbar-sep" />
            <button onClick={() => setRotation(r => r - 90)} title="Rotar izquierda (R)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
            </button>
            <button onClick={() => setRotation(r => r + 90)} title="Rotar derecha">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
            </button>
            <div className="image-viewer-toolbar-sep" />
            <button onClick={() => { setZoom(1); setRotation(0); setPan({ x: 0, y: 0 }); }} title="Reset (0)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 109-9"/><path d="M3 3v6h6"/></svg>
            </button>
            <button onClick={handleDownload} title="Descargar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </button>
          </div>
          <div className="image-viewer-toolbar-right">
            <button className="image-viewer-close" onClick={onClose} title="Cerrar (Esc)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div
          className={`image-viewer-canvas ${dragging ? 'dragging' : ''}`}
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt={img.descripcion || img.archivo_original}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transition: dragging ? 'none' : 'transform 0.2s ease',
            }}
            draggable={false}
          />
        </div>

        {imagenes.length > 1 && (
          <>
            <button className="image-viewer-nav image-viewer-nav-prev" onClick={() => onNavigate(-1)} disabled={index === 0}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button className="image-viewer-nav image-viewer-nav-next" onClick={() => onNavigate(1)} disabled={index === imagenes.length - 1}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </>
        )}

        <div className="image-viewer-sidebar">
          <div className="image-viewer-sidebar-header">
            <h4>Detalles</h4>
          </div>
          <div className="image-viewer-sidebar-content">
            <div className="image-viewer-detail">
              <span className="detail-label">Tipo</span>
              <span className="detail-value">
                <span className="detail-badge" style={{ background: TIPO_COLORS[img.tipo]?.bg, color: TIPO_COLORS[img.tipo]?.text }}>
                  {TIPO_COLORS[img.tipo]?.label || img.tipo}
                </span>
              </span>
            </div>
            <div className="image-viewer-detail">
              <span className="detail-label">Fecha</span>
              <span className="detail-value">{new Date(img.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            {img.descripcion && (
              <div className="image-viewer-detail">
                <span className="detail-label">Descripcion</span>
                <span className="detail-value">{img.descripcion}</span>
              </div>
            )}
            <div className="image-viewer-detail">
              <span className="detail-label">Archivo</span>
              <span className="detail-value detail-filename">{img.archivo_original}</span>
            </div>
          </div>
          <div className="image-viewer-sidebar-footer">
            <p className="image-viewer-shortcuts">
              <kbd>+</kbd>/<kbd>-</kbd> Zoom &nbsp;
              <kbd>R</kbd> Rotar &nbsp;
              <kbd>0</kbd> Reset &nbsp;
              <kbd>←</kbd><kbd>→</kbd> Navegar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Galeria({ pacienteId }) {
  const [imagenes, setImagenes] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [cargando, setCargando] = useState(true);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [mostrarUpload, setMostrarUpload] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [uploadForm, setUploadForm] = useState({ tipo: 'foto', descripcion: '' });
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [mostrarQR, setMostrarQR] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [generandoQR, setGenerandoQR] = useState(false);
  const [nuevasCount, setNuevasCount] = useState(0);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [accionPendiente, setAccionPendiente] = useState(null);
  const imagenesRef = useRef(imagenes);

  const requerirPassword = (accion) => {
    setAccionPendiente(() => accion);
    setMostrarPassword(true);
  };

  const passwordConfirmado = () => {
    setMostrarPassword(false);
    if (accionPendiente) accionPendiente();
    setAccionPendiente(null);
  };

  useEffect(() => { imagenesRef.current = imagenes; }, [imagenes]);

  useEffect(() => { cargar(); }, [pacienteId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!pacienteId) return;
      api.imagenes.porPaciente(pacienteId).then(data => {
        const prev = imagenesRef.current;
        if (data.length > prev.length) {
          setNuevasCount(data.length - prev.length);
        }
        setImagenes(data);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [pacienteId]);

  useEffect(() => {
    if (nuevasCount > 0) {
      const timer = setTimeout(() => setNuevasCount(0), 5000);
      return () => clearTimeout(timer);
    }
  }, [nuevasCount]);

  const cargar = async () => {
    try {
      const data = await api.imagenes.porPaciente(pacienteId);
      setImagenes(data);
    } catch {
      setImagenes([]);
    }
    setCargando(false);
  };

  const handleGenerarQR = async () => {
    setGenerandoQR(true);
    try {
      const data = await api.imagenes.generarQR(pacienteId);
      setQrData(data);
      setMostrarQR(true);
    } catch {
      alert('Error al generar QR');
    }
    setGenerandoQR(false);
  };

  const handleSubir = async (e) => {
    e.preventDefault();
    if (!archivoSeleccionado) return;
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('archivo', archivoSeleccionado);
      formData.append('paciente_id', pacienteId);
      formData.append('tipo', uploadForm.tipo);
      formData.append('descripcion', uploadForm.descripcion);
      await api.imagenes.subir(formData);
      setMostrarUpload(false);
      setArchivoSeleccionado(null);
      setUploadForm({ tipo: 'foto', descripcion: '' });
      cargar();
    } catch {}
    setSubiendo(false);
  };

  const eliminar = async (id) => {
    if (!confirm('Eliminar esta imagen?')) return;
    await api.imagenes.eliminar(id);
    cargar();
  };

  const filtradas = filtro === 'todas' ? imagenes : imagenes.filter(i => i.tipo === filtro);

  const handleNavigate = useCallback((dir) => {
    setViewerIndex(prev => {
      const next = prev + dir;
      if (next < 0 || next >= filtradas.length) return prev;
      return next;
    });
  }, [filtradas.length]);

  if (cargando) return <div className="loading">Cargando galeria...</div>;

  return (
    <div className="galeria-panel">
      <div className="tratamientos-header">
        <div className="galeria-filtros">
          <button className={`filtro-btn ${filtro === 'todas' ? 'active' : ''}`} onClick={() => setFiltro('todas')}>
            Todas ({imagenes.length})
            {nuevasCount > 0 && <span className="badge-nuevas">+{nuevasCount}</span>}
          </button>
          <button className={`filtro-btn ${filtro === 'radiografia' ? 'active' : ''}`} onClick={() => setFiltro('radiografia')}>Radiografias</button>
          <button className={`filtro-btn ${filtro === 'foto' ? 'active' : ''}`} onClick={() => setFiltro('foto')}>Fotos</button>
          <button className={`filtro-btn ${filtro === 'panoramica' ? 'active' : ''}`} onClick={() => setFiltro('panoramica')}>Panoramicas</button>
          <button className={`filtro-btn ${filtro === 'intraoral' ? 'active' : ''}`} onClick={() => setFiltro('intraoral')}>Intraorales</button>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleGenerarQR} disabled={generandoQR}>
            {generandoQR ? 'Generando...' : '📱 Subir desde Celular'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setMostrarUpload(true)}>
            + Subir Imagen
          </button>
        </div>
      </div>

      {mostrarUpload && (
        <div className="tratamiento-form-card">
          <form onSubmit={handleSubir}>
            <div className="form-grid-3">
              <div className="field">
                <label>Archivo *</label>
                <input type="file" accept="image/jpeg,jpg,png,gif,webp" onChange={e => setArchivoSeleccionado(e.target.files[0])} required />
              </div>
              <div className="field">
                <label>Tipo</label>
                <select value={uploadForm.tipo} onChange={e => setUploadForm({ ...uploadForm, tipo: e.target.value })}>
                  <option value="foto">Foto</option>
                  <option value="radiografia">Radiografia</option>
                  <option value="panoramica">Panoramica</option>
                  <option value="intraoral">Intraoral</option>
                </select>
              </div>
              <div className="field">
                <label>Descripcion</label>
                <input type="text" value={uploadForm.descripcion} onChange={e => setUploadForm({ ...uploadForm, descripcion: e.target.value })} placeholder="Descripcion de la imagen" />
              </div>
            </div>
            <div className="form-actions-inline">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMostrarUpload(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={subiendo || !archivoSeleccionado}>
                {subiendo ? 'Subiendo...' : 'Subir'}
              </button>
            </div>
          </form>
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="galeria-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <p>No hay imagenes registradas</p>
          <span>Sube imagenes clinicas del paciente</span>
        </div>
      ) : (
        <div className="galeria-grid">
          {filtradas.map((img, idx) => {
            const tipoInfo = TIPO_COLORS[img.tipo] || TIPO_COLORS.foto;
            return (
              <div key={img.id} className="galeria-item">
                <div className="galeria-thumb" onClick={() => setViewerIndex(idx)}>
                  {img.archivo_nombre ? (
                    <img
                      src={getImageUrl(img.archivo_nombre)}
                      alt={img.descripcion || img.archivo_original}
                      loading="lazy"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div className="galeria-thumb-placeholder" style={{ display: img.archivo_nombre ? 'none' : 'flex', background: tipoInfo.bg }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={tipoInfo.text} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  </div>
                  <div className="galeria-thumb-overlay">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                  </div>
                </div>
                <div className="galeria-item-info">
                  <span className="galeria-item-tipo" style={{ background: tipoInfo.bg, color: tipoInfo.text }}>{tipoInfo.label}</span>
                  <span className="galeria-item-desc">{img.descripcion || img.archivo_original}</span>
                  <span className="galeria-item-fecha">{new Date(img.created_at).toLocaleDateString()}</span>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => requerirPassword(() => eliminar(img.id))} style={{ margin: '4px 8px 8px' }}>Eliminar</button>
              </div>
            );
          })}
        </div>
      )}

      {viewerIndex !== null && filtradas.length > 0 && (
        <ImageViewer
          imagenes={filtradas}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={handleNavigate}
        />
      )}

      {mostrarQR && qrData && (
        <div className="image-viewer-overlay" onClick={() => setMostrarQR(false)}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '32px', maxWidth: '380px',
            width: '90%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            position: 'relative', top: '50%', transform: 'translateY(-50%)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '4px', fontSize: '18px', color: '#1a1a2e' }}>Subir desde celular</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
              Escanea el codigo QR con la camara de tu celular
            </p>
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#2563eb', marginBottom: '16px' }}>
              {qrData.paciente}
            </p>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', marginBottom: '16px' }}>
              <img src={qrData.qr} alt="QR Upload" style={{ width: '220px', height: '220px' }} />
            </div>
            <p style={{ fontSize: '11px', color: '#999', marginBottom: '16px' }}>
              Expira en {qrData.expira_en}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setMostrarQR(false)}>Cerrar</button>
              <button className="btn btn-primary btn-sm" onClick={() => {
                navigator.clipboard.writeText(qrData.url);
                alert('URL copiada al portapapeles');
              }}>Copiar URL</button>
            </div>
          </div>
        </div>
      )}
      {mostrarPassword && (
        <ConfirmarPassword
          titulo="Confirmar eliminacion"
          onConfirm={passwordConfirmado}
          onCancelar={() => { setMostrarPassword(false); setAccionPendiente(null); }}
        />
      )}
    </div>
  );
}
