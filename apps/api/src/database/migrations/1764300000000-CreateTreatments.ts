import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B-05 (molde): catálogo de tratamientos (DATA-MODEL.md: treatment) y su semilla.
 * El anticipo NO va aquí: es único para la clínica (V-06, tabla clinic_settings en T-01).
 */
export class CreateTreatments1764300000000 implements MigrationInterface {
  name = 'CreateTreatments1764300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE treatment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(80) NOT NULL CHECK (length(trim(name)) > 0),
        description varchar(500) NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Nombre único sin distinguir mayúsculas: "Limpieza" y "limpieza" son el mismo.
    await queryRunner.query('CREATE UNIQUE INDEX treatment_name_uq ON treatment (lower(name))');

    // Semilla: los siete tratamientos del documento de requisitos v4.2.
    await queryRunner.query(`
      INSERT INTO treatment (name) VALUES
        ('Limpieza'),
        ('Blanqueamiento'),
        ('Exodoncia'),
        ('Prótesis fija'),
        ('Prótesis removible'),
        ('Obturación'),
        ('Cirugía de terceros molares')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE treatment');
  }
}
