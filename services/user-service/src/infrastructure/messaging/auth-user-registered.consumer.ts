import { Inject, Injectable } from '@nestjs/common';
import { BaseConsumer, EventEnvelope, RabbitMqConnection, REDIS_CLIENT } from '@toka/common';
import type Redis from 'ioredis';
import { RegisterProfileInput, RegisterProfileUseCase } from '../../application/use-cases/register-profile.use-case';

@Injectable()
export class AuthUserRegisteredConsumer extends BaseConsumer<RegisterProfileInput> {
  protected readonly queue = 'user.auth-registered';
  protected readonly routingKeys = ['auth.user.registered'];

  constructor(
    connection: RabbitMqConnection,
    @Inject(REDIS_CLIENT) redis: Redis,
    private readonly registerProfile: RegisterProfileUseCase,
  ) {
    super(connection, redis);
  }

  protected handle(event: EventEnvelope<RegisterProfileInput>): Promise<void> {
    const { userId, email, firstName, lastName } = event.data;
    return this.registerProfile.execute({ userId, email, firstName, lastName });
  }
}
