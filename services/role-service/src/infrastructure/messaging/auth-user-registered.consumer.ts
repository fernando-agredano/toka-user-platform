import { Inject, Injectable } from '@nestjs/common';
import { BaseConsumer, EventEnvelope, RabbitMqConnection, REDIS_CLIENT } from '@toka/common';
import type Redis from 'ioredis';
import { AssignDefaultRoleUseCase } from '../../application/use-cases/assign-default-role.use-case';

@Injectable()
export class AuthUserRegisteredConsumer extends BaseConsumer<{ userId: string }> {
  protected readonly queue = 'role.auth-registered';
  protected readonly routingKeys = ['auth.user.registered'];

  constructor(
    connection: RabbitMqConnection,
    @Inject(REDIS_CLIENT) redis: Redis,
    private readonly assignDefaultRole: AssignDefaultRoleUseCase,
  ) {
    super(connection, redis);
  }

  protected handle(event: EventEnvelope<{ userId: string }>): Promise<void> {
    return this.assignDefaultRole.execute(event.data.userId);
  }
}
