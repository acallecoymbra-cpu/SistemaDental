import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AVAILABILITY_MIN_MINUTES,
  CLINIC_TIME_ZONE,
  SLOT_MINUTES,
  todayInClinicTimeZone,
  type AvailabilityInterval as AvailabilityIntervalView,
  type AvailableSlotsResponse,
} from '@sistema-dental/contracts';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { AuditService, RequestContext } from '../audit/audit.service';
import type {
  CreateAvailabilityIntervalDto,
  UpdateAvailabilityIntervalDto,
} from './availability-interval.dto';
import { AvailabilityInterval } from './availability-interval.entity';

const NOT_FOUND = 'El intervalo de atención no existe.';
const OVERLAP = 'Ya existe un intervalo de atención que se superpone con ese horario.';
const INVALID_DATE = 'La fecha no es válida.';
const INVALID_ORDER = 'La hora de fin debe ser posterior a la hora de inicio.';
const TOO_SHORT = `El intervalo debe durar al menos ${AVAILABILITY_MIN_MINUTES} minutos.`;
const HAS_CONFIRMED =
  'No se puede cambiar ni eliminar este horario: hay una consulta confirmada que quedaría fuera.';

/** Códigos de PostgreSQL: violación de exclusión (superposición) y de CHECK. */
const PG_EXCLUSION_VIOLATION = '23P01';
const PG_CHECK_VIOLATION = '23514';

function pgCode(error: unknown): string | undefined {
  return error instanceof QueryFailedError
    ? (error.driverError as { code?: string } | undefined)?.code
    : undefined;
}

/** `HH:mm:ss` -> `HH:mm`. */
function toHm(time: string): string {
  return time.slice(0, 5);
}

function toMinutes(hm: string): number {
  const [hours, minutes] = hm.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Acepta solo fechas que existen (rechaza 2026-02-30 aunque tenga buen formato). */
function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Reglas del intervalo. La base las vuelve a exigir con CHECK; esto da mensajes claros. */
function assertValidInterval(serviceDate: string, startsLocal: string, endsLocal: string): void {
  if (!isRealDate(serviceDate)) {
    throw new BadRequestException(INVALID_DATE);
  }
  const length = toMinutes(endsLocal) - toMinutes(startsLocal);
  if (length <= 0) {
    throw new BadRequestException(INVALID_ORDER);
  }
  if (length < AVAILABILITY_MIN_MINUTES) {
    throw new BadRequestException(TOO_SHORT);
  }
}

/** Convierte la entidad a lo que ve el panel (horas `HH:mm`, fechas en ISO). */
export function toAvailabilityInterval(row: AvailabilityInterval): AvailabilityIntervalView {
  return {
    id: row.id,
    serviceDate: row.serviceDate,
    startsLocal: toHm(row.startsLocal),
    endsLocal: toHm(row.endsLocal),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Campos que se guardan en la auditoría (antes/después). */
function auditSnapshot(row: AvailabilityInterval): Record<string, unknown> {
  return {
    serviceDate: row.serviceDate,
    startsLocal: toHm(row.startsLocal),
    endsLocal: toHm(row.endsLocal),
  };
}

interface IntervalTimes {
  serviceDate: string;
  startsLocal: string;
  endsLocal: string;
}

/**
 * Rechaza (409) si hay una cita `confirmada` dentro del intervalo anterior que no cabría
 * completa en el intervalo nuevo (`next = null` significa que el intervalo se elimina).
 * Las horas locales de La Paz se convierten a instantes en la base.
 */
async function assertNoConfirmedLeftOutside(
  manager: EntityManager,
  previous: IntervalTimes,
  next: IntervalTimes | null,
): Promise<void> {
  const rows: unknown[] = await manager.query(
    `SELECT 1
       FROM appointment a
      WHERE a.status = 'confirmada'
        AND tstzrange(a.starts_at, a.ends_at, '[)') &&
            tstzrange(($1::date + $2::time) AT TIME ZONE $3::text,
                      ($1::date + $4::time) AT TIME ZONE $3::text, '[)')
        AND ($5::date IS NULL OR NOT
             (tstzrange(($5::date + $6::time) AT TIME ZONE $3::text,
                        ($5::date + $7::time) AT TIME ZONE $3::text, '[)')
              @> tstzrange(a.starts_at, a.ends_at, '[)')))
      LIMIT 1`,
    [
      previous.serviceDate,
      previous.startsLocal,
      CLINIC_TIME_ZONE,
      previous.endsLocal,
      next?.serviceDate ?? null,
      next?.startsLocal ?? null,
      next?.endsLocal ?? null,
    ],
  );
  if (rows.length > 0) {
    throw new ConflictException(HAS_CONFIRMED);
  }
}

/** Traduce errores de la base a respuestas HTTP claras; el resto se relanza. */
function translateDatabaseError(error: unknown): never {
  const code = pgCode(error);
  if (code === PG_EXCLUSION_VIOLATION) {
    throw new ConflictException(OVERLAP);
  }
  if (code === PG_CHECK_VIOLATION) {
    throw new BadRequestException(TOO_SHORT);
  }
  throw error;
}

/**
 * Lógica de los intervalos de atención (T-02). Mismo patrón del molde `treatments`:
 * 1. Toda escritura va en UNA transacción junto con su registro de auditoría.
 * 2. Errores esperados -> 400, 404 y 409.
 * 3. La superposición la decide la base (restricción de exclusión), no el código.
 *
 * Regla de citas: no se puede reducir, mover ni eliminar un intervalo si una cita
 * `confirmada` quedaría fuera de él (409). Se revisa dentro de la misma transacción.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Panel: todos, por fecha y hora de inicio. */
  async list(): Promise<AvailabilityIntervalView[]> {
    const rows = await this.dataSource.getRepository(AvailabilityInterval).find({
      order: { serviceDate: 'ASC', startsLocal: 'ASC' },
    });
    return rows.map(toAvailabilityInterval);
  }

  /**
   * Portal público (T-03): franjas libres de una fecha, cada 45 min dentro de cada intervalo.
   * - Solo desde el día siguiente en La Paz: hoy y el pasado devuelven lista vacía. Con
   *   `includeToday` (panel del dentista, T-12) también se ofrecen las franjas de hoy que aún no empezaron.
   * - Ocupan franja las citas `confirmada`, `completada` y `no_asistio`, y las `por_pagar`
   *   con reserva vigente (o sin plazo). Una reserva vencida libera su franja.
   * - La última franja cabe completa en el intervalo.
   * Una `por_pagar` con comprobante enviado sigue ocupando la franja aunque su plazo haya pasado.
   */
  async listSlots(
    date: string,
    options: { includeToday?: boolean } = {},
  ): Promise<AvailableSlotsResponse> {
    if (!isRealDate(date)) {
      throw new BadRequestException(INVALID_DATE);
    }
    const today = todayInClinicTimeZone();
    if (options.includeToday ? date < today : date <= today) {
      return { date, slots: [] };
    }
    const rows: { starts_at: Date; starts_local: string }[] = await this.dataSource.query(
      `SELECT s.starts_at,
              to_char(s.starts_at AT TIME ZONE $2::text, 'HH24:MI') AS starts_local
         FROM availability_interval ai
        CROSS JOIN LATERAL generate_series(
                (ai.service_date + ai.starts_local) AT TIME ZONE $2::text,
                ((ai.service_date + ai.ends_local) AT TIME ZONE $2::text)
                  - make_interval(mins => $3::int),
                make_interval(mins => $3::int)) AS s(starts_at)
        WHERE ai.service_date = $1::date
          AND s.starts_at > now()
          AND NOT EXISTS (
                SELECT 1 FROM appointment a
                 WHERE (a.status IN ('confirmada', 'completada', 'no_asistio')
                        OR (a.status = 'por_pagar'
                            AND (a.hold_expires_at IS NULL OR a.hold_expires_at >= now()
                                 OR EXISTS (SELECT 1 FROM payment_proof pp
                                             WHERE pp.appointment_id = a.id))))
                   AND a.starts_at < s.starts_at + make_interval(mins => $3::int)
                   AND a.ends_at > s.starts_at)
        ORDER BY s.starts_at`,
      [date, CLINIC_TIME_ZONE, SLOT_MINUTES],
    );
    return {
      date,
      slots: rows.map((row) => ({
        startsAt: new Date(row.starts_at).toISOString(),
        startsLocal: row.starts_local,
      })),
    };
  }

  async create(
    dto: CreateAvailabilityIntervalDto,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<AvailabilityIntervalView> {
    assertValidInterval(dto.serviceDate, dto.startsLocal, dto.endsLocal);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const saved = await manager.getRepository(AvailabilityInterval).save({
          serviceDate: dto.serviceDate,
          startsLocal: dto.startsLocal,
          endsLocal: dto.endsLocal,
          createdBy: actorUserId,
        });
        await this.audit.record(
          {
            actorKind: 'dentist',
            actorUserId,
            entityType: 'availability_interval',
            entityId: saved.id,
            action: 'availability_interval_created',
            after: auditSnapshot(saved),
          },
          ctx,
          manager,
        );
        return toAvailabilityInterval(saved);
      });
    } catch (error) {
      return translateDatabaseError(error);
    }
  }

  async update(
    id: string,
    dto: UpdateAvailabilityIntervalDto,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<AvailabilityIntervalView> {
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(AvailabilityInterval);
        // FOR UPDATE: si dos ediciones llegan a la vez, la segunda espera a la primera.
        const current = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!current) {
          return null;
        }
        const before = auditSnapshot(current);
        const previous: IntervalTimes = {
          serviceDate: current.serviceDate,
          startsLocal: current.startsLocal,
          endsLocal: current.endsLocal,
        };
        if (dto.serviceDate !== undefined) current.serviceDate = dto.serviceDate;
        if (dto.startsLocal !== undefined) current.startsLocal = dto.startsLocal;
        if (dto.endsLocal !== undefined) current.endsLocal = dto.endsLocal;
        // Se valida el resultado final (lo guardado + lo enviado), no solo lo enviado.
        assertValidInterval(
          current.serviceDate,
          toHm(current.startsLocal),
          toHm(current.endsLocal),
        );
        await assertNoConfirmedLeftOutside(manager, previous, {
          serviceDate: current.serviceDate,
          startsLocal: current.startsLocal,
          endsLocal: current.endsLocal,
        });
        const saved = await repo.save(current);
        const after = auditSnapshot(saved);
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          await this.audit.record(
            {
              actorKind: 'dentist',
              actorUserId,
              entityType: 'availability_interval',
              entityId: id,
              action: 'availability_interval_updated',
              before,
              after,
            },
            ctx,
            manager,
          );
        }
        return toAvailabilityInterval(saved);
      });
      if (!result) {
        throw new NotFoundException(NOT_FOUND);
      }
      return result;
    } catch (error) {
      return translateDatabaseError(error);
    }
  }

  /**
   * Elimina el intervalo (T-02 lo pide expresamente). Es configuración de horario, no un
   * dato histórico: la auditoría conserva cómo era (`before`).
   */
  async remove(id: string, actorUserId: string, ctx: RequestContext): Promise<void> {
    const removed = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AvailabilityInterval);
      const current = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!current) {
        return false;
      }
      const before = auditSnapshot(current);
      await assertNoConfirmedLeftOutside(
        manager,
        {
          serviceDate: current.serviceDate,
          startsLocal: current.startsLocal,
          endsLocal: current.endsLocal,
        },
        null,
      );
      await repo.delete({ id });
      await this.audit.record(
        {
          actorKind: 'dentist',
          actorUserId,
          entityType: 'availability_interval',
          entityId: id,
          action: 'availability_interval_deleted',
          before,
        },
        ctx,
        manager,
      );
      return true;
    });
    if (!removed) {
      throw new NotFoundException(NOT_FOUND);
    }
  }
}
