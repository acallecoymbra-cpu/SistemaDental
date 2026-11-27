import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Citas (DATA-MODEL.md: appointment, RF-02/04/05/06/16–20/26).
 * Las reglas críticas viven en la base:
 * - franja fija de 45 min (V-20);
 * - dos citas que ocupan franja no se superponen (V-09, V-21): restricción de exclusión sobre
 *   `por_pagar`, `confirmada`, `completada` y `no_asistio`. Como la restricción no puede usar
 *   `now()`, quien crea una reserva primero cancela las `por_pagar` vencidas que choquen (T-06);
 * - un estado terminal no se modifica (disparador).
 *
 */
export class CreateAppointments1764700000000 implements MigrationInterface {
  name = 'CreateAppointments1764700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE appointment_status AS ENUM
        ('por_pagar', 'confirmada', 'completada', 'cancelada', 'no_asistio')
    `);
    await queryRunner.query(`
      CREATE TABLE appointment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES patient(id),
        treatment_id uuid NOT NULL REFERENCES treatment(id),
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        status appointment_status NOT NULL,
        deposit_cents bigint NOT NULL CHECK (deposit_cents >= 0),
        diagnosis text NULL,
        cost_cents bigint NULL CHECK (cost_cents >= 0),
        currency char(3) NOT NULL DEFAULT 'BOB' CHECK (currency = 'BOB'),
        refunded varchar(14) NULL CHECK (refunded IN ('yes', 'no', 'not_applicable')),
        cancel_reason text NULL,
        origin varchar(8) NOT NULL CHECK (origin IN ('web', 'dentist')),
        hold_expires_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz NULL,
        completed_by uuid NULL REFERENCES dentist_user(id),
        canceled_at timestamptz NULL,
        canceled_by uuid NULL REFERENCES dentist_user(id),
        CONSTRAINT appointment_slot_length_ck CHECK (ends_at = starts_at + interval '45 minutes'),
        CONSTRAINT appointment_no_overlap_ex EXCLUDE USING gist (
          tstzrange(starts_at, ends_at, '[)') WITH &&
        ) WHERE (status IN ('por_pagar', 'confirmada', 'completada', 'no_asistio'))
      )
    `);
    await queryRunner.query(
      'CREATE INDEX appointment_starts_status_idx ON appointment (starts_at, status)',
    );
    await queryRunner.query(
      'CREATE INDEX appointment_patient_idx ON appointment (patient_id, starts_at)',
    );
    await queryRunner.query(`
      CREATE FUNCTION appointment_block_terminal_update() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'La consulta está en un estado final y no se puede modificar.'
          USING ERRCODE = '23514';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER appointment_terminal_immutable
        BEFORE UPDATE ON appointment
        FOR EACH ROW
        WHEN (OLD.status IN ('completada', 'cancelada', 'no_asistio'))
        EXECUTE FUNCTION appointment_block_terminal_update()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE appointment');
    await queryRunner.query('DROP FUNCTION appointment_block_terminal_update()');
    await queryRunner.query('DROP TYPE appointment_status');
  }
}
