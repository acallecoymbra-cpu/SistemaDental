import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminAppointment,
  CompleteAppointmentRequest,
  CancelAppointmentResponse,
  CancelNotice,
} from '@sistema-dental/contracts';
import { CLINIC_TIME_ZONE, SLOT_MINUTES } from '@sistema-dental/contracts';
import { DataSource, QueryFailedError } from 'typeorm';
import { AuditService, RequestContext } from '../audit/audit.service';
import { AgendaService } from './agenda.service';
import { AppointmentHoldsService } from './appointment-holds.service';

const NOT_FOUND = 'La consulta no existe.';
const NO_PROOF = 'Esta consulta aún no tiene comprobante de pago.';
const NOT_RESCHEDULABLE = 'Esta consulta ya no se puede reprogramar.';
const SAME_SLOT = 'Elige un horario distinto al actual.';
const SLOT_NOT_OFFERED =
  'Ese horario no está disponible. Elige una franja de los horarios publicados que aún no pasó.';
const SLOT_TAKEN = 'Esa franja ya está ocupada. Elige otra.';
const NO_SHOW_ONLY_CONFIRMED = 'Solo una consulta confirmada puede marcarse como «no asistió».';
const NO_SHOW_TOO_EARLY = 'Todavía no llegó la hora de la consulta.';
const COMPLETE_ONLY_CONFIRMED = 'Solo una consulta confirmada puede cerrarse.';
const COMPLETE_TOO_EARLY = 'Todavía no llegó la hora de la consulta.';
const NOT_CANCELABLE = 'Esta consulta ya no se puede cancelar.';
const NOT_PENDING = 'Esta consulta ya no está pendiente de pago.';

/**
 * Cambios de estado que hace el dentista sobre una consulta (T-11 en adelante).
 * Cada cambio corre en una transacción con la fila de la cita bloqueada y deja auditoría.
 */
@Injectable()
export class AppointmentActionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly agenda: AgendaService,
    private readonly holds: AppointmentHoldsService,
  ) {}

  /**
   * Confirma el pago (T-11, RF-17): `por_pagar` con comprobante → `confirmada`.
   * Queda quién y cuándo confirmó. No existe «rechazar» (V-17): si algo está mal, la doctora
   * coordina con el paciente por WhatsApp y cancela (T-13).
   * Dos confirmaciones a la vez: la fila se bloquea, gana una y la otra encuentra la consulta
   * ya confirmada y recibe el mismo resultado, sin duplicar la auditoría.
   */
  async confirmPayment(
    id: string,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<AdminAppointment> {
    await this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query<
        { status: string; proof_id: string | null; proof_confirmed: boolean }[]
      >(
        `SELECT a.status, pp.id AS proof_id, (pp.confirmed_at IS NOT NULL) AS proof_confirmed
           FROM appointment a
           LEFT JOIN payment_proof pp ON pp.appointment_id = a.id
          WHERE a.id = $1 FOR UPDATE OF a`,
        [id],
      );
      if (!row) {
        throw new NotFoundException(NOT_FOUND);
      }
      if (row.status === 'confirmada' && row.proof_confirmed) {
        return; // ya confirmada por otra petición: mismo resultado, sin repetir
      }
      if (row.status !== 'por_pagar') {
        throw new ConflictException(NOT_PENDING);
      }
      if (!row.proof_id) {
        throw new ConflictException(NO_PROOF);
      }
      await manager.query(
        `UPDATE payment_proof SET confirmed_at = now(), confirmed_by = $2 WHERE id = $1`,
        [row.proof_id, actorUserId],
      );
      await manager.query(
        `UPDATE appointment SET status = 'confirmada', hold_expires_at = NULL, updated_at = now()
          WHERE id = $1`,
        [id],
      );
      await this.audit.record(
        {
          actorKind: 'dentist',
          actorUserId,
          entityType: 'appointment',
          entityId: id,
          action: 'appointment_payment_confirmed',
          before: { status: 'por_pagar' },
          after: { status: 'confirmada' },
        },
        ctx,
        manager,
      );
    });
    return this.agenda.get(id);
  }

  /**
   * Cancela una consulta (T-13, RF-21): solo `por_pagar` o `confirmada`. La franja queda libre
   * porque la cancelada sale de la restricción de superposición. El anticipo no se devuelve
   * (V-15). Si el paciente tiene correo, el aviso entra a la cola en la MISMA transacción;
   * el envío ocurre aparte, con reintentos, y su fallo nunca deshace la cancelación.
   */
  async cancel(
    id: string,
    reason: string,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<CancelAppointmentResponse> {
    const notice = await this.dataSource.transaction(async (manager): Promise<CancelNotice> => {
      const [row] = await manager.query<{ status: string; email: string | null }[]>(
        `SELECT a.status, p.email
           FROM appointment a JOIN patient p ON p.id = a.patient_id
          WHERE a.id = $1 FOR UPDATE OF a`,
        [id],
      );
      if (!row) {
        throw new NotFoundException(NOT_FOUND);
      }
      if (row.status !== 'por_pagar' && row.status !== 'confirmada') {
        throw new ConflictException(NOT_CANCELABLE);
      }
      await manager.query(
        `UPDATE appointment
            SET status = 'cancelada', cancel_reason = $2, canceled_at = now(),
                canceled_by = $3, refunded = 'no', updated_at = now()
          WHERE id = $1`,
        [id, reason, actorUserId],
      );
      await this.audit.record(
        {
          actorKind: 'dentist',
          actorUserId,
          entityType: 'appointment',
          entityId: id,
          action: 'appointment_canceled',
          before: { status: row.status },
          after: { status: 'cancelada' },
        },
        ctx,
        manager,
      );
      if (!row.email) {
        return 'no_email';
      }
      await manager.query(
        `INSERT INTO email_notification (appointment_id, recipient_email, kind, next_attempt_at)
         VALUES ($1, $2, 'appointment_canceled', now())`,
        [id, row.email],
      );
      return 'queued';
    });
    return { appointment: await this.agenda.get(id), notice };
  }

  /**
   * Reprograma (T-12, RF-18): `por_pagar` o `confirmada` a otra franja LIBRE. Todo en una
   * transacción: la nueva franja debe ser una de los horarios publicados y no haber empezado;
   * la restricción de superposición de la base decide si está ocupada (aunque dos personas
   * pidan la misma a la vez). Se guarda el antes y el después en la auditoría. El estado y el
   * pago no cambian. Los estados finales no se tocan (409, y el disparador de la base lo impide).
   */
  async reschedule(
    id: string,
    startsAt: string,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<AdminAppointment> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const [row] = await manager.query<
          { status: string; starts_at: Date; ends_at: Date; same: boolean }[]
        >(
          `SELECT status, starts_at, ends_at, (starts_at = $2::timestamptz) AS same
             FROM appointment WHERE id = $1 FOR UPDATE`,
          [id, startsAt],
        );
        if (!row) {
          throw new NotFoundException(NOT_FOUND);
        }
        if (row.status !== 'por_pagar' && row.status !== 'confirmada') {
          throw new ConflictException(NOT_RESCHEDULABLE);
        }
        if (row.same) {
          throw new ConflictException(SAME_SLOT);
        }
        const offered = await manager.query<unknown[]>(
          `SELECT 1
             FROM availability_interval ai
            CROSS JOIN LATERAL generate_series(
                    (ai.service_date + ai.starts_local) AT TIME ZONE $2::text,
                    ((ai.service_date + ai.ends_local) AT TIME ZONE $2::text)
                      - make_interval(mins => $3::int),
                    make_interval(mins => $3::int)) AS s(starts_at)
            WHERE ai.service_date = (($1::timestamptz) AT TIME ZONE $2::text)::date
              AND s.starts_at = $1::timestamptz
              AND s.starts_at > now()
            LIMIT 1`,
          [startsAt, CLINIC_TIME_ZONE, SLOT_MINUTES],
        );
        if (offered.length === 0) {
          throw new ConflictException(SLOT_NOT_OFFERED);
        }
        // Una reserva vencida sin comprobante no debe bloquear la franja nueva.
        await this.holds.releaseExpired(manager, ctx, startsAt);
        const [movedRows] = await manager.query<[{ starts_at: Date; ends_at: Date }[], number]>(
          `UPDATE appointment
              SET starts_at = $2::timestamptz,
                  ends_at = $2::timestamptz + make_interval(mins => $3::int),
                  updated_at = now()
            WHERE id = $1
            RETURNING starts_at, ends_at`,
          [id, startsAt, SLOT_MINUTES],
        );
        const moved = movedRows[0];
        if (!moved) {
          throw new ConflictException(SLOT_TAKEN);
        }
        await this.audit.record(
          {
            actorKind: 'dentist',
            actorUserId,
            entityType: 'appointment',
            entityId: id,
            action: 'appointment_rescheduled',
            before: {
              startsAt: new Date(row.starts_at).toISOString(),
              endsAt: new Date(row.ends_at).toISOString(),
            },
            after: {
              startsAt: new Date(moved.starts_at).toISOString(),
              endsAt: new Date(moved.ends_at).toISOString(),
            },
          },
          ctx,
          manager,
        );
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code === '23P01'
      ) {
        throw new ConflictException(SLOT_TAKEN);
      }
      throw error;
    }
    return this.agenda.get(id);
  }

  /**
   * «No asistió» (T-12, RF-19): solo desde `confirmada` y cuando la hora de inicio ya pasó.
   * Es un estado final y el anticipo se retiene (`refunded = 'no'`).
   */
  async markNoShow(
    id: string,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<AdminAppointment> {
    await this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query<{ status: string; started: boolean }[]>(
        `SELECT status, (starts_at <= now()) AS started FROM appointment WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!row) {
        throw new NotFoundException(NOT_FOUND);
      }
      if (row.status !== 'confirmada') {
        throw new ConflictException(NO_SHOW_ONLY_CONFIRMED);
      }
      if (!row.started) {
        throw new ConflictException(NO_SHOW_TOO_EARLY);
      }
      await manager.query(
        `UPDATE appointment SET status = 'no_asistio', refunded = 'no', updated_at = now()
          WHERE id = $1`,
        [id],
      );
      await this.audit.record(
        {
          actorKind: 'dentist',
          actorUserId,
          entityType: 'appointment',
          entityId: id,
          action: 'appointment_no_show',
          before: { status: 'confirmada' },
          after: { status: 'no_asistio' },
        },
        ctx,
        manager,
      );
    });
    return this.agenda.get(id);
  }

  /**
   * Cierra la consulta (T-17, RF-20): solo una `confirmada` cuya hora de inicio ya pasó.
   * Guarda diagnóstico y costo y pasa a `completada` (estado final: queda de solo lectura,
   * lo garantiza el disparador de la base). La auditoría no copia el diagnóstico.
   */
  async complete(
    id: string,
    input: CompleteAppointmentRequest,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<AdminAppointment> {
    await this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query<{ status: string; started: boolean }[]>(
        `SELECT status, (starts_at <= now()) AS started FROM appointment WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!row) {
        throw new NotFoundException(NOT_FOUND);
      }
      if (row.status !== 'confirmada') {
        throw new ConflictException(COMPLETE_ONLY_CONFIRMED);
      }
      if (!row.started) {
        throw new ConflictException(COMPLETE_TOO_EARLY);
      }
      await manager.query(
        `UPDATE appointment
            SET status = 'completada', diagnosis = $2, cost_cents = $3, updated_at = now()
          WHERE id = $1`,
        [id, input.diagnosis, input.costCents],
      );
      await this.audit.record(
        {
          actorKind: 'dentist',
          actorUserId,
          entityType: 'appointment',
          entityId: id,
          action: 'appointment_completed',
          before: { status: 'confirmada' },
          after: { status: 'completada', costCents: input.costCents },
        },
        ctx,
        manager,
      );
    });
    return this.agenda.get(id);
  }
}
