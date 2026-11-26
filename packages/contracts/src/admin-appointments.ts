/** Agenda del dentista (RF-16, T-10). Solo existe en el panel: no hay versión pública. */

import type { AppointmentStatus } from './appointment-status';
import type { CancelNotificationStatus } from './cancel-appointment';

/** Rango máximo de la agenda, en días (una semana con holgura para vistas mensuales). */
export const AGENDA_MAX_RANGE_DAYS = 62;

export interface AdminAppointmentPatient {
  id: string;
  fullName: string;
  phone: string;
  isMinor: boolean;
  guardianPhone: string | null;
}

/** Comprobante de pago enviado por el paciente (T-07). */
export interface AdminPaymentProof {
  receiptNumber: string;
  submittedAt: string;
  confirmedAt: string | null;
}

export interface AdminAppointment {
  id: string;
  status: AppointmentStatus;
  /** Inicio y fin en UTC (ISO 8601); la pantalla los muestra en hora de La Paz. */
  startsAt: string;
  endsAt: string;
  treatment: { id: string; name: string };
  patient: AdminAppointmentPatient;
  /** Anticipo acordado al reservar, en centavos de Bs. */
  depositCents: number;
  origin: 'web' | 'dentist';
  /** Hasta cuándo se aparta la franja sin comprobante; null si no tiene plazo. */
  holdExpiresAt: string | null;
  cancelReason: string | null;
  canceledAt: string | null;
  paymentProof: AdminPaymentProof | null;
  /** Se llenan al cerrar la consulta (T-17). */
  diagnosis: string | null;
  costCents: number | null;
  /** Solo en consultas canceladas: qué pasó con el aviso por correo (T-13). */
  cancelNotification: CancelNotificationStatus | null;
  createdAt: string;
}
