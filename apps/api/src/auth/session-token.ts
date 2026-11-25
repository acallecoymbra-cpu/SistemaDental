import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Token de sesión opaco: "<id de sesión>.<secreto>". En la BD solo se guarda el
 * SHA-256 del secreto; si alguien lee la tabla, no puede reutilizar las sesiones.
 */
export interface ParsedToken {
  sessionId: string;
  secret: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET = /^[A-Za-z0-9_-]{43}$/;

export function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function buildToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function parseToken(token: unknown): ParsedToken | null {
  if (typeof token !== 'string') {
    return null;
  }
  const [sessionId, secret, extra] = token.split('.');
  if (
    extra !== undefined ||
    !sessionId ||
    !secret ||
    !UUID.test(sessionId) ||
    !SECRET.test(secret)
  ) {
    return null;
  }
  return { sessionId, secret };
}

/** Comparación en tiempo constante del hash guardado con el del secreto recibido. */
export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(secret), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
