import type { AuthUserResponse } from '@sistema-dental/contracts';
import type { DentistUser } from '../users/dentist-user.entity';

export const SESSION_COOKIE = 'sd_session';

export interface AuthContext {
  sessionId: string;
  user: DentistUser;
}

export function toAuthUserResponse(user: DentistUser): AuthUserResponse {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    mustChangePassword: user.mustChangePassword,
  };
}
