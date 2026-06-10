import { useState, useEffect } from 'react';
import { api } from '../services/api';
import ImportarDatos from './ImportarDatos';

const ENTIDADES_EXPORT = [
  { key: 'completo', label: 'Completo (7 hojas)', desc: 'Pacientes + Consultas + Tratamientos + Pagos + Recetas + Odontogramas', color: '#3b82f6', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8V16a2 2 0 01-2 2H5a2 2 0 01-2-2V8m18 0l-9-5-9 5m18 0l-9 5-9-5"/></svg> },
  { key: 'pacientes', label: 'Pacientes', desc: 'Datos de pacientes e historias clinicas', color: '#10b981', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { key: 'consultas', label: 'Consultas', desc: 'Todas las consultas registradas', color: '#8b5cf6', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { key: 'tratamientos', label: 'Tratamientos', desc: 'Planes de tratamiento y procedimientos', color: '#f59e0b', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0110 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/><path d="M12 6v6l4 2"/></svg> },
  { key: 'pagos', label: 'Pagos', desc: 'Historial de pagos y saldos', color: '#06b6d4', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
  { key: 'recetas', label: 'Recetas', desc: 'Recetas medicas emitidas', color: '#ec4899', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> },
];

const STAT_CARDS = [
  { key: 'pacientes', label: 'Pacientes', color: '#10b981', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { key: 'consultas', label: 'Consultas', color: '#8b5cf6', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  { key: 'tratamientos', label: 'Tratamientos', color: '#f59e0b', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0110 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/></svg> },
  { key: 'pagos', label: 'Pagos', color: '#06b6d4', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
  { key: 'recetas', label: 'Recetas', color: '#ec4899', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> },
  { key: 'odontogramas', label: 'Odontogramas', color: '#ef4444', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8 2 5 5 5 9c0 3 1 5 2 7l5 6 5-6c1-2 2-4 2-7 0-4-3-7-7-7z"/></svg> },
];

export default function EstacionDatos({ onVolver }) {
  const [tab, setTab] = useState('exportar');
  const [stats, setStats] = useState(null);
  const [exportando, setExportando] = useState(null);
  const [formato, setFormato] = useState('xlsx');

  const [subTabImport, setSubTabImport] = useState('excel');
  const [importandoBD, setImportandoBD] = useState(false);
  const [resultadoBD, setResultadoBD] = useState(null);
  const [errorBD, setErrorBD] = useState('');
  const [isDraggingBD, setIsDraggingBD] = useState(false);

  useEffect(() => {
    api.exportacion.estadisticas().then(setStats).catch(() => {});
  }, []);

  const handleExportar = async (entidad) => {
    setExportando(entidad);
    try {
      const url = api.exportacion[entidad](formato);
      const link = document.createElement('a');
      link.href = url;
      link.download = `export_${entidad}.${formato === 'xlsx' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error al exportar:', err);
    } finally {
      setTimeout(() => setExportando(null), 1200);
    }
  };

  const handleBackupBD = () => {
    setExportando('backup');
    const url = api.exportacion.backupBD();
    const link = document.createElement('a');
    link.href = url;
    link.download = `clinica_backup_${new Date().toISOString().slice(0, 10)}.db`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setExportando(null), 1200);
  };

  const handleImportarBD = async (file) => {
    setImportandoBD(true);
    setErrorBD('');
    setResultadoBD(null);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const result = await api.exportacion.importarBD(formData);
      setResultadoBD(result);
      api.exportacion.estadisticas().then(setStats).catch(() => {});
    } catch (err) {
      setErrorBD(err.message || 'Error al importar BD');
    } finally {
      setImportandoBD(false);
    }
  };

  const handleDropBD = (e) => {
    e.preventDefault();
    setIsDraggingBD(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.db') || file.name.endsWith('.sqlite') || file.name.endsWith('.sqlite3'))) {
      handleImportarBD(file);
    } else {
      setErrorBD('Solo se permiten archivos .db / .sqlite');
    }
  };

  const handleFileSelectBD = (e) => {
    const file = e.target.files[0];
    if (file) handleImportarBD(file);
  };

  const totalRegistros = stats ? Object.values(stats).reduce((s, v) => s + (v || 0), 0) : 0;

  return (
    <div className="estacion-datos">
      <div className="page-header">
        <div>
          <h1>Estacion de Datos</h1>
          <p className="page-subtitle">Importar y exportar informacion del sistema</p>
        </div>
        <button className="btn btn-secondary" onClick={onVolver}>Volver</button>
      </div>

      <div className="estacion-tabs-container">
        <button className={`estacion-tab-btn ${tab === 'exportar' ? 'active' : ''}`} onClick={() => setTab('exportar')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar
        </button>
        <button className={`estacion-tab-btn ${tab === 'importar' ? 'active' : ''}`} onClick={() => setTab('importar')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Importar
        </button>
      </div>

      {tab === 'exportar' && (
        <div className="estacion-tab-content">
          <div className="estadisticas-grid">
            {STAT_CARDS.map(sc => (
              <div key={sc.key} className="ed-stat-card" style={{ borderLeftColor: sc.color }}>
                <div className="ed-stat-icon" style={{ color: sc.color, background: sc.color + '15' }}>{sc.icon}</div>
                <div className="ed-stat-body">
                  <span className="ed-stat-num" style={{ color: sc.color }}>{stats?.[sc.key] || 0}</span>
                  <span className="ed-stat-label">{sc.label}</span>
                </div>
              </div>
            ))}
          </div>

          {stats && (
            <div className="ed-total-bar">
              <span className="ed-total-label">Total registros en base de datos</span>
              <span className="ed-total-num">{totalRegistros.toLocaleString()}</span>
            </div>
          )}

          <div className="export-section-profesional">
            <div className="ed-section-header">
              <div className="ed-section-icon" style={{ color: '#10b981', background: '#10b98115' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8V16a2 2 0 01-2 2H5a2 2 0 01-2-2V8m18 0l-9-5-9 5m18 0l-9 5-9-5"/></svg>
              </div>
              <div>
                <h3>Backup de Base de Datos</h3>
                <p className="export-section-desc">Descarga completa de la base de datos SQLite. Puede usarse para restaurar el sistema o importar en otra instancia.</p>
              </div>
            </div>
            <div className="export-card profesional" onClick={handleBackupBD}>
              <div className="ed-card-icon" style={{ color: '#10b981', background: '#10b98115' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              </div>
              <div className="export-info">
                <div className="export-label">Backup BD Completa (.db)</div>
                <div className="export-desc">Archivo SQLite con todos los datos del sistema</div>
              </div>
              {exportando === 'backup' ? (
                <div className="ed-export-progress">
                  <div className="ed-progress-bar"><div className="ed-progress-fill" style={{ width: '100%' }}></div></div>
                  <span className="ed-progress-text">Descargando...</span>
                </div>
              ) : (
                <button className="btn btn-primary btn-sm">Descargar</button>
              )}
            </div>
          </div>

          <div className="export-section-excel">
            <div className="ed-section-header">
              <div className="ed-section-icon" style={{ color: '#8b5cf6', background: '#8b5cf615' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
              </div>
              <div>
                <h3>Exportar a Excel / CSV</h3>
                <div className="formato-toggle">
                  <span>Formato:</span>
                  <button className={`btn btn-sm ${formato === 'xlsx' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFormato('xlsx')}>Excel (.xlsx)</button>
                  <button className={`btn btn-sm ${formato === 'csv' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFormato('csv')}>CSV (.csv)</button>
                </div>
              </div>
            </div>
            <div className="export-grid">
              {ENTIDADES_EXPORT.map(ent => (
                <div key={ent.key} className="export-card" onClick={() => handleExportar(ent.key)}>
                  <div className="ed-card-icon" style={{ color: ent.color, background: ent.color + '15' }}>{ent.icon}</div>
                  <div className="export-info">
                    <div className="export-label">{ent.label}</div>
                    {ent.desc && <div className="export-desc">{ent.desc}</div>}
                  </div>
                  {exportando === ent.key ? (
                    <div className="ed-export-progress">
                      <div className="ed-progress-bar"><div className="ed-progress-fill" style={{ width: '100%', background: ent.color }}></div></div>
                      <span className="ed-progress-text">Descargando...</span>
                    </div>
                  ) : (
                    <button className="btn btn-primary btn-sm" disabled={!!exportando}>Descargar</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'importar' && (
        <div className="estacion-tab-content">
          <div className="sub-tabs-container">
            <button className={`sub-tab-btn ${subTabImport === 'bd' ? 'active' : ''}`} onClick={() => setSubTabImport('bd')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              Importar BD Anterior
            </button>
            <button className={`sub-tab-btn ${subTabImport === 'excel' ? 'active' : ''}`} onClick={() => setSubTabImport('excel')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              Importar Excel
            </button>
          </div>

          {subTabImport === 'bd' && (
            <div className="sub-tab-content">
              <p className="import-bd-desc">Importa una base de datos de una version anterior del sistema. Los datos se fusionan sin sobrescribir existentes.</p>

              <div
                className={`drop-zone-bd ${isDraggingBD ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingBD(true); }}
                onDragLeave={() => setIsDraggingBD(false)}
                onDrop={handleDropBD}
              >
                {importandoBD ? (
                  <div className="importando-bd">
                    <div className="spinner"></div>
                    <p>Importando base de datos...</p>
                    <div className="ed-progress-bar" style={{ width: '200px', marginTop: '12px' }}><div className="ed-progress-fill loading"></div></div>
                  </div>
                ) : (
                  <>
                    <div className="ed-drop-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                    </div>
                    <p>Arrastra un archivo <strong>.db</strong> aqui</p>
                    <p className="drop-subtitle">o haz clic para seleccionar</p>
                    <input type="file" accept=".db,.sqlite,.sqlite3" onChange={handleFileSelectBD} className="file-input-hidden" />
                  </>
                )}
              </div>

              {errorBD && <div className="error-bd">{errorBD}</div>}

              {resultadoBD && (
                <div className="resultado-bd">
                  <div className="ed-result-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <h4>Importacion completada</h4>
                  </div>
                  <div className="result-cards">
                    {Object.entries(resultadoBD.resultados).map(([tabla, r]) => (
                      <div key={tabla} className="result-card">
                        <span className="result-num">{r.nuevos}</span>
                        <span className="result-label">{tabla} nuevos</span>
                        {r.duplicados > 0 && <span className="result-dup">({r.duplicados} existentes)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {subTabImport === 'excel' && (
            <div className="sub-tab-content">
              <ImportarDatos onVolver={() => setTab('exportar')} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
