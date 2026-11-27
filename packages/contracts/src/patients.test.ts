import { describe, expect, it } from 'vitest';
import {
  CI_PATTERN,
  buildFullName,
  firstWordKey,
  isMinorOn,
  nameKey,
  normalizeCi,
  normalizePatientName,
  normalizePhone,
  todayInClinicTimeZone,
} from './patients';

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

describe('nameKey', () => {
  it('quita tildes, mayúsculas, espacios, puntos, guiones y apóstrofos', () => {
    expect(nameKey('De la Roca')).toBe('delaroca');
    expect(nameKey('Muñoz-Pérez')).toBe('munozperez');
    expect(nameKey("D'Angelo Jr.")).toBe('dangelojr');
    expect(nameKey('  MARÍA   José ')).toBe('mariajose');
  });

  it('firstWordKey toma solo el primer nombre', () => {
    expect(firstWordKey('  María José ')).toBe('maria');
    expect(firstWordKey('Ana')).toBe('ana');
  });
});

describe('buildFullName', () => {
  it('une las partes con un espacio', () => {
    expect(buildFullName('María José', 'de la Roca', null)).toBe('María José de la Roca');
    expect(buildFullName(' Ana ', ' Pérez ', ' Soto ')).toBe('Ana Pérez Soto');
  });
});

describe('normalizeCi', () => {
  it('pasa a mayúsculas y quita espacios y puntos', () => {
    expect(normalizeCi('1234567 sc')).toBe('1234567SC');
    expect(normalizeCi('1.234.567-1b')).toBe('1234567-1B');
  });

  it('CI_PATTERN acepta de 4 a 20 caracteres de números, letras y guion', () => {
    expect(CI_PATTERN.test('123')).toBe(false);
    expect(CI_PATTERN.test('1234567-1B')).toBe(true);
    expect(CI_PATTERN.test('1234567_1')).toBe(false);
  });
});
