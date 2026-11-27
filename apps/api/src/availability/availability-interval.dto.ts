import {
  AVAILABILITY_DATE_PATTERN,
  AVAILABILITY_TIME_PATTERN,
  type CreateAvailabilityIntervalRequest,
  type UpdateAvailabilityIntervalRequest,
} from '@sistema-dental/contracts';
import { IsOptional, IsString, Matches } from 'class-validator';

const DATE_MESSAGE = 'La fecha debe tener el formato AAAA-MM-DD.';
const START_MESSAGE = 'La hora de inicio debe tener el formato HH:mm (de 00:00 a 23:59).';
const END_MESSAGE = 'La hora de fin debe tener el formato HH:mm (de 00:00 a 23:59).';

/**
 * DTO = forma validada del cuerpo de la petición. Aquí solo se revisa el FORMATO;
 * las reglas (fin > inicio, mínimo 45 min, fecha real) las revisa el servicio y la base.
 */
export class CreateAvailabilityIntervalDto implements CreateAvailabilityIntervalRequest {
  @IsString({ message: DATE_MESSAGE })
  @Matches(AVAILABILITY_DATE_PATTERN, { message: DATE_MESSAGE })
  serviceDate!: string;

  @IsString({ message: START_MESSAGE })
  @Matches(AVAILABILITY_TIME_PATTERN, { message: START_MESSAGE })
  startsLocal!: string;

  @IsString({ message: END_MESSAGE })
  @Matches(AVAILABILITY_TIME_PATTERN, { message: END_MESSAGE })
  endsLocal!: string;
}

export class UpdateAvailabilityIntervalDto implements UpdateAvailabilityIntervalRequest {
  @IsOptional()
  @IsString({ message: DATE_MESSAGE })
  @Matches(AVAILABILITY_DATE_PATTERN, { message: DATE_MESSAGE })
  serviceDate?: string;

  @IsOptional()
  @IsString({ message: START_MESSAGE })
  @Matches(AVAILABILITY_TIME_PATTERN, { message: START_MESSAGE })
  startsLocal?: string;

  @IsOptional()
  @IsString({ message: END_MESSAGE })
  @Matches(AVAILABILITY_TIME_PATTERN, { message: END_MESSAGE })
  endsLocal?: string;
}
