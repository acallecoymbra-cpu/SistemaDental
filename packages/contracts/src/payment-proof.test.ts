import { describe, expect, it } from 'vitest';
import { normalizeReceiptNumber, RECEIPT_NUMBER_PATTERN } from './payment-proof';

describe('comprobante de pago', () => {
  it('normaliza a mayúsculas sin espacios en los extremos', () => {
    expect(normalizeReceiptNumber('  ab-1234 ')).toBe('AB-1234');
  });

  it('acepta solo letras, números y guiones de 4 a 30 caracteres', () => {
    for (const ok of ['1234', 'AB-123456', 'a1b2c3d4e5']) {
      expect(RECEIPT_NUMBER_PATTERN.test(ok)).toBe(true);
    }
    for (const bad of ['123', '12 34', 'ab_1234', "1234'; --", 'x'.repeat(31), '']) {
      expect(RECEIPT_NUMBER_PATTERN.test(bad)).toBe(false);
    }
  });
});
