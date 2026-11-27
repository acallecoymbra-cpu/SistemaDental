import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  CURRENCY,
  DEPOSIT_MAX_CENTS,
  DEPOSIT_MIN_CENTS,
  isValidNationalNumber,
  parseE164,
  type ClinicSettings,
  type PublicClinicInfo,
} from '@sistema-dental/contracts';
import { DataSource, QueryFailedError } from 'typeorm';
import { AuditService, RequestContext } from '../audit/audit.service';
import type { UpdateClinicSettingsDto } from './clinic-settings.dto';
import { ClinicSettingsRow } from './clinic-settings.entity';

const DEPOSIT_RANGE = 'El anticipo debe estar entre 10 y 20 Bs.';
const DEPOSIT_VS_PRICE = 'El anticipo no puede ser mayor que el precio de la consulta.';
const WHATSAPP_INVALID = 'El WhatsApp no es válido para el país elegido.';

/** El WhatsApp llega como `+<código><número>`: el número debe ser válido para su país. */
function assertValidWhatsapp(value: string | null): void {
  if (value === null) return;
  const { dialCode, national } = parseE164(value);
  if (!value.startsWith(`+${dialCode}`) || !isValidNationalNumber(dialCode, national)) {
    throw new BadRequestException(WHATSAPP_INVALID);
  }
}
const PG_CHECK_VIOLATION = '23514';

export function toClinicSettings(row: ClinicSettingsRow): ClinicSettings {
  return {
    consultationPriceCents: row.consultationPriceCents,
    depositCents: row.depositCents,
    currency: CURRENCY,
    paymentQrRef: row.paymentQrRef,
    whatsappPhone: row.whatsappPhone,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Campos que se guardan en la auditoría (antes/después). */
function auditSnapshot(row: ClinicSettingsRow): Record<string, unknown> {
  return {
    consultationPriceCents: row.consultationPriceCents,
    depositCents: row.depositCents,
    paymentQrRef: row.paymentQrRef,
    whatsappPhone: row.whatsappPhone,
  };
}

/** Reglas de negocio del anticipo (V-06). La base las vuelve a exigir con CHECK. */
function assertValidSettings(consultationPriceCents: number, depositCents: number): void {
  if (depositCents < DEPOSIT_MIN_CENTS || depositCents > DEPOSIT_MAX_CENTS) {
    throw new BadRequestException(DEPOSIT_RANGE);
  }
  if (depositCents > consultationPriceCents) {
    throw new BadRequestException(DEPOSIT_VS_PRICE);
  }
}

/**
 * Configuración única de la clínica (T-01). Hay una sola fila (la crea la migración):
 * no se crea ni se borra desde la API, solo se lee y se actualiza.
 */
@Injectable()
export class ClinicService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  private async loadRow(): Promise<ClinicSettingsRow> {
    const row = await this.dataSource.getRepository(ClinicSettingsRow).findOne({ where: {} });
    if (!row) {
      throw new InternalServerErrorException(
        'La configuración de la clínica no está inicializada.',
      );
    }
    return row;
  }

  /** Panel: todo, incluida la referencia al QR. */
  async getSettings(): Promise<ClinicSettings> {
    return toClinicSettings(await this.loadRow());
  }

  /** Portal público: solo datos mínimos. El QR no se expone aquí. */
  async getPublicInfo(): Promise<PublicClinicInfo> {
    const row = await this.loadRow();
    return {
      consultationPriceCents: row.consultationPriceCents,
      depositCents: row.depositCents,
      whatsappPhone: row.whatsappPhone,
    };
  }

  async update(
    dto: UpdateClinicSettingsDto,
    actorUserId: string,
    ctx: RequestContext,
  ): Promise<ClinicSettings> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(ClinicSettingsRow);
        // FOR UPDATE: dos cambios simultáneos se atienden uno tras otro.
        const current = await repo.findOne({ where: {}, lock: { mode: 'pessimistic_write' } });
        if (!current) {
          throw new InternalServerErrorException(
            'La configuración de la clínica no está inicializada.',
          );
        }
        const before = auditSnapshot(current);
        if (dto.consultationPriceCents !== undefined) {
          current.consultationPriceCents = dto.consultationPriceCents;
        }
        if (dto.depositCents !== undefined) current.depositCents = dto.depositCents;
        if (dto.paymentQrRef !== undefined) current.paymentQrRef = dto.paymentQrRef;
        if (dto.whatsappPhone !== undefined) {
          assertValidWhatsapp(dto.whatsappPhone);
          current.whatsappPhone = dto.whatsappPhone;
        }
        // Se valida el resultado final (lo guardado + lo enviado).
        assertValidSettings(current.consultationPriceCents, current.depositCents);
        current.updatedBy = actorUserId;
        const saved = await repo.save(current);
        const after = auditSnapshot(saved);
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          await this.audit.record(
            {
              actorKind: 'dentist',
              actorUserId,
              entityType: 'clinic_settings',
              entityId: saved.id,
              action: 'clinic_settings_updated',
              before,
              after,
            },
            ctx,
            manager,
          );
        }
        return toClinicSettings(saved);
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code === PG_CHECK_VIOLATION
      ) {
        throw new BadRequestException(DEPOSIT_RANGE);
      }
      throw error;
    }
  }
}
