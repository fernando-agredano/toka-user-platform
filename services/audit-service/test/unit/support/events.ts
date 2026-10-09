import type { AuditSourceEvent } from '../../../src/domain/entities/audit-entry';

let sequence = 0;

export function buildEvent(overrides: Partial<AuditSourceEvent> = {}): AuditSourceEvent {
  sequence += 1;
  return {
    eventId: `event-${sequence}`,
    type: 'user.created',
    version: 1,
    occurredAt: '2026-01-01T00:00:00.000Z',
    correlationId: 'corr-1',
    source: 'user-service',
    actor: { userId: null, ip: null },
    data: {},
    ...overrides,
  };
}
