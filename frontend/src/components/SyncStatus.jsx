import { useState, useEffect } from 'react';
import { syncService } from '../services/syncService';

export default function SyncStatus() {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    loadStatus();
    const unsubscribe = syncService.onStatusChange(({ syncing: s, lastResult: r, error }) => {
      setSyncing(s);
      if (r) setLastResult(r);
      if (r) loadStatus();
    });
    return unsubscribe;
  }, []);

  const loadStatus = async () => {
    const s = await syncService.getStatus();
    setStatus(s);
  };

  const handleSync = async () => {
    const result = await syncService.fullSync();
    setLastResult(result);
  };

  if (!status) return null;

  return (
    <div className="sync-status-container">
      <div className="sync-status-bar">
        <div className="sync-status-info">
          <div className={`sync-dot ${status.isTurso ? 'connected' : 'disconnected'}`} />
          <span className="sync-label">
            {status.isTurso ? 'Turso conectado' : 'Solo local'}
          </span>
          {status.lastSync && (
            <span className="sync-last">
              Ultima sync: {new Date(status.lastSync).toLocaleString('es-PE')}
            </span>
          )}
        </div>
        <div className="sync-actions">
          {status.pendingChanges > 0 && (
            <span className="sync-pending">{status.pendingChanges} pendientes</span>
          )}
          <button
            className="btn btn-sm btn-primary"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        </div>
      </div>

      {lastResult && (
        <div className={`sync-result ${lastResult.success ? 'success' : 'error'}`}>
          {lastResult.success ? (
            <>
              Sync completada en {lastResult.duration}ms
              {lastResult.push?.pushed && Object.entries(lastResult.push.pushed).map(([table, count]) => (
                count > 0 && <span key={table} className="sync-stat">↑{count} {table}</span>
              ))}
              {lastResult.pull?.pulled && Object.entries(lastResult.pull.pulled).map(([table, count]) => (
                count > 0 && <span key={table} className="sync-stat">↓{count} {table}</span>
              ))}
            </>
          ) : (
            <span>Error: {lastResult.error || 'Sync fallida'}</span>
          )}
        </div>
      )}
    </div>
  );
}
