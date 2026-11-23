/**
 * Estados de una consulta (ADR-005, aceptada por el cliente; V-08 y V-22).
 * Los valores son los que se guardan en la base de datos.
 */
export const APPOINTMENT_STATUSES = [
  'por_pagar',
  'confirmada',
  'completada',
  'cancelada',
  'no_asistio',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Estados que ya no admiten cambios. */
export const TERMINAL_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'completada',
  'cancelada',
  'no_asistio',
];

/** Transiciones permitidas por estado de origen. */
export const APPOINTMENT_TRANSITIONS: Readonly<
  Record<AppointmentStatus, readonly AppointmentStatus[]>
> = {
  por_pagar: ['confirmada', 'cancelada'],
  confirmada: ['completada', 'no_asistio', 'cancelada'],
  completada: [],
  cancelada: [],
  no_asistio: [],
};

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === 'string' && (APPOINTMENT_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return APPOINTMENT_TRANSITIONS[from].includes(to);
}
