import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Tratamientos from '../components/Tratamientos';

vi.mock('../services/api', () => ({
  api: {
    tratamientos: { listar: vi.fn(), eliminar: vi.fn() },
    auth: { verificarPassword: vi.fn() },
    pdf: { tratamientos: vi.fn(() => '#') },
  },
}));

import { api } from '../services/api';

const tratamiento = {
  id: 11, consulta_id: null, procedimiento_realizado: 'Limpieza',
  costo_total: 100, monto_a_cuenta: 0, saldo_pendiente: 100,
  estado: 'planificado', pieza_dental: '', notas: '',
};

function mockApi({ lista = [tratamiento], eliminar = {}, password = { valido: true } } = {}) {
  api.tratamientos.listar.mockResolvedValue(lista);
  api.tratamientos.eliminar.mockResolvedValue(eliminar);
  api.auth.verificarPassword.mockResolvedValue(password);
}

async function pasarPuertaPassword() {
  // Puerta de password (ConfirmarPassword) y confirm() nativo conservados.
  fireEvent.click(screen.getByTitle('Eliminar'));
  expect(await screen.findByText('Ingrese su password para continuar')).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'doctor' } });
  fireEvent.click(screen.getByText('Confirmar'));
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mockApi();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Tratamientos — eliminar', () => {
  test('éxito: conserva el comportamiento actual', async () => {
    render(<Tratamientos pacienteId={1} />);
    expect(await screen.findByText('Limpieza')).toBeTruthy();
    const llamadasAntes = api.tratamientos.listar.mock.calls.length;
    await pasarPuertaPassword();
    await waitFor(() => expect(api.tratamientos.eliminar).toHaveBeenCalledWith(11));
    await waitFor(() => expect(api.tratamientos.listar.mock.calls.length).toBe(llamadasAntes + 1));
    expect(screen.queryByText(/No se pudo eliminar/)).toBeNull();
  });

  test('fallo: mensaje visible, registro presente, sin recarga ciega', async () => {
    mockApi({ eliminar: { error: 'Error de conexion. Verifica tu internet.' } });
    render(<Tratamientos pacienteId={1} />);
    expect(await screen.findByText('Limpieza')).toBeTruthy();
    const llamadasAntes = api.tratamientos.listar.mock.calls.length;
    await pasarPuertaPassword();
    expect(await screen.findByText(/No se pudo eliminar/)).toBeTruthy();
    expect(screen.getByText('Limpieza')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(api.tratamientos.listar.mock.calls.length).toBe(llamadasAntes);
  });
});

describe('Tratamientos — carga de lista (4.5)', () => {
  test('fallo de carga: sin crash, con error y Reintentar, sin vacío normal', async () => {
    mockApi({});
    api.tratamientos.listar.mockResolvedValue({ error: 'Error de conexion. Verifica tu internet.' });
    render(<Tratamientos pacienteId={1} />);
    expect(await screen.findByText('No se pudieron cargar los tratamientos. Revisa tu conexión e inténtalo de nuevo.')).toBeTruthy();
    expect(screen.getByText('Reintentar')).toBeTruthy();
    expect(screen.queryByText('No hay tratamientos registrados')).toBeNull();
  });

  test('reintento tras fallo recupera la lista', async () => {
    api.tratamientos.listar
      .mockResolvedValueOnce({ error: 'Error de conexion. Verifica tu internet.' })
      .mockResolvedValueOnce([{
        id: 11, consulta_id: null, procedimiento_realizado: 'Limpieza',
        costo_total: 100, monto_a_cuenta: 0, saldo_pendiente: 100,
        estado: 'planificado', pieza_dental: '', notas: '',
      }]);
    render(<Tratamientos pacienteId={1} />);
    expect(await screen.findByText('Reintentar')).toBeTruthy();
    fireEvent.click(screen.getByText('Reintentar'));
    expect(await screen.findByText('Limpieza')).toBeTruthy();
    expect(screen.queryByText('No se pudieron cargar los tratamientos.')).toBeNull();
  });
});
