import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Recepcion from '../components/Recepcion';

vi.mock('../services/api', () => ({
  api: {
    pacientes: { listar: vi.fn(), buscar: vi.fn(), crear: vi.fn() },
    historias: { crear: vi.fn() },
  },
}));

import { api } from '../services/api';

const recientes = [
  {
    id: 1, apellido_paterno: 'Perez', apellido_materno: 'Lopez', nombres: 'Juan',
    dni: '12345678', tipo_documento: 'dni', telefono: '',
  },
];

function mockApi({ lista = recientes } = {}) {
  api.pacientes.listar.mockResolvedValue(lista);
  api.pacientes.buscar.mockResolvedValue([]);
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mockApi();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Recepcion — carga de recientes (4.5)', () => {
  test('éxito: conserva el comportamiento actual', async () => {
    render(<Recepcion onVolver={() => {}} onStartSesion={() => {}} />);
    expect(await screen.findByText('Pacientes Recientes')).toBeTruthy();
    expect(await screen.findByText('Perez Lopez Juan')).toBeTruthy();
    expect(screen.queryByText('No se pudieron cargar los pacientes recientes.')).toBeNull();
  });

  test('fallo de carga: sin crash, con error y Reintentar, sin vacío normal', async () => {
    mockApi({});
    api.pacientes.listar.mockResolvedValue({ error: 'Error de conexion. Verifica tu internet.' });
    render(<Recepcion onVolver={() => {}} onStartSesion={() => {}} />);
    expect(await screen.findByText('Pacientes Recientes')).toBeTruthy();
    expect(await screen.findByText('No se pudieron cargar los pacientes recientes. Revisa tu conexión e inténtalo de nuevo.')).toBeTruthy();
    expect(screen.getByText('Reintentar')).toBeTruthy();
    expect(screen.queryByText('No hay pacientes registrados')).toBeNull();
  });

  test('reintento tras fallo recupera los recientes', async () => {
    api.pacientes.listar
      .mockResolvedValueOnce({ error: 'Error de conexion. Verifica tu internet.' })
      .mockResolvedValueOnce(recientes);
    render(<Recepcion onVolver={() => {}} onStartSesion={() => {}} />);
    expect(await screen.findByText('Reintentar')).toBeTruthy();
    fireEvent.click(screen.getByText('Reintentar'));
    expect(await screen.findByText('Perez Lopez Juan')).toBeTruthy();
    expect(screen.queryByText('No se pudieron cargar los pacientes recientes.')).toBeNull();
  });
});
