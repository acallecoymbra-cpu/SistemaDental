/** Pacientes (RF-03, RF-22, RF-23, T-05). Funciones puras compartidas por la API y la web. */

import { CLINIC_TIME_ZONE } from './scheduling';

export const PATIENT_NAME_MAX_LENGTH = 120;
export const PATIENT_EMAIL_MAX_LENGTH = 254;
/** Mayoría de edad: menores de esta edad llevan etiqueta y celular de apoderado (V-18). */
export const ADULT_AGE_YEARS = 18;
/** Un celular normalizado tiene solo dígitos, de 7 a 15. */
export const PATIENT_PHONE_NORMALIZED_PATTERN = /^[0-9]{7,15}$/;

export type PatientOrigin = 'web' | 'dentist';

/** Lo que ve el dentista en el panel. */
export interface AdminPatient {
  id: string;
  fullName: string;
  /** Celular normalizado: solo dígitos. */
  phone: string;
  email: string | null;
  /** `AAAA-MM-DD`. */
  birthDate: string | null;
  /** Etiqueta de menor de edad (V-18). */
  isMinor: boolean;
  /** Celular del apoderado; obligatorio si es menor. */
  guardianPhone: string | null;
  origin: PatientOrigin;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientRequest {
  fullName: string;
  phone: string;
  email?: string | null;
  birthDate?: string | null;
  guardianPhone?: string | null;
}

/** Todos los campos son opcionales: solo se cambia lo que se envía. */
export interface UpdatePatientRequest {
  fullName?: string;
  phone?: string;
  email?: string | null;
  birthDate?: string | null;
  guardianPhone?: string | null;
}

/** Respuesta al crear o editar: el paciente y avisos informativos (no bloquean). */
export interface PatientWriteResponse {
  patient: AdminPatient;
  warnings: string[];
}

/** Aviso cuando otro paciente ya usa el mismo celular con otro nombre (V-02). */
export const SHARED_PHONE_WARNING =
  'Ese celular ya está registrado con otro nombre. Se guardó como otro paciente.';

/**
 * Nombre normalizado para detectar duplicados: sin tildes, en minúsculas y con los
 * espacios simplificados. «  José  PÉREZ » y «jose perez» son el mismo paciente.
 */
export function normalizePatientName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Celular normalizado: solo dígitos. Si trae el código de Bolivia (591) delante de un
 * número de 8 dígitos, se quita, así `+591 7000-0000` y `70000000` son el mismo celular.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('591') ? digits.slice(3) : digits;
}

/** Fecha de hoy en La Paz como `AAAA-MM-DD` (RNF-11). */
export function todayInClinicTimeZone(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** ¿Tiene menos de 18 años en `today` (ambas `AAAA-MM-DD`)? */
export function isMinorOn(birthDate: string, today: string): boolean {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const hadBirthday = (tm ?? 0) > (bm ?? 0) || ((tm ?? 0) === (bm ?? 0) && (td ?? 0) >= (bd ?? 0));
  const age = (ty ?? 0) - (by ?? 0) - (hadBirthday ? 0 : 1);
  return age < ADULT_AGE_YEARS;
}
