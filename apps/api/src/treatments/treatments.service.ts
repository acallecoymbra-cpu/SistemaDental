import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminTreatment, PublicTreatment } from '@sistema-dental/contracts';
import { DataSource, QueryFailedError } from 'typeorm';
import { AuditService, RequestContext } from '../audit/audit.service';
import type { CreateTreatmentDto, UpdateTreatmentDto } from './treatment.dto';
import { Treatment } from './treatment.entity';

const DUPLICATE_NAME = 'Ya existe un tratamiento con ese nombre.';
const NOT_FOUND = 'El tratamiento no existe.';

/** Código de PostgreSQL para «valor duplicado en un índice único». */
const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code === PG_UNIQUE_VIOLATION
  );
}

/** Convierte la entidad a lo que ve el panel (fechas en ISO, sin campos internos). */
export function toAdminTreatment(t: Treatment): AdminTreatment {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    active: t.active,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function toPublicTreatment(t: Treatment): PublicTreatment {
  return { id: t.id, name: t.name, description: t.description };
}

/** Campos que se guardan en la auditoría (antes/después). */
function auditSnapshot(t: Treatment): Record<string, unknown> {
  return { name: t.name, description: t.description, active: t.active };
}

/**
 * Lógica del catálogo de tratamientos. Patrón del molde:
 * 1. Toda escritura va en UNA transacción junto con su registro de auditoría.
 * 2. Los errores esperados se traducen a excepciones HTTP claras (404, 409).
 * 3. Nunca se borra: desactivar es `active = false` (RF-15).
 */
@Injectable()
export class TreatmentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Portal público: solo activos, ordenados por nombre. */
  async listPublic(): Promise<PublicTreatment[]> {
    const rows = await this.dataSource.getRepository(Treatment).find({
      where: { active: true },
      order: { name: 'ASC' },
    });
    return rows.map(toPublicTreatment);
  }

  /** Panel: todos, activos primero. */
  async listAdmin(): Promise<AdminTreatment[]> {
    const rows = await this.dataSource.getRepository(Treatment).find({
      order: { active: 'DESC', name: 'ASC' },
    });
    return rows.map(toAdminTreatment);
  }

  async create(
    dto: CreateTreatmentDto,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<AdminTreatment> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const saved = await manager.getRepository(Treatment).save({
          name: dto.name,
          description: dto.description ?? null,
        });
        await this.audit.record(
          {
            actorKind: 'dentist',
            actorUserId,
            entityType: 'treatment',
            entityId: saved.id,
            action: 'treatment_created',
            after: auditSnapshot(saved),
          },
          ctx,
          manager,
        );
        return toAdminTreatment(saved);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_NAME);
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateTreatmentDto,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<AdminTreatment> {
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Treatment);
        // FOR UPDATE: si dos ediciones llegan a la vez, la segunda espera a la primera.
        const current = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!current) {
          return null;
        }
        const before = auditSnapshot(current);
        if (dto.name !== undefined) current.name = dto.name;
        if (dto.description !== undefined) current.description = dto.description;
        if (dto.active !== undefined) current.active = dto.active;
        const saved = await repo.save(current);
        const after = auditSnapshot(saved);
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          await this.audit.record(
            {
              actorKind: 'dentist',
              actorUserId,
              entityType: 'treatment',
              entityId: id,
              action: 'treatment_updated',
              before,
              after,
            },
            ctx,
            manager,
          );
        }
        return toAdminTreatment(saved);
      });
      if (!result) {
        throw new NotFoundException(NOT_FOUND);
      }
      return result;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_NAME);
      }
      throw error;
    }
  }
}
