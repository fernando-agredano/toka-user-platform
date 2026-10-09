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
import { PERMISSIONS_CACHE } from './application/ports/ports';
import { AssignDefaultRoleUseCase } from './application/use-cases/assign-default-role.use-case';
import { AssignRoleUseCase } from './application/use-cases/assign-role.use-case';
import { CreateRoleUseCase } from './application/use-cases/create-role.use-case';
import { GetUserAuthorizationUseCase } from './application/use-cases/get-user-authorization.use-case';
import { GetUserRolesUseCase } from './application/use-cases/get-user-roles.use-case';
import { ListRolesUseCase } from './application/use-cases/list-roles.use-case';
import { RevokeRoleUseCase } from './application/use-cases/revoke-role.use-case';
import { SeedRolesUseCase } from './application/use-cases/seed-roles.use-case';
import { UpdateRolePermissionsUseCase } from './application/use-cases/update-role-permissions.use-case';
import { ROLE_REPOSITORY } from './domain/repositories/role.repository';
import { RedisPermissionsCache } from './infrastructure/cache/redis-permissions-cache';
import { ROLE_CONFIG, loadRoleConfig } from './infrastructure/config/role-config';
import { AuthUserRegisteredConsumer } from './infrastructure/messaging/auth-user-registered.consumer';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { PrismaRoleRepository } from './infrastructure/persistence/prisma-role.repository';
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { SeedRolesBootstrap } from './infrastructure/persistence/seed-roles.bootstrap';
import { InternalAuthorizationController } from './presentation/controllers/internal-authorization.controller';
import { RolesController } from './presentation/controllers/roles.controller';

@Module({
  imports: [
    LoggerModule.forService('role-service'),
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
  controllers: [RolesController, InternalAuthorizationController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: ROLE_CONFIG, useFactory: () => loadRoleConfig() },
    { provide: ROLE_REPOSITORY, useClass: PrismaRoleRepository },
    { provide: PERMISSIONS_CACHE, useClass: RedisPermissionsCache },
    ListRolesUseCase,
    CreateRoleUseCase,
    UpdateRolePermissionsUseCase,
    GetUserRolesUseCase,
    GetUserAuthorizationUseCase,
    AssignRoleUseCase,
    AssignDefaultRoleUseCase,
    RevokeRoleUseCase,
    SeedRolesUseCase,
    SeedRolesBootstrap,
    OutboxRelayService,
    AuthUserRegisteredConsumer,
  ],
})
export class AppModule {}
