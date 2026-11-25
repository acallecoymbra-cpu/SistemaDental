import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthContext } from './auth.types';

export const IS_PUBLIC = 'auth:isPublic';
export const ALLOW_PENDING_PASSWORD_CHANGE = 'auth:allowPendingPasswordChange';

/** Ruta accesible sin sesión. Por defecto TODA ruta exige sesión. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Ruta usable aunque el dentista aún no cambió su contraseña temporal. */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE, true);

/** Inyecta la sesión autenticada en el controlador. */
export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
  return req.auth;
});
