/** Pacientes (RF-03, RF-22, RF-23, T-05). Funciones puras compartidas por la API y la web. */

import type { PhoneDialCode } from './phone';
import { CLINIC_TIME_ZONE } from './scheduling';

export const PATIENT_NAME_MAX_LENGTH = 120;
export const PATIENT_GIVEN_NAMES_MAX_LENGTH = 80;
export const PATIENT_SURNAME_MAX_LENGTH = 60;
/** CI ya normalizado: números, letras mayúsculas y guion (complemento o pasaporte), 4 a 20. */
export const CI_PATTERN = /^[0-9A-Z-]{4,20}$/;
export const PATIENT_EMAIL_MAX_LENGTH = 254;
/** Mayoría de edad: menores de esta edad llevan etiqueta y celular de apoderado (V-18). */
export const ADULT_AGE_YEARS = 18;
/** Un celular normalizado tiene solo dígitos, de 7 a 15. */
export const PATIENT_PHONE_NORMALIZED_PATTERN = /^[0-9]{7,15}$/;

export type PatientOrigin = 'web' | 'dentist';

/** Lo que ve el dentista en el panel. */
export interface AdminPatient {
  id: string;
  /** Nombre para mostrar: nombres + apellidos. */
  fullName: string;
  givenNames: string;
  firstSurname: string;
  secondSurname: string | null;
  /** CI normalizado (mayúsculas, sin espacios ni puntos). */
  ci: string | null;
  phoneCountryCode: PhoneDialCode;
  /** Número nacional, sin el código de país: solo dígitos. */
  phone: string;
  email: string | null;
  /** `AAAA-MM-DD`. */
  birthDate: string | null;
  /** Etiqueta de menor de edad (V-18). */
  isMinor: boolean;
  /** Celular del apoderado; obligatorio si es menor. */
  guardianPhoneCountryCode: PhoneDialCode | null;
  guardianPhone: string | null;
  origin: PatientOrigin;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientRequest {
  givenNames: string;
  firstSurname: string;
  secondSurname?: string | null;
  ci?: string | null;
  phoneCountryCode: PhoneDialCode;
  phone: string;
  email?: string | null;
  birthDate?: string | null;
  guardianPhoneCountryCode?: PhoneDialCode | null;
  guardianPhone?: string | null;
}

/** Todos los campos son opcionales: solo se cambia lo que se envía. */
export interface UpdatePatientRequest {
  givenNames?: string;
  firstSurname?: string;
  secondSurname?: string | null;
  ci?: string | null;
  phoneCountryCode?: PhoneDialCode;
  phone?: string;
  email?: string | null;
  birthDate?: string | null;
  guardianPhoneCountryCode?: PhoneDialCode | null;
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
 * Clave para comparar nombres: sin tildes (`ñ` → `n`), en minúsculas y solo letras `a–z`
 * (sin espacios, puntos, guiones ni apóstrofos). «De la Roca» → `delaroca`.
 */
export function nameKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** Clave del primer nombre: «María José» → `maria`. */
export function firstWordKey(givenNames: string): string {
  return nameKey(givenNames.trim().split(/\s+/)[0] ?? '');
}

/** Nombre para mostrar: nombres, primer apellido y segundo apellido (si hay). */
export function buildFullName(
  givenNames: string,
  firstSurname: string,
  secondSurname: string | null,
): string {
  return [givenNames, firstSurname, secondSurname ?? '']
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter((part) => part.length > 0)
    .join(' ');
}

/** CI: mayúsculas, sin espacios ni puntos (`1.234.567 sc` → `1234567SC`). */
export function normalizeCi(raw: string): string {
  return raw.toUpperCase().replace(/[\s.]/g, '');
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
