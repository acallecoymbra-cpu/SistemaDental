import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PATIENT_PHONE_NORMALIZED_PATTERN,
  SHARED_PHONE_WARNING,
  isMinorOn,
  normalizePatientName,
  normalizePhone,
  todayInClinicTimeZone,
  type AdminPatient,
  type PatientWriteResponse,
} from '@sistema-dental/contracts';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { AuditService, RequestContext } from '../audit/audit.service';
import type { CreatePatientDto, UpdatePatientDto } from './patient.dto';
import { Patient } from './patient.entity';

const NOT_FOUND = 'El paciente no existe.';
const BIRTH_REQUIRED = 'Para registrarte por primera vez necesitamos tu fecha de nacimiento.';
const DUPLICATE = 'Ya existe un paciente con ese nombre y celular.';
const PHONE_INVALID = 'El celular debe tener entre 7 y 15 dígitos.';
const GUARDIAN_PHONE_INVALID = 'El celular del apoderado debe tener entre 7 y 15 dígitos.';
const GUARDIAN_REQUIRED = 'Un paciente menor de edad necesita el celular de su apoderado.';
const BIRTH_INVALID = 'La fecha de nacimiento no es válida.';
const BIRTH_FUTURE = 'La fecha de nacimiento no puede ser futura.';
const MIN_BIRTH_YEAR = 1900;
const PG_UNIQUE_VIOLATION = '23505';
const SEARCH_LIMIT = 50;

export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code === PG_UNIQUE_VIOLATION
  );
}

export function toAdminPatient(p: Patient): AdminPatient {
  return {
    id: p.id,
    fullName: p.fullName,
    phone: p.phone,
    email: p.email,
    birthDate: p.birthDate,
    isMinor: p.isMinor,
    guardianPhone: p.guardianPhone,
    origin: p.origin,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Fecha que existe de verdad (rechaza 2020-02-30 aunque tenga buen formato). */
function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Campos que se guardan al auditar una edición: solo los que cambiaron. */
function changedFields(before: Patient, after: Patient) {
  const keys = ['fullName', 'phone', 'email', 'birthDate', 'guardianPhone'] as const;
  const beforeChanged: Record<string, unknown> = {};
  const afterChanged: Record<string, unknown> = {};
  for (const key of keys) {
    if (before[key] !== after[key]) {
      beforeChanged[key] = before[key];
      afterChanged[key] = after[key];
    }
  }
  return { beforeChanged, afterChanged, any: Object.keys(afterChanged).length > 0 };
}

/**
 * Aplica las reglas de un paciente sobre el resultado final: celulares normalizados,
 * fecha de nacimiento real y no futura, etiqueta de menor derivada de la fecha de hoy
 * en La Paz, y celular de apoderado obligatorio para menores.
 */
function applyRules(patient: Patient): void {
  patient.fullName = patient.fullName.trim();
  patient.normalizedName = normalizePatientName(patient.fullName);
  patient.phone = normalizePhone(patient.phone);
  if (!PATIENT_PHONE_NORMALIZED_PATTERN.test(patient.phone)) {
    throw new BadRequestException(PHONE_INVALID);
  }
  if (patient.guardianPhone !== null) {
    patient.guardianPhone = normalizePhone(patient.guardianPhone);
    if (!PATIENT_PHONE_NORMALIZED_PATTERN.test(patient.guardianPhone)) {
      throw new BadRequestException(GUARDIAN_PHONE_INVALID);
    }
  }
  if (patient.birthDate === null) {
    patient.isMinor = false;
    return;
  }
  const today = todayInClinicTimeZone();
  if (!isRealDate(patient.birthDate) || Number(patient.birthDate.slice(0, 4)) < MIN_BIRTH_YEAR) {
    throw new BadRequestException(BIRTH_INVALID);
  }
  if (patient.birthDate > today) {
    throw new BadRequestException(BIRTH_FUTURE);
  }
  patient.isMinor = isMinorOn(patient.birthDate, today);
  if (patient.isMinor && patient.guardianPhone === null) {
    throw new BadRequestException(GUARDIAN_REQUIRED);
  }
}

/**
 * Lógica de pacientes del panel (T-05). Mismo patrón del molde: escrituras en una
 * transacción con auditoría; errores esperados como 400/404/409; nunca se borra.
 * La auditoría guarda lo mínimo (sin teléfono ni correo al crear; solo campos cambiados al editar).
 */
@Injectable()
export class PatientsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Busca por nombre o celular (RF-23). Sin texto, devuelve los más recientes. */
  async search(query: string | undefined): Promise<AdminPatient[]> {
    const repo = this.dataSource.getRepository(Patient);
    const text = (query ?? '').trim();
    if (text.length === 0) {
      const rows = await repo.find({ order: { createdAt: 'DESC' }, take: SEARCH_LIMIT });
      return rows.map(toAdminPatient);
    }
    const name = normalizePatientName(text).replace(/[\\%_]/g, (c) => `\\${c}`);
    const digits = text.replace(/\D/g, '');
    const qb = repo
      .createQueryBuilder('p')
      .where(`p.normalized_name LIKE :name`, { name: `%${name}%` });
    if (digits.length > 0) {
      qb.orWhere('p.phone LIKE :phone', { phone: `%${normalizePhone(digits)}%` }).orWhere(
        'p.guardian_phone LIKE :phone',
      );
    }
    const rows = await qb.orderBy('p.full_name', 'ASC').limit(SEARCH_LIMIT).getMany();
    return rows.map(toAdminPatient);
  }

  async get(id: string): Promise<AdminPatient> {
    const patient = await this.dataSource.getRepository(Patient).findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException(NOT_FOUND);
    }
    return toAdminPatient(patient);
  }

  private async warningsFor(manager: EntityManager, patient: Patient): Promise<string[]> {
    const others = await manager
      .getRepository(Patient)
      .createQueryBuilder('p')
      .where('p.phone = :phone AND p.id <> :id', { phone: patient.phone, id: patient.id })
      .getCount();
    return others > 0 ? [SHARED_PHONE_WARNING] : [];
  }

  /**
   * Reserva pública (T-06): reconoce al paciente por nombre normalizado + celular y lo bloquea
   * hasta el final de la transacción (así sus reservas simultáneas se ordenan). Si no existe,
   * lo crea con origen `web`; entonces la fecha de nacimiento es obligatoria y un menor exige
   * apoderado. A un paciente que ya existe NO se le cambian datos desde el portal público
   * (solo se completa el correo si no tenía). `manager` es el de la transacción de la reserva.
   */
  async findOrCreateForBooking(
    manager: EntityManager,
    input: {
      fullName: string;
      phone: string;
      email: string;
      birthDate: string | null;
      guardianPhone: string | null;
    },
  ): Promise<Patient> {
    const probe = new Patient();
    probe.fullName = input.fullName;
    probe.phone = input.phone;
    probe.guardianPhone = null;
    probe.birthDate = null;
    probe.isMinor = false;
    applyRules(probe); // valida y normaliza nombre y celular
    const repo = manager.getRepository(Patient);
    const existing = await repo.findOne({
      where: { normalizedName: probe.normalizedName, phone: probe.phone },
      lock: { mode: 'pessimistic_write' },
    });
    if (existing) {
      if (!existing.email) {
        existing.email = input.email;
        await repo.save(existing);
      }
      return existing;
    }
    if (!input.birthDate) {
      throw new BadRequestException(BIRTH_REQUIRED);
    }
    const patient = new Patient();
    patient.fullName = input.fullName;
    patient.phone = input.phone;
    patient.email = input.email;
    patient.birthDate = input.birthDate;
    patient.guardianPhone = input.guardianPhone;
    patient.origin = 'web';
    patient.updatedBy = null;
    patient.isMinor = false;
    applyRules(patient);
    return repo.save(patient);
  }

  async create(
    dto: CreatePatientDto,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<PatientWriteResponse> {
    const patient = new Patient();
    patient.fullName = dto.fullName;
    patient.phone = dto.phone;
    patient.email = dto.email ?? null;
    patient.birthDate = dto.birthDate ?? null;
    patient.guardianPhone = dto.guardianPhone ?? null;
    patient.origin = 'dentist';
    patient.updatedBy = actorUserId;
    patient.isMinor = false;
    applyRules(patient);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const saved = await manager.getRepository(Patient).save(patient);
        await this.audit.record(
          {
            actorKind: 'dentist',
            actorUserId,
            entityType: 'patient',
            entityId: saved.id,
            action: 'patient_created',
            after: { origin: saved.origin, isMinor: saved.isMinor },
          },
          ctx,
          manager,
        );
        return { patient: toAdminPatient(saved), warnings: await this.warningsFor(manager, saved) };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE);
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdatePatientDto,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<PatientWriteResponse> {
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Patient);
        const current = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!current) {
          return null;
        }
        const before = { ...current } as Patient;
        if (dto.fullName !== undefined) current.fullName = dto.fullName;
        if (dto.phone !== undefined) current.phone = dto.phone;
        if (dto.email !== undefined) current.email = dto.email;
        if (dto.birthDate !== undefined) current.birthDate = dto.birthDate;
        if (dto.guardianPhone !== undefined) current.guardianPhone = dto.guardianPhone;
        applyRules(current);
        current.updatedBy = actorUserId;
        const saved = await repo.save(current);
        const changes = changedFields(before, saved);
        if (changes.any) {
          await this.audit.record(
            {
              actorKind: 'dentist',
              actorUserId,
              entityType: 'patient',
              entityId: id,
              action: 'patient_updated',
              before: changes.beforeChanged,
              after: changes.afterChanged,
            },
            ctx,
            manager,
          );
        }
        return { patient: toAdminPatient(saved), warnings: await this.warningsFor(manager, saved) };
      });
      if (!result) {
        throw new NotFoundException(NOT_FOUND);
      }
      return result;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE);
      }
      throw error;
    }
  }
}
