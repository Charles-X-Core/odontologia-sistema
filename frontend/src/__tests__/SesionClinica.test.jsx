import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SesionClinica, { tieneTrabajoSinGuardar } from '../components/SesionClinica';

vi.mock('../services/api', () => ({
  api: {
    pacientes: { historial: vi.fn(), actualizarDni: vi.fn() },
    historias: { crear: vi.fn(), actualizar: vi.fn() },
    consultas: { crear: vi.fn() },
    odontogramas: { crear: vi.fn() },
    necesidades: { crear: vi.fn() },
    recetas: { crear: vi.fn() },
    imagenes: { subir: vi.fn() },
    tratamientos: { crear: vi.fn() },
    citas: { completar: vi.fn() },
  },
}));

import { api } from '../services/api';

const paciente = {
  id: 1, apellido_paterno: 'Perez', apellido_materno: '', nombres: 'Juan',
  dni: '12345678', tipo_documento: 'dni', telefono: '', email: '',
  fecha_nacimiento: '', sexo: 'M', estado_civil: '',
};

const historiaVacia = {
  id: 7, numero_historia: 'HCLX-1',
  alergia_medicamentos: '', propension_hemorragias: '', complicaciones_anestesia: '',
  presion_arterial_medicacion: '', cardiopatias_personales: '', cardiopatias_familiares: '',
  diabetes_personal: '', diabetes_familiar: '', hepatitis: '',
  otras_enfermedades: '', enfermedad_actual_medicacion: '',
};

function mockHistorial(historia = historiaVacia, consultas = []) {
  api.pacientes.historial.mockResolvedValue({ historia, consultas, necesidades: null });
}

function volverBtn() {
  return document.querySelector('.btn-back');
}

function irAPasoEnfermedad() {
  fireEvent.click(screen.getByText('Enfermedad'));
}

function escribirMotivo(texto) {
  fireEvent.change(screen.getByPlaceholderText(/Describe los sintomas/i), { target: { value: texto } });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mockHistorial();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SesionClinica — salida sin cambios', () => {
  test('1. Sin cambios: Volver mantiene el comportamiento actual, sin modal', async () => {
    const onVolver = vi.fn();
    render(<SesionClinica paciente={paciente} onVolver={onVolver} onCompletado={() => {}} />);
    await screen.findByText('Paso 1 de 8');
    fireEvent.click(volverBtn());
    expect(onVolver).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Tienes cambios sin guardar')).toBeNull();
  });
});

describe('SesionClinica — salida con cambios', () => {
  test('2. Con motivo: Volver muestra el modal y la sesión sigue abierta', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const onVolver = vi.fn();
    render(<SesionClinica paciente={paciente} onVolver={onVolver} onCompletado={() => {}} />);
    await screen.findByText('Paso 1 de 8');
    irAPasoEnfermedad();
    escribirMotivo('Dolor molar');
    fireEvent.click(volverBtn());
    expect(await screen.findByText('Tienes cambios sin guardar')).toBeTruthy();
    expect(onVolver).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/Describe los sintomas/i).value).toBe('Dolor molar');
    expect(alertSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  test('3. Seguir editando: cierra (botón, × y Escape), conserva datos, sin onVolver', async () => {
    const onVolver = vi.fn();
    render(<SesionClinica paciente={paciente} onVolver={onVolver} onCompletado={() => {}} />);
    await screen.findByText('Paso 1 de 8');
    irAPasoEnfermedad();
    escribirMotivo('Dolor molar');
    fireEvent.click(volverBtn());
    await screen.findByText('Tienes cambios sin guardar');
    // Botón principal.
    fireEvent.click(screen.getByText('Seguir editando'));
    expect(screen.queryByText('Tienes cambios sin guardar')).toBeNull();
    expect(screen.getByPlaceholderText(/Describe los sintomas/i).value).toBe('Dolor molar');
    expect(onVolver).not.toHaveBeenCalled();
    // Reabrir y cerrar con ×.
    fireEvent.click(volverBtn());
    await screen.findByText('Tienes cambios sin guardar');
    fireEvent.click(document.querySelector('.ui-modal-close'));
    expect(screen.queryByText('Tienes cambios sin guardar')).toBeNull();
    expect(onVolver).not.toHaveBeenCalled();
    // Reabrir y cerrar con Escape.
    fireEvent.click(volverBtn());
    await screen.findByText('Tienes cambios sin guardar');
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByText('Tienes cambios sin guardar')).toBeNull();
    expect(onVolver).not.toHaveBeenCalled();
  });

  test('4. Salir: cierra el modal y ejecuta la salida normal una sola vez', async () => {
    const onVolver = vi.fn();
    render(<SesionClinica paciente={paciente} onVolver={onVolver} onCompletado={() => {}} />);
    await screen.findByText('Paso 1 de 8');
    irAPasoEnfermedad();
    escribirMotivo('Dolor molar');
    fireEvent.click(volverBtn());
    await screen.findByText('Tienes cambios sin guardar');
    fireEvent.click(screen.getByText('Salir'));
    expect(screen.queryByText('Tienes cambios sin guardar')).toBeNull();
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  test('5. Cualquier señal real activa la protección (tiempo de enfermedad solo)', async () => {
    const onVolver = vi.fn();
    render(<SesionClinica paciente={paciente} onVolver={onVolver} onCompletado={() => {}} />);
    await screen.findByText('Paso 1 de 8');
    irAPasoEnfermedad();
    fireEvent.change(screen.getByPlaceholderText(/Ej: 3 dias/i), { target: { value: '2 semanas' } });
    fireEvent.click(volverBtn());
    expect(await screen.findByText('Tienes cambios sin guardar')).toBeTruthy();
    expect(onVolver).not.toHaveBeenCalled();
  });

  test('6. Prefill autocargado no dispara: odontograma previo + antecedentes iguales', async () => {
    api.pacientes.historial.mockResolvedValue({
      historia: { ...historiaVacia, alergia_medicamentos: 'Penicilina' },
      consultas: [{ id: 9, odontograma: { dientes: { 16: 'caries' } } }],
      necesidades: null,
    });
    const onVolver = vi.fn();
    render(<SesionClinica paciente={paciente} onVolver={onVolver} onCompletado={() => {}} />);
    await screen.findByText('Paso 1 de 8');
    await waitFor(() => expect(api.pacientes.historial).toHaveBeenCalled());
    // Deja asentar los setState del prefill antes de intentar salir.
    await new Promise((r) => setTimeout(r, 50));
    fireEvent.click(volverBtn());
    expect(onVolver).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Tienes cambios sin guardar')).toBeNull();
  });
});

describe('tieneTrabajoSinGuardar — reglas de detección', () => {
  const draftVacio = {
    motivo: '', tiempoEnfermedad: '', signosSintomas: '', relatoCronologico: '',
    funcionesBiologicas: '', signosVitales: {}, examenClinico: '', evaluacionOdonto: '',
    diagnosticos: [{ texto: '', tipo: 'clinico' }],
    planTratamiento: { descripcion: '', procedimientos: '', secuencia: '' },
    consentimiento: false, odontograma: {}, necesidades: {
      cariados: 0, curados: 0, por_extraer: 0, endodoncia: 0,
      ortodoncia: 0, protesis: 0, extraidos: 0, destartraje: 0,
    },
    evidencias: [],
    recetas: [{ medicamentos: [{ nombre: '', dosis: '', frecuencia: '', duracion: '' }], indicaciones: '' }],
    tratamientos: [{ procedimiento_realizado: '', costo_total: '', monto_a_cuenta: '', pieza_dental: '', notas: '', realizado: false }],
    antecedentesForm: {}, historia: null,
  };
  const baseVacia = { motivo: '', odontograma: {} };

  test('borrador vacío no es cambio; filas vacías extra tampoco (réplica del guardado)', () => {
    expect(tieneTrabajoSinGuardar(draftVacio, baseVacia)).toBe(false);
    expect(tieneTrabajoSinGuardar({
      ...draftVacio,
      diagnosticos: [{ texto: '', tipo: 'clinico' }, { texto: '', tipo: 'clinico' }],
      recetas: [...draftVacio.recetas, { medicamentos: [{ nombre: '', dosis: '', frecuencia: '', duracion: '' }], indicaciones: '' }],
    }, baseVacia)).toBe(false);
  });

  test('motivo igual a la baseline de la cita no es cambio; distinto sí', () => {
    expect(tieneTrabajoSinGuardar({ ...draftVacio, motivo: 'dolor' }, { ...baseVacia, motivo: 'dolor' })).toBe(false);
    expect(tieneTrabajoSinGuardar({ ...draftVacio, motivo: 'dolor fuerte' }, { ...baseVacia, motivo: 'dolor' })).toBe(true);
  });

  test('receta/tratamiento con contenido sí cuentan', () => {
    expect(tieneTrabajoSinGuardar({
      ...draftVacio,
      recetas: [{ medicamentos: [{ nombre: 'Ibuprofeno', dosis: '', frecuencia: '', duracion: '' }], indicaciones: '' }],
    }, baseVacia)).toBe(true);
    expect(tieneTrabajoSinGuardar({
      ...draftVacio,
      tratamientos: [{ procedimiento_realizado: 'Limpieza', costo_total: '', monto_a_cuenta: '', pieza_dental: '', notas: '', realizado: false }],
    }, baseVacia)).toBe(true);
  });

  test('antecedentes: iguales no cuentan; distintos sí', () => {
    const hist = { ...historiaVacia };
    expect(tieneTrabajoSinGuardar({ ...draftVacio, antecedentesForm: { alergia_medicamentos: '' }, historia: hist }, baseVacia)).toBe(false);
    expect(tieneTrabajoSinGuardar({ ...draftVacio, antecedentesForm: { alergia_medicamentos: 'Penicilina' }, historia: hist }, baseVacia)).toBe(true);
  });

  test('odontograma igual al prefill no cuenta; distinto sí', () => {
    const prefill = { 16: 'caries' };
    expect(tieneTrabajoSinGuardar({ ...draftVacio, odontograma: { 16: 'caries' } }, { ...baseVacia, odontograma: prefill })).toBe(false);
    expect(tieneTrabajoSinGuardar({ ...draftVacio, odontograma: { 16: 'caries', 17: 'obturado' } }, { ...baseVacia, odontograma: prefill })).toBe(true);
  });
});
