import {
  PAYMENT_QR_REF_MAX_LENGTH,
  WHATSAPP_PHONE_PATTERN,
  type UpdateClinicSettingsRequest,
} from '@sistema-dental/contracts';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Quita espacios; un texto vacío se guarda como null. */
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const PRICE_MESSAGE = 'El precio de la consulta debe ser un importe en centavos mayor que cero.';
const DEPOSIT_MESSAGE = 'El anticipo debe ser un importe en centavos.';
const PHONE_MESSAGE =
  'El WhatsApp debe tener solo dígitos, con + opcional al inicio (7 a 15 dígitos).';

/**
 * DTO: solo revisa el FORMATO. Los rangos de negocio (anticipo de 10 a 20 Bs, anticipo
 * no mayor que la consulta) los revisa el servicio y la base.
 */
export class UpdateClinicSettingsDto implements UpdateClinicSettingsRequest {
  @IsOptional()
  @IsInt({ message: PRICE_MESSAGE })
  @Min(1, { message: PRICE_MESSAGE })
  @Max(100_000_000, { message: PRICE_MESSAGE })
  consultationPriceCents?: number;

  @IsOptional()
  @IsInt({ message: DEPOSIT_MESSAGE })
  @Min(0, { message: DEPOSIT_MESSAGE })
  @Max(100_000_000, { message: DEPOSIT_MESSAGE })
  depositCents?: number;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(PAYMENT_QR_REF_MAX_LENGTH, {
    message: `La referencia del QR admite hasta ${PAYMENT_QR_REF_MAX_LENGTH} caracteres.`,
  })
  paymentQrRef?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: PHONE_MESSAGE })
  @Matches(WHATSAPP_PHONE_PATTERN, { message: PHONE_MESSAGE })
  whatsappPhone?: string | null;
}
