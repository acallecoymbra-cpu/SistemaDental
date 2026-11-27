import type { PublicAppointmentSummary, PublicLookupRequest } from '@sistema-dental/contracts';
import { apiFetch } from '@/lib/api-client';

/** «Mis consultas» (T-09): consulta pública con nombre y celular. */
export const lookupApi = {
  find: (body: PublicLookupRequest) =>
    apiFetch<PublicAppointmentSummary[]>('/appointments/lookup', { method: 'POST', body }),
};
