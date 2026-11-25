import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type AuditActorKind = 'dentist' | 'system' | 'anonymous';

/** Registro de auditoría: solo inserción, protegido por trigger en la BD (RF-27). */
@Entity({ name: 'audit_log' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ name: 'actor_kind', type: 'varchar', length: 16 })
  actorKind!: AuditActorKind;

  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Column({ name: 'before_json', type: 'jsonb', nullable: true })
  beforeJson!: Record<string, unknown> | null;

  @Column({ name: 'after_json', type: 'jsonb', nullable: true })
  afterJson!: Record<string, unknown> | null;

  @Column({ name: 'request_id', type: 'varchar', length: 64, nullable: true })
  requestId!: string | null;

  @Column({ name: 'ip_hash', type: 'char', length: 64, nullable: true })
  ipHash!: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt!: Date;
}
