import {
  PASSWORD_MIN_LENGTH,
  type ChangePasswordRequest,
  type LoginRequest,
} from '@sistema-dental/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @IsString({ message: 'Escribe tu usuario.' })
  @MinLength(1, { message: 'Escribe tu usuario.' })
  @MaxLength(64, { message: 'El usuario es demasiado largo.' })
  username!: string;

  @IsString({ message: 'Escribe tu contraseña.' })
  @MinLength(1, { message: 'Escribe tu contraseña.' })
  @MaxLength(256, { message: 'La contraseña es demasiado larga.' })
  password!: string;
}

export class ChangePasswordDto implements ChangePasswordRequest {
  @IsString({ message: 'Escribe tu contraseña actual.' })
  @MinLength(1, { message: 'Escribe tu contraseña actual.' })
  @MaxLength(256, { message: 'La contraseña actual es demasiado larga.' })
  currentPassword!: string;

  @IsString({ message: 'Escribe la nueva contraseña.' })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  @MaxLength(256, { message: 'La nueva contraseña es demasiado larga.' })
  newPassword!: string;
}
