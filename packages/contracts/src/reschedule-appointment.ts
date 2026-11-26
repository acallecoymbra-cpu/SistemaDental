/** Reprogramar una consulta y marcar «no asistió» (RF-18, RF-19, T-12). */

export interface RescheduleAppointmentRequest {
  /** Inicio de la nueva franja (una de las que ofrece `GET /admin/availability-slots`). */
  startsAt: string;
}
