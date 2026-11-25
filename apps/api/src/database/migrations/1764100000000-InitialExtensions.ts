import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Primera migración: extensiones que el modelo necesita.
 * btree_gist permite la restricción de exclusión que impide citas superpuestas (DATA-MODEL.md).
 */
export class InitialExtensions1764100000000 implements MigrationInterface {
  name = 'InitialExtensions1764100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS btree_gist');
  }
}
