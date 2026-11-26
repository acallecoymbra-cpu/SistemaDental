import {
  PATIENT_EMAIL_MAX_LENGTH,
  PATIENT_NAME_MAX_LENGTH,
  type CreatePatientRequest,
  type UpdatePatientRequest,
} from '@sistema-dental/contracts';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const NAME_MESSAGE = 'El nombre es obligatorio.';
const PHONE_MESSAGE = 'El celular es obligatorio.';
const EMAIL_MESSAGE = 'El correo no es válido.';
const DATE_MESSAGE = 'La fecha de nacimiento debe tener el formato AAAA-MM-DD.';

/**
 * DTOs: solo revisan el FORMATO. Las reglas (celular de 7 a 15 dígitos, menor con apoderado,
 * fecha real y no futura) las revisa el servicio y la base.
 */
export class CreatePatientDto implements CreatePatientRequest {
  @Transform(trim)
  @IsString({ message: NAME_MESSAGE })
  @MinLength(1, { message: NAME_MESSAGE })
  @MaxLength(PATIENT_NAME_MAX_LENGTH, {
    message: `El nombre admite hasta ${PATIENT_NAME_MAX_LENGTH} caracteres.`,
  })
  fullName!: string;

  @Transform(trim)
  @IsString({ message: PHONE_MESSAGE })
  @MinLength(1, { message: PHONE_MESSAGE })
  @MaxLength(30, { message: 'El celular es demasiado largo.' })
  phone!: string;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsEmail({}, { message: EMAIL_MESSAGE })
  @MaxLength(PATIENT_EMAIL_MAX_LENGTH, { message: EMAIL_MESSAGE })
  email?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: DATE_MESSAGE })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  birthDate?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(30, { message: 'El celular del apoderado es demasiado largo.' })
  guardianPhone?: string | null;
}

export class UpdatePatientDto implements UpdatePatientRequest {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: NAME_MESSAGE })
  @MinLength(1, { message: NAME_MESSAGE })
  @MaxLength(PATIENT_NAME_MAX_LENGTH, {
    message: `El nombre admite hasta ${PATIENT_NAME_MAX_LENGTH} caracteres.`,
  })
  fullName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: PHONE_MESSAGE })
  @MinLength(1, { message: PHONE_MESSAGE })
  @MaxLength(30, { message: 'El celular es demasiado largo.' })
  phone?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsEmail({}, { message: EMAIL_MESSAGE })
  @MaxLength(PATIENT_EMAIL_MAX_LENGTH, { message: EMAIL_MESSAGE })
  email?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: DATE_MESSAGE })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  birthDate?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(30, { message: 'El celular del apoderado es demasiado largo.' })
  guardianPhone?: string | null;
}
