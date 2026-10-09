import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  HealthModule,
  JwtAuthModule,
  LoggerModule,
  MessagingModule,
  REDIS_CLIENT,
  RedisModule,
  createPingIndicator,
} from '@toka/common';
import type Redis from 'ioredis';
import type { Connection } from 'mongoose';
import { GetAuditStatsUseCase } from './application/use-cases/get-audit-stats.use-case';
import { RecordAuditEventUseCase } from './application/use-cases/record-audit-event.use-case';
import { SearchAuditUseCase } from './application/use-cases/search-audit.use-case';
import { AUDIT_REPOSITORY } from './domain/repositories/audit.repository';
import { AuditAllEventsConsumer } from './infrastructure/messaging/audit-all-events.consumer';
import { MONGO_CONNECTION, MongoModule } from './infrastructure/persistence/mongo.module';
import { MongoAuditRepository } from './infrastructure/persistence/mongo-audit.repository';
import { AuditController } from './presentation/controllers/audit.controller';

@Module({
  imports: [
    LoggerModule.forService('audit-service'),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    RedisModule,
    MessagingModule,
    JwtAuthModule.register(),
    MongoModule,
    HealthModule.registerAsync({
      inject: [MONGO_CONNECTION, REDIS_CLIENT],
      useFactory: (mongo: Connection, redis: Redis) => [
        createPingIndicator('mongo', () => mongo.db!.admin().ping()),
        createPingIndicator('redis', () => redis.ping()),
      ],
    }),
  ],
  controllers: [AuditController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: AUDIT_REPOSITORY, useClass: MongoAuditRepository },
    RecordAuditEventUseCase,
    SearchAuditUseCase,
    GetAuditStatsUseCase,
    AuditAllEventsConsumer,
  ],
})
export class AppModule {}
