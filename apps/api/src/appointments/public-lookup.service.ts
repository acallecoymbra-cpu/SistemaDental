import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  LOOKUP_BLOCK_MINUTES,
  LOOKUP_MAX_FAILURES,
  LOOKUP_WINDOW_MINUTES,
  normalizePatientName,
  normalizePhone,
  type AppointmentStatus,
  type PublicAppointmentSummary,
} from '@sistema-dental/contracts';
import { DataSource, EntityManager } from 'typeorm';
import { AuditService, RequestContext } from '../audit/audit.service';

/** Un solo mensaje para «no existe», «datos mal escritos» y «sin consultas»: no revela nada. */
const NOT_FOUND = 'No encontramos consultas con esos datos. Revisa tu nombre y tu celular.';
const BLOCKED = `Demasiados intentos. Espera ${LOOKUP_BLOCK_MINUTES} minutos o escríbenos por WhatsApp.`;
const RESULT_LIMIT = 50;
const RETENTION_HOURS = 24;

interface Row {
  starts_at: Date;
  ends_at: Date;
  treatment_name: string;
  status: AppointmentStatus;
  deposit_cents: string;
  has_proof: boolean;
}

/**
 * «Mis consultas» (T-09, CU-03). Sin cuenta: se identifica con nombre + celular (el de la
 * persona o, si es menor, el de su apoderado). Muestra solo lo mínimo de cada consulta.
 *
 * Protección contra adivinar datos: 5 intentos sin resultado en 10 minutos desde el mismo
 * origen bloquean 15 minutos. El origen se guarda como hash. Mientras dura el bloqueo no se
 * consulta nada ni se extiende. Todo corre bajo un candado por origen para que varios
 * intentos simultáneos no se salten el límite.
 */
@Injectable()
export class PublicLookupService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async lookup(
    input: { fullName: string; phone: string },
    ctx: RequestContext,
  ): Promise<PublicAppointmentSummary[]> {
    const origin = this.audit.hashIp(ctx.ip) ?? 'desconocido';
    // Se decide dentro de la transacción, pero el error se lanza DESPUÉS de confirmarla: si se
    // lanzara adentro, se desharía el registro del intento fallido y el límite nunca se alcanzaría.
    const outcome = await this.dataSource.transaction(
      async (manager): Promise<'blocked' | 'not_found' | PublicAppointmentSummary[]> => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [origin]);

        const [blocked] = await manager.query<{ until: Date | null }[]>(
          `SELECT max(blocked_until) AS until FROM public_lookup_attempt
            WHERE origin_hash = $1 AND blocked_until > now()`,
          [origin],
        );
        if (blocked?.until) {
          return 'blocked';
        }

        const rows = await this.find(manager, input);
        if (rows.length > 0) {
          await this.registerAttempt(manager, origin, true);
          return rows.map(toSummary);
        }
        await this.registerFailure(manager, origin, ctx);
        return 'not_found';
      },
    );
    if (outcome === 'blocked') {
      throw new HttpException(BLOCKED, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (outcome === 'not_found') {
      throw new NotFoundException(NOT_FOUND);
    }
    return outcome;
  }

  private find(manager: EntityManager, input: { fullName: string; phone: string }): Promise<Row[]> {
    const phone = normalizePhone(input.phone);
    return manager.query<Row[]>(
      `SELECT a.starts_at, a.ends_at, a.status, a.deposit_cents, t.name AS treatment_name,
              EXISTS (SELECT 1 FROM payment_proof pp WHERE pp.appointment_id = a.id) AS has_proof
         FROM appointment a
         JOIN patient p ON p.id = a.patient_id
         JOIN treatment t ON t.id = a.treatment_id
        WHERE p.normalized_name = $1 AND (p.phone = $2 OR p.guardian_phone = $2)
        ORDER BY a.starts_at DESC
        LIMIT ${RESULT_LIMIT}`,
      [normalizePatientName(input.fullName), phone],
    );
  }

  private async registerAttempt(
    manager: EntityManager,
    origin: string,
    successful: boolean,
    blockedUntilNow = false,
  ): Promise<void> {
    await manager.query(
      `DELETE FROM public_lookup_attempt
        WHERE attempted_at < now() - make_interval(hours => $1::int)`,
      [RETENTION_HOURS],
    );
    await manager.query(
      `INSERT INTO public_lookup_attempt (origin_hash, successful, blocked_until)
       VALUES ($1, $2, CASE WHEN $3::boolean
                            THEN now() + make_interval(mins => $4::int) END)`,
      [origin, successful, blockedUntilNow, LOOKUP_BLOCK_MINUTES],
    );
  }

  private async registerFailure(
    manager: EntityManager,
    origin: string,
    ctx: RequestContext,
  ): Promise<void> {
    const [recent] = await manager.query<{ failures: string }[]>(
      `SELECT count(*) AS failures FROM public_lookup_attempt
        WHERE origin_hash = $1 AND successful = false
          AND attempted_at >= now() - make_interval(mins => $2::int)`,
      [origin, LOOKUP_WINDOW_MINUTES],
    );
    // Con este intento ya suman los fallos de la ventana.
    const reachesLimit = Number(recent?.failures ?? 0) + 1 >= LOOKUP_MAX_FAILURES;
    await this.registerAttempt(manager, origin, false, reachesLimit);
    if (reachesLimit) {
      await this.audit.record(
        {
          actorKind: 'anonymous',
          entityType: 'public_lookup',
          action: 'public_lookup_blocked',
        },
        ctx,
        manager,
      );
    }
  }
}

function toSummary(row: Row): PublicAppointmentSummary {
  return {
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    treatmentName: row.treatment_name,
    status: row.status,
    depositCents: Number(row.deposit_cents),
    paymentReceived: row.has_proof,
  };
}
