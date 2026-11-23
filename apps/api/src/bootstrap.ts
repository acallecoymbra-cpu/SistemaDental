import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

export const API_PREFIX = 'api/v1';

/** Configuración común de la app: usada por main.ts y por las pruebas. */
export function configureApp(app: INestApplication): INestApplication {
  app.use(helmet());
  app.setGlobalPrefix(API_PREFIX);
  return app;
}
