import { useState } from 'react';
import { api } from '../services/api';

export default function BackupRestore() {
  const [activeTab, setActiveTab] = useState('import');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [cleanConfirm, setCleanConfirm] = useState('');

  // Seleccionar archivo .db
  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.name.endsWith('.db')) {
      setFile(selected);
      setPreview(null);
      setResult(null);
      setError(null);
    } else {
      setError('Solo se permiten archivos .db (SQLite)');
    }
  };

  // Preview del .db
  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('database', file);
      const response = await api.backup.previewDb(formData);
      setPreview(response);
    } catch (err) {
      setError(err.message || 'Error al leer el archivo');
    } finally {
      setLoading(false);
    }
  };

  // Importar .db
  const handleImport = async () => {
    if (!file) return;
    if (!confirm('¿Estás seguro de importar estos datos? Se agregarán a la base de datos actual.')) return;
    
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('database', file);
      const response = await api.backup.importDb(formData);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Error al importar');
    } finally {
      setLoading(false);
    }
  };

  // Exportar backup
  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.backup.export();
      const dataStr = JSON.stringify(response, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Error al exportar backup');
    } finally {
      setLoading(false);
    }
  };

  // Borrar todos los datos
  const handleClean = async () => {
    if (cleanConfirm !== 'BORRAR TODO') {
      setError('Debes escribir "BORRAR TODO" para confirmar');
      return;
    }
    if (!confirm('¿ESTÁS SEGURO? Esta acción eliminará TODOS los datos de la nube.')) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await api.backup.clean('BORRAR TODO');
      setResult(response);
      setCleanConfirm('');
    } catch (err) {
      setError(err.message || 'Error al borrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Backup y Restauración</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'import'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Importar .db
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'export'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Exportar Backup
        </button>
        <button
          onClick={() => setActiveTab('clean')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'clean'
              ? 'bg-red-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Borrar Datos
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Operación exitosa</p>
          {result.mensaje && <p>{result.mensaje}</p>}
          {result.summary && (
            <div className="mt-2">
              <p>Importados: {result.summary.totalImported}</p>
              <p>Omitidos (duplicados): {result.summary.totalSkipped}</p>
              <p>Errores: {result.summary.totalErrors}</p>
            </div>
          )}
          {result.verification && (
            <div className="mt-2">
              <p className="font-bold">Verificación en Turso:</p>
              {Object.entries(result.verification).map(([table, count]) => (
                <p key={table}>  {table}: {count} registros</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Importar */}
      {activeTab === 'import' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Importar base de datos antigua</h2>
          <p className="text-gray-600 mb-4">
            Selecciona el archivo .db del sistema anterior para importar todos los datos.
          </p>

          <div className="mb-4">
            <input
              type="file"
              accept=".db"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {file && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600">
                Archivo: <span className="font-medium">{file.name}</span>
              </p>
              <p className="text-sm text-gray-600">
                Tamaño: <span className="font-medium">{(file.size / 1024).toFixed(1)} KB</span>
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handlePreview}
              disabled={!file || loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? 'Cargando...' : 'Vista previa'}
            </button>
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Importando...' : 'Importar datos'}
            </button>
          </div>

          {/* Preview */}
          {preview && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Vista previa del archivo:</h3>
              <p className="text-sm text-gray-600 mb-2">
                Archivo: {preview.filename} | Tamaño: {(preview.size / 1024).toFixed(1)} KB
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Tablas encontradas: {preview.totalTables}
              </p>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Tabla</th>
                      <th className="px-4 py-2 text-left">Columnas</th>
                      <th className="px-4 py-2 text-left">Registros</th>
                      <th className="px-4 py-2 text-left">Mapeo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.tables.map((table) => (
                      <tr key={table.name} className="border-b">
                        <td className="px-4 py-2 font-medium">{table.name}</td>
                        <td className="px-4 py-2">{table.columns}</td>
                        <td className="px-4 py-2">{table.records}</td>
                        <td className="px-4 py-2">
                          {table.hasMapping ? (
                            <span className="text-green-600">✓ {table.mappedTo}</span>
                          ) : (
                            <span className="text-gray-400">Sin mapeo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Exportar */}
      {activeTab === 'export' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Exportar backup completo</h2>
          <p className="text-gray-600 mb-4">
            Descarga un archivo JSON con todos los datos de la base de datos actual.
          </p>

          <button
            onClick={handleExport}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Exportando...' : 'Descargar backup'}
          </button>
        </div>
      )}

      {/* Tab: Borrar */}
      {activeTab === 'clean' && (
        <div className="bg-white rounded-lg shadow p-6 border-2 border-red-200">
          <h2 className="text-lg font-semibold mb-4 text-red-600">Borrar todos los datos</h2>
          <p className="text-gray-600 mb-4">
            Esta acción eliminará permanentemente TODOS los datos de la base de datos en la nube.
            Esta operación no se puede deshacer.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Escribe "BORRAR TODO" para confirmar:
            </label>
            <input
              type="text"
              value={cleanConfirm}
              onChange={(e) => setCleanConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="BORRAR TODO"
            />
          </div>

          <button
            onClick={handleClean}
            disabled={loading || cleanConfirm !== 'BORRAR TODO'}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Borrando...' : 'Borrar todos los datos'}
          </button>
        </div>
      )}
    </div>
  );
}
