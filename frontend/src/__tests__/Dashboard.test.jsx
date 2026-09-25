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

const citasOk = [
  { id: 10, hora: '09:00', paciente_nombre: 'Perez Juan', motivo_usar: 'Control' },
];

function mockApi({ stats = statsOk, citas = citasOk, wa = { connected: false } } = {}) {
  api.dashboard.stats.mockResolvedValue(stats);
  api.citas.pendientesProcesar.mockResolvedValue(citas);
  api.whatsapp.estado.mockResolvedValue(wa);
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mockApi();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Dashboard — carga de datos', () => {
  test('éxito: los datos se muestran', async () => {
    render(<Dashboard onNavigate={() => {}} />);
    // En citas por procesar y en últimas consultas.
    expect((await screen.findAllByText('Perez Juan'))).toHaveLength(2);
    expect(screen.getByText('Citas por Procesar')).toBeTruthy();
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
    expect((await screen.findAllByText('Perez Juan'))).toHaveLength(2);
    expect(screen.queryByText('No se pudieron cargar los datos del panel.')).toBeNull();
    // Reintentar dispara exactamente una recarga, venga de donde venga el conteo previo.
    expect(api.dashboard.stats.mock.calls.length).toBe(llamadasAntes + 1);
  });

  test('caracterización: fallo de pendientesProcesar oculta solo esa sección', async () => {
    mockApi({ citas: { error: 'Error de conexion. Verifica tu internet.' } });
    render(<Dashboard onNavigate={() => {}} />);
    // El panel principal sigue con datos reales…
    expect((await screen.findAllByText('Perez Juan'))).toHaveLength(1);
    expect(screen.queryByText('No se pudieron cargar los datos del panel.')).toBeNull();
    // …pero la sección de citas por procesar desaparece (comportamiento actual).
    expect(screen.queryByText('Citas por Procesar')).toBeNull();
  });
});
