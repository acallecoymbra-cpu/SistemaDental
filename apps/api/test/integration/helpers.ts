import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { createTestDataSource, resetTestDatabase, testDatabaseUrl } from './test-database';

/**
 * Utilidades para pruebas de integración de cualquier módulo (molde B-05).
 * Uso típico:
 *
 *   const ctx = await startTestApp();          // BD vacía + migraciones + app completa
 *   const cookie = await ctx.loginAsDentist(); // sesión lista para rutas del panel
 *   await ctx.http().get('/api/v1/admin/...').set('Cookie', cookie).expect(200);
 *   await ctx.close();
 */
export const TEST_WEB_ORIGIN = 'http://localhost:3000';
export const TEST_DENTIST = { username: 'dra.prueba', password: 'clave-de-prueba-segura' };

export interface TestApp {
  app: NestExpressApplication;
  db: DataSource;
  http: () => ReturnType<typeof request>;
  /** Crea (o reinicia) al dentista de prueba y devuelve la cookie de sesión. */
  loginAsDentist: () => Promise<string>;
  close: () => Promise<void>;
}

export async function startTestApp(extraControllers: Type<unknown>[] = []): Promise<TestApp> {
  await resetTestDatabase();
  const db = createTestDataSource();
  await db.initialize();
  await db.runMigrations({ transaction: 'each' });

  process.env.DATABASE_URL = testDatabaseUrl();
  const { AppModule } = await import('../../src/app.module');
  const { configureApp } = await import('../../src/bootstrap');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: extraControllers,
  }).compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(), {
    allowedOrigins: [TEST_WEB_ORIGIN],
    trustProxy: false,
  });
  await app.init();

  const http = () => request(app.getHttpServer());

  async function loginAsDentist(): Promise<string> {
    const { hashPassword } = await import('../../src/auth/passwords');
    await db.query('UPDATE dentist_user SET active = false WHERE username <> $1', [
      TEST_DENTIST.username,
    ]);
    await db.query(
      `INSERT INTO dentist_user (username, password_hash, full_name, must_change_password)
       VALUES ($1, $2, 'Dra. Prueba', false)
       ON CONFLICT (lower(username)) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, active = true,
             must_change_password = false, failed_attempts = 0, locked_until = NULL`,
      [TEST_DENTIST.username, await hashPassword(TEST_DENTIST.password)],
    );
    const res = await http()
      .post('/api/v1/auth/login')
      .set('Origin', TEST_WEB_ORIGIN)
      .send(TEST_DENTIST)
      .expect(200);
    const raw = res.headers['set-cookie'] as unknown as string[];
    const cookie = raw.find((c) => c.startsWith('sd_session='));
    if (!cookie) {
      throw new Error('El login no devolvió la cookie de sesión');
    }
    return cookie.split(';')[0]!;
  }

  return {
    app,
    db,
    http,
    loginAsDentist,
    close: async () => {
      await app.close();
      await db.destroy();
    },
  };
}
