import type {
  AdminTreatment,
  CreateTreatmentRequest,
  UpdateTreatmentRequest,
} from '@sistema-dental/contracts';
import { apiFetch } from '@/lib/api-client';

/** Llamadas del panel para tratamientos. Los tipos vienen de `contracts`, igual que en la API. */
export const treatmentsApi = {
  list: () => apiFetch<AdminTreatment[]>('/admin/treatments'),
  create: (body: CreateTreatmentRequest) =>
    apiFetch<AdminTreatment>('/admin/treatments', { method: 'POST', body }),
  update: (id: string, body: UpdateTreatmentRequest) =>
    apiFetch<AdminTreatment>(`/admin/treatments/${id}`, { method: 'PATCH', body }),
};
