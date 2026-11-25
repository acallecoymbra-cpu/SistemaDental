import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { originCheckMiddleware } from './common/origin-check';
import { requestIdMiddleware } from './common/request-id';
import type { SecurityOptions } from './common/security-options';

export const API_PREFIX = 'api/v1';

/**
 * Configuración común de la app (B-03), usada por main.ts y por las pruebas para que
 * ambos tengan exactamente la misma seguridad.
 */
export function configureApp(
  app: NestExpressApplication,
  options: SecurityOptions,
): NestExpressApplication {
  app.set('trust proxy', options.trustProxy ? 1 : false);
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.enableCors({
    origin: [...options.allowedOrigins],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    exposedHeaders: ['x-request-id'],
  });
  app.use(cookieParser());
  app.use(originCheckMiddleware(options.allowedOrigins));
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  return app;
}
