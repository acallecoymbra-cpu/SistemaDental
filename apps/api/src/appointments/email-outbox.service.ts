import { Injectable, Logger } from '@nestjs/common';
import { CLINIC_TIME_ZONE, EMAIL_MAX_ATTEMPTS } from '@sistema-dental/contracts';
import { DataSource } from 'typeorm';
import { MailError, Mailer } from '../mail/mailer';

const BATCH_SIZE = 20;
const SEND_TIMEOUT_MS = 10_000;
/** Espera antes del 2.º y del 3.º intento, en minutos. */
const RETRY_DELAY_MINUTES = [1, 5];

interface DueRow {
  id: string;
  attempts: number;
  recipient_email: string;
  starts_at: Date;
  patient_name: string;
  treatment_name: string;
  whatsapp_phone: string | null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new MailError('timeout', 'Tiempo agotado.')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function errorCode(error: unknown): string {
  return error instanceof MailError ? error.code : 'send_failed';
}

/**
 * Envía los avisos pendientes de la cola (T-13). Hasta `EMAIL_MAX_ATTEMPTS` intentos en total
 * (el primero cuenta), con espera creciente. Idempotente y segura con varias instancias
 * (`FOR UPDATE SKIP LOCKED`): un aviso lo toma un solo proceso. Guarda solo un código de error.
 */
@Injectable()
export class EmailOutboxService {
  private readonly logger = new Logger(EmailOutboxService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailer: Mailer,
  ) {}

  /** Una pasada. Devuelve cuántos avisos se enviaron. */
  async processDue(): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<DueRow[]>(
        `SELECT n.id, n.attempts, n.recipient_email, a.starts_at,
                p.full_name AS patient_name, t.name AS treatment_name,
                (SELECT whatsapp_phone FROM clinic_settings LIMIT 1) AS whatsapp_phone
           FROM email_notification n
           JOIN appointment a ON a.id = n.appointment_id
           JOIN patient p ON p.id = a.patient_id
           JOIN treatment t ON t.id = a.treatment_id
          WHERE n.delivery_status = 'pending' AND n.next_attempt_at <= now()
          ORDER BY n.created_at
          LIMIT ${BATCH_SIZE}
          FOR UPDATE OF n SKIP LOCKED`,
      );
      let sent = 0;
      for (const row of rows) {
        const attempts = row.attempts + 1;
        try {
          await withTimeout(this.mailer.send(this.compose(row)), SEND_TIMEOUT_MS);
          await manager.query(
            `UPDATE email_notification
                SET delivery_status = 'sent', attempts = $2, sent_at = now(),
                    next_attempt_at = NULL, last_error_code = NULL
              WHERE id = $1`,
            [row.id, attempts],
          );
          sent += 1;
        } catch (error) {
          const exhausted = attempts >= EMAIL_MAX_ATTEMPTS;
          const delay = RETRY_DELAY_MINUTES[attempts - 1] ?? RETRY_DELAY_MINUTES.at(-1)!;
          await manager.query(
            `UPDATE email_notification
                SET attempts = $2, last_error_code = $3,
                    delivery_status = CASE WHEN $4::boolean THEN 'failed' ELSE 'pending' END,
                    next_attempt_at = CASE WHEN $4::boolean THEN NULL
                                           ELSE now() + make_interval(mins => $5::int) END
              WHERE id = $1`,
            [row.id, attempts, errorCode(error), exhausted, delay],
          );
          this.logger.warn(
            `Aviso ${row.id}: intento ${attempts}/${EMAIL_MAX_ATTEMPTS} fallido (${errorCode(error)})`,
          );
        }
      }
      return sent;
    });
  }

  private compose(row: DueRow) {
    const when = new Intl.DateTimeFormat('es-BO', {
      timeZone: CLINIC_TIME_ZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(row.starts_at));
    const phone = (row.whatsapp_phone ?? '').replace(/\D/g, '');
    const contact = phone
      ? `Para reprogramar o consultar, escríbenos por WhatsApp: https://wa.me/${phone}`
      : 'Para reprogramar o consultar, comunícate con el consultorio.';
    return {
      to: row.recipient_email,
      subject: 'Tu consulta en Renovando Sonrisas fue cancelada',
      text: `Hola ${row.patient_name},\n\nTu consulta de ${row.treatment_name} del ${when} fue cancelada.\n\n${contact}\n\nRenovando Sonrisas`,
    };
  }
}
