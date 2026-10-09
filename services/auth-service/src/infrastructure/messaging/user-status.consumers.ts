import { Inject, Injectable } from '@nestjs/common';
import { BaseConsumer, EventEnvelope, RabbitMqConnection, REDIS_CLIENT } from '@toka/common';
import type Redis from 'ioredis';
import { ChangeCredentialStatusUseCase } from '../../application/use-cases/change-credential-status.use-case';

interface UserStatusEventData {
  userId: string;
}

abstract class UserStatusConsumer extends BaseConsumer<UserStatusEventData> {
  protected abstract readonly active: boolean;

  protected constructor(
    connection: RabbitMqConnection,
    redis: Redis,
    private readonly changeStatus: ChangeCredentialStatusUseCase,
  ) {
    super(connection, redis);
  }

  protected handle(event: EventEnvelope<UserStatusEventData>): Promise<void> {
    return this.changeStatus.execute({ userId: event.data.userId, active: this.active });
  }
}

/** user.deactivated: revoke every refresh token and disable the credential. */
@Injectable()
export class UserDeactivatedConsumer extends UserStatusConsumer {
  protected readonly queue = 'auth.user-deactivated';
  protected readonly routingKeys = ['user.deactivated'];
  protected readonly active = false;

  constructor(connection: RabbitMqConnection, @Inject(REDIS_CLIENT) redis: Redis, useCase: ChangeCredentialStatusUseCase) {
    super(connection, redis, useCase);
  }
}

@Injectable()
export class UserActivatedConsumer extends UserStatusConsumer {
  protected readonly queue = 'auth.user-activated';
  protected readonly routingKeys = ['user.activated'];
  protected readonly active = true;

  constructor(connection: RabbitMqConnection, @Inject(REDIS_CLIENT) redis: Redis, useCase: ChangeCredentialStatusUseCase) {
    super(connection, redis, useCase);
  }
}
