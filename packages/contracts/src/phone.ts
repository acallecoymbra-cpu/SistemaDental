/**
 * Celulares con código de país. Lista corta y fija (sin dependencias): Bolivia, sus vecinos,
 * Estados Unidos y España. Bolivia va primero y es la opción preseleccionada.
 */

export type PhoneDialCode = '591' | '54' | '55' | '56' | '51' | '595' | '1' | '34';

export interface PhoneCountry {
  /** Código ISO 3166-1 alfa-2, para la bandera. */
  iso: string;
  name: string;
  dialCode: PhoneDialCode;
}

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { iso: 'BO', name: 'Bolivia', dialCode: '591' },
  { iso: 'AR', name: 'Argentina', dialCode: '54' },
  { iso: 'BR', name: 'Brasil', dialCode: '55' },
  { iso: 'CL', name: 'Chile', dialCode: '56' },
  { iso: 'PE', name: 'Perú', dialCode: '51' },
  { iso: 'PY', name: 'Paraguay', dialCode: '595' },
  { iso: 'US', name: 'Estados Unidos', dialCode: '1' },
  { iso: 'ES', name: 'España', dialCode: '34' },
];

export const DEFAULT_PHONE_DIAL_CODE: PhoneDialCode = '591';

/** Códigos de la lista, del más largo al más corto (para reconocer un prefijo sin ambigüedad). */
const DIAL_CODES_LONGEST_FIRST: readonly PhoneDialCode[] = PHONE_COUNTRIES.map(
  (c) => c.dialCode,
).sort((a, b) => b.length - a.length);

/** WhatsApp guardado en formato internacional E.164: `+` y de 7 a 15 dígitos en total. */
export const WHATSAPP_PHONE_PATTERN = /^\+[0-9]{7,15}$/;

export function isPhoneDialCode(value: unknown): value is PhoneDialCode {
  return typeof value === 'string' && PHONE_COUNTRIES.some((c) => c.dialCode === value);
}

/** Bandera como emoji a partir del código ISO (`BO` → 🇧🇴). */
export function flagEmoji(iso: string): string {
  return [...iso.toUpperCase()]
    .map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65))
    .join('');
}

/** Bolivia: exactamente 8 dígitos. Resto de la lista: de 6 a 14. */
export function isValidNationalNumber(dialCode: PhoneDialCode, digits: string): boolean {
  return dialCode === '591' ? /^[0-9]{8}$/.test(digits) : /^[0-9]{6,14}$/.test(digits);
}

/**
 * Número nacional: solo dígitos. Si el paciente pegó el número con el prefijo del país elegido
 * (`+591 7000-0000`), se quita, siempre que lo que queda sea un número válido.
 */
export function normalizeNationalNumber(dialCode: PhoneDialCode, raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith(dialCode)) {
    const rest = digits.slice(dialCode.length);
    if (isValidNationalNumber(dialCode, rest)) {
      return rest;
    }
  }
  return digits;
}

export function toE164(dialCode: PhoneDialCode, national: string): string {
  return `+${dialCode}${national}`;
}

/**
 * Separa `+<código><número>`. Usa el código más largo de la lista que coincida; si ninguno
 * coincide, devuelve Bolivia con los dígitos tal cual, para que se corrijan en pantalla.
 */
export function parseE164(value: string): { dialCode: PhoneDialCode; national: string } {
  const digits = value.replace(/\D/g, '');
  const dialCode = DIAL_CODES_LONGEST_FIRST.find((code) => digits.startsWith(code));
  if (!dialCode) {
    return { dialCode: DEFAULT_PHONE_DIAL_CODE, national: digits };
  }
  return { dialCode, national: digits.slice(dialCode.length) };
}
