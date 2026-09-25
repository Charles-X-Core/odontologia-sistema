import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../components/Sidebar';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ usuario: { nombre: 'Doctor', rol: 'admin' }, logout: vi.fn() }),
}));

// El Sidebar monta SyncStatus, que consulta /api/sync/*. No es foco de este
// archivo, pero sin este stub la petición real rompería el render.
function mockSyncFetch() {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/api/sync/')) {
      return { ok: true, json: async () => ({ success: true, data: null }) };
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

describe('Sidebar — Citas fuera de alcance (4.6)', () => {
  test('navegación principal intacta, sin Citas y sin opción Sincronización', () => {
    const onNavigate = vi.fn();
    render(<Sidebar active="dashboard" onNavigate={onNavigate} />);
    for (const label of ['Dashboard', 'Nueva Sesion', 'Pacientes', 'Estacion de Datos', 'WhatsApp', 'Configuracion']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // Citas fuera de alcance: la entrada desaparece, el módulo sigue en el repo.
    expect(screen.queryByText('Citas')).toBeNull();
    // El indicador compacto no es una opción principal del menú.
    expect(document.querySelectorAll('.sidebar-item').length).toBe(6);
    fireEvent.click(screen.getByText('Pacientes'));
    expect(onNavigate).toHaveBeenCalledWith('pacientes');
  });

  test('Nueva Sesion funciona con independencia de Citas', () => {
    const onNavigate = vi.fn();
    render(<Sidebar active="dashboard" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Nueva Sesion'));
    expect(onNavigate).toHaveBeenCalledWith('recepcion');
    expect(onNavigate).not.toHaveBeenCalledWith('citas');
  });
});
