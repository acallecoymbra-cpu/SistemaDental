import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { securityOptionsFromConfig } from './common/security-options';

async function main(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  configureApp(app, securityOptionsFromConfig(config));
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'));
}

void main();
