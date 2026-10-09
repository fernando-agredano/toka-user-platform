const SENSITIVE_KEYS = new Set(['password', 'passwordhash', 'token', 'accesstoken', 'refreshtoken', 'authorization']);
const REDACTED = '[REDACTED]';

export interface AuditActor {
  userId: string | null;
  ip: string | null;
}

/** Raw shape of an integration event as received from the broker. */
export interface AuditSourceEvent {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string;
  correlationId: string;
  source: string;
  actor?: Partial<AuditActor>;
  data?: unknown;
}

/** Immutable read-model record of a domain event. */
export interface AuditEntry {
  eventId: string;
  type: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  source: string;
  actor: AuditActor;
  data: Record<string, unknown>;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redact(nested),
      ]),
    );
  }
  return value;
}

/** Builds an entry from an event, defensively redacting secrets that must never reach the audit log. */
export function createAuditEntry(event: AuditSourceEvent): AuditEntry {
  const occurredAt = new Date(event.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) throw new Error(`Invalid occurredAt on event ${event.eventId}`);

  const data = event.data && typeof event.data === 'object' ? (redact(event.data) as Record<string, unknown>) : {};
  return {
    eventId: event.eventId,
    type: event.type,
    version: event.version ?? 1,
    occurredAt,
    correlationId: event.correlationId,
    source: event.source,
    actor: { userId: event.actor?.userId ?? null, ip: event.actor?.ip ?? null },
    data,
  };
}
