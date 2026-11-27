/** Intervalos de atención por fecha (RF-02, RF-14, T-02). */

import { SLOT_MINUTES } from './scheduling';

/** Duración mínima de un intervalo: una franja de consulta (V-20). */
export const AVAILABILITY_MIN_MINUTES = SLOT_MINUTES;

/** Formato de la fecha del intervalo: `AAAA-MM-DD`, en hora de La Paz. */
export const AVAILABILITY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Formato de hora local: `HH:mm` de 24 horas (de `00:00` a `23:59`). */
export const AVAILABILITY_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Lo que ve el dentista en el panel. Solo existe en el panel: no hay versión pública. */
export interface AvailabilityInterval {
  id: string;
  /** Fecha de atención, `AAAA-MM-DD`. */
  serviceDate: string;
  /** Hora de inicio, `HH:mm`. */
  startsLocal: string;
  /** Hora de fin, `HH:mm`. Siempre posterior al inicio. */
  endsLocal: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvailabilityIntervalRequest {
  serviceDate: string;
  startsLocal: string;
  endsLocal: string;
}

/** Todos los campos son opcionales: solo se cambia lo que se envía. */
export interface UpdateAvailabilityIntervalRequest {
  serviceDate?: string;
  startsLocal?: string;
  endsLocal?: string;
}

/** Una franja libre que el paciente puede elegir (T-03). */
export interface AvailableSlot {
  /** Inicio exacto, en UTC (ISO 8601). Es lo que se envía al reservar. */
  startsAt: string;
  /** Hora de inicio en La Paz, `HH:mm`, para mostrar en pantalla. */
  startsLocal: string;
}

/** Respuesta pública de horarios libres de una fecha. Lista vacía si no hay o la fecha no es reservable. */
export interface AvailableSlotsResponse {
  date: string;
  slots: AvailableSlot[];
}
