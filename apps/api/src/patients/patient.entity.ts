import type { PhoneDialCode } from '@sistema-dental/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Entidad de `patient` (migraciones `CreatePatients1764600000000` y `PatientNamePartsCiPhoneCountry1765200000000`). */
@Entity({ name: 'patient' })
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Nombre para mostrar, armado con las partes. */
  @Column({ name: 'full_name', type: 'varchar', length: 210 })
  fullName!: string;

  /** Para el buscador del panel. */
  @Column({ name: 'normalized_name', type: 'varchar', length: 210 })
  normalizedName!: string;

  @Column({ name: 'given_names', type: 'varchar', length: 80 })
  givenNames!: string;

  @Column({ name: 'first_surname', type: 'varchar', length: 60 })
  firstSurname!: string;

  @Column({ name: 'second_surname', type: 'varchar', length: 60, nullable: true })
  secondSurname!: string | null;

  @Column({ name: 'first_given_name_key', type: 'varchar', length: 80 })
  firstGivenNameKey!: string;

  @Column({ name: 'given_names_key', type: 'varchar', length: 80 })
  givenNamesKey!: string;

  @Column({ name: 'first_surname_key', type: 'varchar', length: 60 })
  firstSurnameKey!: string;

  @Column({ name: 'second_surname_key', type: 'varchar', length: 60, nullable: true })
  secondSurnameKey!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ci!: string | null;

  @Column({ name: 'phone_country_code', type: 'varchar', length: 4 })
  phoneCountryCode!: PhoneDialCode;

  /** Número nacional, sin código de país. */
  @Column({ type: 'varchar', length: 15 })
  phone!: string;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email!: string | null;

  /** `date` llega como texto `AAAA-MM-DD`. */
  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate!: string | null;

  @Column({ name: 'is_minor', type: 'boolean', default: false })
  isMinor!: boolean;

  @Column({ name: 'guardian_phone_country_code', type: 'varchar', length: 4, nullable: true })
  guardianPhoneCountryCode!: PhoneDialCode | null;

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
