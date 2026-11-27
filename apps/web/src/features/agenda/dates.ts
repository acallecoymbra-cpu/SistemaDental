/**
 * Fechas de la agenda. Todo trabaja con fechas `AAAA-MM-DD` de La Paz como texto,
 * sin pasar por la zona horaria del navegador (La Paz no tiene horario de verano).
 */

const MS_PER_DAY = 86_400_000;

function parse(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(parse(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Lunes (inicio) y domingo (fin) de la semana que contiene `date`. */
export function weekRange(date: string): { from: string; to: string } {
  const weekday = new Date(parse(date)).getUTCDay(); // 0 = domingo
  const sinceMonday = (weekday + 6) % 7;
  const from = addDays(date, -sinceMonday);
  return { from, to: addDays(from, 6) };
}

export type AgendaView = 'dia' | 'semana';

export function rangeFor(view: AgendaView, date: string): { from: string; to: string } {
  return view === 'dia' ? { from: date, to: date } : weekRange(date);
}

/** Salta un día o una semana hacia atrás (-1) o adelante (+1). */
export function shiftDate(view: AgendaView, date: string, direction: -1 | 1): string {
  return addDays(date, direction * (view === 'dia' ? 1 : 7));
}

const TIME_ZONE = 'America/La_Paz';

/** `2033-03-07T12:00:00Z` -> `08:00` (hora de La Paz). */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** `2033-03-07T12:00:00Z` -> `2033-03-07` (fecha de La Paz). */
export function localDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(iso));
}

/** `2033-03-07` -> `lunes 7 de marzo de 2033`. */
export function formatDayTitle(date: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(parse(date)));
}

/** `2033-03-07` -> `07/03/2033`. */
export function formatShortDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export const STATUS_LABEL = {
  por_pagar: 'Por pagar',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
} as const;

/** Clase visual de la etiqueta de cada estado de consulta. */
export const STATUS_BADGE = {
  por_pagar: 'badge badge-warn',
  confirmada: 'badge',
  completada: 'badge badge-info',
  cancelada: 'badge badge-danger',
  no_asistio: 'badge badge-danger',
} as const;

/**
 * Enlace de WhatsApp para escribirle al paciente (al apoderado si es menor). Cada celular se
 * guarda como número nacional con su código de país aparte.
 */
export function patientWhatsappLink(
  patient: {
    fullName: string;
    phone: string;
    phoneCountryCode: string;
    guardianPhone: string | null;
    guardianPhoneCountryCode: string | null;
  },
  message: string,
): string | null {
  const [dial, number] = patient.guardianPhone
    ? [patient.guardianPhoneCountryCode ?? '591', patient.guardianPhone]
    : [patient.phoneCountryCode, patient.phone];
  const digits = number.replace(/\D/g, '');
  if (digits.length < 6) return null;
  return `https://wa.me/${dial}${digits}?text=${encodeURIComponent(message)}`;
}
