import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entidad TypeORM: describe la tabla `treatment` creada por la migración.
 * Columnas en snake_case en la BD (`created_at`) y camelCase en TypeScript (`createdAt`).
 * Nunca se devuelve tal cual al cliente: el servicio la convierte a los tipos de `contracts`.
 */
@Entity({ name: 'treatment' })
export class Treatment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
