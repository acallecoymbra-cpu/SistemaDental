import {
  PATIENT_EMAIL_MAX_LENGTH,
  PATIENT_GIVEN_NAMES_MAX_LENGTH,
  PATIENT_SURNAME_MAX_LENGTH,
  RECEIPT_NUMBER_PATTERN,
  type PhoneDialCode,
  type CancelAppointmentRequest,
  CANCEL_REASON_MAX_LENGTH,
  COMPLETE_COST_MAX_CENTS,
  COMPLETE_DIAGNOSIS_MAX_LENGTH,
  type CompleteAppointmentRequest,
  type PublicLookupRequest,
  type RescheduleAppointmentRequest,
  type SubmitPaymentProofRequest,
} from '@sistema-dental/contracts';
import { Transform, Type } from 'class-transformer';
import {
  COUNTRY_MESSAGE,
  DIAL_CODES,
  FIRST_SURNAME_MESSAGE,
  GIVEN_NAMES_MESSAGE,
  trim,
  trimOrNull,
} from '../patients/patient.dto';
import {
  IsEmail,
  IsIn,
  IsInt,
  Max,
  Min,
  IsISO8601,
  IsNotEmptyObject,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/**
 * DTOs: solo revisan el FORMATO; las reglas las decide el servicio y la base.
 * El paciente llega como `kind: 'returning'` (ya registrado) o `kind: 'new'`; cada campo se
 * valida solo para la variante que lo usa.
 */
const isReturning = (o: BookingPatientDto) => o.kind === 'returning';
const isNew = (o: BookingPatientDto) => o.kind === 'new';

export class BookingPatientDto {
  @IsIn(['returning', 'new'], { message: 'Indica si ya te atendiste con nosotros.' })
  kind!: 'returning' | 'new';

  @ValidateIf(isReturning)
  @Transform(trim)
  @IsString({ message: GIVEN_NAMES_MESSAGE })
  @MinLength(1, { message: GIVEN_NAMES_MESSAGE })
  @MaxLength(PATIENT_GIVEN_NAMES_MAX_LENGTH, { message: GIVEN_NAMES_MESSAGE })
  firstName?: string;

  @ValidateIf(isNew)
  @Transform(trim)
  @IsString({ message: GIVEN_NAMES_MESSAGE })
  @MinLength(1, { message: GIVEN_NAMES_MESSAGE })
  @MaxLength(PATIENT_GIVEN_NAMES_MAX_LENGTH, {
    message: `El nombre admite hasta ${PATIENT_GIVEN_NAMES_MAX_LENGTH} caracteres.`,
  })
  givenNames?: string;

  @Transform(trim)
  @IsString({ message: FIRST_SURNAME_MESSAGE })
  @MinLength(1, { message: FIRST_SURNAME_MESSAGE })
  @MaxLength(PATIENT_SURNAME_MAX_LENGTH, {
    message: `Cada apellido admite hasta ${PATIENT_SURNAME_MAX_LENGTH} caracteres.`,
  })
  firstSurname!: string;

  @ValidateIf((o: BookingPatientDto, value) => isNew(o) && value != null)
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(PATIENT_SURNAME_MAX_LENGTH, {
    message: `Cada apellido admite hasta ${PATIENT_SURNAME_MAX_LENGTH} caracteres.`,
  })
  secondSurname?: string | null;

  @ValidateIf((o: BookingPatientDto, value) => isNew(o) && value != null)
  @Transform(trimOrNull)
  @IsString({ message: 'El CI no es válido.' })
  @MaxLength(30, { message: 'El CI es demasiado largo.' })
  ci?: string | null;

  @IsIn(DIAL_CODES, { message: COUNTRY_MESSAGE })
  phoneCountryCode!: PhoneDialCode;

  @Transform(trim)
  @IsString({ message: 'El celular es obligatorio.' })
  @MinLength(1, { message: 'El celular es obligatorio.' })
  @MaxLength(30, { message: 'El celular es demasiado largo.' })
  phone!: string;

  @Transform(trim)
  @IsEmail({}, { message: 'Escribe un correo válido.' })
  @MaxLength(PATIENT_EMAIL_MAX_LENGTH, { message: 'Escribe un correo válido.' })
  email!: string;

  @ValidateIf((o: BookingPatientDto, value) => isNew(o) && value != null)
  @Transform(trimOrNull)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD.',
  })
  birthDate?: string | null;

  @ValidateIf((o: BookingPatientDto, value) => isNew(o) && value != null)
  @IsIn(DIAL_CODES, { message: COUNTRY_MESSAGE })
  guardianPhoneCountryCode?: PhoneDialCode | null;

  @ValidateIf((o: BookingPatientDto, value) => isNew(o) && value != null)
  @Transform(trimOrNull)
  @IsString({ message: 'El celular del apoderado no es válido.' })
  @MaxLength(30, { message: 'El celular del apoderado es demasiado largo.' })
  guardianPhone?: string | null;
}

export class CreatePublicBookingDto {
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
  @IsString({ message: GIVEN_NAMES_MESSAGE })
  @MinLength(1, { message: GIVEN_NAMES_MESSAGE })
  @MaxLength(PATIENT_GIVEN_NAMES_MAX_LENGTH, { message: GIVEN_NAMES_MESSAGE })
  firstName!: string;

  @Transform(trim)
  @IsString({ message: FIRST_SURNAME_MESSAGE })
  @MinLength(1, { message: FIRST_SURNAME_MESSAGE })
  @MaxLength(PATIENT_SURNAME_MAX_LENGTH, { message: FIRST_SURNAME_MESSAGE })
  firstSurname!: string;

  @IsIn(DIAL_CODES, { message: COUNTRY_MESSAGE })
  phoneCountryCode!: PhoneDialCode;

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
