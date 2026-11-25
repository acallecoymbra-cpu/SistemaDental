import {
  PASSWORD_MIN_LENGTH,
  type ChangePasswordRequest,
  type LoginRequest,
} from '@sistema-dental/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class ChangePasswordDto implements ChangePasswordRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  @MaxLength(256)
  newPassword!: string;
}
