import { Inject, Injectable } from '@nestjs/common';
import { BaseConsumer, EventEnvelope, RabbitMqConnection, REDIS_CLIENT } from '@toka/common';
import type Redis from 'ioredis';
import type { AuditSourceEvent } from '../../domain/entities/audit-entry';
import { RecordAuditEventUseCase } from '../../application/use-cases/record-audit-event.use-case';

/**
 * Subscribes to every event (`#`). Idempotency is enforced twice: Redis dedup in
 * BaseConsumer, and the unique `eventId` index as the source of truth.
 */
@Injectable()
export class AuditAllEventsConsumer extends BaseConsumer {
  protected readonly queue = 'audit.all';
  protected readonly routingKeys = ['#'];

  constructor(
    connection: RabbitMqConnection,
    @Inject(REDIS_CLIENT) redis: Redis,
    private readonly recordEvent: RecordAuditEventUseCase,
  ) {
    super(connection, redis);
  }

  protected async handle(event: EventEnvelope): Promise<void> {
    await this.recordEvent.execute(event as AuditSourceEvent);
  }
}
