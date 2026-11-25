import 'reflect-metadata';
import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  LOGIN_LOCK_MINUTES,
  LOGIN_MAX_FAILED_ATTEMPTS,
  SESSION_IDLE_MINUTES,
} from '@sistema-dental/contracts';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { createTestDataSource, resetTestDatabase, testDatabaseUrl } from './test-database';

const WEB = 'http://localhost:3000';
const USERNAME = 'dra.prueba';
const PASSWORD = 'clave-de-prueba-segura';

/** Ruta protegida normal (sin @AllowPendingPasswordChange) para probar el guard. */
@Controller('test-protegida')
class ProtectedController {
  @Get()
  ok(): { ok: true } {
    return { ok: true };
  }
}

describe('autenticación del dentista (B-04, PostgreSQL real)', () => {
  let app: NestExpressApplication;
  let db: DataSource;
  let userId: string;

  const http = () => request(app.getHttpServer());

  function login(username = USERNAME, password = PASSWORD) {
    return http().post('/api/v1/auth/login').set('Origin', WEB).send({ username, password });
  }

  function sessionCookie(res: request.Response): string {
    const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
    const cookie = raw?.find((c) => c.startsWith('sd_session='));
    if (!cookie) {
      throw new Error('No se recibió la cookie de sesión');
    }
    return cookie.split(';')[0]!;
  }

  async function auditActions(): Promise<string[]> {
    const rows: { action: string }[] = await db.query(
      'SELECT action FROM audit_log ORDER BY occurred_at, id',
    );
    return rows.map((r) => r.action);
  }

  /** Deja al dentista de prueba como único activo, con la clave conocida y sin bloqueos. */
  async function createDentist(mustChangePassword: boolean): Promise<string> {
    const { hashPassword } = await import('../../src/auth/passwords');
    const hash = await hashPassword(PASSWORD);
    await db.query('UPDATE dentist_user SET active = false WHERE username <> $1', [USERNAME]);
    const updated: [{ id: string }[], number] = await db.query(
      `UPDATE dentist_user
         SET password_hash = $2, must_change_password = $3, failed_attempts = 0,
             locked_until = NULL, active = true
       WHERE username = $1 RETURNING id`,
      [USERNAME, hash, mustChangePassword],
    );
    if (updated[1] > 0) {
      return updated[0][0]!.id;
    }
    const rows: { id: string }[] = await db.query(
      `INSERT INTO dentist_user (username, password_hash, full_name, must_change_password)
       VALUES ($1, $2, 'Dra. Prueba', $3) RETURNING id`,
      [USERNAME, hash, mustChangePassword],
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    await resetTestDatabase();
    db = createTestDataSource();
    await db.initialize();
    await db.runMigrations({ transaction: 'each' });

    process.env.DATABASE_URL = testDatabaseUrl();
    const { AppModule } = await import('../../src/app.module');
    const { configureApp } = await import('../../src/bootstrap');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedController],
    }).compile();
    app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(), {
      allowedOrigins: [WEB],
      trustProxy: false,
    });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await db?.destroy();
  });

  beforeEach(async () => {
    await db.query('DELETE FROM auth_session');
    userId = await createDentist(false);
  });

  describe('login', () => {
    it('exige origen permitido (CSRF)', async () => {
      await http()
        .post('/api/v1/auth/login')
        .send({ username: USERNAME, password: PASSWORD })
        .expect(403);
    });

    it('con credenciales correctas devuelve el usuario y una cookie segura', async () => {
      const res = await login().expect(200);
      expect(res.body).toEqual({
        id: userId,
        username: USERNAME,
        fullName: 'Dra. Prueba',
        mustChangePassword: false,
      });
      const raw = (res.headers['set-cookie'] as unknown as string[]).join(';');
      expect(raw).toContain('HttpOnly');
      expect(raw).toContain('SameSite=Lax');
      expect(raw).toContain('Path=/api');
      expect(JSON.stringify(res.body)).not.toContain('hash');
    });

    it('usuario inexistente y contraseña incorrecta dan el mismo error', async () => {
      const a = await login('no-existe', PASSWORD).expect(401);
      const b = await login(USERNAME, 'incorrecta').expect(401);
      expect(a.body.message).toBe(b.body.message);
      expect(a.body.message).toBe('Usuario o contraseña incorrectos.');
    });

    it('acepta el usuario sin distinguir mayúsculas', async () => {
      await login(USERNAME.toUpperCase()).expect(200);
    });
  });

  describe('bloqueo por intentos fallidos', () => {
    it(`bloquea ${LOGIN_LOCK_MINUTES} min tras ${LOGIN_MAX_FAILED_ATTEMPTS} fallos, incluso con la clave correcta`, async () => {
      for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i++) {
        await login(USERNAME, 'incorrecta').expect(401);
      }
      const blocked = await login().expect(429);
      expect(blocked.body.message).toContain('bloqueada');

      const [user] = await db.query('SELECT locked_until FROM dentist_user WHERE id = $1', [
        userId,
      ]);
      const minutes = (new Date(user.locked_until).getTime() - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(LOGIN_LOCK_MINUTES - 1);
      expect(minutes).toBeLessThanOrEqual(LOGIN_LOCK_MINUTES);

      // Pasado el bloqueo, vuelve a entrar.
      await db.query(`UPDATE dentist_user SET locked_until = now() - interval '1 second'`);
      await login().expect(200);
    });

    it('un login correcto reinicia el contador de fallos', async () => {
      for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS - 1; i++) {
        await login(USERNAME, 'incorrecta').expect(401);
      }
      await login().expect(200);
      await login(USERNAME, 'incorrecta').expect(401);
      await login().expect(200);
    });
  });

  describe('sesión', () => {
    it('sin cookie o con cookie alterada las rutas protegidas responden 401', async () => {
      await http().get('/api/v1/test-protegida').expect(401);
      const cookie = sessionCookie(await login().expect(200));
      const altered = cookie.slice(0, -3) + 'AAA';
      await http().get('/api/v1/test-protegida').set('Cookie', altered).expect(401);
      await http().get('/api/v1/test-protegida').set('Cookie', cookie).expect(200, { ok: true });
    });

    it('health sigue siendo público', async () => {
      await http().get('/api/v1/health').expect(200);
    });

    it('logout revoca la sesión', async () => {
      const cookie = sessionCookie(await login().expect(200));
      await http().post('/api/v1/auth/logout').set('Origin', WEB).set('Cookie', cookie).expect(204);
      await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
    });

    it(`cierra la sesión tras ${SESSION_IDLE_MINUTES} min sin actividad`, async () => {
      const cookie = sessionCookie(await login().expect(200));
      await db.query(
        `UPDATE auth_session SET last_activity_at = now() - interval '${SESSION_IDLE_MINUTES + 1} minutes'`,
      );
      await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
      const [row] = await db.query('SELECT revoked_at FROM auth_session');
      expect(row.revoked_at).not.toBeNull();
    });

    it('no guarda el secreto de la sesión en claro', async () => {
      const cookie = sessionCookie(await login().expect(200));
      const secret = cookie.split('.')[1]!;
      const [row] = await db.query('SELECT secret_hash FROM auth_session');
      expect(row.secret_hash).not.toContain(secret);
      expect(row.secret_hash).toHaveLength(64);
    });
  });

  describe('contraseña temporal', () => {
    beforeEach(async () => {
      await db.query('DELETE FROM auth_session');
      userId = await createDentist(true);
    });

    it('obliga a cambiarla antes de usar otras rutas', async () => {
      const cookie = sessionCookie(await login().expect(200));
      await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
      const res = await http().get('/api/v1/test-protegida').set('Cookie', cookie).expect(403);
      expect(res.body.message).toContain('cambiar su contraseña');
    });

    it('valida la contraseña actual y el largo mínimo', async () => {
      const cookie = sessionCookie(await login().expect(200));
      const change = (body: object) =>
        http()
          .post('/api/v1/auth/change-password')
          .set('Origin', WEB)
          .set('Cookie', cookie)
          .send(body);
      await change({ currentPassword: 'incorrecta', newPassword: 'otra-clave-muy-larga' }).expect(
        400,
      );
      await change({ currentPassword: PASSWORD, newPassword: 'corta' }).expect(400);
      await change({ currentPassword: PASSWORD, newPassword: PASSWORD }).expect(400);
    });

    it('al cambiarla se habilita el sistema y se cierran las otras sesiones', async () => {
      const other = sessionCookie(await login().expect(200));
      const cookie = sessionCookie(await login().expect(200));
      await http()
        .post('/api/v1/auth/change-password')
        .set('Origin', WEB)
        .set('Cookie', cookie)
        .send({ currentPassword: PASSWORD, newPassword: 'nueva-clave-segura-2026' })
        .expect(204);
      await http().get('/api/v1/test-protegida').set('Cookie', cookie).expect(200);
      await http().get('/api/v1/auth/me').set('Cookie', other).expect(401);
      await login(USERNAME, 'nueva-clave-segura-2026').expect(200);
    });
  });

  describe('auditoría', () => {
    it('registra los eventos de acceso sin contraseñas ni tokens', async () => {
      await db.query('ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_truncate');
      await db.query('ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_update_delete');
      await db.query('DELETE FROM audit_log');
      await db.query('ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_update_delete');
      await db.query('ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_truncate');

      await login(USERNAME, 'clave-equivocada').expect(401);
      const cookie = sessionCookie(await login().expect(200));
      await http().post('/api/v1/auth/logout').set('Origin', WEB).set('Cookie', cookie).expect(204);

      expect(await auditActions()).toEqual(['login_failed', 'login_succeeded', 'logout']);
      const dump = JSON.stringify(await db.query('SELECT * FROM audit_log'));
      expect(dump).not.toContain('clave-equivocada');
      expect(dump).not.toContain(PASSWORD);
      expect(dump).not.toContain(cookie.split('.')[1]!);
    });

    it('la auditoría no se puede modificar ni borrar', async () => {
      await login().expect(200);
      await expect(db.query(`UPDATE audit_log SET action = 'alterado'`)).rejects.toThrow(
        'solo de inserción',
      );
      await expect(db.query('DELETE FROM audit_log')).rejects.toThrow('solo de inserción');
    });
  });

  describe('regla de un solo dentista', () => {
    it('la BD impide dos dentistas activos', async () => {
      await expect(
        db.query(
          `INSERT INTO dentist_user (username, password_hash, full_name) VALUES ('otro', 'x', 'Otro')`,
        ),
      ).rejects.toThrow();
    });
  });
});
