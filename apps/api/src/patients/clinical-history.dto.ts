import {
  CLINICAL_ANAMNESIS_MAX_LENGTH,
  CLINICAL_DIAGNOSIS_MAX_LENGTH,
  CLINICAL_INDEX_MAX_LENGTH,
  type SaveClinicalVersionRequest,
} from '@sistema-dental/contracts';
import { IsString, MaxLength } from 'class-validator';

/** Solo revisa el formato: los cuatro campos son texto (pueden ir vacíos) con su largo máximo. */
export class SaveClinicalVersionDto implements SaveClinicalVersionRequest {
  @IsString({ message: 'La anamnesis debe ser texto.' })
  @MaxLength(CLINICAL_ANAMNESIS_MAX_LENGTH, { message: 'La anamnesis es demasiado larga.' })
  anamnesis!: string;

  @IsString({ message: 'El tipo de índice debe ser texto.' })
  @MaxLength(CLINICAL_INDEX_MAX_LENGTH, { message: 'El tipo de índice es demasiado largo.' })
  dentalIndexType!: string;

  @IsString({ message: 'El valor del índice debe ser texto.' })
  @MaxLength(CLINICAL_INDEX_MAX_LENGTH, { message: 'El valor del índice es demasiado largo.' })
  dentalIndexValue!: string;

  @IsString({ message: 'El diagnóstico debe ser texto.' })
  @MaxLength(CLINICAL_DIAGNOSIS_MAX_LENGTH, { message: 'El diagnóstico es demasiado largo.' })
  diagnosis!: string;
}
