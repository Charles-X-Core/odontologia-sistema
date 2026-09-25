import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SyncStatus from '../components/SyncStatus';
import { syncService } from '../services/syncService';

const baseStatus = {
  isTurso: true,
  lastSync: '2026-09-24T10:00:00',
  bootstrapPending: false,
  bootstrapCompletedAt: '2026-09-24T10:00:00',
  deviceId: 'dev-1',
  scenario: 'A2_with_data',
  pendingChanges: 0,
  pendingTombstones: 0,
  tables: ['pacientes'],
};

const cloudEmpty = {
  cloud: 'empty', isConfigured: true, totalRows: 0,
  tables: {}, hasSyncState: false, hasTombstones: false, error: null,
};

const fullOk = {
  success: true,
  message: 'ok',
  data: {
    success: true,
    push: { success: true, pushed: { pacientes: 2 }, errors: [], idCollisions: [] },
    pull: { success: true, pulled: { citas: 1 }, errors: [], idCollisions: [] },
    duration: 120,
    timestamp: '2026-09-24T10:05:00',
  },
};

function mockApi({ status = baseStatus, cloud = cloudEmpty, fullJson = fullOk, fullThrows = false } = {}) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/sync/full')) {
      if (fullThrows) throw new Error('fetch failed (simulado)');
      const data = typeof fullJson === 'function' ? await fullJson() : fullJson;
      return { ok: true, json: async () => data };
    }
    if (u.includes('cloud-status')) {
      return { ok: true, json: async () => ({ success: true, data: cloud }) };
    }
    return { ok: true, json: async () => ({ success: true, data: status }) };
  });
}

function fullCalls() {
  return global.fetch.mock.calls.filter(([u]) => String(u).includes('/api/sync/full')).length;
}

function pushCalls() {
  return global.fetch.mock.calls.filter(([u]) => String(u).includes('/api/sync/push')).length;
}

function cloudCalls() {
  return global.fetch.mock.calls.filter(([u]) => String(u).includes('cloud-status')).length;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

describe('SyncStatus — estados normales', () => {
  test('1. Solo local: sin nube, sin botón', async () => {
    mockApi({ status: { ...baseStatus, isTurso: false, lastSync: null } });
    render(<SyncStatus />);
    expect(await screen.findByText('Solo en esta computadora')).toBeTruthy();
    expect(screen.getByText(/No hay copia en la nube/)).toBeTruthy();
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
    expect(screen.queryByText(/Turso/i)).toBeNull();
  });

  test('2. Al día: última copia + botón habilitado', async () => {
    mockApi({});
    render(<SyncStatus />);
    expect(await screen.findByText('Al día')).toBeTruthy();
    expect(screen.getByText(/Última copia:/)).toBeTruthy();
    expect(screen.getByText('Sincronizar ahora')).toBeTruthy();
  });

  test('3. Cambios por enviar con conteo real', async () => {
    mockApi({ status: { ...baseStatus, pendingChanges: 5 } });
    render(<SyncStatus />);
    expect(await screen.findByText('Cambios por enviar')).toBeTruthy();
    expect(screen.getByText('5 cambios por enviar')).toBeTruthy();
    expect(screen.getByText('Sincronizar ahora')).toBeTruthy();
  });

  test('4. Solo tombstones: mensaje de eliminaciones sin número inventado', async () => {
    mockApi({ status: { ...baseStatus, pendingChanges: 0, pendingTombstones: 2 } });
    render(<SyncStatus />);
    expect(await screen.findByText('Cambios por enviar')).toBeTruthy();
    expect(screen.getByText('Hay eliminaciones por confirmar en la nube.')).toBeTruthy();
  });

  test('5. Sincronizando: botón deshabilitado y sin doble envío', async () => {
    let release;
    const gate = new Promise((res) => { release = res; });
    mockApi({ fullJson: () => gate.then(() => fullOk) });
    render(<SyncStatus />);
    expect(await screen.findByText('Sincronizar ahora')).toBeTruthy();
    const btn = screen.getByText('Sincronizar ahora');
    fireEvent.click(btn);
    expect(await screen.findByText(/Sincronizando… no cierres el programa/)).toBeTruthy();
    expect(screen.getByText('Sincronizando…')).toBeTruthy();
    expect(screen.getByText('Sincronizando…').disabled).toBe(true);
    release();
    await screen.findByText('Al día');
  });
});

describe('SyncStatus — errores y colisiones', () => {
  test('6. Error genérico: mensaje amable + reintento', async () => {
    mockApi({ fullJson: { success: false, error: 'Error al subir cambios' } });
    render(<SyncStatus />);
    expect(await screen.findByText('Sincronizar ahora')).toBeTruthy();
    fireEvent.click(screen.getByText('Sincronizar ahora'));
    expect(await screen.findByText('No se pudo sincronizar')).toBeTruthy();
    expect(screen.getByText(/Tus datos siguen a salvo/)).toBeTruthy();
    expect(screen.getByText('Sincronizar ahora')).toBeTruthy();
  });

  test('7. Error de red: fetch caído muestra estado amable', async () => {
    mockApi({ fullThrows: true });
    render(<SyncStatus />);
    expect(await screen.findByText('Sincronizar ahora')).toBeTruthy();
    fireEvent.click(screen.getByText('Sincronizar ahora'));
    expect(await screen.findByText('No se pudo sincronizar')).toBeTruthy();
    expect(screen.queryByText(/fetch failed/)).toBeNull();
  });

  test('8. Colisión con data.aborted', async () => {
    mockApi({
      fullJson: {
        success: false,
        data: {
          success: false,
          aborted: 'idCollision',
          push: { success: true, pushed: {}, errors: [], idCollisions: [] },
          pull: { success: false, pulled: {}, errors: [], idCollisions: [{ table: 'pacientes', id: 1, direction: 'pull' }] },
        },
      },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Sincronizar ahora')).toBeTruthy();
    fireEvent.click(screen.getByText('Sincronizar ahora'));
    expect(await screen.findByText('Necesitamos revisar la información')).toBeTruthy();
    expect(screen.getByText(/tus datos siguen intactos aquí/i)).toBeTruthy();
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
  });

  test('9. Colisión formato anterior (push/pull en raíz)', async () => {
    mockApi({
      fullJson: {
        success: false,
        aborted: 'idCollision',
        push: { success: false, pushed: {}, errors: [], idCollisions: [{ table: 'citas', id: 7, direction: 'push' }] },
        pull: { success: true, pulled: {}, errors: [], idCollisions: [] },
      },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Sincronizar ahora')).toBeTruthy();
    fireEvent.click(screen.getByText('Sincronizar ahora'));
    expect(await screen.findByText('Necesitamos revisar la información')).toBeTruthy();
  });
});

describe('SyncStatus — bootstrap y nube', () => {
  test('10. Bootstrap A1: primera copia pendiente sin CTA manual', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A1_empty' },
      cloud: { ...cloudEmpty, cloud: 'empty' },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Primera copia pendiente')).toBeTruthy();
    expect(screen.getByText(/primera descarga la traerá/i)).toBeTruthy();
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
    await waitFor(() => expect(cloudCalls()).toBeGreaterThan(0));
    expect(pushCalls()).toBe(0);
    expect(fullCalls()).toBe(0);
  });

  test('11. Bootstrap A2 + nube vacía: remite al asistente', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A2_with_data' },
      cloud: { ...cloudEmpty, cloud: 'empty' },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Primera copia pendiente')).toBeTruthy();
    expect(screen.getByText(/asistente de primera sincronización/i)).toBeTruthy();
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
    expect(fullCalls()).toBe(0);
  });

  test('12. Bootstrap + nube parcial: pide ayuda, sin botón', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A2_with_data' },
      cloud: { ...cloudEmpty, cloud: 'partial' },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Primera copia pendiente')).toBeTruthy();
    expect(await screen.findByText(/No pudimos confirmar que la nube esté vacía/)).toBeTruthy();
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
  });

  test('13. Bootstrap + error de nube: sin conexión, sin botón', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A2_with_data' },
      cloud: { ...cloudEmpty, cloud: 'error', error: 'timeout' },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Primera copia pendiente')).toBeTruthy();
    expect(await screen.findByText(/Sin conexión a la nube/)).toBeTruthy();
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
  });

  test('14. SYNC_DESKTOP_ONLY: mensaje de clínica sin código técnico', async () => {
    mockApi({ fullJson: { success: false, error: 'SYNC_DESKTOP_ONLY', code: 'SYNC_DESKTOP_ONLY' } });
    render(<SyncStatus />);
    expect(await screen.findByText('Sincronizar ahora')).toBeTruthy();
    fireEvent.click(screen.getByText('Sincronizar ahora'));
    expect(
      await screen.findByText('La sincronización solo está disponible en la computadora de la clínica')
    ).toBeTruthy();
    expect(screen.getByText(/los cambios se sincronizan desde la computadora principal/)).toBeTruthy();
    expect(screen.queryByText(/SYNC_DESKTOP_ONLY/)).toBeNull();
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
  });
});

describe('SyncStatus — reglas transversales', () => {
  test('15. No muestra errores técnicos crudos como texto principal', async () => {
    mockApi({
      fullJson: { success: false, error: 'Turso not configured; BOOTSTRAP_PENDING; SELECT * FROM sqlite_master' },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Sincronizar ahora')).toBeTruthy();
    fireEvent.click(screen.getByText('Sincronizar ahora'));
    expect(await screen.findByText('No se pudo sincronizar')).toBeTruthy();
    for (const raw of ['Turso not configured', 'BOOTSTRAP_PENDING', 'sqlite_master', 'tombstone', 'LWW', 'cursor']) {
      expect(screen.queryByText(new RegExp(raw, 'i'))).toBeNull();
    }
  });

  test('16. No llama fullSync extra mientras ya sincroniza', async () => {
    let release;
    const gate = new Promise((res) => { release = res; });
    mockApi({ fullJson: () => gate.then(() => fullOk) });
    const spy = vi.spyOn(syncService, 'fullSync');
    render(<SyncStatus />);
    expect(await screen.findByText('Sincronizar ahora')).toBeTruthy();
    fireEvent.click(screen.getByText('Sincronizar ahora'));
    await screen.findByText(/Sincronizando… no cierres/);
    fireEvent.click(screen.getByText('Sincronizando…'));
    await new Promise((r) => setTimeout(r, 50));
    expect(spy.mock.calls.length).toBeLessThanOrEqual(1);
    release();
    await screen.findByText('Al día');
  });

  test('17. No crea un segundo flujo de primera sincronización', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A2_with_data' },
      cloud: { ...cloudEmpty, cloud: 'empty' },
    });
    const pushSpy = vi.spyOn(syncService, 'push');
    render(<SyncStatus />);
    await screen.findByText('Primera copia pendiente');
    await new Promise((r) => setTimeout(r, 100));
    expect(pushSpy).not.toHaveBeenCalled();
    expect(pushCalls()).toBe(0);
    expect(fullCalls()).toBe(0);
    expect(screen.queryByText(/Comenzar sincronización/)).toBeNull();
    expect(screen.queryByText(/admitLocalPush/)).toBeNull();
  });

  test('18. Botón correcto según estado', async () => {
    // Sincronizado y pendientes: visible. Tras colisión: oculto.
    mockApi({
      status: { ...baseStatus, pendingChanges: 3 },
      fullJson: {
        success: false,
        data: {
          success: false,
          aborted: 'idCollision',
          push: { success: true, pushed: {}, errors: [], idCollisions: [] },
          pull: { success: false, pulled: {}, errors: [], idCollisions: [{ table: 'pacientes', id: 1, direction: 'pull' }] },
        },
      },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Cambios por enviar')).toBeTruthy();
    expect(screen.getByText('Sincronizar ahora')).toBeTruthy();
    fireEvent.click(screen.getByText('Sincronizar ahora'));
    await screen.findByText('Necesitamos revisar la información');
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
  });

  test('19. Al salir de bootstrap se limpia el diagnóstico de nube obsoleto', async () => {
    // 1. bootstrap pendiente + cloud-status con error.
    let currentStatus = { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A2_with_data' };
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('cloud-status')) {
        return { ok: true, json: async () => ({ success: true, data: { ...cloudEmpty, cloud: 'error', error: 'timeout' } }) };
      }
      return { ok: true, json: async () => ({ success: true, data: currentStatus }) };
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Primera copia pendiente')).toBeTruthy();
    expect(await screen.findByText(/Sin conexión a la nube/)).toBeTruthy();
    // 2. la primera copia se completa (p. ej. desde el asistente): el status
    // pasa a bootstrapPending=false y el servicio lo notifica.
    currentStatus = { ...baseStatus };
    syncService.notifyListeners({ syncing: false, lastResult: fullOk });
    // 3. el aviso antiguo de nube no debe persistir.
    expect(await screen.findByText('Al día')).toBeTruthy();
    expect(screen.queryByText(/Sin conexión a la nube/)).toBeNull();
  });
});
