import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '../components/Dashboard';

// Chart.js necesita canvas (ausente en jsdom): se sustituyen los gráficos,
// lo que se prueba es el flujo de datos, no el render de canvas.
vi.mock('react-chartjs-2', () => ({
  Bar: () => null,
  Line: () => null,
  Doughnut: () => null,
}));

vi.mock('../services/api', () => ({
  // API_BASE (4.6) lo consume syncService para resolver /api/sync/*.
  API_BASE: '',
  api: {
    dashboard: { stats: vi.fn() },
    citas: { pendientesProcesar: vi.fn() },
    whatsapp: { estado: vi.fn() },
  },
}));

import { api } from '../services/api';

const statsOk = {
  pacientes: 3, consultas: 5, tratamientos: 2,
  tratamientosRealizados: 1, tratamientosPlanificados: 1,
  pagos: { total_general: 500, total_pagado: 300, total_pendiente: 200 },
  ultimasConsultas: [
    { id: 1, fecha: new Date().toISOString(), paciente_nombre: 'Perez Juan', motivo: 'Dolor', diagnostico: 'Caries' },
  ],
  ingresosMensuales: [],
  saldosPendientes: [],
};

const syncOk = {
  isTurso: true, lastSync: '2026-09-24T10:00:00', bootstrapPending: false,
  bootstrapCompletedAt: '2026-09-24T10:00:00', deviceId: 'dev-1',
  scenario: 'A2_with_data', pendingChanges: 0, pendingTombstones: 0,
  tables: ['pacientes'],
};

function mockApi({ stats = statsOk, citas = [], wa = { connected: false } } = {}) {
  api.dashboard.stats.mockResolvedValue(stats);
  api.citas.pendientesProcesar.mockResolvedValue(citas);
  api.whatsapp.estado.mockResolvedValue(wa);
}

// SyncStatus usa fetch directo (no api.js): se mockea por URL.
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
  mockApi();
  mockSyncFetch();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

describe('Dashboard — carga de datos', () => {
  test('éxito: los datos se muestran', async () => {
    render(<Dashboard onNavigate={() => {}} />);
    // Solo en últimas consultas (Citas por Procesar está oculto en 4.6).
    expect((await screen.findAllByText('Perez Juan'))).toHaveLength(1);
    expect(screen.queryByText('Citas por Procesar')).toBeNull();
    expect(screen.queryByText('No se pudieron cargar los datos del panel.')).toBeNull();
  });

  test('stats() con error: estado visible, sin ceros como datos ni CTA engañoso', async () => {
    mockApi({ stats: { error: 'Error de conexion. Verifica tu internet.' } });
    render(<Dashboard onNavigate={() => {}} />);
    expect(await screen.findByText('No se pudieron cargar los datos del panel.')).toBeTruthy();
    expect(screen.getByText('Reintentar')).toBeTruthy();
    // Nada del dashboard "normal": ni tarjetas, ni CTA de primera consulta.
    expect(screen.queryByText('Cobrado')).toBeNull();
    expect(screen.queryByText('Crear primera consulta')).toBeNull();
    expect(screen.queryByText(/Error de conexion/)).toBeNull();
  });

  test('reintentar tras error recupera el Dashboard', async () => {
    api.dashboard.stats
      .mockResolvedValueOnce({ error: 'Error de conexion. Verifica tu internet.' })
      .mockResolvedValueOnce(statsOk);
    render(<Dashboard onNavigate={() => {}} />);
    expect(await screen.findByText('Reintentar')).toBeTruthy();
    const llamadasAntes = api.dashboard.stats.mock.calls.length;
    fireEvent.click(screen.getByText('Reintentar'));
    expect((await screen.findAllByText('Perez Juan'))).toHaveLength(1);
    expect(screen.queryByText('No se pudieron cargar los datos del panel.')).toBeNull();
    // Reintentar dispara exactamente una recarga, venga de donde venga el conteo previo.
    expect(api.dashboard.stats.mock.calls.length).toBe(llamadasAntes + 1);
  });
});

describe('Dashboard — citas ocultas y bloque sync (4.6)', () => {
  test('Citas por Procesar no se renderiza ni se carga', async () => {
    render(<Dashboard onNavigate={() => {}} />);
    expect(await screen.findByText('Sincronización')).toBeTruthy();
    expect(screen.queryByText('Citas por Procesar')).toBeNull();
    expect(screen.queryByText('Abrir Sesion')).toBeNull();
    await waitFor(() => expect(api.dashboard.stats).toHaveBeenCalled());
    expect(api.citas.pendientesProcesar).not.toHaveBeenCalled();
  });

  test('bloque compacto muestra el estado y Ver detalle navega a Configuración', async () => {
    const onNavigate = vi.fn();
    render(<Dashboard onNavigate={onNavigate} />);
    expect(await screen.findByText('Sincronización')).toBeTruthy();
    // Badge del encabezado + fila comparten el texto corto.
    expect((await screen.findAllByText('Al día'))).toHaveLength(2);
    fireEvent.click(screen.getByText('Ver detalle →'));
    expect(onNavigate).toHaveBeenCalledWith('configuracion');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  test('sin estado por fallo de carga: neutral visible en vez de desaparecer', async () => {
    mockSyncFetch(null, { throws: true });
    render(<Dashboard onNavigate={() => {}} />);
    expect(await screen.findByText('Sincronización')).toBeTruthy();
    expect((await screen.findAllByText('Estado desconocido'))).toHaveLength(2);
  });
});
