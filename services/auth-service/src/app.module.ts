import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  HealthModule,
  JwtAuthModule,
  LoggerModule,
  MessagingModule,
  OutboxRelayService,
  REDIS_CLIENT,
  RedisModule,
  createPingIndicator,
} from '@toka/common';
import type Redis from 'ioredis';
import {
  ACCESS_TOKEN_ISSUER,
  EVENT_PUBLISHER,
  LOGIN_ATTEMPT_TRACKER,
  PASSWORD_HASHER,
  PERMISSIONS_PROVIDER,
  REFRESH_TOKEN_STORE,
  TOKEN_BLACKLIST,
} from './application/ports/ports';
import { SessionIssuer } from './application/services/session-issuer';
import { ChangeCredentialStatusUseCase } from './application/use-cases/change-credential-status.use-case';
import { CreateCredentialInternalUseCase } from './application/use-cases/create-credential-internal.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshUseCase } from './application/use-cases/refresh.use-case';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { SeedAdminUseCase } from './application/use-cases/seed-admin.use-case';
import { CREDENTIAL_REPOSITORY } from './domain/repositories/credential.repository';
import { RedisLoginAttemptTracker } from './infrastructure/cache/redis-login-attempt-tracker';
import { RedisRefreshTokenStore } from './infrastructure/cache/redis-refresh-token-store';
import { RedisTokenBlacklist } from './infrastructure/cache/redis-token-blacklist';
import { AUTH_CONFIG, AuthConfig, loadAuthConfig } from './infrastructure/config/auth-config';
import { ROLE_HTTP_CLIENT, RolePermissionsGateway, createRoleHttpClient } from './infrastructure/http/role-permissions-gateway';
import { OutboxEventPublisher } from './infrastructure/messaging/outbox-event-publisher';
import { UserActivatedConsumer, UserDeactivatedConsumer } from './infrastructure/messaging/user-status.consumers';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { PrismaCredentialRepository } from './infrastructure/persistence/prisma-credential.repository';
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { SeedAdminBootstrap } from './infrastructure/persistence/seed-admin.bootstrap';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher';
import { JoseAccessTokenIssuer } from './infrastructure/security/jose-access-token-issuer';
import { RsaKeyStore } from './infrastructure/security/rsa-key-store';
import { AuthController } from './presentation/controllers/auth.controller';
import { InternalCredentialsController } from './presentation/controllers/internal-credentials.controller';

@Module({
  imports: [
    LoggerModule.forService('auth-service'),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    RedisModule,
    MessagingModule,
    PersistenceModule,
    JwtAuthModule.register(),
    HealthModule.registerAsync({
      imports: [PersistenceModule],
      inject: [PrismaService, REDIS_CLIENT],
      useFactory: (prisma: PrismaService, redis: Redis) => [
        createPingIndicator('postgres', () => prisma.$queryRawUnsafe('SELECT 1')),
        createPingIndicator('redis', () => redis.ping()),
      ],
    }),
  ],
  controllers: [AuthController, InternalCredentialsController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: AUTH_CONFIG, useFactory: () => loadAuthConfig() },
    {
      provide: ROLE_HTTP_CLIENT,
      inject: [AUTH_CONFIG],
      useFactory: (config: AuthConfig) => createRoleHttpClient(config),
    },
    { provide: CREDENTIAL_REPOSITORY, useClass: PrismaCredentialRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: ACCESS_TOKEN_ISSUER, useClass: JoseAccessTokenIssuer },
    { provide: REFRESH_TOKEN_STORE, useClass: RedisRefreshTokenStore },
    { provide: TOKEN_BLACKLIST, useClass: RedisTokenBlacklist },
    { provide: LOGIN_ATTEMPT_TRACKER, useClass: RedisLoginAttemptTracker },
    { provide: PERMISSIONS_PROVIDER, useClass: RolePermissionsGateway },
    { provide: EVENT_PUBLISHER, useClass: OutboxEventPublisher },
    RsaKeyStore,
    SessionIssuer,
    RegisterUseCase,
    CreateCredentialInternalUseCase,
    LoginUseCase,
    RefreshUseCase,
    LogoutUseCase,
    ChangeCredentialStatusUseCase,
    SeedAdminUseCase,
    SeedAdminBootstrap,
    OutboxRelayService,
    UserDeactivatedConsumer,
    UserActivatedConsumer,
  ],
})
export class AppModule {}
