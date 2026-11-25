import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { getRequestId } from '../common/request-id';
import { ALLOW_PENDING_PASSWORD_CHANGE, IS_PUBLIC } from './auth.decorators';
import { AuthService } from './auth.service';
import { SESSION_COOKIE, type AuthContext } from './auth.types';

export const PASSWORD_CHANGE_REQUIRED = 'Debe cambiar su contraseña temporal antes de continuar.';

/**
 * Guard global: toda ruta exige sesión salvo las marcadas con @Public() (deny by default).
 * Con contraseña temporal solo se permiten las rutas marcadas con @AllowPendingPasswordChange().
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const cookies = req.cookies as Record<string, unknown> | undefined;
    req.auth = await this.auth.authenticate(cookies?.[SESSION_COOKIE], {
      requestId: getRequestId(req),
      ip: req.ip,
    });
    if (
      req.auth.user.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE, targets)
    ) {
      throw new ForbiddenException(PASSWORD_CHANGE_REQUIRED);
    }
    return true;
  }
}
