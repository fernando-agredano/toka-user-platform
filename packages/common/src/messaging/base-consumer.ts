import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Channel, ConsumeMessage } from 'amqplib';
import type Redis from 'ioredis';
import { runWithCorrelationId } from '../correlation/correlation-context';
import { DLX_EXCHANGE, EVENTS_EXCHANGE, EventEnvelope } from './event-envelope';
import { RabbitMqConnection } from './rabbitmq-connection';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
const PROCESSED_TTL_SECONDS = 7 * 24 * 60 * 60;
const PREFETCH = 10;
const ATTEMPTS_HEADER = 'x-attempts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Manual-ack consumer with idempotency by `eventId` and bounded retries.
 * After MAX_ATTEMPTS failures the message is rejected and the queue's
 * dead-letter exchange routes it to `toka.dlq`.
 */
export abstract class BaseConsumer<T = unknown> implements OnApplicationBootstrap {
  protected abstract readonly queue: string;
  protected abstract readonly routingKeys: string[];
  protected readonly logger = new Logger(this.constructor.name);

  protected constructor(
    private readonly connection: RabbitMqConnection,
    private readonly redis: Redis,
  ) {}

  protected abstract handle(event: EventEnvelope<T>): Promise<void>;

  async onApplicationBootstrap(): Promise<void> {
    await this.start();
    this.connection.events.on('reconnected', () => {
      this.start().catch((error: Error) => this.logger.error(`Failed to re-subscribe: ${error.message}`));
    });
  }

  private async start(): Promise<void> {
    const channel = await this.connection.createChannel();
    await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    await channel.assertQueue(this.queue, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': DLX_EXCHANGE },
    });
    for (const key of this.routingKeys) await channel.bindQueue(this.queue, EVENTS_EXCHANGE, key);
    await channel.prefetch(PREFETCH);
    await channel.consume(this.queue, (message) => {
      if (message) void this.process(channel, message);
    });
    this.logger.log(`Consuming ${this.queue} [${this.routingKeys.join(', ')}]`);
  }

  private async process(channel: Channel, message: ConsumeMessage): Promise<void> {
    let event: EventEnvelope<T>;
    try {
      event = JSON.parse(message.content.toString()) as EventEnvelope<T>;
      if (!event.eventId || !event.type) throw new Error('Malformed envelope');
    } catch {
      this.logger.error('Discarding malformed message to DLQ');
      channel.nack(message, false, false);
      return;
    }

    const processedKey = `processed:${this.queue}:${event.eventId}`;
    try {
      if (await this.redis.exists(processedKey)) {
        channel.ack(message);
        return;
      }
      await runWithCorrelationId(event.correlationId, () => this.handle(event));
      await this.redis.set(processedKey, '1', 'EX', PROCESSED_TTL_SECONDS);
      channel.ack(message);
    } catch (error) {
      await this.retryOrDeadLetter(channel, message, event, error);
    }
  }

  private async retryOrDeadLetter(
    channel: Channel,
    message: ConsumeMessage,
    event: EventEnvelope<T>,
    error: unknown,
  ): Promise<void> {
    const attempts = Number(message.properties.headers?.[ATTEMPTS_HEADER] ?? 0) + 1;
    const reason = error instanceof Error ? error.message : String(error);

    if (attempts >= MAX_ATTEMPTS) {
      this.logger.error(`Event ${event.eventId} (${event.type}) failed ${attempts} times, dead-lettering: ${reason}`);
      channel.nack(message, false, false);
      return;
    }

    this.logger.warn(`Event ${event.eventId} (${event.type}) failed attempt ${attempts}: ${reason}`);
    await sleep(RETRY_DELAY_MS * attempts);
    channel.sendToQueue(this.queue, message.content, {
      ...message.properties,
      persistent: true,
      headers: { ...message.properties.headers, [ATTEMPTS_HEADER]: attempts },
    });
    channel.ack(message);
  }
}
