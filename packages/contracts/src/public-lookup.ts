/** «Mis consultas» (RF-09, T-09): el paciente consulta con nombre y celular, sin cuenta. */

import type { AppointmentStatus } from './appointment-status';

/** Intentos fallidos permitidos en la ventana antes de bloquear. */
export const LOOKUP_MAX_FAILURES = 5;
/** Ventana en la que se cuentan los fallos, en minutos. */
export const LOOKUP_WINDOW_MINUTES = 10;
/** Duración del bloqueo, en minutos. */
export const LOOKUP_BLOCK_MINUTES = 15;

/**
 * Un adulto escribe su nombre y su celular. Un menor, su nombre y el celular de su apoderado.
 */
export interface PublicLookupRequest {
  fullName: string;
  phone: string;
}

/** Lo único que ve el paciente de cada consulta: nada clínico y nada de otras personas. */
export interface PublicAppointmentSummary {
  startsAt: string;
  endsAt: string;
  treatmentName: string;
  status: AppointmentStatus;
  depositCents: number;
  /** Si ya envió su número de comprobante. */
  paymentReceived: boolean;
}
