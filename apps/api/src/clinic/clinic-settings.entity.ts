import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** `bigint` llega de PostgreSQL como texto; los importes son centavos enteros chicos. */
const centsTransformer = {
  to: (value: number) => value,
  from: (value: string | number) => Number(value),
};

/**
 * Entidad de `clinic_settings` (migración `CreateClinicSettings1764500000000`).
 * Hay UNA sola fila: la base lo garantiza con un índice único.
 */
@Entity({ name: 'clinic_settings' })
export class ClinicSettingsRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'consultation_price_cents', type: 'bigint', transformer: centsTransformer })
  consultationPriceCents!: number;

  @Column({ name: 'deposit_cents', type: 'bigint', transformer: centsTransformer })
  depositCents!: number;

  @Column({ type: 'char', length: 3, default: 'BOB' })
  currency!: string;

  @Column({ name: 'payment_qr_ref', type: 'varchar', length: 500, nullable: true })
  paymentQrRef!: string | null;

  @Column({ name: 'whatsapp_phone', type: 'varchar', length: 16, nullable: true })
  whatsappPhone!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
