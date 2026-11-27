/** Deja solo lo que puede tener un celular: dígitos, un «+» al inicio, espacios y guiones. */
export function sanitizePhoneInput(value: string): string {
  const cleaned = value.replace(/[^\d+\s-]/g, '');
  const hasPlus = cleaned.trimStart().startsWith('+');
  return (hasPlus ? '+' : '') + cleaned.replace(/\+/g, '');
}
