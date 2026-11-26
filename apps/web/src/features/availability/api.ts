import type {
  AvailabilityInterval,
  CreateAvailabilityIntervalRequest,
  UpdateAvailabilityIntervalRequest,
} from '@sistema-dental/contracts';
import { apiFetch } from '@/lib/api-client';

/** Llamadas del panel para los intervalos de atención (T-02). Tipos de `contracts`. */
export const availabilityApi = {
  list: () => apiFetch<AvailabilityInterval[]>('/admin/availability-intervals'),
  create: (body: CreateAvailabilityIntervalRequest) =>
    apiFetch<AvailabilityInterval>('/admin/availability-intervals', { method: 'POST', body }),
  update: (id: string, body: UpdateAvailabilityIntervalRequest) =>
    apiFetch<AvailabilityInterval>(`/admin/availability-intervals/${id}`, {
      method: 'PATCH',
      body,
    }),
  remove: (id: string) =>
    apiFetch<void>(`/admin/availability-intervals/${id}`, { method: 'DELETE' }),
};

/** `2030-05-10` -> `10/05/2030`, el formato que se usa en pantalla. */
export function formatServiceDate(serviceDate: string): string {
  const [year, month, day] = serviceDate.split('-');
  return `${day}/${month}/${year}`;
}

/** Orden de la lista: por fecha y luego por hora de inicio. */
export function sortIntervals(items: AvailabilityInterval[]): AvailabilityInterval[] {
  return [...items].sort((a, b) =>
    `${a.serviceDate} ${a.startsLocal}`.localeCompare(`${b.serviceDate} ${b.startsLocal}`),
  );
}
