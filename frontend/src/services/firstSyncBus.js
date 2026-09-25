/**
 * firstSyncBus — coordinación local mínima entre SyncStatus y
 * FirstSyncOnboarding (Proyecto 3.3).
 *
 * Solo distribuye eventos puntuales en memoria:
 * - { type: 'reopen-request' } — SyncStatus pide reabrir el asistente
 *   descartado con "Ahora no". No ejecuta sync ni cambia estados.
 * - { type: 'assistant-open', open: boolean } — el asistente avisa si está
 *   visible, para que SyncStatus no duplique el CTA mientras está abierto.
 *
 * Garantías: sin polling, sin setInterval, sin backend, sin persistencia.
 * No es un motor de estado: no guarda nada, solo avisa a los suscriptores
 * vigentes. Cada suscripción devuelve su unsubscribe.
 */

const listeners = new Set();

export function onFirstSyncEvent(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function emitFirstSyncEvent(event) {
  listeners.forEach((cb) => {
    try {
      cb(event);
    } catch {
      // Un suscriptor no debe impedir avisar a los demás.
    }
  });
}

export function requestAssistantReopen() {
  emitFirstSyncEvent({ type: 'reopen-request' });
}

export function notifyAssistantOpen(open) {
  emitFirstSyncEvent({ type: 'assistant-open', open: !!open });
}
