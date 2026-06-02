import { useState } from 'react';
import { api } from '../services/api';

const ENTIDADES = [
  { key: 'completo', label: 'Importacion Completa (3 hojas)', icon: '\uD83D\uDCC4', desc: 'Historia Clinica + Antecedentes + Saldos' },
  { key: 'pacientes', label: 'Pacientes', icon: '\uD83D\uDC64' },
  { key: 'tratamientos', label: 'Tratamientos', icon: '\uD83E\uDE7A' },
  { key: 'consultas', label: 'Consultas', icon: '\uD83D\uDCCB' },
  { key: 'pagos', label: 'Pagos', icon: '\uD83D\uDCB0' },
];

const FIELDS = {
  pacientes: [
    { key: 'apellido_paterno', label: 'Apellido Paterno', required: true },
    { key: 'apellido_materno', label: 'Apellido Materno' },
    { key: 'nombres', label: 'Nombres', required: true },
    { key: 'dni', label: 'DNI', required: true },
    { key: 'telefono', label: 'Telefono' },
    { key: 'email', label: 'Email' },
    { key: 'fecha_nacimiento', label: 'Fecha Nacimiento' },
    { key: 'sexo', label: 'Sexo (M/F)' },
    { key: 'estado_civil', label: 'Estado Civil' },
    { key: 'direccion', label: 'Direccion' },
    { key: 'lugar_nacimiento', label: 'Lugar Nacimiento' },
    { key: 'lugar_procedencia', label: 'Lugar Procedencia' },
    { key: 'grado_instruccion', label: 'Grado Instruccion' },
    { key: 'ocupacion', label: 'Ocupacion' },
  ],
  tratamientos: [
    { key: 'paciente_dni', label: 'DNI Paciente', required: true },
    { key: 'fecha', label: 'Fecha', required: true },
    { key: 'procedimiento_realizado', label: 'Procedimiento', required: true },
    { key: 'pieza_dental', label: 'Pieza Dental' },
    { key: 'costo_total', label: 'Costo Total' },
    { key: 'monto_a_cuenta', label: 'Monto a Cuenta' },
  ],
  consultas: [
    { key: 'paciente_dni', label: 'DNI Paciente', required: true },
    { key: 'fecha', label: 'Fecha' },
    { key: 'motivo', label: 'Motivo', required: true },
    { key: 'diagnostico', label: 'Diagnostico' },
    { key: 'notas', label: 'Notas' },
  ],
  pagos: [
    { key: 'paciente_dni', label: 'DNI Paciente', required: true },
    { key: 'fecha', label: 'Fecha', required: true },
    { key: 'procedimiento', label: 'Procedimiento' },
    { key: 'total', label: 'Total', required: true },
    { key: 'a_cuenta', label: 'A Cuenta' },
    { key: 'metodo_pago', label: 'Metodo Pago' },
  ],
};

const SHEET_TYPE_LABELS = {
  historia_clinica: 'Historia Clinica',
  antecedentes: 'Antecedentes / Tratamientos',
  saldos: 'Saldos / Pagos',
};

const SHEET_TYPE_ICONS = {
  historia_clinica: '\uD83D\uDCCB',
  antecedentes: '\uD83E\uDE7A',
  saldos: '\uD83D\uDCB0',
};

export default function ImportarDatos({ onVolver }) {
  const [mode, setMode] = useState(null);
  const [step, setStep] = useState('entidad');
  const [entidad, setEntidad] = useState(null);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [previewCompleto, setPreviewCompleto] = useState(null);
  const [fileHash, setFileHash] = useState(null);
  const [yaImportado, setYaImportado] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);

  const seleccionarEntidad = (key) => {
    setEntidad(key);
    setMode(key === 'completo' ? 'completo' : 'individual');
    setStep('upload');
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  };

  const handleFileInput = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) processFile(selectedFile);
  };

  const processFile = async (f) => {
    setFile(f);
    setError('');
    try {
      if (mode === 'completo') {
        const formData = new FormData();
        formData.append('archivo', f);
        const data = await api.importacion.previewCompleto(formData);
        setPreviewCompleto(data.hojas);
        setFileHash(data.fileHash);
        setYaImportado(data.yaImportado);
        setHistorial(data.historialImportaciones || []);
        setEstadisticas(data.estadisticasDB);
        setStep('analysis');
      } else {
        const formData = new FormData();
        formData.append('archivo', f);
        const data = await api.importacion.preview(formData);
        setHeaders(data.headers);
        setPreviewData(data.preview);
        const autoMapping = {};
        const fields = FIELDS[entidad] || [];
        for (const header of data.headers) {
          const normalized = header.toLowerCase().trim();
          for (const field of fields) {
            if (normalized === field.key || normalized.includes(field.key.replace(/_/g, ' '))) {
              autoMapping[header] = field.key;
              break;
            }
          }
        }
        setMapping(autoMapping);
        setStep('mapping');
      }
    } catch (err) {
      setError('Error al leer archivo: ' + (err.message || err));
    }
  };

  const handleImport = async () => {
    setImportando(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      if (mode === 'individual') {
        formData.append('mapping', JSON.stringify(mapping));
        const res = await api.importacion[entidad](formData);
        setResultado(res);
      } else {
        const res = await api.importacion.completo(formData);
        setResultado(res);
      }
      setStep('result');
    } catch (err) {
      setError('Error al importar: ' + (err.message || err));
    }
    setImportando(false);
  };

  const resetAll = () => {
    setStep('entidad');
    setEntidad(null);
    setMode(null);
    setFile(null);
    setPreviewData(null);
    setPreviewCompleto(null);
    setHeaders([]);
    setMapping({});
    setResultado(null);
    setError('');
    setFileHash(null);
    setYaImportado(false);
    setHistorial([]);
    setEstadisticas(null);
  };

  return (
    <div className="importar-container">
      <div className="page-header">
        <div>
          <button className="btn-back" onClick={onVolver}>&larr; Volver</button>
          <h2>Importar Datos</h2>
          <p>Importa datos desde archivos Excel al sistema</p>
        </div>
      </div>

      {step === 'entidad' && (
        <div className="importar-entidades">
          <h3>Que tipo de datos deseas importar?</h3>
          <div className="entidad-grid">
            {ENTIDADES.map(e => (
              <div key={e.key} className={`entidad-card ${e.key === 'completo' ? 'entidad-featured' : ''}`} onClick={() => seleccionarEntidad(e.key)}>
                <span className="entidad-icon">{e.icon}</span>
                <span className="entidad-label">{e.label}</span>
                {e.desc && <span className="entidad-desc">{e.desc}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'upload' && (
        <div className="importar-upload">
          <div className={`drop-zone ${isDragging ? 'dragging' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            <div className="drop-zone-content">
              <span className="drop-icon">{'\uD83D\uDCC1'}</span>
              <p>Arrastra un archivo Excel aqui</p>
              <p className="drop-hint">o</p>
              <label className="btn btn-primary btn-sm">
                Seleccionar archivo
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} style={{ display: 'none' }} />
              </label>
              <p className="drop-formats">Formatos: .xlsx, .xls, .csv (max 10MB)</p>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={resetAll}>Volver</button>
        </div>
      )}

      {step === 'analysis' && previewCompleto && (
        <div className="importar-analysis">
          <h3>Analisis del Archivo</h3>

          {yaImportado && (
            <div className="alert alert-warning">
              <strong>Este archivo ya fue importado anteriormente.</strong>
              {historial.length > 0 && (
                <div className="historial-list">
                  {historial.slice(0, 3).map((h, i) => (
                    <div key={i} className="historial-item">
                      <span>{h.fecha_importacion}</span> - <span>{h.pacientes_creados} pacientes, {h.tratamientos_creados} tratamientos</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="analysis-section">
            <h4>Estado Actual de la Base de Datos</h4>
            {estadisticas && (
              <div className="stats-grid">
                <div className="stat-item"><span className="stat-num">{estadisticas.totalPacientes}</span><span className="stat-label">Pacientes</span></div>
                <div className="stat-item"><span className="stat-num">{estadisticas.totalConsultas}</span><span className="stat-label">Consultas</span></div>
                <div className="stat-item"><span className="stat-num">{estadisticas.totalTratamientos}</span><span className="stat-label">Tratamientos</span></div>
                <div className="stat-item"><span className="stat-num">{estadisticas.totalPagos}</span><span className="stat-label">Pagos</span></div>
                <div className="stat-item"><span className="stat-num">{estadisticas.totalHistorias}</span><span className="stat-label">Historias</span></div>
              </div>
            )}
          </div>

          <div className="analysis-section">
            <h4>Hojas Detectadas ({Object.keys(previewCompleto).length})</h4>
            <div className="sheet-tabs">
              {Object.entries(previewCompleto).map(([name, sheet]) => (
                <div key={name} className="sheet-tab">
                  <div className="sheet-tab-header">
                    <span className="sheet-icon">{SHEET_TYPE_ICONS[sheet.tipoDetectado] || '\uD83D\uDCC4'}</span>
                    <span className="sheet-name">{name}</span>
                    {sheet.tipoDetectado && <span className={`sheet-badge badge-${sheet.tipoDetectado}`}>{SHEET_TYPE_LABELS[sheet.tipoDetectado]}</span>}
                    {!sheet.tipoDetectado && <span className="sheet-badge badge-unknown">No detectado</span>}
                  </div>
                  <div className="sheet-info">
                    <span>{sheet.totalFilas} filas</span>
                    <span>{sheet.headers.length} columnas</span>
                  </div>
                  {sheet.preview.length > 0 && (
                    <div className="sheet-preview-table">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            {sheet.headers.slice(0, 6).map(h => <th key={h}>{h}</th>)}
                            {sheet.headers.length > 6 && <th>+{sheet.headers.length - 6}</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.preview.slice(0, 2).map((row, i) => (
                            <tr key={i}>
                              {sheet.headers.slice(0, 6).map(h => <td key={h}>{String(row[h] || '').substring(0, 20)}</td>)}
                              {sheet.headers.length > 6 && <td>...</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {yaImportado && (
            <div className="importar-duplicado-warning">
              <p>Si importas este archivo de nuevo, se crearan registros adicionales. Los pacientes existentes por DNI seran omitidos.</p>
            </div>
          )}

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={resetAll}>Volver</button>
            <button className="btn btn-primary" onClick={() => setStep('preview')} disabled={importando}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && previewCompleto && (
        <div className="importar-preview-completo">
          <h3>Vista Previa de las Hojas</h3>
          <p>Verifica que los datos sean correctos antes de importar</p>

          <div className="sheet-tabs">
            {Object.entries(previewCompleto).map(([name, sheet]) => (
              <div key={name} className="sheet-tab">
                <div className="sheet-tab-header">
                  <span className="sheet-icon">{SHEET_TYPE_ICONS[sheet.tipoDetectado] || '\uD83D\uDCC4'}</span>
                  <span className="sheet-name">{name}</span>
                  {sheet.tipoDetectado && <span className={`sheet-badge badge-${sheet.tipoDetectado}`}>{SHEET_TYPE_LABELS[sheet.tipoDetectado]}</span>}
                </div>
                <div className="sheet-info">
                  <span>{sheet.totalFilas} filas</span>
                  <span>{sheet.headers.length} columnas</span>
                </div>
                {sheet.preview.length > 0 && (
                  <div className="sheet-preview-table">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          {sheet.headers.slice(0, 6).map(h => <th key={h}>{h}</th>)}
                          {sheet.headers.length > 6 && <th>+{sheet.headers.length - 6}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.preview.slice(0, 3).map((row, i) => (
                          <tr key={i}>
                            {sheet.headers.slice(0, 6).map(h => <td key={h}>{String(row[h] || '').substring(0, 25)}</td>)}
                            {sheet.headers.length > 6 && <td>...</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setStep('analysis')}>Volver</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={importando}>
              {importando ? 'Importando...' : 'Importar Todos los Datos'}
            </button>
          </div>
        </div>
      )}

      {step === 'mapping' && previewData && (
        <div className="importar-mapping">
          <h3>Mapeo de Columnas</h3>
          <p>Mapea las columnas del archivo a los campos del sistema ({previewData.length} filas detectadas)</p>

          <div className="mapping-grid">
            {FIELDS[entidad]?.filter(f => f.required).map(field => (
              <div key={field.key} className="mapping-row required">
                <label>{field.label} *</label>
                <select value={mapping[field.key] || ''} onChange={(e) => setMapping({...mapping, [field.key]: e.target.value})}>
                  <option value="">-- Seleccionar columna --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
            {FIELDS[entidad]?.filter(f => !f.required).map(field => (
              <div key={field.key} className="mapping-row">
                <label>{field.label}</label>
                <select value={mapping[field.key] || ''} onChange={(e) => setMapping({...mapping, [field.key]: e.target.value})}>
                  <option value="">-- Opcional --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="importar-preview">
            <h4>Vista Previa (primeras 5 filas)</h4>
            <div className="table-responsive">
              <table className="table table-sm">
                <thead><tr>{headers.slice(0, 6).map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {previewData.slice(0, 5).map((row, i) => (
                    <tr key={i}>{headers.slice(0, 6).map(h => <td key={h}>{String(row[h] || '').substring(0, 30)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setStep('upload'); setFile(null); setPreviewData(null); }}>Volver</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={importando}>
              {importando ? 'Importando...' : `Importar ${previewData.length} registros`}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && resultado && (
        <div className="importar-result">
          <h3>Resultado de la Importacion</h3>

          {mode === 'completo' && (
            <div className="result-completo">
              <div className="result-section">
                <h4>{'\uD83D\uDC64'} Pacientes</h4>
                <div className="result-cards">
                  <div className="result-card exitoso"><span className="result-num">{resultado.pacientes?.exitosos || 0}</span><span className="result-label">Creados</span></div>
                  <div className="result-card duplicado"><span className="result-num">{resultado.pacientes?.duplicados || 0}</span><span className="result-label">Existentes</span></div>
                  <div className="result-card fallido"><span className="result-num">{resultado.pacientes?.fallidos || 0}</span><span className="result-label">Fallidos</span></div>
                </div>
                {resultado.pacientesCreadosAutomaticamente?.length > 0 && (
                  <div className="auto-created-list">
                    <h5>Pacientes creados automaticamente:</h5>
                    {resultado.pacientesCreadosAutomaticamente.map((p, i) => (
                      <div key={i} className="auto-created-item">{p.nombre} (origen: {p.origen})</div>
                    ))}
                  </div>
                )}
                {resultado.pacientes?.errores?.length > 0 && (
                  <div className="errores-list">
                    {resultado.pacientes.errores.slice(0, 5).map((e, i) => <div key={i} className="error-item"><span>Fila {e.fila}:</span> {e.error}</div>)}
                  </div>
                )}
              </div>

              <div className="result-section">
                <h4>{'\uD83D\uDCCB'} Consultas / Historia Clinica</h4>
                <div className="result-cards">
                  <div className="result-card exitoso"><span className="result-num">{resultado.consultas?.exitosos || 0}</span><span className="result-label">Creadas</span></div>
                  <div className="result-card duplicado"><span className="result-num">{resultado.consultas?.duplicados || 0}</span><span className="result-label">Existentes</span></div>
                </div>
              </div>

              <div className="result-section">
                <h4>{'\uD83D\uDCCA'} Necesidades Odontologicas</h4>
                <div className="result-cards">
                  <div className="result-card exitoso"><span className="result-num">{resultado.necesidades?.exitosos || 0}</span><span className="result-label">Registradas</span></div>
                  <div className="result-card fallido"><span className="result-num">{resultado.necesidades?.fallidos || 0}</span><span className="result-label">Fallidas</span></div>
                </div>
              </div>

              <div className="result-section">
                <h4>{'\uD83E\uDE7A'} Tratamientos</h4>
                <div className="result-cards">
                  <div className="result-card exitoso"><span className="result-num">{resultado.tratamientos?.exitosos || 0}</span><span className="result-label">Creados</span></div>
                  <div className="result-card fallido"><span className="result-num">{resultado.tratamientos?.fallidos || 0}</span><span className="result-label">Fallidos</span></div>
                </div>
                {resultado.tratamientos?.errores?.length > 0 && (
                  <div className="errores-list">
                    {resultado.tratamientos.errores.slice(0, 5).map((e, i) => <div key={i} className="error-item"><span>Fila {e.fila}:</span> {e.error}</div>)}
                  </div>
                )}
              </div>

              <div className="result-section">
                <h4>{'\uD83D\uDCB0'} Pagos</h4>
                <div className="result-cards">
                  <div className="result-card exitoso"><span className="result-num">{resultado.pagos?.exitosos || 0}</span><span className="result-label">Creados</span></div>
                  <div className="result-card fallido"><span className="result-num">{resultado.pagos?.fallidos || 0}</span><span className="result-label">Fallidos</span></div>
                </div>
                {resultado.pagos?.errores?.length > 0 && (
                  <div className="errores-list">
                    {resultado.pagos.errores.slice(0, 5).map((e, i) => <div key={i} className="error-item"><span>Fila {e.fila}:</span> {e.error}</div>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === 'individual' && (
            <div className="result-cards">
              <div className="result-card exitoso"><span className="result-num">{resultado.exitosos}</span><span className="result-label">Exitosos</span></div>
              {resultado.duplicados > 0 && <div className="result-card duplicado"><span className="result-num">{resultado.duplicados}</span><span className="result-label">Duplicados</span></div>}
              {resultado.fallidos > 0 && <div className="result-card fallido"><span className="result-num">{resultado.fallidos}</span><span className="result-label">Fallidos</span></div>}
            </div>
          )}

          {mode === 'individual' && resultado.errores?.length > 0 && (
            <div className="errores-list">
              <h4>Errores:</h4>
              {resultado.errores.slice(0, 20).map((e, i) => <div key={i} className="error-item"><span>Fila {e.fila}:</span> {e.error}</div>)}
            </div>
          )}

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={resetAll}>Importar otro archivo</button>
            <button className="btn btn-primary" onClick={onVolver}>Volver al Dashboard</button>
          </div>
        </div>
      )}
    </div>
  );
}
