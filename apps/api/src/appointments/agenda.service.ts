import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AGENDA_MAX_RANGE_DAYS,
  CLINIC_TIME_ZONE,
  isAppointmentStatus,
  normalizePatientName,
  normalizePhone,
  type PhoneDialCode,
  todayInClinicTimeZone,
  type AdminAppointment,
  type AppointmentStatus,
} from '@sistema-dental/contracts';
import { DataSource } from 'typeorm';

const BAD_DATE = 'Las fechas deben tener el formato AAAA-MM-DD.';
const BAD_RANGE = 'La fecha final no puede ser anterior a la inicial.';
const TOO_LONG = `El rango no puede superar ${AGENDA_MAX_RANGE_DAYS} días.`;
const BAD_STATUS = 'El estado no es válido.';
const NOT_FOUND = 'La consulta no existe.';
const LIST_LIMIT = 500;

export interface AgendaQuery {
  from?: string;
  to?: string;
  status?: string;
  patient?: string;
  /** `true`: solo las `por_pagar` con comprobante todavía sin confirmar. */
  review?: string;
}

interface Row {
  id: string;
  status: AppointmentStatus;
  starts_at: Date;
  ends_at: Date;
  treatment_id: string;
  treatment_name: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  patient_phone_country_code: PhoneDialCode;
  patient_guardian_phone_country_code: PhoneDialCode | null;
  patient_is_minor: boolean;
  patient_guardian_phone: string | null;
  deposit_cents: string;
  origin: 'web' | 'dentist';
  hold_expires_at: Date | null;
  cancel_reason: string | null;
  diagnosis: string | null;
  cost_cents: string | null;
  canceled_at: Date | null;
  created_at: Date;
  proof_receipt_number: string | null;
  proof_submitted_at: Date | null;
  proof_confirmed_at: Date | null;
  notification_status: string | null;
  notification_exists: boolean;
}

function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && parsed.toISOString().slice(0, 10) === value;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const SELECT = `
  SELECT a.id, a.status, a.starts_at, a.ends_at, a.deposit_cents, a.origin, a.hold_expires_at,
         a.cancel_reason, a.canceled_at, a.created_at, a.diagnosis, a.cost_cents,
         pp.receipt_number AS proof_receipt_number, pp.submitted_at AS proof_submitted_at,
         pp.confirmed_at AS proof_confirmed_at,
         en.delivery_status AS notification_status, (en.id IS NOT NULL) AS notification_exists,
         t.id AS treatment_id, t.name AS treatment_name,
         p.id AS patient_id, p.full_name AS patient_name, p.phone AS patient_phone,
         p.phone_country_code AS patient_phone_country_code,
         p.guardian_phone_country_code AS patient_guardian_phone_country_code,
         p.is_minor AS patient_is_minor, p.guardian_phone AS patient_guardian_phone
    FROM appointment a
    JOIN patient p ON p.id = a.patient_id
    JOIN treatment t ON t.id = a.treatment_id
    LEFT JOIN payment_proof pp ON pp.appointment_id = a.id
    LEFT JOIN email_notification en
           ON en.appointment_id = a.id AND en.kind = 'appointment_canceled'`;

function toAdminAppointment(row: Row): AdminAppointment {
  return {
    id: row.id,
    status: row.status,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    treatment: { id: row.treatment_id, name: row.treatment_name },
    patient: {
      id: row.patient_id,
      fullName: row.patient_name,
      phone: row.patient_phone,
      phoneCountryCode: row.patient_phone_country_code,
      isMinor: row.patient_is_minor,
      guardianPhone: row.patient_guardian_phone,
      guardianPhoneCountryCode: row.patient_guardian_phone_country_code,
    },
    depositCents: Number(row.deposit_cents),
    origin: row.origin,
    holdExpiresAt: row.hold_expires_at ? new Date(row.hold_expires_at).toISOString() : null,
    cancelReason: row.cancel_reason,
    diagnosis: row.diagnosis,
    costCents: row.cost_cents === null ? null : Number(row.cost_cents),
    canceledAt: row.canceled_at ? new Date(row.canceled_at).toISOString() : null,
    paymentProof:
      row.proof_receipt_number && row.proof_submitted_at
        ? {
            receiptNumber: row.proof_receipt_number,
            submittedAt: new Date(row.proof_submitted_at).toISOString(),
            confirmedAt: row.proof_confirmed_at
              ? new Date(row.proof_confirmed_at).toISOString()
              : null,
          }
        : null,
    cancelNotification:
      row.status !== 'cancelada'
        ? null
        : row.notification_exists
          ? (row.notification_status as 'pending' | 'sent' | 'failed')
          : 'none',
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Agenda del dentista (T-10, RF-16): consultas por rango de fechas de La Paz (el día completo,
 * de 00:00 a 24:00 hora local) con filtros por estado, paciente y «por confirmar». Solo lectura.
 */
@Injectable()
export class AgendaService {
  constructor(private readonly dataSource: DataSource) {}

  async list(query: AgendaQuery): Promise<AdminAppointment[]> {
    const today = todayInClinicTimeZone();
    const from = query.from ?? today;
    const to = query.to ?? from;
    if (!isRealDate(from) || !isRealDate(to)) {
      throw new BadRequestException(BAD_DATE);
    }
    if (to < from) {
      throw new BadRequestException(BAD_RANGE);
    }
    if (daysBetween(from, to) + 1 > AGENDA_MAX_RANGE_DAYS) {
      throw new BadRequestException(TOO_LONG);
    }
    if (query.status !== undefined && query.status !== '' && !isAppointmentStatus(query.status)) {
      throw new BadRequestException(BAD_STATUS);
    }

    const params: unknown[] = [from, to, CLINIC_TIME_ZONE];
    const where = [
      `a.starts_at >= ($1::date)::timestamp AT TIME ZONE $3::text`,
      `a.starts_at < (($2::date + 1))::timestamp AT TIME ZONE $3::text`,
    ];
    if (query.status) {
      params.push(query.status);
      where.push(`a.status = $${params.length}::appointment_status`);
    }
    if (query.review === 'true') {
      where.push(
        `a.status = 'por_pagar' AND pp.receipt_number IS NOT NULL AND pp.confirmed_at IS NULL`,
      );
    }
    const text = (query.patient ?? '').trim();
    if (text.length > 0) {
      const name = normalizePatientName(text)
        .trim()
        .replace(/[\\%_]/g, (c) => `\\${c}`);
      params.push(`%${name}%`);
      let condition = `p.normalized_name LIKE $${params.length}`;
      // Solo se busca como celular si el texto parece un celular (dígitos, +, espacios, guiones).
      const digits = /^[+\d\s()-]+$/.test(text) ? text.replace(/\D/g, '') : '';
      if (digits.length > 0) {
        params.push(`%${normalizePhone(digits)}%`);
        condition += ` OR p.phone LIKE $${params.length} OR p.guardian_phone LIKE $${params.length}`;
      }
      where.push(`(${condition})`);
    }

    const rows = await this.dataSource.query<Row[]>(
      `${SELECT} WHERE ${where.join(' AND ')} ORDER BY a.starts_at, a.created_at LIMIT ${LIST_LIMIT}`,
      params,
    );
    return rows.map(toAdminAppointment);
  }

  async get(id: string): Promise<AdminAppointment> {
    const [row] = await this.dataSource.query<Row[]>(`${SELECT} WHERE a.id = $1`, [id]);
    if (!row) {
      throw new NotFoundException(NOT_FOUND);
    }
    return toAdminAppointment(row);
  }
}
