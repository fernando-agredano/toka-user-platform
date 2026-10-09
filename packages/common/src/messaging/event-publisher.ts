import { Injectable, Logger } from '@nestjs/common';
import type { ConfirmChannel } from 'amqplib';
import { EVENTS_EXCHANGE, EventEnvelope } from './event-envelope';
import { RabbitMqConnection } from './rabbitmq-connection';

@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name);
  private channel?: Promise<ConfirmChannel>;

  constructor(private readonly connection: RabbitMqConnection) {
    connection.events.on('reconnected', () => {
      this.channel = undefined;
    });
  }

  /** Resolves only once the broker has confirmed the message (publisher confirms). */
  async publish(envelope: EventEnvelope): Promise<void> {
    const channel = await this.getChannel();
    const content = Buffer.from(JSON.stringify(envelope));
    await new Promise<void>((resolve, reject) => {
      channel.publish(
        EVENTS_EXCHANGE,
        envelope.type,
        content,
        {
          persistent: true,
          contentType: 'application/json',
          messageId: envelope.eventId,
          correlationId: envelope.correlationId,
          type: envelope.type,
          timestamp: Date.now(),
        },
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  private getChannel(): Promise<ConfirmChannel> {
    this.channel ??= this.openChannel().catch((error) => {
      this.channel = undefined;
      throw error;
    });
    return this.channel;
  }

  private async openChannel(): Promise<ConfirmChannel> {
    const channel = await this.connection.createConfirmChannel();
    await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    channel.on('error', (error: Error) => this.logger.error(`Publisher channel error: ${error.message}`));
    channel.on('close', () => {
      this.channel = undefined;
    });
    return channel;
  }
}
