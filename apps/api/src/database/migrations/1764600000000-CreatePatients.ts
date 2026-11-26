import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * T-05: pacientes (DATA-MODEL.md: patient, RF-03/22/23).
 * - Único por (nombre normalizado, celular normalizado); mismo celular con otro nombre
 *   es otro paciente (V-02).
 * - Un menor siempre tiene celular de apoderado (V-18), exigido por la base.
 * No hay borrado: los pacientes no se eliminan.
 */
export class CreatePatients1764600000000 implements MigrationInterface {
  name = 'CreatePatients1764600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE patient (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name varchar(120) NOT NULL CHECK (length(trim(full_name)) > 0),
        normalized_name varchar(120) NOT NULL CHECK (length(normalized_name) > 0),
        phone varchar(15) NOT NULL CHECK (phone ~ '^[0-9]{7,15}$'),
        email varchar(254) NULL,
        birth_date date NULL,
        is_minor boolean NOT NULL DEFAULT false,
        guardian_phone varchar(15) NULL CHECK (guardian_phone ~ '^[0-9]{7,15}$'),
        origin varchar(8) NOT NULL CHECK (origin IN ('web', 'dentist')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NULL REFERENCES dentist_user(id),
        CONSTRAINT patient_name_phone_uq UNIQUE (normalized_name, phone),
        CONSTRAINT patient_minor_guardian_ck CHECK (NOT is_minor OR guardian_phone IS NOT NULL)
      )
    `);
    await queryRunner.query('CREATE INDEX patient_phone_idx ON patient (phone)');
    await queryRunner.query('CREATE INDEX patient_guardian_phone_idx ON patient (guardian_phone)');
    await queryRunner.query(
      'CREATE INDEX patient_normalized_name_idx ON patient (normalized_name text_pattern_ops)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE patient');
  }
}
