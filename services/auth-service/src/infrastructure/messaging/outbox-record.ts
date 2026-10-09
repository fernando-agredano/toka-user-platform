import { createEnvelope } from '@toka/common';
import type { Prisma } from '../../../generated/prisma-client';
import type { DomainEvent } from '../../domain/events/auth-events';

export const SERVICE_NAME = 'auth-service';

/** Wraps a domain event in the standard envelope and shapes it as an `outbox_events` row. */
export function toOutboxRecord(event: DomainEvent): Prisma.OutboxEventCreateManyInput {
  const envelope = createEnvelope(SERVICE_NAME, event);
  return { id: envelope.eventId, type: envelope.type, payload: envelope as unknown as Prisma.InputJsonValue };
}
