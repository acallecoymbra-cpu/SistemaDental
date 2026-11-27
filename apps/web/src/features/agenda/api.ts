import type {
  AdminAppointment,
  AppointmentStatus,
  AvailableSlotsResponse,
  CancelAppointmentResponse,
  CompleteAppointmentRequest,
} from '@sistema-dental/contracts';
import { apiFetch } from '@/lib/api-client';

export interface AgendaFilters {
  from: string;
  to: string;
  status?: AppointmentStatus | '';
  patient?: string;
  /** Solo las por pagar con comprobante sin confirmar. */
  review?: boolean;
}

/** Llamadas del panel para la agenda (T-10). Lectura, confirmación de pago y cancelación. */
export const agendaApi = {
  list: ({ from, to, status, patient, review }: AgendaFilters) => {
    const params = new URLSearchParams({ from, to });
    if (status) params.set('status', status);
    if (patient?.trim()) params.set('patient', patient.trim());
    if (review) params.set('review', 'true');
    return apiFetch<AdminAppointment[]>(`/admin/appointments?${params.toString()}`);
  },
  cancel: (id: string, reason: string) =>
    apiFetch<CancelAppointmentResponse>(`/admin/appointments/${id}/cancel`, {
      method: 'POST',
      body: { reason },
    }),
  confirmPayment: (id: string) =>
    apiFetch<AdminAppointment>(`/admin/appointments/${id}/confirm-payment`, { method: 'POST' }),
  slots: (date: string) =>
    apiFetch<AvailableSlotsResponse>(`/admin/availability-slots?date=${date}`),
  reschedule: (id: string, startsAt: string) =>
    apiFetch<AdminAppointment>(`/admin/appointments/${id}/reschedule`, {
      method: 'POST',
      body: { startsAt },
    }),
  noShow: (id: string) =>
    apiFetch<AdminAppointment>(`/admin/appointments/${id}/no-show`, { method: 'POST' }),
  complete: (id: string, body: CompleteAppointmentRequest) =>
    apiFetch<AdminAppointment>(`/admin/appointments/${id}/complete`, { method: 'POST', body }),
};
