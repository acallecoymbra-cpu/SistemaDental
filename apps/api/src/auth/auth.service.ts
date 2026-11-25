import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  LOGIN_LOCK_MINUTES,
  LOGIN_MAX_FAILED_ATTEMPTS,
  SESSION_IDLE_MINUTES,
  SESSION_MAX_HOURS,
} from '@sistema-dental/contracts';
import { DataSource } from 'typeorm';
import { AuditService, RequestContext } from '../audit/audit.service';
import { DentistUser } from '../users/dentist-user.entity';
import { AuthSession } from './auth-session.entity';
import type { AuthContext } from './auth.types';
import { dummyPasswordHash, hashPassword, verifyPassword } from './passwords';
import { buildToken, hashSecret, newSecret, parseToken, secretMatches } from './session-token';

const MINUTE = 60_000;
/** Cada cuánto se actualiza last_activity_at como máximo (evita una escritura por petición). */
const ACTIVITY_WRITE_INTERVAL_MS = MINUTE;

export const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos.';
export const ACCOUNT_LOCKED = `Cuenta bloqueada por ${LOGIN_MAX_FAILED_ATTEMPTS} intentos fallidos. Intente nuevamente en ${LOGIN_LOCK_MINUTES} minutos.`;
export const SESSION_INVALID = 'Sesión no válida o vencida. Inicie sesión nuevamente.';

export interface LoginResult {
  token: string;
  user: DentistUser;
}

/** Login, sesiones y cambio de contraseña del dentista (RF-13, TASK-101). */
@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  private now(): Date {
    return new Date();
  }

  async login(username: string, password: string, ctx: RequestContext): Promise<LoginResult> {
    // Los fallos se confirman en la BD (intentos, bloqueo, auditoría) y el error se lanza
    // DESPUÉS de la transacción; si se lanzara dentro, el rollback borraría el conteo.
    const outcome = await this.loginTransaction(username, password, ctx);
    if (outcome.kind === 'invalid') {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (outcome.kind === 'locked') {
      throw new HttpException(ACCOUNT_LOCKED, HttpStatus.TOO_MANY_REQUESTS);
    }
    return outcome.result;
  }

  private loginTransaction(
    username: string,
    password: string,
    ctx: RequestContext,
  ): Promise<{ kind: 'ok'; result: LoginResult } | { kind: 'invalid' } | { kind: 'locked' }> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(DentistUser)
        .createQueryBuilder('u')
        .addSelect('u.passwordHash')
        .where('lower(u.username) = lower(:username)', { username })
        .setLock('pessimistic_write')
        .getOne();

      if (!user || !user.active) {
        await verifyPassword(await dummyPasswordHash(), password);
        await this.audit.record(
          { actorKind: 'anonymous', entityType: 'dentist_user', action: 'login_failed' },
          ctx,
          manager,
        );
        return { kind: 'invalid' as const };
      }

      const now = this.now();
      if (user.lockedUntil && user.lockedUntil > now) {
        await this.audit.record(
          {
            actorKind: 'anonymous',
            entityType: 'dentist_user',
            entityId: user.id,
            action: 'login_blocked',
          },
          ctx,
          manager,
        );
        return { kind: 'locked' as const };
      }

      if (!(await verifyPassword(user.passwordHash, password))) {
        const attempts = user.failedAttempts + 1;
        const locks = attempts >= LOGIN_MAX_FAILED_ATTEMPTS;
        await manager.update(DentistUser, user.id, {
          failedAttempts: locks ? 0 : attempts,
          lockedUntil: locks ? new Date(now.getTime() + LOGIN_LOCK_MINUTES * MINUTE) : null,
        });
        await this.audit.record(
          {
            actorKind: 'anonymous',
            entityType: 'dentist_user',
            entityId: user.id,
            action: locks ? 'account_locked' : 'login_failed',
            after: { failedAttempts: attempts },
          },
          ctx,
          manager,
        );
        // El error no distingue usuario inexistente de contraseña incorrecta.
        return { kind: 'invalid' as const };
      }

      await manager.update(DentistUser, user.id, { failedAttempts: 0, lockedUntil: null });
      const secret = newSecret();
      const session = await manager.getRepository(AuthSession).save({
        userId: user.id,
        secretHash: hashSecret(secret),
        lastActivityAt: now,
        expiresAt: new Date(now.getTime() + SESSION_MAX_HOURS * 60 * MINUTE),
        revokedAt: null,
      });
      await this.audit.record(
        {
          actorKind: 'dentist',
          actorUserId: user.id,
          entityType: 'auth_session',
          entityId: session.id,
          action: 'login_succeeded',
        },
        ctx,
        manager,
      );
      return { kind: 'ok' as const, result: { token: buildToken(session.id, secret), user } };
    });
  }

  /** Valida el token de la cookie; cierra la sesión si venció por tiempo o inactividad. */
  async authenticate(token: unknown, ctx: RequestContext): Promise<AuthContext> {
    const parsed = parseToken(token);
    if (!parsed) {
      throw new UnauthorizedException(SESSION_INVALID);
    }
    const sessions = this.dataSource.getRepository(AuthSession);
    const session = await sessions.findOneBy({ id: parsed.sessionId });
    if (!session || session.revokedAt || !secretMatches(parsed.secret, session.secretHash)) {
      throw new UnauthorizedException(SESSION_INVALID);
    }

    const now = this.now();
    const idleLimit = new Date(now.getTime() - SESSION_IDLE_MINUTES * MINUTE);
    if (session.expiresAt <= now || session.lastActivityAt <= idleLimit) {
      await sessions.update(session.id, { revokedAt: now });
      await this.audit.record(
        {
          actorKind: 'system',
          actorUserId: session.userId,
          entityType: 'auth_session',
          entityId: session.id,
          action: session.expiresAt <= now ? 'session_expired' : 'session_idle_timeout',
        },
        ctx,
      );
      throw new UnauthorizedException(SESSION_INVALID);
    }

    const user = await this.dataSource.getRepository(DentistUser).findOneBy({ id: session.userId });
    if (!user || !user.active) {
      throw new UnauthorizedException(SESSION_INVALID);
    }

    if (now.getTime() - session.lastActivityAt.getTime() >= ACTIVITY_WRITE_INTERVAL_MS) {
      await sessions.update(session.id, { lastActivityAt: now });
    }
    return { sessionId: session.id, user };
  }

  async logout(auth: AuthContext, ctx: RequestContext): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(AuthSession, auth.sessionId, { revokedAt: this.now() });
      await this.audit.record(
        {
          actorKind: 'dentist',
          actorUserId: auth.user.id,
          entityType: 'auth_session',
          entityId: auth.sessionId,
          action: 'logout',
        },
        ctx,
        manager,
      );
    });
  }

  /** Cambia la contraseña y cierra las demás sesiones abiertas del dentista. */
  async changePassword(
    auth: AuthContext,
    currentPassword: string,
    newPassword: string,
    ctx: RequestContext,
  ): Promise<void> {
    if (currentPassword === newPassword) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual.');
    }
    await this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(DentistUser)
        .createQueryBuilder('u')
        .addSelect('u.passwordHash')
        .where('u.id = :id', { id: auth.user.id })
        .setLock('pessimistic_write')
        .getOneOrFail();
      if (!(await verifyPassword(user.passwordHash, currentPassword))) {
        throw new BadRequestException('La contraseña actual no es correcta.');
      }
      await manager.update(DentistUser, user.id, {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
      });
      await manager
        .createQueryBuilder()
        .update(AuthSession)
        .set({ revokedAt: this.now() })
        .where('user_id = :userId AND id <> :sessionId AND revoked_at IS NULL', {
          userId: user.id,
          sessionId: auth.sessionId,
        })
        .execute();
      await this.audit.record(
        {
          actorKind: 'dentist',
          actorUserId: user.id,
          entityType: 'dentist_user',
          entityId: user.id,
          action: 'password_changed',
        },
        ctx,
        manager,
      );
    });
  }
}
