import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SyncStatus from '../components/SyncStatus';
import FirstSyncOnboarding from '../components/FirstSyncOnboarding';
import { syncService } from '../services/syncService';
import { onFirstSyncEvent, requestAssistantReopen, notifyAssistantOpen } from '../services/firstSyncBus';

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
  test('10. Bootstrap A1 + nube vacía: primera descarga manual', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A1_empty' },
      cloud: { ...cloudEmpty, cloud: 'empty' },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Primera copia pendiente')).toBeTruthy();
    // Esperar la variante con nube confirmada (antes, con nube aún sin
    // cargar, hay un estado neutro sin botón).
    expect(await screen.findByText('Descargar primera copia')).toBeTruthy();
    expect(screen.getByText(/Esta computadora aún no tiene información/)).toBeTruthy();
    expect(screen.queryByText(/Sigue el asistente en pantalla/)).toBeNull();
    expect(screen.queryByText(/Usa el asistente/)).toBeNull();
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
    await waitFor(() => expect(cloudCalls()).toBeGreaterThan(0));
    expect(pushCalls()).toBe(0);
    expect(fullCalls()).toBe(0);
  });

  test('11. Bootstrap A2 + nube vacía: ofrece reabrir el asistente', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A2_with_data' },
      cloud: { ...cloudEmpty, cloud: 'empty' },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Primera copia pendiente')).toBeTruthy();
    // Esperar la variante con nube confirmada (el título aparece antes,
    // con nube aún sin cargar, en la rama genérica sin botón).
    expect(await screen.findByText('Abrir asistente')).toBeTruthy();
    expect(screen.getByText(/Abre el asistente para preparar la primera copia/)).toBeTruthy();
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
    // 3. el aviso antiguo de nube no debe persistir (espera: la limpieza
    // ocurre en el efecto posterior al cambio de estado).
    expect(await screen.findByText('Al día')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Sin conexión a la nube/)).toBeNull());
  });
});

describe('SyncStatus — primera descarga A1 (3.2)', () => {
  test('20. A1 + nube con datos: el botón llama una vez a fullSync sin argumentos', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A1_empty' },
      cloud: { ...cloudEmpty, cloud: 'with-data', totalRows: 12 },
    });
    const spy = vi.spyOn(syncService, 'fullSync');
    render(<SyncStatus />);
    expect(await screen.findByText('Descargar primera copia')).toBeTruthy();
    fireEvent.click(screen.getByText('Descargar primera copia'));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy).toHaveBeenCalledWith();
    expect(pushCalls()).toBe(0);
  });

  test('21. A1 + nube sin configurar: botón disponible, fullSync es la única operación', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A1_empty' },
      cloud: { ...cloudEmpty, cloud: 'unconfigured', isConfigured: false },
      fullJson: { success: false, error: 'Turso not configured' },
    });
    const spy = vi.spyOn(syncService, 'fullSync');
    const pushSpy = vi.spyOn(syncService, 'push');
    render(<SyncStatus />);
    expect(await screen.findByText('Descargar primera copia')).toBeTruthy();
    fireEvent.click(screen.getByText('Descargar primera copia'));
    expect(await screen.findByText('No se pudo sincronizar')).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(pushCalls()).toBe(0);
  });

  test('22. A1 + nube parcial: sin botón', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A1_empty' },
      cloud: { ...cloudEmpty, cloud: 'partial' },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Primera copia pendiente')).toBeTruthy();
    expect(screen.queryByText('Descargar primera copia')).toBeNull();
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
    expect(fullCalls()).toBe(0);
  });

  test('23. A1 + error de nube: sin botón', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A1_empty' },
      cloud: { ...cloudEmpty, cloud: 'error', error: 'timeout' },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Primera copia pendiente')).toBeTruthy();
    expect(await screen.findByText(/Sin conexión a la nube/)).toBeTruthy();
    expect(screen.queryByText('Descargar primera copia')).toBeNull();
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
  });

  test('24. Durante la descarga: deshabilitado y doble clic sin segunda llamada', async () => {
    let release;
    const gate = new Promise((res) => { release = res; });
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A1_empty' },
      cloud: { ...cloudEmpty, cloud: 'empty' },
      fullJson: () => gate.then(() => fullOk),
    });
    const spy = vi.spyOn(syncService, 'fullSync');
    render(<SyncStatus />);
    expect(await screen.findByText('Descargar primera copia')).toBeTruthy();
    fireEvent.click(screen.getByText('Descargar primera copia'));
    expect(await screen.findByText(/Sincronizando… no cierres el programa/)).toBeTruthy();
    const busy = screen.getByText('Sincronizando…');
    expect(busy.disabled).toBe(true);
    fireEvent.click(busy);
    await new Promise((r) => setTimeout(r, 50));
    expect(spy).toHaveBeenCalledTimes(1);
    release();
    await screen.findByText('Descargar primera copia');
  });

  test('25. Descarga exitosa: sale de bootstrap y muestra Al día', async () => {
    let currentStatus = { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A1_empty' };
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/api/sync/full')) {
        currentStatus = { ...baseStatus };
        return { ok: true, json: async () => fullOk };
      }
      if (u.includes('cloud-status')) {
        return { ok: true, json: async () => ({ success: true, data: cloudEmpty }) };
      }
      return { ok: true, json: async () => ({ success: true, data: currentStatus }) };
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Descargar primera copia')).toBeTruthy();
    fireEvent.click(screen.getByText('Descargar primera copia'));
    expect(await screen.findByText('Al día')).toBeTruthy();
    expect(screen.queryByText('Primera copia pendiente')).toBeNull();
    expect(screen.getByText(/Última copia:/)).toBeTruthy();
  });

  test('26. Descarga fallida: mensaje amable sin tecnicismos', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A1_empty' },
      cloud: { ...cloudEmpty, cloud: 'with-data', totalRows: 8 },
      fullJson: { success: false, error: 'Error al descargar cambios' },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Descargar primera copia')).toBeTruthy();
    fireEvent.click(screen.getByText('Descargar primera copia'));
    expect(await screen.findByText('No se pudo sincronizar')).toBeTruthy();
    expect(screen.getByText(/Tus datos siguen a salvo/)).toBeTruthy();
    for (const raw of ['A1_empty', 'bootstrap', 'Turso', 'cursor', 'admitLocalPush']) {
      expect(screen.queryByText(new RegExp(raw, 'i'))).toBeNull();
    }
  });
});

describe('SyncStatus — reapertura del asistente (3.3)', () => {
  const statusA2Empty = { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A2_with_data' };

  test('27. Descartar y reabrir: sin botón duplicado, sin sync, flujo intacto', async () => {
    mockApi({ status: statusA2Empty, cloud: { ...cloudEmpty, cloud: 'empty' } });
    const fullSpy = vi.spyOn(syncService, 'fullSync');
    const pushSpy = vi.spyOn(syncService, 'push');
    render(<><SyncStatus /><FirstSyncOnboarding /></>);
    // Asistente abierto: SyncStatus no duplica su CTA.
    expect(await screen.findByText('Prepara la nube de tu clínica')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Abrir asistente')).toBeNull());
    // "Ahora no": el asistente se cierra y aparece la reapertura.
    fireEvent.click(screen.getByText('Ahora no'));
    expect(await screen.findByText('Abrir asistente')).toBeTruthy();
    expect(fullSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(pushCalls()).toBe(0);
    expect(fullCalls()).toBe(0);
    // Reabrir: vuelve el flujo existente intacto.
    fireEvent.click(screen.getByText('Abrir asistente'));
    expect(await screen.findByText('Prepara la nube de tu clínica')).toBeTruthy();
    fireEvent.click(screen.getByText('Revisar y continuar'));
    expect(await screen.findByText('Antes de continuar')).toBeTruthy();
  });

  test('28. El bus avisa y el unsubscribe deja de avisar', () => {
    const seen = [];
    const unsub = onFirstSyncEvent((e) => seen.push(e));
    requestAssistantReopen();
    notifyAssistantOpen(true);
    expect(seen).toEqual([{ type: 'reopen-request' }, { type: 'assistant-open', open: true }]);
    unsub();
    requestAssistantReopen();
    expect(seen).toHaveLength(2);
  });

  test('29. Desmontar limpia el listener: emitir después no falla', async () => {
    mockApi({ status: statusA2Empty, cloud: { ...cloudEmpty, cloud: 'empty' } });
    const { unmount } = render(<SyncStatus />);
    expect(await screen.findByText('Abrir asistente')).toBeTruthy();
    unmount();
    expect(() => {
      requestAssistantReopen();
      notifyAssistantOpen(false);
    }).not.toThrow();
  });

  test('30. A2 + nube con datos: ayuda de sistemas, sin asistente ni botón', async () => {
    mockApi({
      status: statusA2Empty,
      cloud: { ...cloudEmpty, cloud: 'with-data', totalRows: 30 },
    });
    render(<SyncStatus />);
    expect(await screen.findByText('Primera copia pendiente')).toBeTruthy();
    expect(screen.getByText(/Pide ayuda al encargado de sistemas/)).toBeTruthy();
    expect(screen.queryByText('Abrir asistente')).toBeNull();
    expect(screen.queryByText(/Sigue el asistente/)).toBeNull();
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
    expect(fullCalls()).toBe(0);
  });

  test('31. A1 y estados normales: sin botón de reapertura', async () => {
    mockApi({
      status: { ...baseStatus, lastSync: null, bootstrapPending: true, scenario: 'A1_empty' },
      cloud: { ...cloudEmpty, cloud: 'empty' },
    });
    const first = render(<SyncStatus />);
    expect(await screen.findByText('Descargar primera copia')).toBeTruthy();
    expect(screen.queryByText('Abrir asistente')).toBeNull();
    first.unmount();
    mockApi({});
    render(<SyncStatus />);
    expect(await screen.findByText('Al día')).toBeTruthy();
    expect(screen.queryByText('Abrir asistente')).toBeNull();
  });
});
