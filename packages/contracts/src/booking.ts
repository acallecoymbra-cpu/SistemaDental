/** Reserva pública de una consulta (RF-04, RF-05, T-06). */

import type { PhoneDialCode } from './phone';

/**
 * Paciente que ya se atendió («Sí, ya estoy registrado»): se reconoce con primer nombre,
 * primer apellido y celular (el suyo o el de su apoderado), como en «Mis consultas».
 */
export interface ReturningBookingPatient {
  kind: 'returning';
  firstName: string;
  firstSurname: string;
  phoneCountryCode: PhoneDialCode;
  phone: string;
  /** Obligatorio: ahí llegan los avisos de la clínica. */
  email: string;
}

/** Paciente nuevo: completa todos sus datos. */
export interface NewBookingPatient {
  kind: 'new';
  givenNames: string;
  firstSurname: string;
  secondSurname?: string | null;
  /** Obligatorio para mayores de edad. */
  ci?: string | null;
  phoneCountryCode: PhoneDialCode;
  phone: string;
  email: string;
  /** Formato `AAAA-MM-DD`. */
  birthDate: string;
  /** Obligatorio si el paciente es menor de 18 años. */
  guardianPhoneCountryCode?: PhoneDialCode | null;
  guardianPhone?: string | null;
}

/** Datos del paciente al reservar. */
export type BookingPatientRequest = ReturningBookingPatient | NewBookingPatient;

export interface CreatePublicBookingRequest {
  treatmentId: string;
  /** Inicio de la franja elegida, tal como lo devolvió `GET /availability/slots`. */
  startsAt: string;
  patient: BookingPatientRequest;
}

/** Respuesta al reservar: la franja queda apartada hasta `holdExpiresAt`. */
export interface PublicBooking {
  /** Identificador opaco de la consulta; sirve para enviar el comprobante (T-07). */
  id: string;
  status: 'por_pagar';
  startsAt: string;
  endsAt: string;
  /** Hasta cuándo se aparta la franja sin comprobante (8 minutos). */
  holdExpiresAt: string;
  treatmentName: string;
  depositCents: number;
  /** Referencia al QR de pago (enlace o ruta de imagen); null si la clínica aún no lo cargó. */
  paymentQrRef: string | null;
  /** WhatsApp de la clínica, para avisar si algo falla con el pago. */
  whatsappPhone: string | null;
}
