import { OutboxRelayService } from '../src/messaging/outbox-relay';

const buildDb = (rows: { id: string; payload: unknown }[]) => {
  const tx = {
    $queryRawUnsafe: jest.fn().mockResolvedValue(rows),
    $executeRawUnsafe: jest.fn().mockResolvedValue(rows.length),
  };
  return { tx, db: { $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)) } };
};

describe('OutboxRelayService', () => {
  it('claims rows with SKIP LOCKED, publishes them in order and marks them published', async () => {
    const { tx, db } = buildDb([
      { id: 'a', payload: { type: 'one' } },
      { id: 'b', payload: { type: 'two' } },
    ]);
    const publisher = { publish: jest.fn().mockResolvedValue(undefined) };

    const relayed = await new OutboxRelayService(db as never, publisher as never).relayPending();

    expect(relayed).toBe(2);
    expect(tx.$queryRawUnsafe.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(publisher.publish.mock.calls.map(([payload]) => payload.type)).toEqual(['one', 'two']);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('published_at'), ['a', 'b']);
  });

  it('marks only confirmed events when a publish fails, and surfaces the error', async () => {
    const { tx, db } = buildDb([
      { id: 'a', payload: { type: 'one' } },
      { id: 'b', payload: { type: 'two' } },
    ]);
    const publisher = { publish: jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('nack')) };

    await expect(new OutboxRelayService(db as never, publisher as never).relayPending()).rejects.toThrow('nack');
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(expect.any(String), ['a']);
  });

  it('does nothing when there are no pending rows', async () => {
    const { tx, db } = buildDb([]);
    const relayed = await new OutboxRelayService(db as never, { publish: jest.fn() } as never).relayPending();
    expect(relayed).toBe(0);
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
