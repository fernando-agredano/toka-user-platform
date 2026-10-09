import { Injectable } from '@nestjs/common';
import type { EventPublisherPort } from '../../application/ports/ports';
import type { DomainEvent } from '../../domain/events/auth-events';
import { PrismaService } from '../persistence/prisma.service';
import { toOutboxRecord } from './outbox-record';

/** Events that are not tied to an aggregate write (login attempts) still go through the outbox. */
@Injectable()
export class OutboxEventPublisher implements EventPublisherPort {
  constructor(private readonly prisma: PrismaService) {}

  async publish(event: DomainEvent): Promise<void> {
    await this.prisma.outboxEvent.create({ data: toOutboxRecord(event) });
  }
}
