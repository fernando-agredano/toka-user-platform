import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '@toka/common';
import { AppModule } from './app.module';
import { loadRoleConfig } from './infrastructure/config/role-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app, 'api/roles');
  await app.listen(loadRoleConfig().port, '0.0.0.0');
}

void bootstrap();
