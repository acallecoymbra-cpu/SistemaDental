import type {
  AvailableSlotsResponse,
  CreatePublicBookingRequest,
  PaymentProofReceived,
  PublicBooking,
} from '@sistema-dental/contracts';
import { apiFetch } from '@/lib/api-client';

/** Llamadas públicas de la reserva (T-06). No necesitan sesión. */
export const bookingApi = {
  slots: (date: string) => apiFetch<AvailableSlotsResponse>(`/availability/slots?date=${date}`),
  book: (body: CreatePublicBookingRequest) =>
    apiFetch<PublicBooking>('/appointments', { method: 'POST', body }),
  sendProof: (appointmentId: string, receiptNumber: string) =>
    apiFetch<PaymentProofReceived>(`/appointments/${appointmentId}/payment-proof`, {
      method: 'POST',
      body: { receiptNumber },
    }),
};

/** El QR es una imagen solo si la referencia es un enlace o una ruta; si no, se muestra el texto. */
export function isImageRef(ref: string): boolean {
  return /^(https?:\/\/|\/)/i.test(ref);
}

const LOCAL = { timeZone: 'America/La_Paz' } as const;

/** `2030-05-10T12:00:00Z` -> `viernes 10 de mayo de 2030, 08:00` (hora de La Paz). */
export function formatAppointmentTime(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('es-BO', {
    ...LOCAL,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('es-BO', {
    ...LOCAL,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${day}, ${time}`;
}

/** Segundos que faltan hasta `iso` (nunca negativo). */
export function secondsUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000));
}

/** `125` -> `02:05`. */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
