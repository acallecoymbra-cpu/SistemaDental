/** Ficha del paciente (RF-24, T-14): contacto + consultas en una sola pantalla. Solo el dentista. */

import type { AppointmentStatus } from './appointment-status';
import type { AdminPatient } from './patients';

/** Máximo de consultas que trae la ficha (las más recientes primero). */
export const PATIENT_RECORD_APPOINTMENTS_LIMIT = 200;

export interface PatientRecordAppointment {
  id: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  treatment: { id: string; name: string };
  /** Anticipo acordado, en centavos de Bs. */
  depositCents: number;
  /** Comprobante enviado, si hay (el número no se repite en la lista de la ficha). */
  paymentProof: { receiptNumber: string; confirmed: boolean } | null;
  /** Se llenan al cerrar la consulta (T-17). */
  diagnosis: string | null;
  costCents: number | null;
  cancelReason: string | null;
}

export interface PatientRecord {
  patient: AdminPatient;
  /** De la más reciente a la más antigua. */
  appointments: PatientRecordAppointment[];
}
