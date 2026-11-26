import {
  PATIENT_EMAIL_MAX_LENGTH,
  PATIENT_NAME_MAX_LENGTH,
  RECEIPT_NUMBER_PATTERN,
  type BookingPatientRequest,
  type CancelAppointmentRequest,
  CANCEL_REASON_MAX_LENGTH,
  COMPLETE_COST_MAX_CENTS,
  COMPLETE_DIAGNOSIS_MAX_LENGTH,
  type CompleteAppointmentRequest,
  type CreatePublicBookingRequest,
  type PublicLookupRequest,
  type RescheduleAppointmentRequest,
  type SubmitPaymentProofRequest,
} from '@sistema-dental/contracts';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  Max,
  Min,
  IsISO8601,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

/** DTOs: solo revisan el FORMATO; las reglas las decide el servicio y la base. */
export class BookingPatientDto implements BookingPatientRequest {
  @Transform(trim)
  @IsString({ message: 'El nombre es obligatorio.' })
  @MinLength(1, { message: 'El nombre es obligatorio.' })
  @MaxLength(PATIENT_NAME_MAX_LENGTH, {
    message: `El nombre admite hasta ${PATIENT_NAME_MAX_LENGTH} caracteres.`,
  })
  fullName!: string;

  @Transform(trim)
  @IsString({ message: 'El celular es obligatorio.' })
  @MinLength(1, { message: 'El celular es obligatorio.' })
  @MaxLength(30, { message: 'El celular es demasiado largo.' })
  phone!: string;

  @Transform(trim)
  @IsEmail({}, { message: 'Escribe un correo válido.' })
  @MaxLength(PATIENT_EMAIL_MAX_LENGTH, { message: 'Escribe un correo válido.' })
  email!: string;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD.',
  })
  birthDate?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: 'El celular del apoderado no es válido.' })
  @MaxLength(30, { message: 'El celular del apoderado es demasiado largo.' })
  guardianPhone?: string | null;
}

export class CreatePublicBookingDto implements CreatePublicBookingRequest {
  @IsUUID('4', { message: 'Elige un tratamiento.' })
  treatmentId!: string;

  @IsISO8601({ strict: true }, { message: 'Elige un horario de la lista.' })
  startsAt!: string;

  @IsNotEmptyObject({}, { message: 'Faltan los datos del paciente.' })
  @ValidateNested()
  @Type(() => BookingPatientDto)
  patient!: BookingPatientDto;
}

export class SubmitPaymentProofDto implements SubmitPaymentProofRequest {
  @Transform(trim)
  @IsString({ message: 'Escribe el número de comprobante.' })
  @Matches(RECEIPT_NUMBER_PATTERN, {
    message: 'El número de comprobante solo lleva letras, números y guiones (4 a 30 caracteres).',
  })
  receiptNumber!: string;
}

export class PublicLookupDto implements PublicLookupRequest {
  @Transform(trim)
  @IsString({ message: 'Escribe tu nombre completo.' })
  @MinLength(1, { message: 'Escribe tu nombre completo.' })
  @MaxLength(PATIENT_NAME_MAX_LENGTH, { message: 'Escribe tu nombre completo.' })
  fullName!: string;

  @Transform(trim)
  @IsString({ message: 'Escribe tu celular.' })
  @MinLength(1, { message: 'Escribe tu celular.' })
  @MaxLength(30, { message: 'Escribe tu celular.' })
  phone!: string;
}

export class CancelAppointmentDto implements CancelAppointmentRequest {
  @Transform(trim)
  @IsString({ message: 'Escribe el motivo de la cancelación.' })
  @MinLength(1, { message: 'Escribe el motivo de la cancelación.' })
  @MaxLength(CANCEL_REASON_MAX_LENGTH, {
    message: `El motivo admite hasta ${CANCEL_REASON_MAX_LENGTH} caracteres.`,
  })
  reason!: string;
}

export class RescheduleAppointmentDto implements RescheduleAppointmentRequest {
  @IsISO8601({ strict: true }, { message: 'Elige un horario de la lista.' })
  startsAt!: string;
}

export class CompleteAppointmentDto implements CompleteAppointmentRequest {
  @Transform(trim)
  @IsString({ message: 'Escribe el diagnóstico.' })
  @MinLength(1, { message: 'Escribe el diagnóstico.' })
  @MaxLength(COMPLETE_DIAGNOSIS_MAX_LENGTH, {
    message: `El diagnóstico admite hasta ${COMPLETE_DIAGNOSIS_MAX_LENGTH} caracteres.`,
  })
  diagnosis!: string;

  @IsInt({ message: 'Escribe el costo de la consulta.' })
  @Min(0, { message: 'El costo no puede ser negativo.' })
  @Max(COMPLETE_COST_MAX_CENTS, { message: 'El costo es demasiado alto.' })
  costCents!: number;
}
