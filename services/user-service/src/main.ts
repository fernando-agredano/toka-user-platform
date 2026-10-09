import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '@toka/common';
import { AppModule } from './app.module';
import { loadUserConfig } from './infrastructure/config/user-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app, 'api/users');
  await app.listen(loadUserConfig().port, '0.0.0.0');
}

void bootstrap();
