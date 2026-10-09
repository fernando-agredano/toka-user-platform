import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { optionalEnv } from './config/env';
import { CorrelationIdMiddleware } from './correlation/correlation-id.middleware';
import { ProblemDetailsFilter } from './errors/problem-details.filter';

/** Cross-cutting HTTP setup shared by every service's `main.ts`. */
export function configureApp(app: NestExpressApplication, globalPrefix: string): INestApplication {
  const correlation = new CorrelationIdMiddleware();

  app.useLogger(app.get(Logger));
  app.set('trust proxy', 1); // behind the nginx gateway: use X-Forwarded-For for client IPs
  app.use(helmet());
  // Registered via app.use (not a module) so it runs before the logger and body parsers.
  app.use(correlation.use.bind(correlation));
  app.setGlobalPrefix(globalPrefix, { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableCors({
    origin: optionalEnv('CORS_ORIGINS', 'http://localhost:8080').split(','),
    credentials: true,
  });
  app.enableShutdownHooks();
  return app;
}
