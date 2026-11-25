/** Reglas de acceso del dentista (RF-13, B-04). */

/** Intentos fallidos seguidos antes de bloquear la cuenta. */
export const LOGIN_MAX_FAILED_ATTEMPTS = 5;

/** Minutos de bloqueo tras alcanzar el máximo de intentos fallidos. */
export const LOGIN_LOCK_MINUTES = 15;

/** Minutos sin actividad tras los que la sesión se cierra. */
export const SESSION_IDLE_MINUTES = 30;

/** Duración máxima de una sesión aunque haya actividad (propuesta, ADR-012). */
export const SESSION_MAX_HOURS = 12;

/** Longitud mínima de contraseña del dentista (propuesta, ADR-012). */
export const PASSWORD_MIN_LENGTH = 12;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Usuario autenticado tal como lo ve la web (sin datos sensibles). */
export interface AuthUserResponse {
  id: string;
  username: string;
  fullName: string;
  /** true si debe cambiar la contraseña temporal antes de usar el sistema. */
  mustChangePassword: boolean;
}
