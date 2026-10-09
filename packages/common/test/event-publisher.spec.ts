import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { EventPublisher } from '../src/messaging/event-publisher';
import type { EventEnvelope } from '../src/messaging/event-envelope';

const envelope: EventEnvelope = {
  eventId: 'evt-1',
  type: 'user.created',
  version: 1,
  occurredAt: '2026-01-01T00:00:00.000Z',
  correlationId: 'corr-1',
  source: 'user-service',
  actor: { userId: null, ip: null },
  data: { id: 'u1' },
};

type PublishCallback = (error: Error | null) => void;

const buildConnection = (channelOverrides: Record<string, unknown> = {}) => {
  const channel = {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn((_exchange: string, _key: string, _content: Buffer, _props: unknown, cb: PublishCallback) =>
      cb(null),
    ),
    on: jest.fn(),
    ...channelOverrides,
  };
  const events = new EventEmitter();
  const connection = { createConfirmChannel: jest.fn().mockResolvedValue(channel), events };
  return { channel, connection, events };
};

describe('EventPublisher', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('publishes the envelope as persistent JSON with the routing key and waits for the confirm', async () => {
    const { channel, connection } = buildConnection();
    const publisher = new EventPublisher(connection as never);

    await publisher.publish(envelope);

    expect(channel.assertExchange).toHaveBeenCalledWith('toka.events', 'topic', { durable: true });
    const [exchange, routingKey, content, properties] = channel.publish.mock.calls[0];
    expect(exchange).toBe('toka.events');
    expect(routingKey).toBe('user.created');
    expect(JSON.parse((content as Buffer).toString())).toEqual(envelope);
    expect(properties).toMatchObject({
      persistent: true,
      messageId: 'evt-1',
      correlationId: 'corr-1',
      type: 'user.created',
    });
  });

  it('reuses the confirm channel across publishes', async () => {
    const { connection } = buildConnection();
    const publisher = new EventPublisher(connection as never);

    await publisher.publish(envelope);
    await publisher.publish(envelope);

    expect(connection.createConfirmChannel).toHaveBeenCalledTimes(1);
  });

  it('rejects when the broker nacks the message', async () => {
    const { connection } = buildConnection({
      publish: jest.fn((_e: string, _k: string, _c: Buffer, _p: unknown, cb: PublishCallback) =>
        cb(new Error('nacked')),
      ),
    });
    const publisher = new EventPublisher(connection as never);

    await expect(publisher.publish(envelope)).rejects.toThrow('nacked');
  });

  it('opens a new channel after a broker reconnection', async () => {
    const { connection, events } = buildConnection();
    const publisher = new EventPublisher(connection as never);
    await publisher.publish(envelope);

    events.emit('reconnected');
    await publisher.publish(envelope);

    expect(connection.createConfirmChannel).toHaveBeenCalledTimes(2);
  });

  it('forgets the channel when it closes so the next publish reopens it', async () => {
    const { channel, connection } = buildConnection();
    const publisher = new EventPublisher(connection as never);
    await publisher.publish(envelope);

    const closeHandler = channel.on.mock.calls.find(([event]) => event === 'close')?.[1] as () => void;
    closeHandler();
    await publisher.publish(envelope);

    expect(connection.createConfirmChannel).toHaveBeenCalledTimes(2);
  });

  it('logs channel errors', async () => {
    const { channel, connection } = buildConnection();
    const publisher = new EventPublisher(connection as never);
    await publisher.publish(envelope);

    const errorHandler = channel.on.mock.calls.find(([event]) => event === 'error')?.[1] as (e: Error) => void;
    errorHandler(new Error('channel blew up'));

    expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('channel blew up'));
  });

  it('resets the cached channel when opening fails and surfaces the error', async () => {
    const { connection } = buildConnection();
    connection.createConfirmChannel
      .mockRejectedValueOnce(new Error('no broker'))
      .mockResolvedValueOnce((await buildConnection()).channel);
    const publisher = new EventPublisher(connection as never);

    await expect(publisher.publish(envelope)).rejects.toThrow('no broker');
    await expect(publisher.publish(envelope)).resolves.toBeUndefined();
    expect(connection.createConfirmChannel).toHaveBeenCalledTimes(2);
  });
});
