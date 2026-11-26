import { describe, expect, it } from 'vitest';
import { isMinorOn, normalizePatientName, normalizePhone, todayInClinicTimeZone } from './patients';

describe('normalizePatientName', () => {
  it('ignora tildes, mayúsculas y espacios de más', () => {
    expect(normalizePatientName('  José   PÉREZ ')).toBe('jose perez');
    expect(normalizePatientName('jose perez')).toBe('jose perez');
    expect(normalizePatientName('Ñusta Muñoz')).toBe('nusta munoz');
  });

  it('distingue nombres distintos', () => {
    expect(normalizePatientName('Ana Pérez')).not.toBe(normalizePatientName('Ana Perez Soto'));
  });
});

describe('normalizePhone', () => {
  it('deja solo dígitos', () => {
    expect(normalizePhone('7000-0000')).toBe('70000000');
    expect(normalizePhone(' 70 000 000 ')).toBe('70000000');
  });

  it('quita el código de Bolivia de un número de 8 dígitos', () => {
    expect(normalizePhone('+591 7000-0000')).toBe('70000000');
    expect(normalizePhone('59170000000')).toBe('70000000');
  });

  it('no toca números que no son de 8 dígitos con 591', () => {
    expect(normalizePhone('591123')).toBe('591123');
  });
});

describe('isMinorOn', () => {
  it('es menor hasta el día anterior al cumpleaños 18', () => {
    expect(isMinorOn('2008-06-15', '2026-06-14')).toBe(true);
    expect(isMinorOn('2008-06-15', '2026-06-15')).toBe(false);
    expect(isMinorOn('2008-06-15', '2026-12-31')).toBe(false);
  });

  it('niños y adultos', () => {
    expect(isMinorOn('2020-01-01', '2026-11-25')).toBe(true);
    expect(isMinorOn('1990-03-10', '2026-11-25')).toBe(false);
  });
});

describe('todayInClinicTimeZone', () => {
  it('usa la fecha de La Paz (UTC-4), no la de UTC', () => {
    // 01:00 UTC del 26 es aún 21:00 del 25 en La Paz
    expect(todayInClinicTimeZone(new Date('2026-11-26T01:00:00Z'))).toBe('2026-11-25');
    expect(todayInClinicTimeZone(new Date('2026-11-26T04:00:00Z'))).toBe('2026-11-26');
  });
});
