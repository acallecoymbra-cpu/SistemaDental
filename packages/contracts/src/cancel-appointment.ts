/** Cancelar una consulta y avisar al paciente (RF-21, T-13). */

import type { AdminAppointment } from './admin-appointments';

export const CANCEL_REASON_MAX_LENGTH = 500;

/** Intentos totales de envío del aviso (el primero cuenta) antes de darlo por fallido. */
export const EMAIL_MAX_ATTEMPTS = 3;

export interface CancelAppointmentRequest {
  /** Motivo de la cancelación (obligatorio). Es interno: no se envía en el aviso. */
  reason: string;
}

/**
 * Qué pasó con el aviso por correo:
 * - `queued`: se enviará en unos instantes (con reintentos);
 * - `no_email`: el paciente no tiene correo; hay que avisarle por WhatsApp.
 */
export type CancelNotice = 'queued' | 'no_email';

export interface CancelAppointmentResponse {
  appointment: AdminAppointment;
  notice: CancelNotice;
}

/** Estado del aviso de cancelación, visible en la agenda. `none`: no tiene correo. */
export type CancelNotificationStatus = 'pending' | 'sent' | 'failed' | 'none';
