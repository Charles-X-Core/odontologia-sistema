import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../components/Sidebar';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ usuario: { nombre: 'Doctor', rol: 'admin' }, logout: vi.fn() }),
}));

const syncOk = {
  isTurso: true, lastSync: '2026-09-24T10:00:00', bootstrapPending: false,
  bootstrapCompletedAt: '2026-09-24T10:00:00', deviceId: 'dev-1',
  scenario: 'A2_with_data', pendingChanges: 0, pendingTombstones: 0,
  tables: ['pacientes'],
};

function mockSyncFetch(status = syncOk, { throws = false } = {}) {
  global.fetch = vi.fn(async (url) => {
    if (throws) throw new Error('red caída (simulado)');
    if (String(url).includes('/api/sync/')) {
      return { ok: true, json: async () => ({ success: true, data: status }) };
    }
    throw new Error('fetch no mockeado: ' + String(url));
  });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mockSyncFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

describe('Sidebar — indicador de sincronización (4.6)', () => {
  test('indicador compacto visible y lleva al detalle', async () => {
    const onNavigate = vi.fn();
    render(<Sidebar active="dashboard" onNavigate={onNavigate} />);
    expect(await screen.findByText('Al día')).toBeTruthy();
    fireEvent.click(screen.getByText('Al día'));
    expect(onNavigate).toHaveBeenCalledWith('configuracion');
  });

  test('indicador visible aun sin backend: neutral en vez de desaparecer', async () => {
    mockSyncFetch(null, { throws: true });
    render(<Sidebar active="dashboard" onNavigate={() => {}} />);
    expect(await screen.findByText('Estado desconocido')).toBeTruthy();
  });
});
