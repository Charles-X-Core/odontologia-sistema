import { useState, useEffect } from 'react';
import { api } from '../services/api';

const IMAGENES_MOCK = [
  { id: 1, tipo: 'radiografia', descripcion: 'Radiografia panoramica', archivo_original: 'radiografia-panoramica.jpg', created_at: '2026-01-15' },
  { id: 2, tipo: 'foto', descripcion: 'Foto clinica sonrisa', archivo_original: 'sonrisa-frontal.jpg', created_at: '2026-02-20' },
  { id: 3, tipo: 'radiografia', descripcion: 'Radiografia periapical zona anterior', archivo_original: 'periapical-anterior.jpg', created_at: '2026-03-10' },
  { id: 4, tipo: 'foto', descripcion: 'Foto intraoral dientes posteriores', archivo_original: 'intraoral-posteriores.jpg', created_at: '2026-04-05' },
];

const TIPO_COLORS = {
  radiografia: { bg: '#dbeafe', text: '#1e40af', icon: 'X-RAY' },
  foto: { bg: '#dcfce7', text: '#166534', icon: 'FOTO' },
};

export default function Galeria({ pacienteId }) {
  const [imagenes, setImagenes] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [cargando, setCargando] = useState(true);
  const [imagenAmpliada, setImagenAmpliada] = useState(null);

  useEffect(() => { cargar(); }, [pacienteId]);

  const cargar = async () => {
    try {
      const data = await api.imagenes.porPaciente(pacienteId);
      if (data.length > 0) {
        setImagenes(data);
      } else {
        setImagenes(IMAGENES_MOCK);
      }
    } catch {
      setImagenes(IMAGENES_MOCK);
    }
    setCargando(false);
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
      </div>

      {filtradas.length === 0 ? (
        <div className="galeria-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <p>No hay imagenes registradas</p>
          <span>Las imagenes de los pacientes apareceran aqui</span>
        </div>
      ) : (
        <div className="galeria-grid">
          {filtradas.map(img => {
            const tipoInfo = TIPO_COLORS[img.tipo] || TIPO_COLORS.foto;
            return (
              <div key={img.id} className="galeria-item" onClick={() => setImagenAmpliada(img)}>
                <div className="galeria-placeholder" style={{ background: tipoInfo.bg }}>
                  <span className="galeria-placeholder-icon">{tipoInfo.icon}</span>
                  <span className="galeria-placeholder-text">{img.archivo_original}</span>
                </div>
                <div className="galeria-item-info">
                  <span className="galeria-item-tipo" style={{ background: tipoInfo.bg, color: tipoInfo.text }}>{img.tipo}</span>
                  <span className="galeria-item-desc">{img.descripcion}</span>
                  <span className="galeria-item-fecha">{new Date(img.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {imagenAmpliada && (
        <div className="modal-overlay" onClick={() => setImagenAmpliada(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{imagenAmpliada.descripcion}</h3>
              <button className="btn-close" onClick={() => setImagenAmpliada(null)}>&times;</button>
            </div>
            <div className="galeria-ampliada">
              <div className="galeria-placeholder-large" style={{ background: TIPO_COLORS[imagenAmpliada.tipo]?.bg || '#f3f4f6' }}>
                <span className="galeria-placeholder-icon-large">{TIPO_COLORS[imagenAmpliada.tipo]?.icon || 'IMG'}</span>
                <span>{imagenAmpliada.archivo_original}</span>
              </div>
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
