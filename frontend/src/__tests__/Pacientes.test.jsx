import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Pacientes from '../components/Pacientes';

vi.mock('../services/api', () => ({
  api: {
    pacientes: { listar: vi.fn(), eliminar: vi.fn() },
    historias: { obtener: vi.fn(), crear: vi.fn(), actualizar: vi.fn() },
  },
}));

import { api } from '../services/api';

const paciente = {
  id: 1, apellido_paterno: 'Perez', apellido_materno: 'Lopez', nombres: 'Juan',
  dni: '12345678', tipo_documento: 'dni', telefono: '', email: '', sexo: 'M',
};

function mockApi({ lista = [paciente], eliminar = {} } = {}) {
  api.pacientes.listar.mockResolvedValue(lista);
  api.pacientes.eliminar.mockResolvedValue(eliminar);
}

function eliminarPrimero() {
  fireEvent.click(screen.getByTitle('Eliminar'));
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mockApi();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Pacientes — eliminar', () => {
  test('éxito: conserva el comportamiento actual', async () => {
    render(<Pacientes onVerHistorial={() => {}} onVer360={() => {}} />);
    expect(await screen.findByText('Perez Lopez Juan')).toBeTruthy();
    const llamadasAntes = api.pacientes.listar.mock.calls.length;
    eliminarPrimero();
    await waitFor(() => expect(api.pacientes.eliminar).toHaveBeenCalledWith(1));
    await waitFor(() => expect(api.pacientes.listar.mock.calls.length).toBe(llamadasAntes + 1));
    expect(screen.queryByText(/No se pudo eliminar/)).toBeNull();
  });

  test('fallo: mensaje visible, registro presente, sin recarga ciega', async () => {
    mockApi({ eliminar: { error: 'Error de conexion. Verifica tu internet.' } });
    render(<Pacientes onVerHistorial={() => {}} onVer360={() => {}} />);
    expect(await screen.findByText('Perez Lopez Juan')).toBeTruthy();
    const llamadasAntes = api.pacientes.listar.mock.calls.length;
    eliminarPrimero();
    const banner = await screen.findByText(/No se pudo eliminar/);
    expect(banner).toBeTruthy();
    // El banner usa el patrón del módulo (mismo que errores de formulario).
    expect(screen.getByText('Perez Lopez Juan')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(api.pacientes.listar.mock.calls.length).toBe(llamadasAntes);
  });
});

describe('Pacientes — carga de lista (4.5)', () => {
  test('fallo de carga: sin crash, con error y Reintentar, sin vacío normal', async () => {
    mockApi({});
    api.pacientes.listar.mockResolvedValue({ error: 'Error de conexion. Verifica tu internet.' });
    render(<Pacientes onVerHistorial={() => {}} onVer360={() => {}} />);
    expect(await screen.findByText('No se pudieron cargar los pacientes. Revisa tu conexión e inténtalo de nuevo.')).toBeTruthy();
    expect(screen.getByText('Reintentar')).toBeTruthy();
    expect(screen.queryByText('No se encontraron pacientes')).toBeNull();
  });

  test('reintento tras fallo recupera la lista', async () => {
    api.pacientes.listar
      .mockResolvedValueOnce({ error: 'Error de conexion. Verifica tu internet.' })
      .mockResolvedValueOnce([{
        id: 1, apellido_paterno: 'Perez', apellido_materno: 'Lopez', nombres: 'Juan',
        dni: '12345678', tipo_documento: 'dni', telefono: '', email: '', sexo: 'M',
      }]);
    render(<Pacientes onVerHistorial={() => {}} onVer360={() => {}} />);
    expect(await screen.findByText('Reintentar')).toBeTruthy();
    fireEvent.click(screen.getByText('Reintentar'));
    expect(await screen.findByText('Perez Lopez Juan')).toBeTruthy();
    expect(screen.queryByText('No se pudieron cargar los pacientes.')).toBeNull();
  });
});
