import {
  PATIENT_EMAIL_MAX_LENGTH,
  PATIENT_GIVEN_NAMES_MAX_LENGTH,
  PATIENT_SURNAME_MAX_LENGTH,
  PHONE_COUNTRIES,
  type CreatePatientRequest,
  type PhoneDialCode,
  type UpdatePatientRequest,
} from '@sistema-dental/contracts';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export const DIAL_CODES = PHONE_COUNTRIES.map((c) => c.dialCode);
export const GIVEN_NAMES_MESSAGE = 'Escribe tu nombre.';
export const FIRST_SURNAME_MESSAGE = 'Escribe tu primer apellido.';
export const COUNTRY_MESSAGE = 'Elige el país del celular.';
const PHONE_MESSAGE = 'El celular es obligatorio.';
const EMAIL_MESSAGE = 'El correo no es válido.';
const DATE_MESSAGE = 'La fecha de nacimiento debe tener el formato AAAA-MM-DD.';
const GIVEN_MAX = `El nombre admite hasta ${PATIENT_GIVEN_NAMES_MAX_LENGTH} caracteres.`;
const SURNAME_MAX = `Cada apellido admite hasta ${PATIENT_SURNAME_MAX_LENGTH} caracteres.`;

/**
 * DTOs: solo revisan el FORMATO. Las reglas (celular válido para su país, CI, menor con
 * apoderado, fecha real y no futura) las revisa el servicio y la base.
 */
export class CreatePatientDto implements CreatePatientRequest {
  @Transform(trim)
  @IsString({ message: GIVEN_NAMES_MESSAGE })
  @MinLength(1, { message: GIVEN_NAMES_MESSAGE })
  @MaxLength(PATIENT_GIVEN_NAMES_MAX_LENGTH, { message: GIVEN_MAX })
  givenNames!: string;

  @Transform(trim)
  @IsString({ message: FIRST_SURNAME_MESSAGE })
  @MinLength(1, { message: FIRST_SURNAME_MESSAGE })
  @MaxLength(PATIENT_SURNAME_MAX_LENGTH, { message: SURNAME_MAX })
  firstSurname!: string;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: SURNAME_MAX })
  @MaxLength(PATIENT_SURNAME_MAX_LENGTH, { message: SURNAME_MAX })
  secondSurname?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: 'El CI no es válido.' })
  @MaxLength(30, { message: 'El CI es demasiado largo.' })
  ci?: string | null;

  @IsIn(DIAL_CODES, { message: COUNTRY_MESSAGE })
  phoneCountryCode!: PhoneDialCode;

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
  @ValidateIf((_, value) => value !== null)
  @IsIn(DIAL_CODES, { message: COUNTRY_MESSAGE })
  guardianPhoneCountryCode?: PhoneDialCode | null;

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
  @IsString({ message: GIVEN_NAMES_MESSAGE })
  @MinLength(1, { message: GIVEN_NAMES_MESSAGE })
  @MaxLength(PATIENT_GIVEN_NAMES_MAX_LENGTH, { message: GIVEN_MAX })
  givenNames?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: FIRST_SURNAME_MESSAGE })
  @MinLength(1, { message: FIRST_SURNAME_MESSAGE })
  @MaxLength(PATIENT_SURNAME_MAX_LENGTH, { message: SURNAME_MAX })
  firstSurname?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: SURNAME_MAX })
  @MaxLength(PATIENT_SURNAME_MAX_LENGTH, { message: SURNAME_MAX })
  secondSurname?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: 'El CI no es válido.' })
  @MaxLength(30, { message: 'El CI es demasiado largo.' })
  ci?: string | null;

  @IsOptional()
  @IsIn(DIAL_CODES, { message: COUNTRY_MESSAGE })
  phoneCountryCode?: PhoneDialCode;

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
  @ValidateIf((_, value) => value !== null)
  @IsIn(DIAL_CODES, { message: COUNTRY_MESSAGE })
  guardianPhoneCountryCode?: PhoneDialCode | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(30, { message: 'El celular del apoderado es demasiado largo.' })
  guardianPhone?: string | null;
}
