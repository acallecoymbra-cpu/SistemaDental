import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Paciente con nombre por partes, celular con código de país y CI
 * (docs/superpowers/specs/2026-11-27-paciente-ci-nombres-celular-design.md, V-26/V-27).
 *
 * - Claves de nombre (sin tildes, minúsculas, solo a–z) para «Mis consultas» y para reconocer
 *   al paciente que vuelve: primer nombre o nombres + primer apellido + celular.
 * - `phone` y `guardian_phone` guardan el número nacional; el país va en su propia columna.
 * - CI opcional y único cuando existe.
 *
 * Las funciones de normalización están copiadas aquí a propósito: una migración no debe cambiar
 * si mañana cambia el código de `contracts`.
 */

const DIAL_CODES_LONGEST_FIRST = ['595', '591', '54', '55', '56', '51', '34', '1'];
const DIAL_CODES_SQL = DIAL_CODES_LONGEST_FIRST.map((c) => `'${c}'`).join(', ');

function nameKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function isValidNational(dialCode: string, digits: string): boolean {
  return dialCode === '591' ? /^[0-9]{8}$/.test(digits) : /^[0-9]{6,14}$/.test(digits);
}

/** Celular guardado con el formato anterior → país + número nacional. */
function splitLegacyPhone(id: string, phone: string): { dialCode: string; national: string } {
  if (/^[0-9]{8}$/.test(phone)) {
    return { dialCode: '591', national: phone };
  }
  for (const dialCode of DIAL_CODES_LONGEST_FIRST) {
    const rest = phone.slice(dialCode.length);
    if (phone.startsWith(dialCode) && isValidNational(dialCode, rest)) {
      return { dialCode, national: rest };
    }
  }
  throw new Error(
    `Paciente ${id}: no se pudo deducir el país del celular "${phone}". ` +
      'Corríjalo en la base (8 dígitos para Bolivia o con el código de país) y vuelva a migrar.',
  );
}

interface LegacyRow {
  id: string;
  full_name: string;
  phone: string;
  guardian_phone: string | null;
}

export class PatientNamePartsCiPhoneCountry1765200000000 implements MigrationInterface {
  name = 'PatientNamePartsCiPhoneCountry1765200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE patient
        ALTER COLUMN full_name TYPE varchar(210),
        ALTER COLUMN normalized_name TYPE varchar(210),
        ADD COLUMN given_names varchar(80) NULL,
        ADD COLUMN first_surname varchar(60) NULL,
        ADD COLUMN second_surname varchar(60) NULL,
        ADD COLUMN first_given_name_key varchar(80) NULL,
        ADD COLUMN given_names_key varchar(80) NULL,
        ADD COLUMN first_surname_key varchar(60) NULL,
        ADD COLUMN second_surname_key varchar(60) NULL,
        ADD COLUMN phone_country_code varchar(4) NULL,
        ADD COLUMN guardian_phone_country_code varchar(4) NULL,
        ADD COLUMN ci varchar(20) NULL,
        DROP CONSTRAINT patient_phone_check,
        DROP CONSTRAINT patient_guardian_phone_check,
        DROP CONSTRAINT patient_name_phone_uq
    `);

    const rows = (await queryRunner.query(
      'SELECT id, full_name, phone, guardian_phone FROM patient',
    )) as LegacyRow[];
    for (const row of rows) {
      const words = row.full_name.trim().split(/\s+/);
      const givenNames = words[0] ?? '';
      const firstSurname = words.length > 1 ? words.slice(1).join(' ') : givenNames;
      const givenKey = nameKey(givenNames);
      const surnameKey = nameKey(firstSurname);
      if (!givenKey || !surnameKey) {
        throw new Error(
          `Paciente ${row.id}: el nombre "${row.full_name}" no tiene letras para compararlo. ` +
            'Corríjalo en la base y vuelva a migrar.',
        );
      }
      const phone = splitLegacyPhone(row.id, row.phone);
      const guardian = row.guardian_phone ? splitLegacyPhone(row.id, row.guardian_phone) : null;
      await queryRunner.query(
        `UPDATE patient
            SET given_names = $2, first_surname = $3, first_given_name_key = $4,
                given_names_key = $4, first_surname_key = $5,
                phone_country_code = $6, phone = $7,
                guardian_phone_country_code = $8, guardian_phone = $9
          WHERE id = $1`,
        [
          row.id,
          givenNames,
          firstSurname,
          givenKey,
          surnameKey,
          phone.dialCode,
          phone.national,
          guardian?.dialCode ?? null,
          guardian?.national ?? null,
        ],
      );
    }

    await queryRunner.query(`
      ALTER TABLE patient
        ALTER COLUMN given_names SET NOT NULL,
        ALTER COLUMN first_surname SET NOT NULL,
        ALTER COLUMN first_given_name_key SET NOT NULL,
        ALTER COLUMN given_names_key SET NOT NULL,
        ALTER COLUMN first_surname_key SET NOT NULL,
        ALTER COLUMN phone_country_code SET NOT NULL,
        ADD CONSTRAINT patient_given_names_ck CHECK (length(trim(given_names)) > 0),
        ADD CONSTRAINT patient_first_surname_ck CHECK (length(trim(first_surname)) > 0),
        ADD CONSTRAINT patient_name_keys_ck CHECK (
          first_given_name_key ~ '^[a-z]+$' AND given_names_key ~ '^[a-z]+$'
          AND first_surname_key ~ '^[a-z]+$'
          AND (second_surname_key IS NULL OR second_surname_key ~ '^[a-z]+$')),
        ADD CONSTRAINT patient_phone_country_ck CHECK (phone_country_code IN (${DIAL_CODES_SQL})),
        ADD CONSTRAINT patient_guardian_phone_country_ck
          CHECK (guardian_phone_country_code IN (${DIAL_CODES_SQL})),
        ADD CONSTRAINT patient_guardian_phone_pair_ck
          CHECK ((guardian_phone IS NULL) = (guardian_phone_country_code IS NULL)),
        ADD CONSTRAINT patient_phone_ck CHECK (phone ~ '^[0-9]{6,14}$'),
        ADD CONSTRAINT patient_guardian_phone_ck CHECK (guardian_phone ~ '^[0-9]{6,14}$'),
        ADD CONSTRAINT patient_ci_ck CHECK (ci ~ '^[0-9A-Z-]{4,20}$')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX patient_identity_uq ON patient
        (given_names_key, first_surname_key, coalesce(second_surname_key, ''),
         phone_country_code, phone)
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX patient_ci_uq ON patient (ci) WHERE ci IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE INDEX patient_lookup_idx ON patient (first_surname_key, phone_country_code, phone)',
    );
    await queryRunner.query(`
      CREATE INDEX patient_guardian_lookup_idx ON patient
        (first_surname_key, guardian_phone_country_code, guardian_phone)
    `);

    // El WhatsApp de la clínica guardado sin prefijo (8 dígitos) es de Bolivia.
    await queryRunner.query(
      `UPDATE clinic_settings SET whatsapp_phone = '+591' || whatsapp_phone
        WHERE whatsapp_phone ~ '^[0-9]{8}$'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tooLong = (await queryRunner.query(`
      SELECT id FROM patient
       WHERE (phone_country_code <> '591' AND length(phone_country_code || phone) > 15)
          OR (guardian_phone_country_code <> '591'
              AND length(guardian_phone_country_code || guardian_phone) > 15)
    `)) as { id: string }[];
    if (tooLong.length > 0) {
      throw new Error(
        `No se puede revertir: ${tooLong.length} celular(es) con código de país no cabe(n) ` +
          'en la columna anterior (máximo 15 dígitos). Corríjalos antes de revertir.',
      );
    }
    await queryRunner.query(`
      UPDATE patient SET phone = phone_country_code || phone WHERE phone_country_code <> '591'
    `);
    await queryRunner.query(`
      UPDATE patient SET guardian_phone = guardian_phone_country_code || guardian_phone
       WHERE guardian_phone_country_code IS NOT NULL AND guardian_phone_country_code <> '591'
    `);
    await queryRunner.query('DROP INDEX patient_guardian_lookup_idx');
    await queryRunner.query('DROP INDEX patient_lookup_idx');
    await queryRunner.query('DROP INDEX patient_ci_uq');
    await queryRunner.query('DROP INDEX patient_identity_uq');
    await queryRunner.query(`
      ALTER TABLE patient
        DROP CONSTRAINT patient_ci_ck,
        DROP CONSTRAINT patient_guardian_phone_ck,
        DROP CONSTRAINT patient_phone_ck,
        DROP CONSTRAINT patient_guardian_phone_pair_ck,
        DROP CONSTRAINT patient_guardian_phone_country_ck,
        DROP CONSTRAINT patient_phone_country_ck,
        DROP CONSTRAINT patient_name_keys_ck,
        DROP CONSTRAINT patient_first_surname_ck,
        DROP CONSTRAINT patient_given_names_ck,
        DROP COLUMN ci,
        DROP COLUMN guardian_phone_country_code,
        DROP COLUMN phone_country_code,
        DROP COLUMN second_surname_key,
        DROP COLUMN first_surname_key,
        DROP COLUMN given_names_key,
        DROP COLUMN first_given_name_key,
        DROP COLUMN second_surname,
        DROP COLUMN first_surname,
        DROP COLUMN given_names,
        ALTER COLUMN full_name TYPE varchar(120),
        ALTER COLUMN normalized_name TYPE varchar(120),
        ADD CONSTRAINT patient_phone_check CHECK (phone ~ '^[0-9]{7,15}$'),
        ADD CONSTRAINT patient_guardian_phone_check CHECK (guardian_phone ~ '^[0-9]{7,15}$'),
        ADD CONSTRAINT patient_name_phone_uq UNIQUE (normalized_name, phone)
    `);
  }
}
