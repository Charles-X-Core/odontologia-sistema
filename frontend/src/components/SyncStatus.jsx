import { useState, useEffect, useRef } from 'react';
import { syncService } from '../services/syncService';

/**
 * SyncStatus — Proyecto 3.1, estado de sincronización en UI.
 *
 * Solo lectura + `POST /full` manual. Reglas:
 * - Nunca ejecuta `push` ni crea otro flujo de primera sincronización:
 *   con `bootstrapPending` cede el protagonismo a FirstSyncOnboarding.
 * - `GET /cloud-status` solo se consulta cuando `bootstrapPending` lo requiere.
 * - No inventa cantidades: usa `status` y el último resultado real.
 * - No muestra códigos técnicos como texto principal (van a console.error).
 */

const TABLE_LABELS = {
  pacientes: 'Pacientes',
  historias_clinicas: 'Historias clínicas',
  consultas: 'Consultas',
  odontogramas: 'Odontogramas',
  tratamientos: 'Tratamientos',
  recetas: 'Recetas',
  citas: 'Citas',
  pagos: 'Pagos',
  necesidades_odontologicas: 'Necesidades odontológicas',
  imagenes: 'Imágenes',
};

function formatFechaHora(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('es-PE');
  } catch {
    return '';
  }
}

/** Nivel real del resultado: acepta envelope `{data:{...}}` y formato directo. */
function innerResult(result) {
  if (!result) return null;
  if (result.data && typeof result.data === 'object') return result.data;
  return result;
}

function resultHasCode(result, code) {
  if (!result) return false;
  const inner = innerResult(result);
  return (
    result.error === code ||
    result.code === code ||
    inner.error === code ||
    inner.code === code
  );
}

function isDesktopOnly(result) {
  return resultHasCode(result, 'SYNC_DESKTOP_ONLY');
}

function isCollision(result) {
  if (!result) return false;
  const inner = innerResult(result);
  if (!inner || typeof inner !== 'object') return false;
  if (inner.aborted === 'idCollision') return true;
  // Compat con formato anterior (push/pull en la raíz) y envelope (en data).
  for (const level of [inner, result]) {
    if (!level || typeof level !== 'object') continue;
    for (const key of ['push', 'pull']) {
      const branch = level[key];
      if (branch && Array.isArray(branch.idCollisions) && branch.idCollisions.length > 0) {
        return true;
      }
    }
  }
  return false;
}

function isFailure(result) {
  if (!result) return false;
  if (result.success === false) return true;
  const inner = innerResult(result);
  return !!inner && inner.success === false;
}

function countRealStats(branch, key) {
  const counts = (branch && branch[key]) || {};
  if (!counts || typeof counts !== 'object') return [];
  return Object.entries(counts)
    .filter(([, n]) => Number(n) > 0)
    .map(([table, n]) => ({ table, count: Number(n) }));
}

/**
 * Clasificador por prioridad aprobada 3.1:
 * Enviando > Colisión > SYNC_DESKTOP_ONLY > Error >
 * Primera copia + nube > Cambios > Al día > Solo local > Cargando.
 * Con `bootstrapPending` nunca se devuelve "Al día" por tener pendientes en 0.
 */
export function classifySyncState({ status, cloud, syncing, lastResult }) {
  if (syncing) {
    return {
      key: 'syncing',
      title: 'Sincronizando… no cierres el programa',
      subtitle: null,
      dot: 'syncing',
      showButton: true,
      buttonEnabled: false,
      buttonText: 'Sincronizando…',
    };
  }

  if (lastResult && isCollision(lastResult)) {
    return {
      key: 'collision',
      title: 'Necesitamos revisar la información',
      subtitle:
        'Encontramos información que necesita revisión. No se modificó nada: tus datos siguen intactos aquí. Pide ayuda al encargado de sistemas.',
      dot: 'error',
      showButton: false,
      buttonEnabled: false,
      buttonText: 'Sincronizar ahora',
    };
  }

  if (lastResult && isDesktopOnly(lastResult)) {
    return {
      key: 'desktop-only',
      title: 'La sincronización solo está disponible en la computadora de la clínica',
      subtitle:
        'En esta versión puedes ver la información, pero los cambios se sincronizan desde la computadora principal.',
      dot: 'disconnected',
      showButton: false,
      buttonEnabled: false,
      buttonText: 'Sincronizar ahora',
    };
  }

  if (lastResult && isFailure(lastResult)) {
    return {
      key: 'error',
      title: 'No se pudo sincronizar',
      subtitle: 'Tus datos siguen a salvo en esta computadora. Puedes intentarlo de nuevo más tarde.',
      dot: 'error',
      showButton: true,
      buttonEnabled: true,
      buttonText: 'Sincronizar ahora',
    };
  }

  if (status && status.bootstrapPending) {
    const scenario = status.scenario;
    if (!cloud || cloud.cloud === 'empty' || cloud.cloud === 'unconfigured') {
      return {
        key: 'bootstrap',
        title: 'Primera copia pendiente',
        subtitle:
          scenario === 'A1_empty'
            ? 'Esta computadora aún no tiene copia de la nube. La primera descarga la traerá. Sigue el asistente en pantalla.'
            : 'Esta computadora tiene información que aún no está en la nube. Usa el asistente de primera sincronización.',
        dot: 'pending',
        showButton: false,
        buttonEnabled: false,
        buttonText: 'Sincronizar ahora',
      };
    }
    if (cloud.cloud === 'partial') {
      return {
        key: 'bootstrap-partial',
        title: 'Primera copia pendiente',
        subtitle:
          'No pudimos confirmar que la nube esté vacía. Pide ayuda al encargado de sistemas antes de continuar.',
        dot: 'pending',
        showButton: false,
        buttonEnabled: false,
        buttonText: 'Sincronizar ahora',
      };
    }
    if (cloud.cloud === 'with-data') {
      return {
        key: 'bootstrap',
        title: 'Primera copia pendiente',
        subtitle:
          'Esta computadora aún no tiene su primera copia. Sigue el asistente en pantalla para continuar.',
        dot: 'pending',
        showButton: false,
        buttonEnabled: false,
        buttonText: 'Sincronizar ahora',
      };
    }
    // cloud === 'error' o desconocido.
    return {
      key: 'bootstrap-offline',
      title: 'Primera copia pendiente',
      subtitle:
        'Sin conexión a la nube. Puedes seguir trabajando con normalidad aquí e intentarlo más tarde.',
      dot: 'pending',
      showButton: false,
      buttonEnabled: false,
      buttonText: 'Sincronizar ahora',
    };
  }

  if (status && status.isTurso && status.lastSync) {
    const pending = Number(status.pendingChanges) || 0;
    const tombs = Number(status.pendingTombstones) || 0;
    if (pending > 0 || tombs > 0) {
      return {
        key: 'pending',
        title: 'Cambios por enviar',
        subtitle:
          pending > 0
            ? `${pending} ${pending === 1 ? 'cambio por enviar' : 'cambios por enviar'}`
            : 'Hay eliminaciones por confirmar en la nube.',
        dot: 'pending',
        showButton: true,
        buttonEnabled: true,
        buttonText: 'Sincronizar ahora',
      };
    }
    return {
      key: 'synced',
      title: 'Al día',
      subtitle: `Última copia: ${formatFechaHora(status.lastSync)}`,
      dot: 'connected',
      showButton: true,
      buttonEnabled: true,
      buttonText: 'Sincronizar ahora',
    };
  }

  if (status && !status.isTurso) {
    return {
      key: 'local',
      title: 'Solo en esta computadora',
      subtitle: 'Tus datos están guardados aquí. No hay copia en la nube.',
      dot: 'disconnected',
      showButton: false,
      buttonEnabled: false,
      buttonText: 'Sincronizar ahora',
    };
  }

  // Sin conexión a la nube fuera de bootstrap: línea secundaria, no título.
  // Se resuelve en el render a partir de `cloud`.
  if (status && status.isTurso && !status.lastSync && !status.bootstrapPending) {
    return {
      key: 'error',
      title: 'No se pudo sincronizar',
      subtitle: 'Tus datos siguen a salvo en esta computadora. Puedes intentarlo de nuevo más tarde.',
      dot: 'error',
      showButton: true,
      buttonEnabled: true,
      buttonText: 'Sincronizar ahora',
    };
  }

  return {
    key: 'loading',
    title: 'Revisando estado…',
    subtitle: null,
    dot: 'disconnected',
    showButton: false,
    buttonEnabled: false,
    buttonText: 'Sincronizar ahora',
  };
}

export default function SyncStatus() {
  const [status, setStatus] = useState(null);
  const [cloud, setCloud] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const syncingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await syncService.getStatus();
      if (cancelled) return;
      setStatus(s);
      setLoaded(true);
    })();
    const unsubscribe = syncService.onStatusChange(({ syncing: s, lastResult: r, error }) => {
      syncingRef.current = !!s;
      setSyncing(!!s);
      if (r) {
        setLastResult(r);
        if (!r.success) {
          console.error('[sync] última operación con error:', r.error || r.code || 'desconocido');
        }
        syncService.getStatus().then((fresh) => {
          if (!cancelled) setStatus(fresh);
        });
      } else if (error) {
        // syncService notifica errores de red sin lastResult: se convierten
        // a resultado fallido para mostrar el estado "No se pudo sincronizar".
        console.error('[sync] error de red:', error);
        setLastResult({ success: false, error });
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Diagnóstico de nube solo cuando el bootstrap lo requiere (sin polling propio).
  // Al salir de bootstrap se limpia para que una lectura antigua de
  // `cloud-status` (p. ej. error) no persista como aviso obsoleto.
  useEffect(() => {
    if (!status || !status.bootstrapPending) {
      setCloud((prev) => (prev === null ? prev : null));
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const c = await syncService.getCloudStatus();
      if (!cancelled) setCloud(c);
    })();
    return () => {
      cancelled = true;
    };
  }, [status && status.bootstrapPending ? 'pending' : 'done', status && status.scenario]);

  const handleSync = async () => {
    // Guarda contra doble clic / auto-sync en curso (J). No crea otro motor.
    if (syncingRef.current) return;
    const fresh = syncing;
    if (fresh) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await syncService.fullSync();
      setLastResult(result);
      if (result && !result.success) {
        console.error('[sync] sincronización manual con error:', result.error || result.code || 'desconocido');
      }
      const s = await syncService.getStatus();
      setStatus(s);
    } catch (e) {
      console.error('[sync] sincronización manual con error:', (e && e.message) || 'desconocido');
      setLastResult({ success: false, error: (e && e.message) || 'Error de conexión' });
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  };

  // Carga inicial sin parpadeos: invisible hasta el primer GET /status.
  if (!loaded || !status) return null;

  const view = classifySyncState({ status, cloud, syncing, lastResult });

  // Resumen de la última operación con datos reales (H): solo en éxito y
  // solo con conteos > 0, con etiquetas amigables en español.
  const inner = innerResult(lastResult);
  const pushedStats = inner ? countRealStats(inner.push, 'pushed') : [];
  const pulledStats = inner ? countRealStats(inner.pull, 'pulled') : [];
  const showSummary =
    !!lastResult &&
    lastResult.success !== false &&
    !(inner && inner.success === false) &&
    (pushedStats.length > 0 || pulledStats.length > 0);

  // "Sin conexión a la nube" como línea secundaria cuando ya hay primera
  // copia pero el diagnóstico de nube falló (no es título principal).
  const offlineHint =
    view.key !== 'bootstrap-offline' &&
    status.isTurso &&
    status.lastSync &&
    cloud &&
    cloud.cloud === 'error'
      ? 'Sin conexión a la nube: puedes seguir trabajando aquí.'
      : null;

  return (
    <div className="sync-status-container">
      <div className="sync-status-bar">
        <div className="sync-status-info">
          <div className={`sync-dot ${view.dot}`} />
          <span className="sync-label">{view.title}</span>
          {view.subtitle && <span className="sync-last">{view.subtitle}</span>}
          {offlineHint && <span className="sync-last">{offlineHint}</span>}
        </div>
        {view.showButton && (
          <div className="sync-actions">
            <button
              className="btn btn-sm btn-primary"
              onClick={handleSync}
              disabled={!view.buttonEnabled}
            >
              {view.buttonText}
            </button>
          </div>
        )}
      </div>

      {showSummary && (
        <div className="sync-result success">
          <span>Última copia completada.</span>
          {pushedStats.map(({ table, count }) => (
            <span key={`up-${table}`} className="sync-stat">
              ↑{count} {TABLE_LABELS[table] || table}
            </span>
          ))}
          {pulledStats.map(({ table, count }) => (
            <span key={`down-${table}`} className="sync-stat">
              ↓{count} {TABLE_LABELS[table] || table}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
