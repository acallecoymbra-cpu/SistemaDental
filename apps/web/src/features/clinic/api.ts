import type { ClinicSettings, UpdateClinicSettingsRequest } from '@sistema-dental/contracts';
import { apiFetch } from '@/lib/api-client';

/** Llamadas del panel para la configuración de la clínica (T-01). */
export const clinicApi = {
  get: () => apiFetch<ClinicSettings>('/admin/clinic-settings'),
  update: (body: UpdateClinicSettingsRequest) =>
    apiFetch<ClinicSettings>('/admin/clinic-settings', { method: 'PATCH', body }),
};
