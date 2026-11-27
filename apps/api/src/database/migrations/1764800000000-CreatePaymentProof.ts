import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Comprobante de pago del anticipo (DATA-MODEL.md: payment_proof, RF-06, T-07).
 * - Una consulta tiene a lo sumo un comprobante (`appointment_id` único).
 * - El número de comprobante no se repite nunca, ni entre consultas distintas (V-11);
 *   se guarda normalizado (mayúsculas, sin espacios).
 * - `confirmed_at` y `confirmed_by` los llena la doctora al confirmar (T-11): van juntos.
 */
export class CreatePaymentProof1764800000000 implements MigrationInterface {
  name = 'CreatePaymentProof1764800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payment_proof (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id uuid NOT NULL REFERENCES appointment(id),
        receipt_number varchar(30) NOT NULL,
        submitted_at timestamptz NOT NULL DEFAULT now(),
        confirmed_at timestamptz NULL,
        confirmed_by uuid NULL REFERENCES dentist_user(id),
        CONSTRAINT payment_proof_appointment_uq UNIQUE (appointment_id),
        CONSTRAINT payment_proof_receipt_uq UNIQUE (receipt_number),
        CONSTRAINT payment_proof_receipt_format_ck
          CHECK (receipt_number ~ '^[A-Z0-9-]{4,30}$'),
        CONSTRAINT payment_proof_confirmation_ck
          CHECK ((confirmed_at IS NULL) = (confirmed_by IS NULL))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE payment_proof');
  }
}
