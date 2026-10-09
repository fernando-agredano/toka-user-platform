import { randomUUID } from 'node:crypto';
import { getCorrelationId } from '../correlation/correlation-context';

export const EVENTS_EXCHANGE = 'toka.events';
export const DLX_EXCHANGE = 'toka.dlx';

export interface EventActor {
  userId: string | null;
  ip: string | null;
}

export interface EventEnvelope<T = unknown> {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string;
  correlationId: string;
  source: string;
  actor: EventActor;
  data: T;
}

/** What a service decides to publish; the envelope metadata is added by `createEnvelope`. */
export interface NewEvent<T = unknown> {
  type: string;
  data: T;
  version?: number;
  actor?: Partial<EventActor>;
}

export function createEnvelope<T>(source: string, event: NewEvent<T>): EventEnvelope<T> {
  return {
    eventId: randomUUID(),
    type: event.type,
    version: event.version ?? 1,
    occurredAt: new Date().toISOString(),
    correlationId: getCorrelationId() ?? randomUUID(),
    source,
    actor: { userId: event.actor?.userId ?? null, ip: event.actor?.ip ?? null },
    data: event.data,
  };
}
