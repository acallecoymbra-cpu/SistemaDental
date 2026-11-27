/** Dinero en bolivianos. Siempre en centavos enteros (ADR-002): nunca `float`. */

export const CURRENCY = 'BOB';

/**
 * Convierte lo que escribe una persona (`15`, `15,5`, `15.50`) a centavos.
 * Devuelve `null` si no es un importe válido. Admite como máximo dos decimales.
 * No usa números decimales: separa enteros y decimales como texto.
 */
export function parseBsToCents(input: string): number | null {
  const text = input.trim().replace(',', '.');
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    return null;
  }
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * 100 + fraction;
}

/** `1550` -> `15,50` (coma decimal, como se escribe en Bolivia). */
export function formatCentsAsBs(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const fraction = String(Math.abs(cents % 100)).padStart(2, '0');
  return `${whole},${fraction}`;
}
