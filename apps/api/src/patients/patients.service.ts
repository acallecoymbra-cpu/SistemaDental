import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CI_PATTERN,
  SHARED_PHONE_WARNING,
  buildFullName,
  firstWordKey,
  isMinorOn,
  isValidNationalNumber,
  nameKey,
  normalizeCi,
  normalizeNationalNumber,
  normalizePatientName,
  normalizePhone,
  todayInClinicTimeZone,
  type AdminPatient,
  type BookingPatientRequest,
  type NewBookingPatient,
  type PatientWriteResponse,
  type ReturningBookingPatient,
} from '@sistema-dental/contracts';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { AuditService, RequestContext } from '../audit/audit.service';
import type { CreatePatientDto, UpdatePatientDto } from './patient.dto';
import { Patient } from './patient.entity';
import { lookupKeyOf, lookupParams, patientLookupSql } from './patient-lookup';

const NOT_FOUND = 'El paciente no existe.';
const BIRTH_REQUIRED = 'Para registrarte por primera vez necesitamos tu fecha de nacimiento.';
const DUPLICATE = 'Ya existe un paciente con ese nombre y celular.';
const CI_TAKEN = 'Ese CI ya pertenece a otro paciente.';
const CI_INVALID = 'El CI solo admite números, letras y guion (4 a 20).';
const CI_REQUIRED = 'Para registrarte necesitamos tu CI.';
const NAME_NO_LETTERS = 'El nombre y el primer apellido deben tener letras.';
const PHONE_INVALID = 'El celular no es válido para el país elegido.';
const GUARDIAN_PHONE_INVALID = 'El celular del apoderado no es válido para el país elegido.';
/** Web: sin coincidencias, varias coincidencias, registro que ya existe y CI repetido. */
export const RETURNING_NOT_FOUND =
  'No encontramos tus datos. Si es tu primera vez, elige "No, es mi primera vez".';
export const RETURNING_AMBIGUOUS =
  'Hay más de un paciente con esos datos. Escríbenos por WhatsApp.';
export const NEW_ALREADY_EXISTS =
  'Ya hay un paciente con ese nombre y celular. Si eres tú, elige "Sí, ya estoy registrado"; si no, escríbenos por WhatsApp.';
export const WEB_REGISTRATION_FAILED = 'No pudimos registrar tus datos. Escríbenos por WhatsApp.';
export const PATIENT_CI_CONSTRAINT = 'patient_ci_uq';
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

/** Nombre de la restricción o índice único que falló (o undefined). */
export function violatedConstraint(error: unknown): string | undefined {
  return error instanceof QueryFailedError
    ? (error.driverError as { constraint?: string } | undefined)?.constraint
    : undefined;
}

/** 409 del panel: distingue CI repetido de paciente repetido. */
function conflictFor(error: unknown): ConflictException {
  return new ConflictException(
    violatedConstraint(error) === PATIENT_CI_CONSTRAINT ? CI_TAKEN : DUPLICATE,
  );
}

export function toAdminPatient(p: Patient): AdminPatient {
  return {
    id: p.id,
    fullName: p.fullName,
    givenNames: p.givenNames,
    firstSurname: p.firstSurname,
    secondSurname: p.secondSurname,
    ci: p.ci,
    phoneCountryCode: p.phoneCountryCode,
    phone: p.phone,
    email: p.email,
    birthDate: p.birthDate,
    isMinor: p.isMinor,
    guardianPhoneCountryCode: p.guardianPhoneCountryCode,
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

/**
 * Campos que se guardan al auditar una edición: solo los que cambiaron. El CI nunca se copia a
 * la auditoría: solo se anota que cambió.
 */
function changedFields(before: Patient, after: Patient) {
  const keys = [
    'givenNames',
    'firstSurname',
    'secondSurname',
    'phoneCountryCode',
    'phone',
    'email',
    'birthDate',
    'guardianPhoneCountryCode',
    'guardianPhone',
  ] as const;
  const beforeChanged: Record<string, unknown> = {};
  const afterChanged: Record<string, unknown> = {};
  for (const key of keys) {
    if (before[key] !== after[key]) {
      beforeChanged[key] = before[key];
      afterChanged[key] = after[key];
    }
  }
  if (before.ci !== after.ci) {
    afterChanged.ciChanged = true;
  }
  return { beforeChanged, afterChanged, any: Object.keys(afterChanged).length > 0 };
}

/**
 * Aplica las reglas de un paciente sobre el resultado final: celulares normalizados,
 * fecha de nacimiento real y no futura, etiqueta de menor derivada de la fecha de hoy
 * en La Paz, y celular de apoderado obligatorio para menores.
 */
function applyRules(patient: Patient): void {
  const collapse = (text: string) => text.trim().replace(/\s+/g, ' ');
  patient.givenNames = collapse(patient.givenNames);
  patient.firstSurname = collapse(patient.firstSurname);
  patient.secondSurname = patient.secondSurname ? collapse(patient.secondSurname) || null : null;
  patient.firstGivenNameKey = firstWordKey(patient.givenNames);
  patient.givenNamesKey = nameKey(patient.givenNames);
  patient.firstSurnameKey = nameKey(patient.firstSurname);
  patient.secondSurnameKey = patient.secondSurname ? nameKey(patient.secondSurname) || null : null;
  if (!patient.firstGivenNameKey || !patient.givenNamesKey || !patient.firstSurnameKey) {
    throw new BadRequestException(NAME_NO_LETTERS);
  }
  patient.fullName = buildFullName(patient.givenNames, patient.firstSurname, patient.secondSurname);
  patient.normalizedName = normalizePatientName(patient.fullName);

  patient.phone = normalizeNationalNumber(patient.phoneCountryCode, patient.phone);
  if (!isValidNationalNumber(patient.phoneCountryCode, patient.phone)) {
    throw new BadRequestException(PHONE_INVALID);
  }
  if (patient.guardianPhone !== null) {
    patient.guardianPhoneCountryCode ??= '591';
    patient.guardianPhone = normalizeNationalNumber(
      patient.guardianPhoneCountryCode,
      patient.guardianPhone,
    );
    if (!isValidNationalNumber(patient.guardianPhoneCountryCode, patient.guardianPhone)) {
      throw new BadRequestException(GUARDIAN_PHONE_INVALID);
    }
  } else {
    patient.guardianPhoneCountryCode = null;
  }
  if (patient.ci !== null) {
    patient.ci = normalizeCi(patient.ci) || null;
    if (patient.ci !== null && !CI_PATTERN.test(patient.ci)) {
      throw new BadRequestException(CI_INVALID);
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
    const ci = normalizeCi(text);
    if (CI_PATTERN.test(ci)) {
      qb.orWhere('p.ci = :ci', { ci });
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
      .where('p.phone_country_code = :dial AND p.phone = :phone AND p.id <> :id', {
        dial: patient.phoneCountryCode,
        phone: patient.phone,
        id: patient.id,
      })
      .getCount();
    return others > 0 ? [SHARED_PHONE_WARNING] : [];
  }

  /**
   * Reserva pública (T-06, V-27). `manager` es el de la transacción de la reserva.
   * - `returning`: se busca con la regla de «Mis consultas» (primer nombre o nombres + primer
   *   apellido + celular propio o del apoderado) y se bloquea la fila hasta el final de la
   *   transacción. 0 coincidencias → 400; varias → 409. Solo se completa el correo si no tenía.
   * - `new`: fecha de nacimiento obligatoria, CI obligatorio para adultos, menor con apoderado.
   *   Si ya hay un paciente que la regla de consulta confundiría con este → 409 (debe elegir
   *   «Sí, ya estoy registrado»). Un CI repetido lo resuelve quien llama (error genérico).
   */
  async findOrCreateForBooking(
    manager: EntityManager,
    input: BookingPatientRequest,
  ): Promise<Patient> {
    return input.kind === 'returning'
      ? this.findReturning(manager, input)
      : this.createFromWeb(manager, input);
  }

  private async findReturning(
    manager: EntityManager,
    input: ReturningBookingPatient,
  ): Promise<Patient> {
    const key = lookupKeyOf(input);
    if (!key) {
      throw new BadRequestException(RETURNING_NOT_FOUND);
    }
    const ids = (await manager.query(
      `SELECT p.id FROM patient p WHERE ${patientLookupSql('p', 1)} ORDER BY p.id LIMIT 2`,
      lookupParams(key),
    )) as { id: string }[];
    if (ids.length === 0) {
      throw new BadRequestException(RETURNING_NOT_FOUND);
    }
    if (ids.length > 1) {
      throw new ConflictException(RETURNING_AMBIGUOUS);
    }
    const repo = manager.getRepository(Patient);
    const existing = await repo.findOne({
      where: { id: ids[0]!.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!existing) {
      throw new BadRequestException(RETURNING_NOT_FOUND);
    }
    if (!existing.email) {
      existing.email = input.email;
      await repo.save(existing);
    }
    return existing;
  }

  private async createFromWeb(manager: EntityManager, input: NewBookingPatient): Promise<Patient> {
    if (!input.birthDate) {
      throw new BadRequestException(BIRTH_REQUIRED);
    }
    const patient = new Patient();
    patient.givenNames = input.givenNames;
    patient.firstSurname = input.firstSurname;
    patient.secondSurname = input.secondSurname ?? null;
    patient.ci = input.ci ?? null;
    patient.phoneCountryCode = input.phoneCountryCode;
    patient.phone = input.phone;
    patient.email = input.email;
    patient.birthDate = input.birthDate;
    patient.guardianPhoneCountryCode = input.guardianPhoneCountryCode ?? null;
    patient.guardianPhone = input.guardianPhone ?? null;
    patient.origin = 'web';
    patient.updatedBy = null;
    patient.isMinor = false;
    applyRules(patient);
    if (!patient.isMinor && patient.ci === null) {
      throw new BadRequestException(CI_REQUIRED);
    }
    // ¿Alguna forma de escribir su nombre en «Mis consultas» encontraría a otro paciente? Se
    // revisa con su celular y con el del apoderado (la consulta acepta ambos). Un candado por
    // (apellido, celular) ordena los registros simultáneos: el segundo ve al primero.
    const phones: [string, string][] = [[patient.phoneCountryCode, patient.phone]];
    if (patient.guardianPhoneCountryCode && patient.guardianPhone) {
      phones.push([patient.guardianPhoneCountryCode, patient.guardianPhone]);
    }
    const lockKeys = phones.map(([dial, phone]) => `${patient.firstSurnameKey}|${dial}|${phone}`);
    for (const key of [...new Set(lockKeys)].sort()) {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
    }
    for (const [dial, phone] of phones) {
      const clash = (await manager.query(
        `SELECT 1 FROM patient p
          WHERE p.first_surname_key = $1
            AND (p.first_given_name_key IN ($2, $3) OR p.given_names_key IN ($2, $3))
            AND ((p.phone_country_code = $4 AND p.phone = $5)
              OR (p.guardian_phone_country_code = $4 AND p.guardian_phone = $5))
          LIMIT 1`,
        [patient.firstSurnameKey, patient.firstGivenNameKey, patient.givenNamesKey, dial, phone],
      )) as unknown[];
      if (clash.length > 0) {
        throw new ConflictException(NEW_ALREADY_EXISTS);
      }
    }
    return manager.getRepository(Patient).save(patient);
  }

  async create(
    dto: CreatePatientDto,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<PatientWriteResponse> {
    const patient = new Patient();
    patient.givenNames = dto.givenNames;
    patient.firstSurname = dto.firstSurname;
    patient.secondSurname = dto.secondSurname ?? null;
    patient.ci = dto.ci ?? null;
    patient.phoneCountryCode = dto.phoneCountryCode;
    patient.phone = dto.phone;
    patient.email = dto.email ?? null;
    patient.birthDate = dto.birthDate ?? null;
    patient.guardianPhoneCountryCode = dto.guardianPhoneCountryCode ?? null;
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
        throw conflictFor(error);
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
        if (dto.givenNames !== undefined) current.givenNames = dto.givenNames;
        if (dto.firstSurname !== undefined) current.firstSurname = dto.firstSurname;
        if (dto.secondSurname !== undefined) current.secondSurname = dto.secondSurname;
        if (dto.ci !== undefined) current.ci = dto.ci;
        if (dto.phoneCountryCode !== undefined) current.phoneCountryCode = dto.phoneCountryCode;
        if (dto.phone !== undefined) current.phone = dto.phone;
        if (dto.email !== undefined) current.email = dto.email;
        if (dto.birthDate !== undefined) current.birthDate = dto.birthDate;
        if (dto.guardianPhoneCountryCode !== undefined) {
          current.guardianPhoneCountryCode = dto.guardianPhoneCountryCode;
        }
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
        throw conflictFor(error);
      }
      throw error;
    }
  }
}
