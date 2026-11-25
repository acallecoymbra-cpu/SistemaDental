import type { ApiErrorResponse } from '@sistema-dental/contracts';
import type { NextFunction, Request, Response } from 'express';
import { getRequestId } from './request-id';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(req: Request): string | undefined {
  const origin = req.header('origin');
  if (origin) {
    return origin;
  }
  const referer = req.header('referer');
  if (!referer) {
    return undefined;
  }
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/**
 * Protección CSRF (B-03): toda petición que modifica datos debe venir de un origen
 * permitido (cabecera Origin o, en su defecto, Referer). Se combina con cookies
 * SameSite en las sesiones (B-04). Las peticiones sin origen se rechazan.
 */
export function originCheckMiddleware(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = originOf(req);
    if (origin && allowed.has(origin)) {
      next();
      return;
    }
    const body: ApiErrorResponse = {
      statusCode: 403,
      error: 'Forbidden',
      message: 'Origen no permitido.',
      requestId: getRequestId(req),
    };
    res.status(403).json(body);
  };
}
