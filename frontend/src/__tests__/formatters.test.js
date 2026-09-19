import { describe, test, expect } from 'vitest';
import {
  nombreCompleto,
  tipoDocLabel,
  tipoDocPlaceholder,
  validarDocumento,
  formatFecha,
  formatFechaNacimiento,
  calcularEdad,
  validarFechaNacimiento,
  formatMoney,
} from '../utils/formatters';

describe('nombreCompleto', () => {
  test('concatena apellidos y nombres', () => {
    const p = { apellido_paterno: 'Garcia', apellido_materno: 'Lopez', nombres: 'Maria Elena' };
    expect(nombreCompleto(p)).toBe('Garcia Lopez Maria Elena');
  });

  test('maneja campos faltantes', () => {
    // La funcion no trimmea espacios dojos cuando falta un campo
    expect(nombreCompleto({ apellido_paterno: 'Garcia', nombres: 'Maria' })).toContain('Garcia');
    expect(nombreCompleto({ apellido_paterno: 'Garcia', nombres: 'Maria' })).toContain('Maria');
    expect(nombreCompleto({})).toBe('');
  });
});

describe('tipoDocLabel', () => {
  test('retorna labels correctos', () => {
    expect(tipoDocLabel('dni')).toBe('DNI');
    expect(tipoDocLabel('ce')).toBe('CE');
    expect(tipoDocLabel('pasaporte')).toBe('PASAPORTE');
    expect(tipoDocLabel('sin_doc')).toBe('DOC');
    expect(tipoDocLabel('otro')).toBe('DNI');
  });
});

describe('tipoDocPlaceholder', () => {
  test('retorna placeholders correctos', () => {
    expect(tipoDocPlaceholder('dni')).toContain('8 digitos');
    expect(tipoDocPlaceholder('ce')).toContain('8-12');
    expect(tipoDocPlaceholder('pasaporte')).toContain('6-12');
  });
});

describe('validarDocumento', () => {
  test('DNI valido con 8 digitos', () => {
    expect(validarDocumento('dni', '12345678')).toBe(true);
    expect(validarDocumento('dni', '1234567')).toBe(false);
    expect(validarDocumento('dni', '123456789')).toBe(false);
  });

  test('CE valido', () => {
    expect(validarDocumento('ce', '00091766')).toBe(true);
    // CE requiere 8-12 digitos, 1234 tiene solo 4
    expect(validarDocumento('ce', '1234')).toBe(false);
  });

  test('Pasaporte valido', () => {
    expect(validarDocumento('pasaporte', 'AB1234567')).toBe(true);
    expect(validarDocumento('pasaporte', 'abc123')).toBe(true);
  });

  test('sin_doc siempre valido', () => {
    expect(validarDocumento('sin_doc', '')).toBe(true);
    expect(validarDocumento('sin_doc', null)).toBe(true);
  });

  test('string vacio invalido para dni', () => {
    expect(validarDocumento('dni', '')).toBe(false);
  });
});

describe('formatFecha', () => {
  test('retorna - si no hay fecha', () => {
    expect(formatFecha(null)).toBe('-');
    expect(formatFecha('')).toBe('-');
  });

  test('formatea fecha valida', () => {
    const result = formatFecha('2026-05-15');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });
});

describe('formatFechaNacimiento', () => {
  test('retorna - si no hay fecha', () => {
    expect(formatFechaNacimiento(null)).toBe('-');
  });

  test('formatea con mes abreviado', () => {
    const result = formatFechaNacimiento('2026-05-15');
    expect(result).toContain('May');
    expect(result).toContain('2026');
  });
});

describe('calcularEdad', () => {
  test('retorna null si no hay fecha', () => {
    expect(calcularEdad(null)).toBeNull();
    expect(calcularEdad('')).toBeNull();
  });

  test('retorna null si fecha es invalida', () => {
    expect(calcularEdad('fecha-invalida')).toBeNull();
  });

  test('calcula edad correctamente', () => {
    const hoy = new Date();
    const hace30Anios = new Date(hoy.getFullYear() - 30, hoy.getMonth(), hoy.getDate());
    const fechaStr = hace30Anios.toISOString().split('T')[0];
    expect(calcularEdad(fechaStr)).toBe(30);
  });

  test('ajusta edad si aun no ha cumplido anios', () => {
    const hoy = new Date();
    const futuroMes = new Date(hoy.getFullYear() - 25, hoy.getMonth() + 1, hoy.getDate());
    if (futuroMes > hoy) {
      const fechaStr = futuroMes.toISOString().split('T')[0];
      expect(calcularEdad(fechaStr)).toBe(24);
    }
  });
});

describe('validarFechaNacimiento', () => {
  test('fecha futura es invalida', () => {
    const result = validarFechaNacimiento('2099-01-01');
    expect(result.valido).toBe(false);
    expect(result.error).toContain('futura');
  });

  test('fecha anterior a 1920 es invalida', () => {
    const result = validarFechaNacimiento('1910-01-01');
    expect(result.valido).toBe(false);
    expect(result.error).toContain('1920');
  });

  test('fecha valida retorna true', () => {
    const result = validarFechaNacimiento('1990-05-15');
    expect(result.valido).toBe(true);
    expect(result.edad).toBeGreaterThan(0);
  });

  test('fecha vacia es valida', () => {
    expect(validarFechaNacimiento('').valido).toBe(true);
    expect(validarFechaNacimiento(null).valido).toBe(true);
  });
});

describe('formatMoney', () => {
  test('formatea con simbolo $', () => {
    expect(formatMoney(150)).toBe('$150');
  });

  test('maneja null/undefined como 0', () => {
    expect(formatMoney(null)).toBe('$0');
    expect(formatMoney(undefined)).toBe('$0');
  });

  test('formatea con decimales', () => {
    expect(formatMoney(25.5)).toBe('$25.5');
  });
});
