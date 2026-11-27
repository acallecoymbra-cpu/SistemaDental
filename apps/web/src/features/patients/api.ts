import type {
  AdminPatient,
  ClinicalContent,
  ClinicalHistory,
  ClinicalVersion,
  CreatePatientRequest,
  PatientRecord,
  PatientWriteResponse,
  SaveClinicalVersionResponse,
  UpdatePatientRequest,
} from '@sistema-dental/contracts';
import { apiFetch } from '@/lib/api-client';

/** Llamadas del panel para pacientes (T-05). */
export const patientsApi = {
  search: (q: string) =>
    apiFetch<AdminPatient[]>(`/admin/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  clinicalHistory: (id: string) =>
    apiFetch<ClinicalHistory>(`/admin/patients/${id}/clinical-history`),
  clinicalVersion: (id: string, version: number) =>
    apiFetch<ClinicalVersion>(`/admin/patients/${id}/clinical-history/versions/${version}`),
  saveClinicalHistory: (id: string, body: ClinicalContent) =>
    apiFetch<SaveClinicalVersionResponse>(`/admin/patients/${id}/clinical-history`, {
      method: 'PUT',
      body,
    }),
  record: (id: string) => apiFetch<PatientRecord>(`/admin/patients/${id}/record`),
  create: (body: CreatePatientRequest) =>
    apiFetch<PatientWriteResponse>('/admin/patients', { method: 'POST', body }),
  update: (id: string, body: UpdatePatientRequest) =>
    apiFetch<PatientWriteResponse>(`/admin/patients/${id}`, { method: 'PATCH', body }),
};

/** `2030-05-10` -> `10/05/2030` (formato de pantalla, RNF-11). */
export function formatBirthDate(birthDate: string | null): string {
  if (!birthDate) {
    return '—';
  }
  const [year, month, day] = birthDate.split('-');
  return `${day}/${month}/${year}`;
}

/** `591`, `70000000` -> `+591 70000000` (celular con su código de país). */
export function formatPhone(dialCode: string | null, phone: string): string {
  return `+${dialCode ?? '591'} ${phone}`;
}
