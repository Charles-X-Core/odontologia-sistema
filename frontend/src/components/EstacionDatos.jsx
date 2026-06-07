import { useState, useEffect } from 'react';
import { api } from '../services/api';
import ImportarDatos from './ImportarDatos';

const ENTIDADES_EXPORT = [
  { key: 'completo', label: 'Completo (7 hojas)', icon: '📦', desc: 'Pacientes + Consultas + Tratamientos + Pagos + Recetas + Odontogramas' },
  { key: 'pacientes', label: 'Pacientes', icon: '👤', desc: 'Datos de pacientes e historias clinicas' },
  { key: 'consultas', label: 'Consultas', icon: '📋', desc: 'Todas las consultas registradas' },
  { key: 'tratamientos', label: 'Tratamientos', icon: '🦷', desc: 'Planes de tratamiento y procedimientos' },
  { key: 'pagos', label: 'Pagos', icon: '💰', desc: 'Historial de pagos y saldos' },
  { key: 'recetas', label: 'Recetas', icon: '💊', desc: 'Recetas medicas emitidas' },
];

export default function EstacionDatos({ onVolver }) {
  const [tab, setTab] = useState('exportar');
  const [stats, setStats] = useState(null);
  const [exportando, setExportando] = useState(false);
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
    setExportando(true);
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
      setTimeout(() => setExportando(false), 1000);
    }
  };

  const handleBackupBD = () => {
    const url = api.exportacion.backupBD();
    const link = document.createElement('a');
    link.href = url;
    link.download = `clinica_backup_${new Date().toISOString().slice(0, 10)}.db`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          📤 Exportar
        </button>
        <button className={`estacion-tab-btn ${tab === 'importar' ? 'active' : ''}`} onClick={() => setTab('importar')}>
          📥 Importar
        </button>
      </div>

      {tab === 'exportar' && (
        <div className="estacion-tab-content">
          <div className="estadisticas-grid">
            <div className="stat-card"><span className="stat-num">{stats?.pacientes || 0}</span><span className="stat-label">Pacientes</span></div>
            <div className="stat-card"><span className="stat-num">{stats?.consultas || 0}</span><span className="stat-label">Consultas</span></div>
            <div className="stat-card"><span className="stat-num">{stats?.tratamientos || 0}</span><span className="stat-label">Tratamientos</span></div>
            <div className="stat-card"><span className="stat-num">{stats?.pagos || 0}</span><span className="stat-label">Pagos</span></div>
            <div className="stat-card"><span className="stat-num">{stats?.recetas || 0}</span><span className="stat-label">Recetas</span></div>
            <div className="stat-card"><span className="stat-num">{stats?.odontogramas || 0}</span><span className="stat-label">Odontogramas</span></div>
          </div>

          <div className="export-section-profesional">
            <h3>Backup de Base de Datos</h3>
            <p className="export-section-desc">Descarga completa de la base de datos SQLite. Puede usarse para restaurar el sistema o importar en otra instancia.</p>
            <div className="export-card profesional" onClick={handleBackupBD}>
              <div className="export-icon">🗃️</div>
              <div className="export-info">
                <div className="export-label">Backup BD Completa (.db)</div>
                <div className="export-desc">Archivo SQLite con todos los datos del sistema</div>
              </div>
              <button className="btn btn-primary btn-sm">Descargar Backup</button>
            </div>
          </div>

          <div className="export-section-excel">
            <h3>Exportar a Excel / CSV</h3>
            <div className="formato-toggle">
              <span>Formato:</span>
              <button className={`btn btn-sm ${formato === 'xlsx' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFormato('xlsx')}>Excel (.xlsx)</button>
              <button className={`btn btn-sm ${formato === 'csv' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFormato('csv')}>CSV (.csv)</button>
            </div>
            <div className="export-grid">
              {ENTIDADES_EXPORT.map(ent => (
                <div key={ent.key} className="export-card" onClick={() => handleExportar(ent.key)}>
                  <div className="export-icon">{ent.icon}</div>
                  <div className="export-info">
                    <div className="export-label">{ent.label}</div>
                    {ent.desc && <div className="export-desc">{ent.desc}</div>}
                  </div>
                  <button className="btn btn-primary btn-sm" disabled={exportando}>
                    {exportando ? '...' : 'Descargar'}
                  </button>
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
              🗃️ Importar BD Anterior
            </button>
            <button className={`sub-tab-btn ${subTabImport === 'excel' ? 'active' : ''}`} onClick={() => setSubTabImport('excel')}>
              📄 Importar Excel
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
                  </div>
                ) : (
                  <>
                    <div className="drop-icon">🗃️</div>
                    <p>Arrastra un archivo <strong>.db</strong> aqui</p>
                    <p className="drop-subtitle">o haz clic para seleccionar</p>
                    <input type="file" accept=".db,.sqlite,.sqlite3" onChange={handleFileSelectBD} className="file-input-hidden" />
                  </>
                )}
              </div>

              {errorBD && <div className="error-bd">{errorBD}</div>}

              {resultadoBD && (
                <div className="resultado-bd">
                  <h4>✅ Importacion completada</h4>
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
