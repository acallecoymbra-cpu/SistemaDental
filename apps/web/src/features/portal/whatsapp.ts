/**
 * Enlace de WhatsApp (`wa.me`) a partir del celular guardado en la configuración.
 * El celular ya viene validado (solo dígitos, con `+` opcional): aquí se deja solo dígitos.
 * Devuelve null si el consultorio aún no configuró su WhatsApp.
 */
export function whatsappLink(
  phone: string | null | undefined,
  message = 'Hola, quisiera consultar por una cita.',
): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 7) {
    return null;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
