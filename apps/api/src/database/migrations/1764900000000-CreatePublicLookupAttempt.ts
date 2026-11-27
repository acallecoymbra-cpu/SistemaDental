import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Protección de «Mis consultas» (DATA-MODEL.md: public_lookup_attempt, RF-09, T-09).
 * Guarda solo un hash del origen (nunca la IP en claro) y si el intento acertó. Regla: 5 fallos
 * en 10 minutos bloquean 15 minutos. Las filas viejas se borran al registrar intentos nuevos.
 */
export class CreatePublicLookupAttempt1764900000000 implements MigrationInterface {
  name = 'CreatePublicLookupAttempt1764900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE public_lookup_attempt (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        origin_hash varchar(64) NOT NULL,
        attempted_at timestamptz NOT NULL DEFAULT now(),
        successful boolean NOT NULL,
        blocked_until timestamptz NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX public_lookup_attempt_origin_idx ON public_lookup_attempt (origin_hash, attempted_at)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE public_lookup_attempt');
  }
}
