import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import App from '../App';
import { syncService } from '../services/syncService';
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    usuario: { nombre: 'Doctor', rol: 'admin' },
    cargando: false,
  }),
}));

vi.mock('../services/syncService', () => ({
  syncService: {
    startAutoSync: vi.fn(),
    stopAutoSync: vi.fn(),
    getStatus: vi.fn().mockResolvedValue({
      isTurso: false,
      bootstrapPending: false,
      scenario: null,
    }),
    onStatusChange: vi.fn(() => () => {}),
  },
}));

describe('App — auto-sync por entorno', () => {
  const originalElectronAPI = window.electronAPI;
  const originalCapacitor = window.Capacitor;

  beforeEach(() => {
    delete window.electronAPI;
    delete window.Capacitor;
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.electronAPI = originalElectronAPI;
    window.Capacitor = originalCapacitor;
  });

  test('no inicia auto-sync en web', () => {
    render(<App />);

    expect(syncService.startAutoSync).not.toHaveBeenCalled();
  });

  test('inicia auto-sync en Electron', () => {
    window.electronAPI = { isElectron: true };

    render(<App />);

    expect(syncService.startAutoSync).toHaveBeenCalledWith(300000);
  });

  test('mantiene auto-sync en Capacitor', () => {
    window.Capacitor = { isNativePlatform: true };

    render(<App />);

    expect(syncService.startAutoSync).toHaveBeenCalledWith(300000);
  });
});
