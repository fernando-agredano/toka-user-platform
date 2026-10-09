import { CorrelationIdMiddleware } from '../src/correlation/correlation-id.middleware';
import { getCorrelationId, runWithCorrelationId } from '../src/correlation/correlation-context';
import { createEnvelope } from '../src/messaging/event-envelope';

describe('createEnvelope', () => {
  it('fills the mandatory envelope fields and defaults actor to nulls', () => {
    const envelope = createEnvelope('auth-service', { type: 'auth.login.failed', data: { email: 'a@b.c' } });

    expect(envelope).toMatchObject({
      type: 'auth.login.failed',
      version: 1,
      source: 'auth-service',
      actor: { userId: null, ip: null },
      data: { email: 'a@b.c' },
    });
    expect(envelope.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(envelope.occurredAt).toISOString()).toBe(envelope.occurredAt);
  });

  it('propagates the correlation id of the current request context', () => {
    const envelope = runWithCorrelationId('corr-123', () => createEnvelope('svc', { type: 'x', data: {} }));
    expect(envelope.correlationId).toBe('corr-123');
  });
});

describe('CorrelationIdMiddleware', () => {
  const run = (incoming?: string) => {
    const headers: Record<string, string> = {};
    const req = { headers, header: (name: string) => (name === 'x-correlation-id' ? incoming : undefined) };
    const res = { setHeader: jest.fn() };
    let seen: string | undefined;
    new CorrelationIdMiddleware().use(req as never, res as never, () => {
      seen = getCorrelationId();
    });
    return { seen, res, headers };
  };

  it('keeps a well-formed incoming id and echoes it in the response', () => {
    const { seen, res } = run('abc-123');
    expect(seen).toBe('abc-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'abc-123');
  });

  it('generates an id when none is sent, and replaces malformed ones', () => {
    expect(run().seen).toMatch(/^[0-9a-f-]{36}$/);
    expect(run('bad value\nwith newline').seen).toMatch(/^[0-9a-f-]{36}$/);
  });
});
