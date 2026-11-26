import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cola de correos (DATA-MODEL.md: email_notification, RF-21, T-13). Outbox: el aviso de
 * cancelación se guarda en la misma transacción que la cancelación y un proceso aparte lo envía,
 * con hasta 3 intentos en total. Un fallo de correo nunca deshace la cancelación.
 * No se guarda el texto del correo ni mensajes de error del proveedor, solo un código.
 */
export class CreateEmailNotification1765000000000 implements MigrationInterface {
  name = 'CreateEmailNotification1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE email_notification (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id uuid NOT NULL REFERENCES appointment(id),
        recipient_email varchar(254) NOT NULL,
        kind varchar(24) NOT NULL CHECK (kind IN ('appointment_canceled')),
        delivery_status varchar(8) NOT NULL DEFAULT 'pending'
          CHECK (delivery_status IN ('pending', 'sent', 'failed')),
        attempts int NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
        next_attempt_at timestamptz NULL,
        last_error_code varchar(40) NULL,
        sent_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT email_notification_once_uq UNIQUE (appointment_id, kind)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX email_notification_due_idx ON email_notification (next_attempt_at)
         WHERE delivery_status = 'pending'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE email_notification');
  }
}
