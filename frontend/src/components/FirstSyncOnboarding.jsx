import { useState, useEffect, useCallback, useRef } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { syncService } from '../services/syncService';
import { onFirstSyncEvent, notifyAssistantOpen } from '../services/firstSyncBus';

/**
 * FirstSyncOnboarding — Proyecto 2, onboarding de primera sincronización.
 *
 * Flujo en dos etapas con reglas 100% backend (aquí no se reimplementa nada):
 *  1) POST /push {admitLocalPush:true} — primera carga explícita; el backend
 *     valida pendiente/A2/permisos/colisiones. Si falla o hay colisiones,
 *     NO se sigue. Si el push ya fue aceptado, el reintento retoma SOLO el
 *     finalize (sin re-empuje por defecto).
 *  2) POST /full — cierra el bootstrap como siempre.
 * Solo se muestran resultados reales, sin porcentajes ni conteos inventados
 * y sin lenguaje técnico interno.
 *
 * Auto-sync: pausado mientras CUALQUIER fase del wizard está abierta
 * (stopAutoSync al abrir, startAutoSync solo al cerrar correctamente).
 * Solución local y reversible, sin segundo intervalo ni cambios al servicio.
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

const TABLE_ORDER = Object.keys(TABLE_LABELS);

function mergeCounts(pushAdmitBody, fullBody) {
  // Conteos reales de ambas respuestas backend: la primera carga admite el
  // push (data.pushed) y el fullSync de cierre aporta pull/push. Sin inventos.
  const admitted = (pushAdmitBody && pushAdmitBody.data) || {};
  const pulled = (fullBody && fullBody.pull && fullBody.pull.pulled) || {};
  const pushedFull = (fullBody && fullBody.push && fullBody.push.pushed) || {};
  const pushedAdmit = admitted.pushed || {};
  const out = {};
  for (const t of TABLE_ORDER) {
    out[t] =
      (Number(pulled[t]) || 0) +
      (Number(pushedFull[t]) || 0) +
      (Number(pushedAdmit[t]) || 0);
  }
  return out;
}

function findCollisionIn(body) {
  // Nota honesta: la ruta POST /push devuelve las colisiones solo como
  // error genérico (500 sin detalle), así que todo push fallido bloquea
  // por igual sin avanzar. Aquí se detectan las colisiones/aborts visibles
  // en el resultado de fullSync, que sí los incluye.
  if (!body) return false;
  if (body.aborted) return true;
  const pullCols = (body.pull && body.pull.idCollisions) || [];
  const pushCols = (body.push && body.push.idCollisions) || [];
  return pullCols.length > 0 || pushCols.length > 0;
}

function findCollision(result) {
  return findCollisionIn(result);
}

function formatFechaHora(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('es-PE');
  } catch {
    return String(value);
  }
}

export default function FirstSyncOnboarding() {
  const [phase, setPhase] = useState('loading');
  const [status, setStatus] = useState(null);
  const [running, setRunning] = useState(false);
  const [runStage, setRunStage] = useState(null); // 'push' | 'finalize'
  const [pushAccepted, setPushAccepted] = useState(false);
  const [pushBody, setPushBody] = useState(null);
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState(null);
  const [failKind, setFailKind] = useState(null); // 'push' | 'finalize' | 'blocked'
  const [lastSyncAt, setLastSyncAt] = useState(null);
  // Proyecto 3.3 — reapertura solicitada desde SyncStatus: re-ejecuta el
  // chequeo inicial existente (sin duplicar lógica). openRef evita reabrir
  // cuando el wizard ya está visible.
  const [reopenTick, setReopenTick] = useState(0);
  const openRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await syncService.getStatus();
      if (cancelled) return;
      if (!s || !s.isTurso || !s.bootstrapPending || s.scenario !== 'A2_with_data') {
        setPhase('hidden');
        return;
      }
      setStatus(s);
      const cloud = await syncService.getCloudStatus();
      if (cancelled) return;
      if (!cloud || cloud.cloud === 'error') {
        setPhase('error');
      } else if (cloud.cloud === 'empty') {
        setPhase('step1');
      } else if (cloud.cloud === 'partial') {
        setPhase('partial');
      } else {
        // unconfigured | with-data → comportamiento normal, sin onboarding.
        setPhase('hidden');
      }
    })();
    return () => { cancelled = true; };
  }, [reopenTick]);

  const open = phase === 'step1' || phase === 'step2' || phase === 'partial' ||
    phase === 'error' || phase === 'running' || phase === 'success' || phase === 'failed';

  // Pausa local y reversible del auto-sync durante TODO el wizard,
  // incluida la ejecución real y la pantalla final.
  useEffect(() => {
    openRef.current = open;
    notifyAssistantOpen(open);
    if (!open) return undefined;
    syncService.stopAutoSync();
    return () => { syncService.startAutoSync(); };
  }, [open ]);

  // Proyecto 3.3 — reapertura desde SyncStatus ("Abrir asistente").
  useEffect(() => {
    return onFirstSyncEvent((evt) => {
      if (evt && evt.type === 'reopen-request' && !openRef.current) {
        setReopenTick((t) => t + 1);
      }
    });
  }, []);

  const dismiss = useCallback(() => {
    setPhase('dismissed');
  }, []);

  const closeAfterSuccess = useCallback(async () => {
    const s = await syncService.getStatus();
    if (s && s.lastSync) setLastSyncAt(s.lastSync);
    dismiss();
  }, [dismiss]);

  /**
   * Primera sincronización en dos etapas con reglas 100% backend:
   *  1) POST /push {admitLocalPush:true} — el backend valida pendiente/A2/
   *     permisos/colisiones; si falla o hay colisiones, NO se sigue.
   *  2) POST /full — cierra el bootstrap como siempre.
   * Si el push ya fue aceptado, el reintento retoma SOLO el finalize
   * (los upserts con guards son idempotentes, pero no se re-empuja por
   * defecto para no duplicar trabajo ni confundir conteos).
   */
  const runPushStage = useCallback(async () => {
    setRunStage('push');
    const pr = await syncService.push(null, true);
    // El backend no detalla colisiones en /push (500 genérico): cualquier
    // push fallido bloquea aquí sin ejecutar fullSync ni admit-replica.
    if (!pr || pr.success !== true) {
      setRunError(pr && pr.error ? pr.error : 'No se pudo guardar la información inicial');
      setFailKind('push');
      setPhase('failed');
      return null;
    }
    setPushBody(pr);
    setPushAccepted(true);
    return pr;
  }, []);

  const runFinalizeStage = useCallback(async () => {
    setRunStage('finalize');
    const fr = await syncService.fullSync();
    if (fr && fr.success) {
      setRunResult(fr);
      const when = (fr.timestamp) ||
        ((await syncService.getStatus()) || {}).lastSync ||
        null;
      setLastSyncAt(when);
      setPhase('success');
    } else if (findCollisionIn(fr)) {
      setRunResult(fr);
      setFailKind('blocked');
      setPhase('failed');
    } else {
      setRunResult(fr || null);
      setRunError(fr && fr.error ? fr.error : 'No se pudo finalizar la configuración');
      setFailKind('finalize');
      setPhase('failed');
    }
  }, []);

  const handleBegin = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    setFailKind(null);
    setPhase('running');
    try {
      const pr = await runPushStage();
      if (!pr) return;
      await runFinalizeStage();
    } catch (e) {
      setRunError(e && e.message ? e.message : 'Error de conexión');
      setFailKind(pushAccepted ? 'finalize' : 'push');
      setPhase('failed');
    } finally {
      setRunning(false);
    }
  }, [running, pushAccepted, runPushStage, runFinalizeStage]);

  const handleRetry = useCallback(async () => {
    // Reintento seguro: si el push ya fue aceptado, se retoma SOLO el
    // finalize (no se re-empuja por defecto); si no, vuelta al paso 2.
    setRunError(null);
    setRunResult(null);
    setFailKind(null);
    if (pushAccepted) {
      if (running) return;
      setRunning(true);
      setPhase('running');
      setRunStage('finalize');
      try {
        await runFinalizeStage();
      } catch (e) {
        setRunError(e && e.message ? e.message : 'Error de conexión');
        setFailKind('finalize');
        setPhase('failed');
      } finally {
        setRunning(false);
      }
      return;
    }
    setPhase('step2');
  }, [pushAccepted, running, runFinalizeStage]);

  const tableNames = status && Array.isArray(status.tables) ? status.tables : [];
  const counts = mergeCounts(pushBody, runResult);
  const blocked = phase === 'failed' && (failKind === 'blocked' || findCollision(runResult));

  return (
    <>
      <Modal open={phase === 'step1'} onClose={dismiss} title="Prepara la nube de tu clínica" size="md">
        <p>Hemos encontrado información de tu clínica en esta computadora.</p>
        <p>La nube está vacía y lista para recibir la información inicial de esta clínica.</p>
        <ul className="first-sync-list">
          {tableNames.map((t) => (
            <li key={t}>{TABLE_LABELS[t] || t}</li>
          ))}
        </ul>
        <p>Tus datos actuales permanecerán en esta computadora. Esta primera sincronización preparará una copia inicial en la nube.</p>
        <div className="first-sync-actions">
          <Button variant="secondary" onClick={dismiss}>Ahora no</Button>
          <Button variant="primary" onClick={() => setPhase('step2')}>Revisar y continuar</Button>
        </div>
      </Modal>

      <Modal open={phase === 'step2'} onClose={dismiss} title="Antes de continuar" size="md">
        <p>Vas a utilizar los datos de esta computadora como información inicial de tu clínica en la nube.</p>
        <p>El proceso puede tardar unos minutos.</p>
        <p>No cierres el programa mientras se realiza la primera sincronización.</p>
        <div className="first-sync-actions">
          <Button variant="secondary" onClick={() => setPhase('step1')} disabled={running}>Volver</Button>
          <Button variant="primary" onClick={handleBegin} disabled={running}>Comenzar sincronización</Button>
        </div>
      </Modal>

      <Modal open={phase === 'running'} onClose={() => {}} title="Preparando la sincronización..." size="md">
        <div className="first-sync-running">
          <Spinner size="lg" />
          {runStage === 'finalize' ? (
            <p>Finalizando la configuración... No cierres el programa.</p>
          ) : (
            <p>Guardando la información inicial en la nube... No cierres el programa.</p>
          )}
        </div>
      </Modal>

      <Modal open={phase === 'success'} onClose={closeAfterSuccess} title="¡Tu clínica está sincronizada!" size="md">
        <p>Tu información inicial ya está guardada en la nube.</p>
        <ul className="first-sync-list">
          {TABLE_ORDER.map((t) => (
            <li key={t}>{TABLE_LABELS[t]}: {counts[t]}</li>
          ))}
        </ul>
        {lastSyncAt && (
          <p>Última sincronización: {formatFechaHora(lastSyncAt)}</p>
        )}
        <div className="first-sync-actions">
          <Button variant="primary" onClick={closeAfterSuccess}>Cerrar</Button>
        </div>
      </Modal>

      <Modal open={phase === 'failed'} onClose={dismiss} title={blocked ? 'Necesitamos revisar la información' : 'No se pudo completar la sincronización'} size="md">
        {blocked ? (
          <p>Encontramos información que necesita revisión antes de continuar. No se modificó nada: tus datos siguen intactos en esta computadora. Pide ayuda al encargado de sistemas para continuar.</p>
        ) : failKind === 'finalize' ? (
          <p>
            La información inicial fue enviada, pero no pudimos finalizar la configuración.
            No vuelvas a cerrar ni eliminar los datos locales. Puedes intentarlo de nuevo
            de forma segura con Reintentar.
          </p>
        ) : (
          <p>
            No pudimos guardar la información inicial en la nube{runError ? `: ${runError}` : '.'} Tu información
            local permanece en esta computadora. Puedes intentarlo nuevamente.
          </p>
        )}
        <div className="first-sync-actions">
          <Button variant="secondary" onClick={dismiss}>Cerrar</Button>
          <Button variant="primary" onClick={handleRetry}>Reintentar</Button>
        </div>
      </Modal>

      <Modal open={phase === 'partial'} onClose={dismiss} title="Revisa el estado de la nube" size="md">
        <p>No pudimos confirmar que la nube esté vacía. Antes de preparar la primera sincronización, pide ayuda al encargado de sistemas para revisar la nube.</p>
        <div className="first-sync-actions">
          <Button variant="primary" onClick={dismiss}>Entendido</Button>
        </div>
      </Modal>

      <Modal open={phase === 'error'} onClose={dismiss} title="No pudimos conectarnos a la nube" size="md">
        <p>Hubo un problema de conexión al revisar la nube. Puedes seguir trabajando con normalidad en esta computadora e intentarlo más tarde.</p>
        <div className="first-sync-actions">
          <Button variant="primary" onClick={dismiss}>Entendido</Button>
        </div>
      </Modal>
    </>
  );
}
