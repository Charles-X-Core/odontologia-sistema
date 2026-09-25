import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Galeria from '../components/Galeria';

vi.mock('../services/api', () => ({
  api: {
    imagenes: { porPaciente: vi.fn(), eliminar: vi.fn(), subir: vi.fn(), generarQR: vi.fn() },
    auth: { verificarPassword: vi.fn() },
  },
}));

import { api } from '../services/api';

const imagen = {
  id: 31, tipo: 'foto', descripcion: 'Foto pieza 16',
  archivo_nombre: '', archivo_original: 'f16.jpg', created_at: '2026-01-05',
};

function mockApi({ lista = [imagen], eliminar = {}, password = { valido: true } } = {}) {
  api.imagenes.porPaciente.mockResolvedValue(lista);
  api.imagenes.eliminar.mockResolvedValue(eliminar);
  api.auth.verificarPassword.mockResolvedValue(password);
}

async function pasarPuertaPassword() {
  fireEvent.click(screen.getByText('Eliminar'));
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

describe('Galeria — eliminar', () => {
  test('éxito: conserva el comportamiento actual', async () => {
    render(<Galeria pacienteId={1} />);
    expect(await screen.findByText('Foto pieza 16')).toBeTruthy();
    await pasarPuertaPassword();
    await waitFor(() => expect(api.imagenes.eliminar).toHaveBeenCalledWith(31));
    expect(screen.queryByText(/No se pudo eliminar/)).toBeNull();
  });

  test('fallo: mensaje visible, imagen presente, sin recarga ciega', async () => {
    mockApi({ eliminar: { error: 'Error de conexion. Verifica tu internet.' } });
    render(<Galeria pacienteId={1} />);
    expect(await screen.findByText('Foto pieza 16')).toBeTruthy();
    const llamadasAntes = api.imagenes.porPaciente.mock.calls.length;
    await pasarPuertaPassword();
    expect(await screen.findByText(/No se pudo eliminar/)).toBeTruthy();
    expect(screen.getByText('Foto pieza 16')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(api.imagenes.porPaciente.mock.calls.length).toBe(llamadasAntes);
  });
});
