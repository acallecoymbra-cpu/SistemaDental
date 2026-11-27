import { Injectable } from '@nestjs/common';
import { SLOT_MINUTES } from '@sistema-dental/contracts';
import { EntityManager } from 'typeorm';
import { AuditService, RequestContext } from '../audit/audit.service';

/**
 * Único lugar donde se cancela una reserva vencida (V-21), para que la reserva pública (T-06)
 * y la tarea programada (T-08) apliquen exactamente la misma regla.
 *
 * Vence una cita `por_pagar` con plazo (`hold_expires_at`) ya pasado. Las citas sin plazo
 * (creadas por el dentista) y las confirmadas no se tocan.
 * Una reserva con comprobante enviado (T-07) no vence: espera la confirmación de la doctora.
 */
@Injectable()
export class AppointmentHoldsService {
  constructor(private readonly audit: AuditService) {}

  /**
   * Cancela las reservas vencidas y registra cada una en la auditoría (actor sistema).
   * Con `slotStartsAt` solo las que chocan con esa franja; sin él, todas.
   * Es idempotente: una segunda llamada seguida no encuentra nada que cancelar.
   * Devuelve los ids cancelados.
   */
  async releaseExpired(
    manager: EntityManager,
    ctx: RequestContext = {},
    slotStartsAt?: string,
  ): Promise<string[]> {
    const [rows] = await manager.query<[{ id: string }[], number]>(
      `UPDATE appointment
          SET status = 'cancelada', cancel_reason = 'Reserva vencida',
              canceled_at = now(), updated_at = now()
        WHERE status = 'por_pagar' AND hold_expires_at < now()
          AND NOT EXISTS (SELECT 1 FROM payment_proof pp WHERE pp.appointment_id = appointment.id)
          AND ($1::timestamptz IS NULL OR
               tstzrange(starts_at, ends_at, '[)') &&
               tstzrange($1::timestamptz, $1::timestamptz + make_interval(mins => $2::int), '[)'))
        RETURNING id`,
      [slotStartsAt ?? null, SLOT_MINUTES],
    );
    for (const row of rows) {
      await this.audit.record(
        {
          actorKind: 'system',
          entityType: 'appointment',
          entityId: row.id,
          action: 'appointment_hold_expired',
          after: { status: 'cancelada' },
        },
        ctx,
        manager,
      );
    }
    return rows.map((row) => row.id);
  }
}
