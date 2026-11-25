import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Formato aceptado para un id recibido (evita inyectar texto arbitrario en los logs). */
const VALID_ID = /^[A-Za-z0-9-]{8,64}$/;

export function getRequestId(req: Request): string {
  return (req as Request & { requestId?: string }).requestId ?? 'desconocido';
}

/** Asigna un id a cada petición y lo devuelve en la cabecera x-request-id. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  (req as Request & { requestId?: string }).requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
