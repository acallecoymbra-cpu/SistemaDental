import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * T-01: configuración única de la clínica (DATA-MODEL.md: clinic_settings, V-06).
 * Una sola fila, garantizada por la base. El anticipo es único para todas las consultas
 * y va entre 10 y 20 Bs. La fila inicial usa el precio acordado (30 Bs) y el anticipo
 * MÍNIMO permitido; el dentista lo ajusta desde el panel.
 */
export class CreateClinicSettings1764500000000 implements MigrationInterface {
  name = 'CreateClinicSettings1764500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE clinic_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        consultation_price_cents bigint NOT NULL,
        deposit_cents bigint NOT NULL,
        currency char(3) NOT NULL DEFAULT 'BOB',
        payment_qr_ref varchar(500) NULL,
        whatsapp_phone varchar(16) NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NULL REFERENCES dentist_user(id),
        CONSTRAINT clinic_settings_currency_ck CHECK (currency = 'BOB'),
        CONSTRAINT clinic_settings_price_ck CHECK (consultation_price_cents > 0),
        CONSTRAINT clinic_settings_deposit_range_ck
          CHECK (deposit_cents BETWEEN 1000 AND 2000),
        CONSTRAINT clinic_settings_deposit_le_price_ck
          CHECK (deposit_cents <= consultation_price_cents)
      )
    `);
    // Una sola fila: índice único sobre una constante.
    await queryRunner.query(
      'CREATE UNIQUE INDEX clinic_settings_single_row_uq ON clinic_settings ((true))',
    );
    await queryRunner.query(`
      INSERT INTO clinic_settings (consultation_price_cents, deposit_cents)
      VALUES (3000, 1000)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE clinic_settings');
  }
}
