import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Pagos from '../components/Pagos';

vi.mock('../services/api', () => ({
  api: {
    pagos: { listarPorPaciente: vi.fn(), resumen: vi.fn(), eliminar: vi.fn() },
    tratamientos: { listar: vi.fn() },
    auth: { verificarPassword: vi.fn() },
    pdf: { pago: vi.fn(() => '#') },
  },
}));

import { api } from '../services/api';

const pago = {
  id: 21, fecha: '2026-01-05', procedimiento: 'Limpieza',
  tratamiento_descripcion: '', total: 100, a_cuenta: 50, saldo: 50,
  metodo_pago: 'efectivo',
};

function mockApi({ lista = [pago], eliminar = {}, password = { valido: true } } = {}) {
  api.pagos.listarPorPaciente.mockResolvedValue(lista);
  api.pagos.resumen.mockResolvedValue({});
  api.tratamientos.listar.mockResolvedValue([]);
  api.pagos.eliminar.mockResolvedValue(eliminar);
  api.auth.verificarPassword.mockResolvedValue(password);
}

async function pasarPuertaPassword() {
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

describe('Pagos — eliminar', () => {
  test('éxito: conserva el comportamiento actual', async () => {
    render(<Pagos pacienteId={1} />);
    expect(await screen.findByText('Limpieza')).toBeTruthy();
    const llamadasAntes = api.pagos.listarPorPaciente.mock.calls.length;
    await pasarPuertaPassword();
    await waitFor(() => expect(api.pagos.eliminar).toHaveBeenCalledWith(21));
    await waitFor(() => expect(api.pagos.listarPorPaciente.mock.calls.length).toBe(llamadasAntes + 1));
    expect(screen.queryByText(/No se pudo eliminar/)).toBeNull();
  });

  test('fallo: mensaje visible, registro presente, sin recarga ciega', async () => {
    mockApi({ eliminar: { error: 'Error de conexion. Verifica tu internet.' } });
    render(<Pagos pacienteId={1} />);
    expect(await screen.findByText('Limpieza')).toBeTruthy();
    const llamadasAntes = api.pagos.listarPorPaciente.mock.calls.length;
    await pasarPuertaPassword();
    expect(await screen.findByText(/No se pudo eliminar/)).toBeTruthy();
    expect(screen.getByText('Limpieza')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(api.pagos.listarPorPaciente.mock.calls.length).toBe(llamadasAntes);
  });
});
