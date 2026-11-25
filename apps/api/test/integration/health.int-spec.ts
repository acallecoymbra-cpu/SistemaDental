import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { testDatabaseUrl } from './test-database';

describe('GET /api/v1/health (con PostgreSQL real)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    const { AppModule } = await import('../../src/app.module');
    const { configureApp } = await import('../../src/bootstrap');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(), {
      allowedOrigins: ['http://localhost:3000'],
      trustProxy: false,
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 con la base de datos disponible', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'api', database: 'up' });
  });

  it('no responde fuera del prefijo /api/v1', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });
});
