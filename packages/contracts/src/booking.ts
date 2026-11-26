/** Reserva pública de una consulta (RF-04, RF-05, T-06). */

/** Datos del paciente al reservar. Si ya está registrado se reconoce por nombre + celular. */
export interface BookingPatientRequest {
  fullName: string;
  phone: string;
  /** Obligatorio: ahí llegan los avisos de la clínica. */
  email: string;
  /** Obligatoria solo la primera vez (si el paciente ya existe se ignora). Formato `AAAA-MM-DD`. */
  birthDate?: string | null;
  /** Obligatorio si el paciente es menor de 18 años. */
  guardianPhone?: string | null;
}

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
