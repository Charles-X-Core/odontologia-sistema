import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FirstSyncOnboarding from '../components/FirstSyncOnboarding';
import { syncService } from '../services/syncService';

const TABLES = [
  'pacientes', 'historias_clinicas', 'consultas', 'odontogramas',
  'tratamientos', 'recetas', 'citas', 'pagos',
  'necesidades_odontologicas', 'imagenes',
];

const statusA2 = {
  isTurso: true, lastSync: null, bootstrapPending: true,
  bootstrapCompletedAt: null, deviceId: null, scenario: 'A2_with_data',
  pendingChanges: 0, pendingTombstones: 0, tables: TABLES,
};

const cloudEmpty = {
  cloud: 'empty', isConfigured: true, totalRows: 0,
  tables: {}, hasSyncState: false, hasTombstones: false, error: null,
};

const successResult = {
  success: true, bootstrap: true,
  classification: { scenario: 'A2_with_data', localRows: 5 },
  pull: { success: true, pulled: {}, errors: [], idCollisions: [] },
  push: { success: true, skipped: true, reason: 'A2_bootstrap_push_prohibited', pushed: {}, errors: [], idCollisions: [] },
  fence: { success: true }, duration: 150, timestamp: '2026-09-24T10:00:00',
};

const failResult = {
  success: false, aborted: 'pull_failed',
  pull: { success: false, pulled: {}, errors: [{ table: 'citas', error: 'x' }], idCollisions: [] },
  push: { success: true, skipped: true, reason: 'bootstrap pull failed', pushed: {}, errors: [], idCollisions: [] },
  fence: null, duration: 50,
};

const collisionResult = {
  success: false, aborted: 'idCollision',
  pull: { success: false, pulled: {}, errors: [], idCollisions: [{ table: 'pacientes', id: 1, direction: 'pull' }] },
  push: { success: true, skipped: true, reason: 'bootstrap pull failed', pushed: {}, errors: [], idCollisions: [] },
  fence: null, duration: 50,
};

const pushAdmitOk = {
  success: true, message: 'Push admitido (A2)',
  data: { success: true, pushed: { pacientes: 3, consultas: 2 }, idCollisions: [], errors: [], skippedByRemoteTombstone: 0, skippedStale: 0, pushedTombstones: 0 },
};

const pushFail = { success: false, error: 'No se pudo subir' };

// Forma real de la ruta /push ante colisión u otro fallo admitido:
// 500 genérico sin detalle (el backend no expone idCollisions por /push).
const pushCollision = { success: false, error: 'Error al subir cambios (admitLocalPush)' };

const fullFailPlain = {
  success: false,
  pull: { success: false, pulled: {}, errors: [{ table: 'citas', error: 'x' }], idCollisions: [] },
  push: { success: true, skipped: true, reason: 'bootstrap pull failed', pushed: {}, errors: [], idCollisions: [] },
  fence: null, duration: 50,
};

function mockApi({ status = statusA2, cloud = cloudEmpty, cloudThrows = false, fullSyncJson = successResult, pushJson = pushAdmitOk }) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/sync/push')) {
      const data = typeof pushJson === 'function' ? await pushJson() : pushJson;
      return { ok: true, json: async () => data };
    }
    if (u.includes('/api/sync/full')) {
      const data = typeof fullSyncJson === 'function' ? await fullSyncJson() : fullSyncJson;
      return { ok: true, json: async () => data };
    }
    if (u.includes('cloud-status')) {
      if (cloudThrows) throw new Error('red caída (simulado)');
      return { ok: true, json: async () => ({ success: true, data: cloud }) };
    }
    return { ok: true, json: async () => ({ success: true, data: status }) };
  });
}

function fullSyncCalls() {
  return global.fetch.mock.calls.filter(([u]) => String(u).includes('/api/sync/full')).length;
}

function pushCalls() {
  return global.fetch.mock.calls.filter(([u]) => String(u).includes('/api/sync/push')).length;
}

function pushBodies() {
  return global.fetch.mock.calls
    .filter(([u, opts]) => String(u).includes('/api/sync/push'))
    .map(([, opts]) => JSON.parse(opts.body));
}

function admitCalls() {
  return global.fetch.mock.calls.filter(([u]) => String(u).includes('admit-replica')).length;
}

async function gotoStep2() {
  render(<FirstSyncOnboarding />);
  await screen.findByText('Prepara la nube de tu clínica');
  fireEvent.click(screen.getByText('Revisar y continuar'));
  await screen.findByText('Antes de continuar');
}

beforeEach(() => {
  vi.spyOn(syncService, 'stopAutoSync').mockImplementation(() => {});
  vi.spyOn(syncService, 'startAutoSync').mockImplementation(() => {});
  vi.spyOn(syncService, 'fullSync');
  vi.spyOn(syncService, 'push');
  vi.spyOn(syncService, 'pull');
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

describe('FirstSyncOnboarding — primera pantalla', () => {
  test('nube vacía + bootstrap pendiente + datos → muestra onboarding con lista amigable', async () => {
    mockApi({});
    render(<FirstSyncOnboarding />);
    expect(await screen.findByText('Prepara la nube de tu clínica')).toBeTruthy();
    expect(screen.getByText('La nube está vacía y lista para recibir la información inicial de esta clínica.')).toBeTruthy();
    expect(screen.getByText('Pacientes')).toBeTruthy();
    expect(screen.getByText('Historias clínicas')).toBeTruthy();
    expect(screen.getByText('Necesidades odontológicas')).toBeTruthy();
    // Sin términos técnicos internos en la UI.
    expect(screen.queryByText(/A1|A2|bootstrap|tombstone|réplica|LWW/i)).toBeNull();
  });

  test('nube con datos → onboarding de nube vacía no visible', async () => {
    mockApi({ cloud: { ...cloudEmpty, cloud: 'with-data', totalRows: 10 } });
    render(<FirstSyncOnboarding />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Prepara la nube de tu clínica')).toBeNull();
  });

  test('error de cloud-status → mensaje de conexión, sin asumir nube vacía', async () => {
    mockApi({ cloudThrows: true });
    render(<FirstSyncOnboarding />);
    expect(await screen.findByText('No pudimos conectarnos a la nube')).toBeTruthy();
    expect(screen.queryByText('La nube está vacía y lista para recibir la información inicial de esta clínica.')).toBeNull();
  });

  test('"Ahora no" cierra sin ejecutar sync', async () => {
    mockApi({});
    render(<FirstSyncOnboarding />);
    await screen.findByText('Prepara la nube de tu clínica');
    fireEvent.click(screen.getByText('Ahora no'));
    await waitFor(() => expect(screen.queryByText('Prepara la nube de tu clínica')).toBeNull());
    expect(syncService.fullSync).not.toHaveBeenCalled();
    expect(syncService.push).not.toHaveBeenCalled();
    expect(syncService.pull).not.toHaveBeenCalled();
  });

  test('"Revisar y continuar" pasa al segundo paso sin ejecutar sync', async () => {
    mockApi({});
    render(<FirstSyncOnboarding />);
    await screen.findByText('Prepara la nube de tu clínica');
    fireEvent.click(screen.getByText('Revisar y continuar'));
    expect(await screen.findByText('Antes de continuar')).toBeTruthy();
    expect(screen.getByText('No cierres el programa mientras se realiza la primera sincronización.')).toBeTruthy();
    expect(syncService.fullSync).not.toHaveBeenCalled();
    expect(syncService.push).not.toHaveBeenCalled();
    expect(syncService.pull).not.toHaveBeenCalled();
  });

  test('"Comenzar sincronización" ejecuta push admitido y luego fullSync', async () => {
    mockApi({});
    render(<FirstSyncOnboarding />);
    await screen.findByText('Prepara la nube de tu clínica');
    fireEvent.click(screen.getByText('Revisar y continuar'));
    await screen.findByText('Antes de continuar');
    fireEvent.click(screen.getByText('Comenzar sincronización'));
    await screen.findByText('¡Tu clínica está sincronizada!');
    expect(pushCalls()).toBe(1);
    expect(pushBodies()).toEqual([{ since: null, admitLocalPush: true }]);
    expect(fullSyncCalls()).toBe(1);
    expect(admitCalls()).toBe(0);
  });

  test('pausa el auto-sync mientras el wizard está abierto y lo restaura al cerrar', async () => {
    mockApi({});
    render(<FirstSyncOnboarding />);
    await screen.findByText('Prepara la nube de tu clínica');
    expect(syncService.stopAutoSync).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Ahora no'));
    await waitFor(() => expect(syncService.startAutoSync).toHaveBeenCalled());
  });
});

describe('FirstSyncOnboarding — ejecución real', () => {
  test('mientras se guarda muestra estado de ejecución con botones deshabilitados', async () => {
    let releasePush;
    let releaseFull;
    mockApi({
      pushJson: () => new Promise((res) => { releasePush = () => res(pushAdmitOk); }),
      fullSyncJson: () => new Promise((res) => { releaseFull = () => res(successResult); }),
    });
    await gotoStep2();
    fireEvent.click(screen.getByText('Comenzar sincronización'));
    expect(await screen.findByText(/Guardando la información inicial en la nube/)).toBeTruthy();
    expect(screen.queryByText('Comenzar sincronización')).toBeNull();
    releasePush();
    expect(await screen.findByText(/Finalizando la configuración/)).toBeTruthy();
    releaseFull();
    await screen.findByText('¡Tu clínica está sincronizada!');
  });

  test('éxito muestra pantalla final con conteos reales del resultado', async () => {
    mockApi({});
    await gotoStep2();
    fireEvent.click(screen.getByText('Comenzar sincronización'));
    await screen.findByText('¡Tu clínica está sincronizada!');
    expect(screen.getByText('Tu información inicial ya está guardada en la nube.')).toBeTruthy();
    expect(document.body.textContent).toContain('Pacientes: 3');
    expect(document.body.textContent).toContain('Consultas: 2');
    expect(document.body.textContent).toContain('Citas: 0');
  });

  test('push fallido → error de guardado, fullSync NO ejecutado, sin reintento solo', async () => {
    mockApi({ pushJson: pushFail });
    await gotoStep2();
    fireEvent.click(screen.getByText('Comenzar sincronización'));
    await screen.findByText(/No pudimos guardar la información inicial/);
    expect(screen.getByText(/permanece en esta computadora/)).toBeTruthy();
    expect(pushCalls()).toBe(1);
    expect(fullSyncCalls()).toBe(0);
    expect(admitCalls()).toBe(0);
    await new Promise((r) => setTimeout(r, 50));
    expect(pushCalls()).toBe(1);
    expect(fullSyncCalls()).toBe(0);
  });

  test('push fallido (incluye colisión según forma real del backend) → error, sin fullSync ni admit', async () => {
    mockApi({ pushJson: pushCollision });
    await gotoStep2();
    fireEvent.click(screen.getByText('Comenzar sincronización'));
    await screen.findByText(/No pudimos guardar la información inicial/);
    expect(fullSyncCalls()).toBe(0);
    expect(admitCalls()).toBe(0);
    await new Promise((r) => setTimeout(r, 50));
    expect(pushCalls()).toBe(1);
    expect(fullSyncCalls()).toBe(0);
  });

  test('fallo de red en push → error, fullSync NO ejecutado', async () => {
    mockApi({ pushJson: () => { throw new Error('red caída'); } });
    await gotoStep2();
    fireEvent.click(screen.getByText('Comenzar sincronización'));
    await screen.findByText(/No pudimos guardar la información inicial/);
    expect(fullSyncCalls()).toBe(0);
    expect(admitCalls()).toBe(0);
  });

  test('fullSync falla después del push → mensaje de enviada-pero-no-finalizada', async () => {
    mockApi({ fullSyncJson: fullFailPlain });
    await gotoStep2();
    fireEvent.click(screen.getByText('Comenzar sincronización'));
    await screen.findByText('No se pudo completar la sincronización');
    expect(screen.getByText(/fue enviada, pero no pudimos finalizar/)).toBeTruthy();
    expect(screen.getByText(/No vuelvas a cerrar ni eliminar los datos locales/)).toBeTruthy();
    expect(pushCalls()).toBe(1);
    expect(fullSyncCalls()).toBe(1);
    expect(admitCalls()).toBe(0);
  });

  test('colisión en fullSync se explica sin resolver y sin llamar admit-replica', async () => {
    mockApi({ fullSyncJson: collisionResult });
    await gotoStep2();
    fireEvent.click(screen.getByText('Comenzar sincronización'));
    expect(await screen.findByText('Necesitamos revisar la información')).toBeTruthy();
    expect(screen.getByText(/siguen intactos en esta computadora/)).toBeTruthy();
    expect(pushCalls()).toBe(1);
    expect(admitCalls()).toBe(0);
    expect(fullSyncCalls()).toBe(1);
  });

  test('auto-sync sigue pausado durante ejecución y éxito; cerrar lo reanuda', async () => {
    mockApi({});
    render(<FirstSyncOnboarding />);
    await screen.findByText('Prepara la nube de tu clínica');
    fireEvent.click(screen.getByText('Revisar y continuar'));
    await screen.findByText('Antes de continuar');
    fireEvent.click(screen.getByText('Comenzar sincronización'));
    await screen.findByText('¡Tu clínica está sincronizada!');
    expect(syncService.startAutoSync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cerrar'));
    await waitFor(() => expect(syncService.startAutoSync).toHaveBeenCalled());
  });

  test('reintentar tras push aceptado retoma solo el finalize (sin re-push)', async () => {
    mockApi({ fullSyncJson: collisionResult });
    await gotoStep2();
    fireEvent.click(screen.getByText('Comenzar sincronización'));
    await screen.findByText('Necesitamos revisar la información');
    expect(pushCalls()).toBe(1);
    expect(fullSyncCalls()).toBe(1);
    fireEvent.click(screen.getByText('Reintentar'));
    expect(await screen.findByText(/Finalizando la configuración/)).toBeTruthy();
    await screen.findByText('Necesitamos revisar la información');
    expect(pushCalls()).toBe(1);
    expect(fullSyncCalls()).toBe(2);
  });

  test('reintentar tras push fallido vuelve al paso 2 y re-empuja solo manual', async () => {
    let attempt = 0;
    mockApi({ pushJson: () => { attempt += 1; return attempt === 1 ? pushFail : pushAdmitOk; } });
    await gotoStep2();
    fireEvent.click(screen.getByText('Comenzar sincronización'));
    await screen.findByText(/No pudimos guardar la información inicial/);
    expect(pushCalls()).toBe(1);
    expect(fullSyncCalls()).toBe(0);
    fireEvent.click(screen.getByText('Reintentar'));
    expect(await screen.findByText('Antes de continuar')).toBeTruthy();
    expect(pushCalls()).toBe(1);
    fireEvent.click(screen.getByText('Comenzar sincronización'));
    await screen.findByText('¡Tu clínica está sincronizada!');
    expect(pushCalls()).toBe(2);
    expect(fullSyncCalls()).toBe(1);
  });
});
