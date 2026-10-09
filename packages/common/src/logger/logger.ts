import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import pino, { LoggerOptions } from 'pino';
import { getCorrelationId } from '../correlation/correlation-context';

export const REDACTED_PATHS = [
  'password',
  'token',
  'authorization',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

export function createLoggerOptions(service: string, level = process.env.LOG_LEVEL ?? 'info'): LoggerOptions {
  return {
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    mixin: () => ({ correlationId: getCorrelationId() ?? null }),
  };
}

export const createLogger = (service: string) => pino(createLoggerOptions(service));

@Module({})
export class LoggerModule {
  static forService(service: string): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRoot({
          pinoHttp: {
            ...createLoggerOptions(service),
            autoLogging: { ignore: (req) => req.url === '/health' },
          },
        }),
      ],
    };
  }
}
