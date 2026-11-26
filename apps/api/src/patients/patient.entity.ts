import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Entidad de `patient` (migración `CreatePatients1764600000000`). */
@Entity({ name: 'patient' })
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName!: string;

  @Column({ name: 'normalized_name', type: 'varchar', length: 120 })
  normalizedName!: string;

  @Column({ type: 'varchar', length: 15 })
  phone!: string;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email!: string | null;

  /** `date` llega como texto `AAAA-MM-DD`. */
  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate!: string | null;

  @Column({ name: 'is_minor', type: 'boolean', default: false })
  isMinor!: boolean;

  @Column({ name: 'guardian_phone', type: 'varchar', length: 15, nullable: true })
  guardianPhone!: string | null;

  @Column({ type: 'varchar', length: 8 })
  origin!: 'web' | 'dentist';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
