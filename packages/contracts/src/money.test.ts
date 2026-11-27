import { describe, expect, it } from 'vitest';
import { formatCentsAsBs, parseBsToCents } from './money';

describe('parseBsToCents', () => {
  it('convierte importes con coma o punto', () => {
    expect(parseBsToCents('15')).toBe(1500);
    expect(parseBsToCents('15,5')).toBe(1550);
    expect(parseBsToCents('15.50')).toBe(1550);
    expect(parseBsToCents(' 9,99 ')).toBe(999);
    expect(parseBsToCents('20,01')).toBe(2001);
    expect(parseBsToCents('0,05')).toBe(5);
  });

  it('no tiene errores de decimales flotantes', () => {
    expect(parseBsToCents('0,29')).toBe(29);
    expect(parseBsToCents('1,1')).toBe(110);
    expect(parseBsToCents('4,35')).toBe(435);
  });

  it('rechaza lo que no es un importe', () => {
    for (const bad of ['', 'abc', '-5', '1,234', '1,2,3', '1e3', '12 Bs', ',5']) {
      expect(parseBsToCents(bad)).toBeNull();
    }
  });
});

describe('formatCentsAsBs', () => {
  it('muestra dos decimales con coma', () => {
    expect(formatCentsAsBs(1500)).toBe('15,00');
    expect(formatCentsAsBs(1550)).toBe('15,50');
    expect(formatCentsAsBs(999)).toBe('9,99');
    expect(formatCentsAsBs(5)).toBe('0,05');
  });
});
