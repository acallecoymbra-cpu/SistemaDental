import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia clínica por versiones (T-15, RF-24). Una `clinical_record` por paciente y versiones
 * numeradas e inmutables: el disparador impide UPDATE y DELETE (error 23514).
 */
export class CreateClinicalHistory1765100000000 implements MigrationInterface {
  name = 'CreateClinicalHistory1765100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE clinical_record (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL UNIQUE REFERENCES patient(id),
        created_by uuid NULL REFERENCES dentist_user(id),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE clinical_version (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        clinical_record_id uuid NOT NULL REFERENCES clinical_record(id),
        version_number int NOT NULL CHECK (version_number >= 1),
        anamnesis text NOT NULL DEFAULT '' CHECK (char_length(anamnesis) <= 5000),
        dental_index_type varchar(40) NOT NULL DEFAULT '',
        dental_index_value varchar(40) NOT NULL DEFAULT '',
        diagnosis text NOT NULL DEFAULT '' CHECK (char_length(diagnosis) <= 2000),
        created_by uuid NOT NULL REFERENCES dentist_user(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (clinical_record_id, version_number)
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION clinical_version_block_change() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'Las versiones de la historia clínica no se modifican ni se borran.'
          USING ERRCODE = '23514';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER clinical_version_immutable
        BEFORE UPDATE OR DELETE ON clinical_version
        FOR EACH ROW EXECUTE FUNCTION clinical_version_block_change()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE clinical_version');
    await queryRunner.query('DROP FUNCTION clinical_version_block_change()');
    await queryRunner.query('DROP TABLE clinical_record');
  }
}
