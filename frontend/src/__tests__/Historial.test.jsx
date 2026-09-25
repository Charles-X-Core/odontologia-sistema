import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Historial from '../components/Historial';

vi.mock('../services/api', () => ({
  api: {
    pacientes: { historial: vi.fn() },
    consultas: { eliminar: vi.fn(), actualizar: vi.fn() },
    imagenes: { porConsulta: vi.fn() },
    auth: { verificarPassword: vi.fn() },
  },
}));

import { api } from '../services/api';

const paciente = {
  id: 1, apellido_paterno: 'Perez', apellido_materno: '', nombres: 'Juan',
  dni: '12345678', tipo_documento: 'dni', telefono: '',
};

const consulta = {
  id: 41, fecha: '2026-01-05', motivo: 'Dolor molar',
  diagnostico_lista: '[]', signos_sintomas: '', notas: '',
  signos_vitales: {}, plan_tratamiento: {},
  tratamientos: [], recetas: [], pagos: [],
};

function mockApi({ consultas = [consulta], eliminar = {}, password = { valido: true } } = {}) {
  api.pacientes.historial.mockResolvedValue({
    historia: { id: 7, numero_historia: 'HCLX-1' },
    consultas,
    resumen: {},
  });
  api.consultas.eliminar.mockResolvedValue(eliminar);
  api.imagenes.porConsulta.mockResolvedValue([]);
  api.auth.verificarPassword.mockResolvedValue(password);
}

async function abrirDetalleYEliminar() {
  // Expande la consulta en el timeline y pulsa Eliminar (con puerta de password).
  fireEvent.click(document.querySelector('.timeline-date'));
  fireEvent.click(await screen.findByText('Eliminar'));
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

describe('Historial — eliminar consulta', () => {
  test('éxito: conserva el comportamiento actual', async () => {
    render(<Historial paciente={paciente} onVolver={() => {}} onNuevaConsulta={() => {}} />);
    expect(await screen.findByText('Dolor molar')).toBeTruthy();
    const llamadasAntes = api.pacientes.historial.mock.calls.length;
    await abrirDetalleYEliminar();
    await waitFor(() => expect(api.consultas.eliminar).toHaveBeenCalledWith(41));
    // Recarga normal tras éxito.
    await waitFor(() => expect(api.pacientes.historial.mock.calls.length).toBe(llamadasAntes + 1));
    expect(screen.queryByText(/No se pudo eliminar/)).toBeNull();
  });

  test('fallo: mensaje visible, consulta presente, sin recarga ciega', async () => {
    mockApi({ eliminar: { error: 'Error de conexion. Verifica tu internet.' } });
    render(<Historial paciente={paciente} onVolver={() => {}} onNuevaConsulta={() => {}} />);
    expect(await screen.findByText('Dolor molar')).toBeTruthy();
    const llamadasAntes = api.pacientes.historial.mock.calls.length;
    await abrirDetalleYEliminar();
    expect(await screen.findByText(/No se pudo eliminar/)).toBeTruthy();
    expect(screen.getByText('Dolor molar')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(api.pacientes.historial.mock.calls.length).toBe(llamadasAntes);
  });
});
