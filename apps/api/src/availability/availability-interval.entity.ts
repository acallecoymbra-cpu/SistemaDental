import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entidad TypeORM: describe la tabla `availability_interval` (migración
 * `CreateAvailabilityIntervals1764400000000`).
 * `date` llega como texto `AAAA-MM-DD` y `time` como `HH:mm:ss`: el servicio recorta a `HH:mm`.
 * Nunca se devuelve tal cual al cliente: el servicio la convierte a los tipos de `contracts`.
 */
@Entity({ name: 'availability_interval' })
export class AvailabilityInterval {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'service_date', type: 'date' })
  serviceDate!: string;

  @Column({ name: 'starts_local', type: 'time' })
  startsLocal!: string;

  @Column({ name: 'ends_local', type: 'time' })
  endsLocal!: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
