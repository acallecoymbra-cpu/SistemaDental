import { hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';

/** Hash Argon2id con los parámetros por defecto de @node-rs/argon2 (m=19456, t=2, p=1). */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}

/** Contraseña temporal legible para el primer acceso (se cambia obligatoriamente). */
export function temporaryPassword(): string {
  return randomBytes(12).toString('base64url');
}

/**
 * Hash ficticio para comparar cuando el usuario no existe: así el tiempo de
 * respuesta no revela si un nombre de usuario es válido.
 */
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}
