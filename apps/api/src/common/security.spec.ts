import 'reflect-metadata';
import { Body, Controller, ForbiddenException, Get, Logger, Module, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IsInt, IsString, Min, MinLength } from 'class-validator';
import request from 'supertest';
import { configureApp } from '../bootstrap';

const WEB = 'http://localhost:3000';

class EchoDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsInt()
  @Min(0)
  age!: number;
}

@Controller('test')
class TestController {
  @Post('echo')
  echo(@Body() dto: EchoDto): EchoDto {
    return dto;
  }

  @Get('boom')
  boom(): never {
    throw new Error('detalle interno secreto');
  }

  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenException('Sin permiso.');
  }
}

@Module({ controllers: [TestController] })
class TestModule {}

describe('seguridad HTTP base (B-03)', () => {
  let app: NestExpressApplication;
  let logSpy: jest.SpyInstance;

  beforeAll(async () => {
    logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
    app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(), {
      allowedOrigins: [WEB],
      trustProxy: false,
    });
    await app.init();
  });

  afterAll(async () => {
    logSpy.mockRestore();
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('protección CSRF por origen', () => {
    it('acepta un POST desde el origen permitido', async () => {
      await http()
        .post('/api/v1/test/echo')
        .set('Origin', WEB)
        .send({ name: 'Ana', age: 30 })
        .expect(201, { name: 'Ana', age: 30 });
    });

    it('acepta un POST sin Origin pero con Referer permitido', async () => {
      await http()
        .post('/api/v1/test/echo')
        .set('Referer', `${WEB}/agendar`)
        .send({ name: 'Ana', age: 30 })
        .expect(201);
    });

    it('rechaza un POST sin origen', async () => {
      const res = await http().post('/api/v1/test/echo').send({ name: 'Ana', age: 30 }).expect(403);
      expect(res.body).toMatchObject({ statusCode: 403, message: 'Origen no permitido.' });
    });

    it('rechaza un POST desde un origen ajeno', async () => {
      await http()
        .post('/api/v1/test/echo')
        .set('Origin', 'https://sitio-malicioso.example')
        .send({ name: 'Ana', age: 30 })
        .expect(403);
    });

    it('no exige origen en GET', async () => {
      await http().get('/api/v1/test/forbidden').expect(403);
    });
  });

  describe('validación de entrada', () => {
    it('rechaza campos que no están en el DTO', async () => {
      const res = await http()
        .post('/api/v1/test/echo')
        .set('Origin', WEB)
        .send({ name: 'Ana', age: 30, isAdmin: true })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain('isAdmin');
    });

    it('rechaza datos inválidos con un mensaje por campo', async () => {
      const res = await http()
        .post('/api/v1/test/echo')
        .set('Origin', WEB)
        .send({ name: 'A', age: -1 })
        .expect(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('errores sin detalles internos', () => {
    it('un error inesperado responde 500 genérico, sin stack ni mensaje interno', async () => {
      const res = await http().get('/api/v1/test/boom').expect(500);
      expect(res.body).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Error interno. Intente nuevamente más tarde.',
      });
      expect(JSON.stringify(res.body)).not.toContain('secreto');
      expect(JSON.stringify(res.body)).not.toContain('at ');
      expect(typeof res.body.requestId).toBe('string');
    });

    it('el log del error no incluye el cuerpo de la petición', async () => {
      logSpy.mockClear();
      await http()
        .get('/api/v1/test/boom')
        .set('Authorization', 'Bearer token-secreto')
        .expect(500);
      const logged = JSON.stringify(logSpy.mock.calls);
      expect(logged).toContain('GET /api/v1/test/boom');
      expect(logged).not.toContain('token-secreto');
    });

    it('una ruta inexistente responde 404 con la forma estándar', async () => {
      const res = await http().get('/api/v1/no-existe').expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
    });
  });

  describe('cabeceras y CORS', () => {
    it('devuelve x-request-id y oculta x-powered-by', async () => {
      const res = await http().get('/api/v1/no-existe');
      expect(res.headers['x-request-id']).toMatch(/^[A-Za-z0-9-]{8,64}$/);
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('descarta un x-request-id con caracteres no permitidos', async () => {
      const res = await http()
        .get('/api/v1/no-existe')
        .set('x-request-id', 'malo <script> inyectado');
      expect(res.headers['x-request-id']).not.toContain('malo');
    });

    it('CORS permite el origen de la web con credenciales', async () => {
      const res = await http()
        .options('/api/v1/test/echo')
        .set('Origin', WEB)
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBe(WEB);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('CORS no autoriza otros orígenes', async () => {
      const res = await http()
        .options('/api/v1/test/echo')
        .set('Origin', 'https://sitio-malicioso.example')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
