import { Inject, Injectable } from '@nestjs/common';
import { BaseConsumer, EventEnvelope, RabbitMqConnection, REDIS_CLIENT } from '@toka/common';
import type Redis from 'ioredis';
import { InvalidatePermissionsCacheUseCase } from '../../application/use-cases/invalidate-permissions-cache.use-case';

@Injectable()
export class RoleChangedConsumer extends BaseConsumer<{ userId?: string }> {
  protected readonly queue = 'auth.role-changed';
  protected readonly routingKeys = ['role.assigned', 'role.revoked', 'role.permissions.updated'];

  constructor(
    connection: RabbitMqConnection,
    @Inject(REDIS_CLIENT) redis: Redis,
    private readonly invalidateCache: InvalidatePermissionsCacheUseCase,
  ) {
    super(connection, redis);
  }

  protected handle(event: EventEnvelope<{ userId?: string }>): Promise<void> {
    return this.invalidateCache.execute({ userId: event.data.userId });
  }
}
