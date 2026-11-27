import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PHONE_DIAL_CODE,
  PHONE_COUNTRIES,
  WHATSAPP_PHONE_PATTERN,
  flagEmoji,
  isPhoneDialCode,
  isValidNationalNumber,
  normalizeNationalNumber,
  parseE164,
  toE164,
} from './phone';

describe('PHONE_COUNTRIES', () => {
  it('tiene Bolivia primero, sus vecinos, Estados Unidos y España', () => {
    expect(PHONE_COUNTRIES.map((c) => c.dialCode)).toEqual([
      '591',
      '54',
      '55',
      '56',
      '51',
      '595',
      '1',
      '34',
    ]);
    expect(PHONE_COUNTRIES[0]).toEqual({ iso: 'BO', name: 'Bolivia', dialCode: '591' });
    expect(DEFAULT_PHONE_DIAL_CODE).toBe('591');
  });

  it('reconoce solo los códigos de la lista', () => {
    expect(isPhoneDialCode('595')).toBe(true);
    expect(isPhoneDialCode('999')).toBe(false);
    expect(isPhoneDialCode(591)).toBe(false);
  });

  it('arma la bandera desde el código ISO', () => {
    expect(flagEmoji('BO')).toBe('🇧🇴');
    expect(flagEmoji('es')).toBe('🇪🇸');
  });
});

describe('normalizeNationalNumber', () => {
  it('deja solo dígitos', () => {
    expect(normalizeNationalNumber('591', '7000 0000')).toBe('70000000');
    expect(normalizeNationalNumber('591', '7000-0000')).toBe('70000000');
  });

  it('quita el prefijo del país si lo pegaron', () => {
    expect(normalizeNationalNumber('591', '+591 7000-0000')).toBe('70000000');
    expect(normalizeNationalNumber('591', '59170000000')).toBe('70000000');
    expect(normalizeNationalNumber('54', '+54 9 11 2345 6789')).toBe('91123456789');
  });

  it('no quita el prefijo si lo que queda no es válido', () => {
    expect(normalizeNationalNumber('591', '5917000')).toBe('5917000');
  });
});

describe('isValidNationalNumber', () => {
  it('Bolivia exige exactamente 8 dígitos', () => {
    expect(isValidNationalNumber('591', '70000000')).toBe(true);
    expect(isValidNationalNumber('591', '7000000')).toBe(false);
    expect(isValidNationalNumber('591', '700000000')).toBe(false);
  });

  it('los demás países aceptan de 6 a 14 dígitos', () => {
    expect(isValidNationalNumber('54', '12345')).toBe(false);
    expect(isValidNationalNumber('54', '123456')).toBe(true);
    expect(isValidNationalNumber('34', '12345678901234')).toBe(true);
    expect(isValidNationalNumber('34', '123456789012345')).toBe(false);
  });
});

describe('toE164 / parseE164', () => {
  it('arma y separa el número internacional', () => {
    expect(toE164('591', '70001234')).toBe('+59170001234');
    expect(parseE164('+59170001234')).toEqual({ dialCode: '591', national: '70001234' });
  });

  it('elige el código más largo que coincide', () => {
    expect(parseE164('+595981000000').dialCode).toBe('595');
    expect(parseE164('+5491123456789')).toEqual({ dialCode: '54', national: '91123456789' });
  });

  it('si ningún código coincide, usa Bolivia con los dígitos tal cual', () => {
    expect(parseE164('+99912345678')).toEqual({ dialCode: '591', national: '99912345678' });
  });

  it('el patrón de WhatsApp exige el +', () => {
    expect(WHATSAPP_PHONE_PATTERN.test('+59170001234')).toBe(true);
    expect(WHATSAPP_PHONE_PATTERN.test('70001234')).toBe(false);
    // E.164: máximo 15 dígitos en total
    expect(WHATSAPP_PHONE_PATTERN.test('+551234567890123')).toBe(true);
    expect(WHATSAPP_PHONE_PATTERN.test('+5512345678901234')).toBe(false);
  });
});
