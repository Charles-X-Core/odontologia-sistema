const {
  cleanPhone,
  cleanName,
  cleanMoney,
  cleanDocument,
} = require('../services/importacion/mappings');

describe('PDF Templates - Helper Functions', () => {
  describe('cleanPhone (used in PDF templates)', () => {
    test('limpia telefonos con formato variado', () => {
      expect(cleanPhone('555-0101')).toBe('5550101');
      expect(cleanPhone('+51 999 888 777')).toBe('51999888777');
      expect(cleanPhone('')).toBeNull();
    });
  });

  describe('cleanName (used in PDF templates)', () => {
    test('normaliza nombres para PDFs', () => {
      expect(cleanName('maria elena')).toBe('Maria Elena');
      expect(cleanName('  juan  carlos  ')).toBe('Juan Carlos');
    });
  });

  describe('cleanMoney (used in PDF templates)', () => {
    test('parsea montos para PDFs', () => {
      expect(cleanMoney(150)).toBe(150);
      expect(cleanMoney('S/ 25.50')).toBe(25.5);
      expect(cleanMoney(null)).toBe(0);
    });
  });

  describe('cleanDocument (used in PDF templates)', () => {
    test('detecta tipo de documento para PDFs', () => {
      expect(cleanDocument('DNI 12345678').tipo).toBe('dni');
      expect(cleanDocument('CE 00091766').tipo).toBe('ce');
      expect(cleanDocument('PASAPORTE AB1234567').tipo).toBe('pasaporte');
    });
  });
});
