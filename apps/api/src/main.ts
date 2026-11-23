import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function main(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void main();
