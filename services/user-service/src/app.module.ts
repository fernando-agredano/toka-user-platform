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
import { CREDENTIAL_GATEWAY, USER_CACHE } from './application/ports/ports';
import { ChangeUserStatusUseCase } from './application/use-cases/change-user-status.use-case';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { GetUserUseCase } from './application/use-cases/get-user.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { RegisterProfileUseCase } from './application/use-cases/register-profile.use-case';
import { SeedAdminUseCase } from './application/use-cases/seed-admin.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { RedisUserCache } from './infrastructure/cache/redis-user-cache';
import { USER_CONFIG, UserConfig, loadUserConfig } from './infrastructure/config/user-config';
import { AUTH_HTTP_CLIENT, AuthCredentialsGateway, createAuthHttpClient } from './infrastructure/http/auth-credentials-gateway';
import { AuthUserRegisteredConsumer } from './infrastructure/messaging/auth-user-registered.consumer';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { SeedAdminBootstrap } from './infrastructure/persistence/seed-admin.bootstrap';
import { UsersController } from './presentation/controllers/users.controller';

@Module({
  imports: [
    LoggerModule.forService('user-service'),
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
  controllers: [UsersController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: USER_CONFIG, useFactory: () => loadUserConfig() },
    {
      provide: AUTH_HTTP_CLIENT,
      inject: [USER_CONFIG],
      useFactory: (config: UserConfig) => createAuthHttpClient(config),
    },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: USER_CACHE, useClass: RedisUserCache },
    { provide: CREDENTIAL_GATEWAY, useClass: AuthCredentialsGateway },
    ListUsersUseCase,
    GetUserUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    ChangeUserStatusUseCase,
    RegisterProfileUseCase,
    SeedAdminUseCase,
    SeedAdminBootstrap,
    OutboxRelayService,
    AuthUserRegisteredConsumer,
  ],
})
export class AppModule {}
