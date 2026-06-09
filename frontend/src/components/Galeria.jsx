import { useState, useEffect } from 'react';
import { api } from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

const TIPO_COLORS = {
  radiografia: { bg: '#dbeafe', text: '#1e40af', icon: 'X-RAY' },
  foto: { bg: '#dcfce7', text: '#166534', icon: 'FOTO' },
};

export default function Galeria({ pacienteId }) {
  const [imagenes, setImagenes] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [cargando, setCargando] = useState(true);
  const [imagenAmpliada, setImagenAmpliada] = useState(null);
  const [mostrarUpload, setMostrarUpload] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [uploadForm, setUploadForm] = useState({ tipo: 'foto', descripcion: '' });
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);

  useEffect(() => { cargar(); }, [pacienteId]);

  const cargar = async () => {
    try {
      const data = await api.imagenes.porPaciente(pacienteId);
      setImagenes(data);
    } catch {
      setImagenes([]);
    }
    setCargando(false);
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

  if (cargando) return <div className="loading">Cargando galeria...</div>;

  return (
    <div className="galeria-panel">
      <div className="tratamientos-header">
        <div className="galeria-filtros">
          <button className={`filtro-btn ${filtro === 'todas' ? 'active' : ''}`} onClick={() => setFiltro('todas')}>Todas</button>
          <button className={`filtro-btn ${filtro === 'radiografia' ? 'active' : ''}`} onClick={() => setFiltro('radiografia')}>Radiografias</button>
          <button className={`filtro-btn ${filtro === 'foto' ? 'active' : ''}`} onClick={() => setFiltro('foto')}>Fotos</button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setMostrarUpload(true)}>
          + Subir Imagen
        </button>
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
          {filtradas.map(img => {
            const tipoInfo = TIPO_COLORS[img.tipo] || TIPO_COLORS.foto;
            return (
              <div key={img.id} className="galeria-item">
                <div className="galeria-placeholder" style={{ background: tipoInfo.bg }} onClick={() => setImagenAmpliada(img)}>
                  {img.archivo_nombre ? (
                    <img
                      src={`${API_BASE}/uploads/${img.archivo_nombre}`}
                      alt={img.descripcion}
                      style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px 8px 0 0' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <>
                      <span className="galeria-placeholder-icon">{tipoInfo.icon}</span>
                      <span className="galeria-placeholder-text">{img.archivo_original}</span>
                    </>
                  )}
                </div>
                <div className="galeria-item-info">
                  <span className="galeria-item-tipo" style={{ background: tipoInfo.bg, color: tipoInfo.text }}>{img.tipo}</span>
                  <span className="galeria-item-desc">{img.descripcion || img.archivo_original}</span>
                  <span className="galeria-item-fecha">{new Date(img.created_at).toLocaleDateString()}</span>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => eliminar(img.id)} style={{ margin: '4px 8px 8px' }}>Eliminar</button>
              </div>
            );
          })}
        </div>
      )}

      {imagenAmpliada && (
        <div className="modal-overlay" onClick={() => setImagenAmpliada(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{imagenAmpliada.descripcion || imagenAmpliada.archivo_original}</h3>
              <button className="btn-close" onClick={() => setImagenAmpliada(null)}>&times;</button>
            </div>
            <div className="galeria-ampliada">
              {imagenAmpliada.archivo_nombre ? (
                <img
                  src={`${API_BASE}/uploads/${imagenAmpliada.archivo_nombre}`}
                  alt={imagenAmpliada.descripcion}
                  style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px' }}
                />
              ) : (
                <div className="galeria-placeholder-large" style={{ background: TIPO_COLORS[imagenAmpliada.tipo]?.bg || '#f3f4f6' }}>
                  <span className="galeria-placeholder-icon-large">{TIPO_COLORS[imagenAmpliada.tipo]?.icon || 'IMG'}</span>
                  <span>{imagenAmpliada.archivo_original}</span>
                </div>
              )}
              <div className="galeria-ampliada-info">
                <p><strong>Tipo:</strong> {imagenAmpliada.tipo}</p>
                <p><strong>Fecha:</strong> {new Date(imagenAmpliada.created_at).toLocaleDateString()}</p>
                <p><strong>Descripcion:</strong> {imagenAmpliada.descripcion}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
