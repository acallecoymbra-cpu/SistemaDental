import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PATIENT_RECORD_APPOINTMENTS_LIMIT,
  type AppointmentStatus,
  type PatientRecord,
  type PatientRecordAppointment,
} from '@sistema-dental/contracts';
import { DataSource } from 'typeorm';
import { AuditService, RequestContext } from '../audit/audit.service';
import { Patient } from './patient.entity';
import { toAdminPatient } from './patients.service';

const NOT_FOUND = 'El paciente no existe.';

interface Row {
  id: string;
  status: AppointmentStatus;
  starts_at: Date;
  ends_at: Date;
  deposit_cents: string;
  diagnosis: string | null;
  cost_cents: string | null;
  cancel_reason: string | null;
  treatment_id: string;
  treatment_name: string;
  proof_receipt_number: string | null;
  proof_confirmed_at: Date | null;
}

function toRecordAppointment(row: Row): PatientRecordAppointment {
  return {
    id: row.id,
    status: row.status,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    treatment: { id: row.treatment_id, name: row.treatment_name },
    depositCents: Number(row.deposit_cents),
    paymentProof: row.proof_receipt_number
      ? { receiptNumber: row.proof_receipt_number, confirmed: row.proof_confirmed_at !== null }
      : null,
    diagnosis: row.diagnosis,
    costCents: row.cost_cents === null ? null : Number(row.cost_cents),
    cancelReason: row.cancel_reason,
  };
}

/**
 * Ficha del paciente (T-14): datos de contacto y consultas. La historia clínica por versiones
 * se suma en T-15. Cada apertura queda auditada (`patient_record_opened`) sin copiar nada del
 * contenido: solo quién la abrió y de qué paciente.
 */
@Injectable()
export class PatientRecordService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async open(patientId: string, actorUserId: string, ctx: RequestContext): Promise<PatientRecord> {
    return this.dataSource.transaction(async (manager) => {
      const patient = await manager.getRepository(Patient).findOne({ where: { id: patientId } });
      if (!patient) {
        throw new NotFoundException(NOT_FOUND);
      }
      const rows = await manager.query<Row[]>(
        `SELECT a.id, a.status, a.starts_at, a.ends_at, a.deposit_cents, a.diagnosis,
                a.cost_cents, a.cancel_reason,
                t.id AS treatment_id, t.name AS treatment_name,
                pp.receipt_number AS proof_receipt_number, pp.confirmed_at AS proof_confirmed_at
           FROM appointment a
           JOIN treatment t ON t.id = a.treatment_id
           LEFT JOIN payment_proof pp ON pp.appointment_id = a.id
          WHERE a.patient_id = $1
          ORDER BY a.starts_at DESC, a.created_at DESC
          LIMIT ${PATIENT_RECORD_APPOINTMENTS_LIMIT}`,
        [patientId],
      );
      await this.audit.record(
        {
          actorKind: 'dentist',
          actorUserId,
          entityType: 'patient',
          entityId: patientId,
          action: 'patient_record_opened',
        },
        ctx,
        manager,
      );
      return { patient: toAdminPatient(patient), appointments: rows.map(toRecordAppointment) };
    });
  }
}
