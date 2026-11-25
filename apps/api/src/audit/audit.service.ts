import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AuditActorKind, AuditLog } from './audit-log.entity';

/** Datos de la petición que se guardan en la auditoría (sin cuerpo ni cabeceras). */
export interface RequestContext {
  requestId?: string;
  ip?: string;
}

export interface AuditEntry {
  actorKind: AuditActorKind;
  actorUserId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Auditoría mínima (TASK-102). Nunca guardar contraseñas, tokens ni contenido clínico:
 * en `before`/`after` van solo los campos que cambian y no son sensibles.
 * La IP se guarda como HMAC para poder correlacionar sin almacenarla en claro.
 */
@Injectable()
export class AuditService {
  private readonly ipSalt: string;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.ipSalt = config.get<string>('AUDIT_IP_SALT') ?? 'sistema-dental-dev';
  }

  hashIp(ip: string | undefined): string | null {
    return ip ? createHmac('sha256', this.ipSalt).update(ip).digest('hex') : null;
  }

  /** Inserta un registro; usar el `manager` de la transacción cuando la acción es transaccional. */
  async record(
    entry: AuditEntry,
    ctx: RequestContext = {},
    manager?: EntityManager,
  ): Promise<void> {
    const repo = (manager ?? this.dataSource.manager).getRepository(AuditLog);
    const row = repo.create({
      actorKind: entry.actorKind,
      actorUserId: entry.actorUserId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      action: entry.action,
      beforeJson: entry.before ?? null,
      afterJson: entry.after ?? null,
      requestId: ctx.requestId ?? null,
      ipHash: this.hashIp(ctx.ip),
    });
    // save() de una entidad nueva hace solo INSERT (la tabla prohíbe UPDATE/DELETE).
    await repo.save(row, { reload: false });
  }
}
