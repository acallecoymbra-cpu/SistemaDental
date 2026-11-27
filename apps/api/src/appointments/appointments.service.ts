import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BOOKING_HOLD_MINUTES,
  CLINIC_TIME_ZONE,
  MAX_PENDING_APPOINTMENTS_PER_PATIENT,
  SLOT_MINUTES,
  normalizeReceiptNumber,
  type BookingPatientRequest,
  type PaymentProofReceived,
  type PublicBooking,
} from '@sistema-dental/contracts';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { AuditService, RequestContext } from '../audit/audit.service';
import {
  PATIENT_CI_CONSTRAINT,
  PatientsService,
  RETURNING_NOT_FOUND,
  WEB_REGISTRATION_FAILED,
  isUniqueViolation,
  violatedConstraint,
} from '../patients/patients.service';
import { AppointmentHoldsService } from './appointment-holds.service';
import { BLOCKED, PublicLookupService } from './public-lookup.service';
import type { CreatePublicBookingDto, SubmitPaymentProofDto } from './booking.dto';

const NO_TREATMENT = 'El tratamiento no está disponible.';
const SLOT_UNAVAILABLE = 'Ese horario ya no está disponible. Elige otro.';
const TOO_MANY_PENDING = `Ya tienes ${MAX_PENDING_APPOINTMENTS_PER_PATIENT} consultas pendientes de pago. Completa o espera a que venzan antes de reservar otra.`;

const NOT_FOUND = 'No encontramos esa reserva.';
const HOLD_EXPIRED =
  'La reserva venció y el horario se liberó. Escríbenos por WhatsApp para ayudarte con tu pago.';
const NOT_PENDING = 'Esta consulta ya no está pendiente de pago.';
const PROOF_ALREADY_SENT =
  'Ya enviaste el comprobante de esta consulta. La doctora lo revisará y la confirmará.';
const RECEIPT_REUSED =
  'Ese número de comprobante ya fue registrado. Revísalo o escríbenos por WhatsApp.';

const PG_EXCLUSION_VIOLATION = '23P01';
const PG_UNIQUE_VIOLATION = '23505';

function pgCode(error: unknown): string | undefined {
  return error instanceof QueryFailedError
    ? (error.driverError as { code?: string } | undefined)?.code
    : undefined;
}

/**
 * Citas: reserva pública (T-06) y comprobante de pago (T-07). La agenda es de `AgendaService`.
 *
 * Reserva: crea la consulta `por_pagar` y aparta la franja 8 minutos. Todo en UNA transacción:
 * 1. el tratamiento existe y está activo;
 * 2. la franja es una de las que ofrece `GET /availability/slots` (grilla de 45 min dentro
 *    de un intervalo, desde mañana en La Paz);
 * 3. el paciente se reconoce o se crea, y se bloquea su fila (sus reservas simultáneas se ordenan);
 * 4. máximo 3 pendientes por paciente;
 * 5. se cancelan las reservas vencidas que chocan con la franja (la restricción de la base no
 *    puede usar `now()`), y se inserta. Si dos pacientes piden la misma franja a la vez,
 *    la restricción de exclusión deja pasar a uno y el otro recibe 409.
 */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly patients: PatientsService,
    private readonly holds: AppointmentHoldsService,
    private readonly lookups: PublicLookupService,
  ) {}

  async createPublicBooking(
    dto: CreatePublicBookingDto,
    ctx: RequestContext,
  ): Promise<PublicBooking> {
    // Dos personas nuevas con el mismo nombre y celular a la vez: una pierde la carrera al
    // crear al paciente; se repite una vez y ya lo encuentra.
    for (let attempt = 0; ; attempt += 1) {
      try {
        const outcome = await this.dataSource.transaction((manager) =>
          this.book(manager, dto, ctx),
        );
        // Los errores del límite se lanzan DESPUÉS de confirmar, para no deshacer el intento.
        if (outcome === 'blocked') {
          throw new HttpException(BLOCKED, HttpStatus.TOO_MANY_REQUESTS);
        }
        if (outcome === 'not_found') {
          throw new BadRequestException(RETURNING_NOT_FOUND);
        }
        return outcome;
      } catch (error) {
        // CI repetido: error genérico, sin revelar que ese CI existe.
        if (isUniqueViolation(error) && violatedConstraint(error) === PATIENT_CI_CONSTRAINT) {
          throw new BadRequestException(WEB_REGISTRATION_FAILED);
        }
        if (isUniqueViolation(error) && attempt === 0) {
          continue;
        }
        if (pgCode(error) === PG_EXCLUSION_VIOLATION) {
          throw new ConflictException(SLOT_UNAVAILABLE);
        }
        throw error;
      }
    }
  }

  private async book(
    manager: EntityManager,
    dto: CreatePublicBookingDto,
    ctx: RequestContext,
  ): Promise<PublicBooking | 'blocked' | 'not_found'> {
    // «Ya estoy registrado» comparte el límite de intentos de «Mis consultas» (RF-09): mismo
    // origen, mismo candado y mismo bloqueo.
    const returning = dto.patient.kind === 'returning';
    const origin = this.lookups.originOf(ctx);
    if (returning && (await this.lookups.lockAndCheckBlocked(manager, origin))) {
      return 'blocked';
    }

    const [treatment] = await manager.query<{ id: string; name: string }[]>(
      'SELECT id, name FROM treatment WHERE id = $1 AND active = true',
      [dto.treatmentId],
    );
    if (!treatment) {
      throw new NotFoundException(NO_TREATMENT);
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
          AND ai.service_date > (now() AT TIME ZONE $2::text)::date
          AND s.starts_at = $1::timestamptz
        LIMIT 1`,
      [dto.startsAt, CLINIC_TIME_ZONE, SLOT_MINUTES],
    );
    if (offered.length === 0) {
      throw new ConflictException(SLOT_UNAVAILABLE);
    }

    let patient;
    try {
      patient = await this.patients.findOrCreateForBooking(
        manager,
        dto.patient as unknown as BookingPatientRequest,
      );
    } catch (error) {
      if (
        returning &&
        error instanceof BadRequestException &&
        error.message === RETURNING_NOT_FOUND
      ) {
        // Hasta aquí la transacción solo leyó: se confirma con el intento fallido registrado.
        await this.lookups.registerFailure(manager, origin, ctx);
        return 'not_found';
      }
      throw error;
    }

    const [counted] = await manager.query<{ pending: string }[]>(
      `SELECT count(*) AS pending FROM appointment
        WHERE patient_id = $1 AND status = 'por_pagar'
          AND (hold_expires_at IS NULL OR hold_expires_at >= now()
               OR EXISTS (SELECT 1 FROM payment_proof pp WHERE pp.appointment_id = appointment.id))`,
      [patient.id],
    );
    if (Number(counted?.pending ?? 0) >= MAX_PENDING_APPOINTMENTS_PER_PATIENT) {
      throw new ConflictException(TOO_MANY_PENDING);
    }

    // Libera la franja de reservas vencidas (la restricción de la base no puede usar now()).
    await this.holds.releaseExpired(manager, ctx, dto.startsAt);

    const [settings] = await manager.query<
      { deposit_cents: string; payment_qr_ref: string | null; whatsapp_phone: string | null }[]
    >('SELECT deposit_cents, payment_qr_ref, whatsapp_phone FROM clinic_settings LIMIT 1');
    const depositCents = Number(settings?.deposit_cents ?? 0);

    const [row] = await manager.query<
      { id: string; starts_at: Date; ends_at: Date; hold_expires_at: Date }[]
    >(
      `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                deposit_cents, origin, hold_expires_at)
       VALUES ($1, $2, $3::timestamptz, $3::timestamptz + make_interval(mins => $4::int),
               'por_pagar', $5, 'web', now() + make_interval(mins => $6::int))
       RETURNING id, starts_at, ends_at, hold_expires_at`,
      [patient.id, treatment.id, dto.startsAt, SLOT_MINUTES, depositCents, BOOKING_HOLD_MINUTES],
    );
    if (!row) {
      throw new ConflictException(SLOT_UNAVAILABLE);
    }
    await this.audit.record(
      {
        actorKind: 'anonymous',
        entityType: 'appointment',
        entityId: row.id,
        action: 'appointment_created',
        after: { origin: 'web', status: 'por_pagar', treatmentId: treatment.id },
      },
      ctx,
      manager,
    );

    return {
      id: row.id,
      status: 'por_pagar',
      startsAt: new Date(row.starts_at).toISOString(),
      endsAt: new Date(row.ends_at).toISOString(),
      holdExpiresAt: new Date(row.hold_expires_at).toISOString(),
      treatmentName: treatment.name,
      depositCents,
      paymentQrRef: settings?.payment_qr_ref ?? null,
      whatsappPhone: settings?.whatsapp_phone ?? null,
    };
  }

  /**
   * Comprobante de pago (T-07). La cita sigue `por_pagar`; la doctora la confirma en T-11.
   * - Solo una `por_pagar` con plazo vigente (o sin plazo); si venció o ya se canceló, 409 con
   *   el aviso de escribir por WhatsApp.
   * - Un comprobante por cita, y el número no se repite nunca (la base lo garantiza).
   * Se bloquea la fila de la cita: si la tarea de vencimiento corre a la vez, o gana el
   * comprobante (la cita ya no vence) o gana el vencimiento (se rechaza el comprobante).
   */
  async submitPaymentProof(
    id: string,
    dto: SubmitPaymentProofDto,
    ctx: RequestContext,
  ): Promise<PaymentProofReceived> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const [appointment] = await manager.query<
          { status: string; expired: boolean; has_proof: boolean }[]
        >(
          `SELECT a.status,
                  (a.hold_expires_at IS NOT NULL AND a.hold_expires_at < now()) AS expired,
                  EXISTS (SELECT 1 FROM payment_proof pp WHERE pp.appointment_id = a.id) AS has_proof
             FROM appointment a WHERE a.id = $1 FOR UPDATE OF a`,
          [id],
        );
        if (!appointment) {
          throw new NotFoundException(NOT_FOUND);
        }
        if (appointment.status === 'cancelada') {
          throw new ConflictException(HOLD_EXPIRED);
        }
        if (appointment.status !== 'por_pagar') {
          throw new ConflictException(NOT_PENDING);
        }
        if (appointment.has_proof) {
          throw new ConflictException(PROOF_ALREADY_SENT);
        }
        if (appointment.expired) {
          throw new ConflictException(HOLD_EXPIRED);
        }

        const [proof] = await manager.query<{ submitted_at: Date }[]>(
          `INSERT INTO payment_proof (appointment_id, receipt_number)
           VALUES ($1, $2) RETURNING submitted_at`,
          [id, normalizeReceiptNumber(dto.receiptNumber)],
        );
        if (!proof) {
          throw new ConflictException(NOT_PENDING);
        }
        await this.audit.record(
          {
            actorKind: 'anonymous',
            entityType: 'appointment',
            entityId: id,
            action: 'payment_proof_submitted',
            after: { status: 'por_pagar' },
          },
          ctx,
          manager,
        );
        return { appointmentId: id, submittedAt: new Date(proof.submitted_at).toISOString() };
      });
    } catch (error) {
      if (pgCode(error) === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(RECEIPT_REUSED);
      }
      throw error;
    }
  }
}
