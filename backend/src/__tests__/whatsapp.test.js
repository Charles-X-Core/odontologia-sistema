const { formatPhone } = require('../services/whatsapp/metaCloudApi');

describe('formatPhone', () => {
  test('agrega prefijo 51 si no lo tiene', () => {
    expect(formatPhone('999888777')).toBe('51999888777');
  });

  test('no duplica prefijo 51 si ya existe', () => {
    expect(formatPhone('51999888777')).toBe('51999888777');
  });

  test('elimina caracteres no numericos', () => {
    expect(formatPhone('+51 999-888-777')).toBe('51999888777');
  });

  test('maneja numero con espacios', () => {
    expect(formatPhone('999 888 777')).toBe('51999888777');
  });
});
