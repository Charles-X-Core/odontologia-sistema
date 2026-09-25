import { useSyncView, innerResult, countRealStats, formatFechaHora, TABLE_LABELS } from './SyncStatus';

/**
 * SincronizacionTab — vista de detalle del estado de sincronización.
 *
 * No tiene lógica propia: consume `useSyncView()` de SyncStatus, que ya
 * clasifica el estado, mantiene la suscripción y expone `handleSync()`.
 * Aquí solo se presentan datos que el backend ya devolvió; si un dato no
 * existe, la fila no se muestra. Nunca se inventa información.
 *
 * Reglas respetadas:
 * - El botón de sincronizar usa `handleSync()` (nunca fetch directo).
 * - En bootstrap no se agregan botones ni flujos nuevos: se explica el estado
 *   y la acción sigue living en su lugar actual (asistente o "Descargar
 *   primera copia" del indicador).
 * - En solo-lectura (SYNC_DESKTOP_ONLY) no se ofrece sincronizar.
 */

// El escenario viene del backend con estos valores técnicos; se muestra con
// lenguaje de clínica sin alterar el dato.
const ESCENARIO_LABELS = {
  A1_empty: 'Instalación nueva (aún sin datos en esta computadora)',
  A2_with_data: 'Con datos en esta computadora pendientes de la primera copia',
};

function Fila({ label, value }) {
  // Estructura h4/p: es la que ya estiliza .info-card en App.css.
  return (
    <div className="info-card">
      <h4>{label}</h4>
      <p>{value}</p>
    </div>
  );
}

export default function SincronizacionTab() {
  const { view, status, syncing, lastResult, handleSync } = useSyncView();

  const inner = innerResult(lastResult);
  const pushed = countRealStats(inner && inner.push, 'pushed');
  const pulled = countRealStats(inner && inner.pull, 'pulled');
  const ultimaOperacionOk = !!lastResult && lastResult.success !== false && !(inner && inner.success === false);

  // Solo en estados incrementales. En bootstrap hay un flujo propio
  // (asistente / primera copia) y en solo-lectura no aplica sincronizar.
  const puedeSincronizar = view.showButton && view.buttonEnabled && !view.action && !syncing;

  return (
    <div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="sync-status-bar" style={{ border: 'none', padding: '0' }}>
          <div className="sync-status-info">
            <div className={`sync-dot ${view.dot}`} />
            <span className="sync-label">{view.title}</span>
          </div>
          {puedeSincronizar && (
            <div className="sync-actions">
              <button className="btn btn-sm btn-primary" onClick={handleSync} disabled={syncing}>
                Sincronizar ahora
              </button>
            </div>
          )}
        </div>
        {view.subtitle && (
          <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginTop: '8px' }}>{view.subtitle}</p>
        )}
      </div>

      <div className="info-cards">
        {status && status.lastSync && (
          <Fila label="Última sincronización" value={formatFechaHora(status.lastSync)} />
        )}
        {status && (
          <Fila label="Cambios pendientes de enviar" value={String(Number(status.pendingChanges) || 0)} />
        )}
        {status && (
          <Fila label="Eliminaciones pendientes de confirmar" value={String(Number(status.pendingTombstones) || 0)} />
        )}
        {status && status.scenario && (
          <Fila label="Situación" value={ESCENARIO_LABELS[status.scenario] || status.scenario} />
        )}
      </div>

      {lastResult && (
        <div className="card" style={{ marginTop: '16px' }}>
          <h3 style={{ marginBottom: '4px' }}>Última operación</h3>
          <p style={{ fontSize: '12px', color: '#888' }}>
            {ultimaOperacionOk
              ? 'La última sincronización se completó correctamente.'
              : 'La última sincronización no se completó. Tus datos siguen a salvo en esta computadora.'}
          </p>
          {pushed.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
              {pushed.map(({ table, count }) => (
                <span key={`up-${table}`} className="sync-stat">
                  ↑{count} {TABLE_LABELS[table] || table}
                </span>
              ))}
            </div>
          )}
          {pulled.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {pulled.map(({ table, count }) => (
                <span key={`down-${table}`} className="sync-stat">
                  ↓{count} {TABLE_LABELS[table] || table}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
