import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * T-02: horarios de atención por fecha (DATA-MODEL.md: availability_interval, RF-02/14).
 * Las reglas viven en la base, no solo en el código: fin posterior al inicio, mínimo una
 * franja de 45 min (V-20) y ningún intervalo superpuesto en la misma fecha.
 * La regla «no reducir un intervalo dejando fuera una cita confirmada» se valida en el
 * servicio, porque la tabla de citas llega en una tarea posterior.
 */
export class CreateAvailabilityIntervals1764400000000 implements MigrationInterface {
  name = 'CreateAvailabilityIntervals1764400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE availability_interval (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        service_date date NOT NULL,
        starts_local time NOT NULL,
        ends_local time NOT NULL,
        created_by uuid NOT NULL REFERENCES dentist_user(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT availability_interval_order_ck CHECK (ends_local > starts_local),
        CONSTRAINT availability_interval_min_length_ck
          CHECK (ends_local - starts_local >= interval '45 minutes'),
        -- Sin superposición por fecha. Rango semiabierto [inicio, fin): 08:00-12:00 y
        -- 12:00-14:00 se tocan pero no se superponen.
        CONSTRAINT availability_interval_no_overlap_ex EXCLUDE USING gist (
          tsrange(service_date + starts_local, service_date + ends_local, '[)') WITH &&
        )
      )
    `);
    await queryRunner.query(
      'CREATE INDEX availability_interval_service_date_idx ON availability_interval (service_date)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE availability_interval');
  }
}
