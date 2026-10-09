import 'reflect-metadata';
import { EventPublisher, JwtVerifier, RabbitMqConnection, createLogger, requireEnv } from '@toka/common';
import Redis from 'ioredis';
import { createRuntime } from './composition-root';
import { jwksAuthenticator } from './infrastructure/auth/token-authenticator';
import { RedisToolRateLimiter } from './infrastructure/cache/rate-limiters';
import { loadMcpConfig } from './infrastructure/config/mcp-config';
import { RabbitInvocationAuditor } from './infrastructure/messaging/rabbit-invocation-auditor';
import { createHttpApp } from './presentation/http/http-app';

async function bootstrap(): Promise<void> {
  const config = loadMcpConfig();
  const logger = createLogger('mcp-server');
  const redis = new Redis(requireEnv('REDIS_URL'));
  const rabbit = new RabbitMqConnection(requireEnv('RABBITMQ_URL'));

  const verifier = new JwtVerifier(
    { jwksUrl: requireEnv('AUTH_JWKS_URL'), issuer: requireEnv('JWT_ISSUER'), audience: requireEnv('JWT_AUDIENCE') },
    redis,
  );
  const runtime = createRuntime(config, {
    rateLimiter: new RedisToolRateLimiter(redis, config.rateLimitPerMinute),
    auditor: new RabbitInvocationAuditor(new EventPublisher(rabbit)),
    logger,
  });
  const app = createHttpApp({
    runtime,
    authenticate: jwksAuthenticator(verifier),
    allowedOrigins: config.allowedOrigins,
    isHealthy: async () => (await redis.ping()) === 'PONG',
    logger,
  });

  const server = app.listen(config.port, '0.0.0.0', () => logger.info({ port: config.port }, 'MCP server listening'));
  const shutdown = () => {
    server.close();
    void rabbit.onApplicationShutdown();
    redis.disconnect();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

void bootstrap();
