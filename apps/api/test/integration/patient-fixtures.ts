import {
  buildFullName,
  firstWordKey,
  nameKey,
  normalizePatientName,
  type PhoneDialCode,
} from '@sistema-dental/contracts';
import type { DataSource, EntityManager } from 'typeorm';

/** Paciente de prueba (datos inventados) insertado directo en la base. */
export interface PatientFixture {
  givenNames: string;
  firstSurname: string;
  secondSurname?: string;
  phone: string;
  phoneCountryCode?: PhoneDialCode;
  email?: string;
  birthDate?: string;
  isMinor?: boolean;
  guardianPhone?: string;
  ci?: string;
  origin?: 'web' | 'dentist';
}

/** Inserta un paciente con sus claves de nombre calculadas como lo hace la API. Devuelve su id. */
export async function insertPatient(
  db: DataSource | EntityManager,
  p: PatientFixture,
): Promise<string> {
  const fullName = buildFullName(p.givenNames, p.firstSurname, p.secondSurname ?? null);
  const [row] = (await db.query(
    `INSERT INTO patient (full_name, normalized_name, given_names, first_surname, second_surname,
                          first_given_name_key, given_names_key, first_surname_key,
                          second_surname_key, phone_country_code, phone, email, birth_date,
                          is_minor, guardian_phone_country_code, guardian_phone, ci, origin)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING id`,
    [
      fullName,
      normalizePatientName(fullName),
      p.givenNames,
      p.firstSurname,
      p.secondSurname ?? null,
      firstWordKey(p.givenNames),
      nameKey(p.givenNames),
      nameKey(p.firstSurname),
      p.secondSurname ? nameKey(p.secondSurname) : null,
      p.phoneCountryCode ?? '591',
      p.phone,
      p.email ?? null,
      p.birthDate ?? null,
      p.isMinor ?? Boolean(p.guardianPhone),
      p.guardianPhone ? '591' : null,
      p.guardianPhone ?? null,
      p.ci ?? null,
      p.origin ?? 'dentist',
    ],
  )) as { id: string }[];
  return row!.id;
}
