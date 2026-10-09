import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '@toka/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { loadAuthConfig } from './infrastructure/config/auth-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app, 'api/auth');
  app.use(cookieParser());
  await app.listen(loadAuthConfig().port, '0.0.0.0');
}

void bootstrap();
