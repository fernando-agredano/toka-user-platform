import { Global, Module } from '@nestjs/common';
import { requireEnv } from '../config/env';
import { EventPublisher } from './event-publisher';
import { RABBITMQ_URL, RabbitMqConnection } from './rabbitmq-connection';

@Global()
@Module({
  providers: [{ provide: RABBITMQ_URL, useFactory: () => requireEnv('RABBITMQ_URL') }, RabbitMqConnection, EventPublisher],
  exports: [RabbitMqConnection, EventPublisher],
})
export class MessagingModule {}
