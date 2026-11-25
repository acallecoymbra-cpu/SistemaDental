import {
  TREATMENT_DESCRIPTION_MAX_LENGTH,
  TREATMENT_NAME_MAX_LENGTH,
  type CreateTreatmentRequest,
  type UpdateTreatmentRequest,
} from '@sistema-dental/contracts';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

/** Quita espacios al inicio y al final; un texto vacío se guarda como null. */
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

/**
 * DTO = forma validada del cuerpo de la petición. El ValidationPipe global rechaza
 * con 400 cualquier campo que no esté declarado aquí (B-03).
 */
export class CreateTreatmentDto implements CreateTreatmentRequest {
  @Transform(trim)
  @IsString({ message: 'El nombre es obligatorio.' })
  @MinLength(1, { message: 'El nombre es obligatorio.' })
  @MaxLength(TREATMENT_NAME_MAX_LENGTH, {
    message: `El nombre admite hasta ${TREATMENT_NAME_MAX_LENGTH} caracteres.`,
  })
  name!: string;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(TREATMENT_DESCRIPTION_MAX_LENGTH, {
    message: `La descripción admite hasta ${TREATMENT_DESCRIPTION_MAX_LENGTH} caracteres.`,
  })
  description?: string | null;
}

export class UpdateTreatmentDto implements UpdateTreatmentRequest {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'El nombre es obligatorio.' })
  @MinLength(1, { message: 'El nombre es obligatorio.' })
  @MaxLength(TREATMENT_NAME_MAX_LENGTH, {
    message: `El nombre admite hasta ${TREATMENT_NAME_MAX_LENGTH} caracteres.`,
  })
  name?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(TREATMENT_DESCRIPTION_MAX_LENGTH, {
    message: `La descripción admite hasta ${TREATMENT_DESCRIPTION_MAX_LENGTH} caracteres.`,
  })
  description?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso.' })
  active?: boolean;
}
