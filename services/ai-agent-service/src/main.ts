import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '@toka/common';
import { AppModule } from './app.module';
import { loadAiConfig } from './infrastructure/config/ai-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app, 'api/ai');
  await app.listen(loadAiConfig().port, '0.0.0.0');
}

void bootstrap();
