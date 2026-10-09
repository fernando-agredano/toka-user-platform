import { createAuditEntry } from '../../../src/domain/entities/audit-entry';
import { buildEvent } from '../support/events';

describe('createAuditEntry', () => {
  it('redacts secrets at any depth, case-insensitively', () => {
    const entry = createAuditEntry(
      buildEvent({ data: { email: 'a@b.c', Password: 'x', nested: [{ refreshToken: 'y', ok: 1 }] } }),
    );
    expect(entry.data).toEqual({ email: 'a@b.c', Password: '[REDACTED]', nested: [{ refreshToken: '[REDACTED]', ok: 1 }] });
  });

  it('defaults actor and data when the event omits them', () => {
    const entry = createAuditEntry({ ...buildEvent(), actor: undefined, data: undefined });
    expect(entry.actor).toEqual({ userId: null, ip: null });
    expect(entry.data).toEqual({});
  });

  it('rejects an unparseable occurredAt', () => {
    expect(() => createAuditEntry(buildEvent({ occurredAt: 'nope' }))).toThrow('Invalid occurredAt');
  });
});
