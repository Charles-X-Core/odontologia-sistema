import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Configuracion from '../components/Configuracion';
import { syncService } from '../services/syncService';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ usuario: { nombre: 'Doctor', email: 'doc@clinica.pe', rol: 'admin' }, logout: vi.fn() }),
}));

vi.mock('../services/api', () => ({
  // syncService importa API_BASE desde aquí para resolver /api/sync/*.
  API_BASE: '',
  api: {
    auth: { actualizarPerfil: vi.fn(), cambiarPassword: vi.fn(), subirFirma: vi.fn(), obtenerFirma: vi.fn() },
    whatsapp: { estado: vi.fn(), getConfig: vi.fn(), analytics: vi.fn(), conectar: vi.fn(), desconectar: vi.fn() },
    importacion: { devReset: vi.fn() },
  },
}));

import { api } from '../services/api';

const statusAlDia = {
  isTurso: true, lastSync: '2026-09-24T10:00:00', bootstrapPending: false,
  bootstrapCompletedAt: '2026-09-24T10:00:00', deviceId: 'dev-1',
  scenario: 'A2_with_data', pendingChanges: 0, pendingTombstones: 0,
  tables: ['pacientes'],
};

const fullOk = {
  success: true,
  data: {
    success: true,
    push: { success: true, pushed: { pacientes: 3, consultas: 1 }, errors: [], idCollisions: [] },
    pull: { success: true, pulled: { citas: 2 }, errors: [], idCollisions: [] },
    duration: 90, timestamp: '2026-09-24T10:05:00',
  },
};

function mockSyncFetch({ status = statusAlDia, full = fullOk } = {}) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/sync/full')) {
      return { ok: true, json: async () => full };
    }
    if (u.includes('/api/sync/')) {
      return { ok: true, json: async () => ({ success: true, data: status }) };
    }
    throw new Error('fetch no mockeado: ' + u);
  });
}

function fullCalls() {
  return global.fetch.mock.calls.filter(([u]) => String(u).includes('/api/sync/full')).length;
}

// El tab-bar contiene los botones; evita colisiones con los títulos de las
// secciones (p. ej. "Mi Perfil" aparece también como <h3>).
function tabs(container) {
  return within(container.querySelector('.configuracion-tabs'));
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // Las pestañas Firma/WhatsApp piden datos al montar; sin esto dejan
  // promesas sin resolver al cambiar de pestaña.
  api.auth.obtenerFirma.mockResolvedValue({});
  api.whatsapp.estado.mockResolvedValue({ connected: false });
  api.whatsapp.getConfig.mockResolvedValue({});
  api.whatsapp.analytics.mockResolvedValue({});
  mockSyncFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

describe('Configuracion — pestaña Sincronización', () => {
  test('abre en Sincronización cuando se pide esa pestaña', async () => {
    const { container } = render(<Configuracion tabInicial="sincronizacion" onVolver={() => {}} />);
    expect(await screen.findByText('Al día')).toBeTruthy();
    expect(tabs(container).getByText('Sincronización').className).toContain('active');
  });

  test('muestra datos reales: última sincronización, pendientes y situación', async () => {
    mockSyncFetch({
      status: { ...statusAlDia, pendingChanges: 4, pendingTombstones: 2 },
    });
    render(<Configuracion tabInicial="sincronizacion" onVolver={() => {}} />);
    expect(await screen.findByText('Última sincronización')).toBeTruthy();
    expect(screen.getByText('Cambios pendientes de enviar')).toBeTruthy();
    expect(screen.getByText('Eliminaciones pendientes de confirmar')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    // Escenario con lenguaje de clínica, no el valor técnico crudo.
    expect(screen.getByText('Con datos en esta computadora pendientes de la primera copia')).toBeTruthy();
    expect(screen.queryByText('A2_with_data')).toBeNull();
  });

  test('el botón usa handleSync y luego muestra la última operación con datos reales', async () => {
    render(<Configuracion tabInicial="sincronizacion" onVolver={() => {}} />);
    expect(await screen.findByText('Al día')).toBeTruthy();
    // Sin operación previa no hay sección de resumen.
    expect(screen.queryByText('Última operación')).toBeNull();

    const antes = fullCalls();
    fireEvent.click(screen.getByText('Sincronizar ahora'));
    // handleSync: una sola llamada a /full (nunca fetch directo desde la vista).
    await waitFor(() => expect(fullCalls()).toBe(antes + 1));

    expect(await screen.findByText('Última operación')).toBeTruthy();
    expect(screen.getByText('La última sincronización se completó correctamente.')).toBeTruthy();
    expect(screen.getByText('↑3 Pacientes')).toBeTruthy();
    expect(screen.getByText('↑1 Consultas')).toBeTruthy();
    expect(screen.getByText('↓2 Citas')).toBeTruthy();
  });

  test('las pestañas existentes siguen intactas y perfil es la inicial', async () => {
    const { container } = render(<Configuracion onVolver={() => {}} />);
    // Inicial: Mi Perfil (comportamiento previo intacto).
    expect(screen.getByText('Informacion que aparece en los PDFs y documentos')).toBeTruthy();
    for (const tab of ['Mi Perfil', 'Firma', 'Cambiar Password', 'WhatsApp', 'Sincronización']) {
      expect(tabs(container).getByText(tab)).toBeTruthy();
    }
    // Cambiar de pestaña funciona y Sincronización también es accesible aquí.
    fireEvent.click(tabs(container).getByText('Firma'));
    expect(screen.queryByText('Informacion que aparece en los PDFs y documentos')).toBeNull();
    fireEvent.click(tabs(container).getByText('Sincronización'));
    expect(await screen.findByText('Al día')).toBeTruthy();
  });

  test('solo-lectura: muestra el estado y no ofrece sincronizar', async () => {
    render(<Configuracion tabInicial="sincronizacion" onVolver={() => {}} />);
    expect(await screen.findByText('Al día')).toBeTruthy();
    // Fallo real (desktop only)，也只有中文标签「同步」。
    syncService.notifyListeners({
      syncing: false,
      lastResult: { success: false, error: 'SYNC_DESKTOP_ONLY', code: 'SYNC_DESKTOP_ONLY' },
    });
    expect(await screen.findByText('La sincronización solo está disponible en la computadora de la clínica')).toBeTruthy();
    expect(screen.queryByText('Sincronizar ahora')).toBeNull();
    expect(screen.queryByText(/SYNC_DESKTOP_ONLY/)).toBeNull();
  });
});
