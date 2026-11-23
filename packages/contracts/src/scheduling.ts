/** Reglas de agenda aceptadas por el cliente (ADR-005). */

/** Franja fija de cada consulta, en minutos (V-20). */
export const SLOT_MINUTES = 45;

/** Tiempo máximo que una reserva sin comprobante aparta la franja, en minutos (V-21). */
export const BOOKING_HOLD_MINUTES = 8;

/** Máximo de consultas pendientes por paciente (RF-05). */
export const MAX_PENDING_APPOINTMENTS_PER_PATIENT = 3;

/** Huso horario de la clínica (RNF-11). */
export const CLINIC_TIME_ZONE = 'America/La_Paz';

/** Rango permitido del anticipo único, en centavos de Bs (V-06). */
export const DEPOSIT_MIN_CENTS = 1000;
export const DEPOSIT_MAX_CENTS = 2000;
