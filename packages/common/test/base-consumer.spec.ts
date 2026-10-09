import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { BaseConsumer } from '../src/messaging/base-consumer';
import type { EventEnvelope } from '../src/messaging/event-envelope';

type Handler = (event: EventEnvelope<{ value: number }>) => Promise<void>;

class TestConsumer extends BaseConsumer<{ value: number }> {
  protected readonly queue = 'test.queue';
  protected readonly routingKeys = ['test.a', 'test.b'];

  constructor(connection: never, redis: never, private readonly handler: Handler) {
    super(connection, redis);
  }

  protected handle(event: EventEnvelope<{ value: number }>): Promise<void> {
    return this.handler(event);
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
// The retry path waits RETRY_DELAY_MS (500 ms x attempt) before requeueing.
const waitForRetryDelay = () => new Promise((resolve) => setTimeout(resolve, 600));

const buildEnvelope = (overrides: Partial<EventEnvelope> = {}): EventEnvelope<{ value: number }> =>
  ({
    eventId: 'evt-1',
    type: 'test.a',
    version: 1,
    occurredAt: '2026-01-01T00:00:00.000Z',
    correlationId: 'corr-1',
    source: 'test',
    actor: { userId: null, ip: null },
    data: { value: 1 },
    ...overrides,
  }) as EventEnvelope<{ value: number }>;

const buildMessage = (body: unknown, headers: Record<string, unknown> = {}): ConsumeMessage =>
  ({
    content: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
    properties: { headers },
  }) as unknown as ConsumeMessage;

const buildSetup = (handler: Handler = jest.fn().mockResolvedValue(undefined)) => {
  let onMessage: (message: ConsumeMessage | null) => void = () => undefined;
  const channel = {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue(undefined),
    bindQueue: jest.fn().mockResolvedValue(undefined),
    prefetch: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn(async (_queue: string, callback: typeof onMessage) => {
      onMessage = callback;
    }),
    ack: jest.fn(),
    nack: jest.fn(),
    sendToQueue: jest.fn(),
  };
  const events = new EventEmitter();
  const connection = { createChannel: jest.fn().mockResolvedValue(channel), events };
  const redis = { exists: jest.fn().mockResolvedValue(0), set: jest.fn().mockResolvedValue('OK') };
  const consumer = new TestConsumer(connection as never, redis as never, handler as Handler);
  return {
    consumer,
    channel,
    connection,
    events,
    redis,
    deliver: (message: ConsumeMessage | null) => {
      onMessage(message);
      return flush();
    },
  };
};

describe('BaseConsumer', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('declares the exchange, queue with DLX, bindings and prefetch on bootstrap', async () => {
    const { consumer, channel } = buildSetup();

    await consumer.onApplicationBootstrap();

    expect(channel.assertExchange).toHaveBeenCalledWith('toka.events', 'topic', { durable: true });
    expect(channel.assertQueue).toHaveBeenCalledWith('test.queue', {
      durable: true,
      arguments: { 'x-dead-letter-exchange': 'toka.dlx' },
    });
    expect(channel.bindQueue).toHaveBeenCalledWith('test.queue', 'toka.events', 'test.a');
    expect(channel.bindQueue).toHaveBeenCalledWith('test.queue', 'toka.events', 'test.b');
    expect(channel.prefetch).toHaveBeenCalledWith(10);
  });

  it('re-subscribes after a broker reconnection', async () => {
    const { consumer, connection, events } = buildSetup();
    await consumer.onApplicationBootstrap();

    events.emit('reconnected');
    await flush();

    expect(connection.createChannel).toHaveBeenCalledTimes(2);
  });

  it('acks and records a successfully handled event', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const { consumer, channel, redis, deliver } = buildSetup(handler);
    await consumer.onApplicationBootstrap();
    const message = buildMessage(buildEnvelope());

    await deliver(message);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt-1' }));
    expect(redis.set).toHaveBeenCalledWith('processed:test.queue:evt-1', '1', 'EX', 7 * 24 * 60 * 60);
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('skips already processed events but still acks them', async () => {
    const handler = jest.fn();
    const { consumer, channel, redis, deliver } = buildSetup(handler);
    redis.exists.mockResolvedValue(1);
    await consumer.onApplicationBootstrap();
    const message = buildMessage(buildEnvelope());

    await deliver(message);

    expect(handler).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('discards malformed JSON to the DLQ without calling the handler', async () => {
    const handler = jest.fn();
    const { consumer, channel, deliver } = buildSetup(handler);
    await consumer.onApplicationBootstrap();
    const message = buildMessage('{not json');

    await deliver(message);

    expect(handler).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('discards envelopes without eventId or type to the DLQ', async () => {
    const handler = jest.fn();
    const { consumer, channel, deliver } = buildSetup(handler);
    await consumer.onApplicationBootstrap();
    const message = buildMessage({ data: {} });

    await deliver(message);

    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores null deliveries (consumer cancelled by the broker)', async () => {
    const handler = jest.fn();
    const { consumer, channel, deliver } = buildSetup(handler);
    await consumer.onApplicationBootstrap();

    await deliver(null);

    expect(handler).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('requeues a failed event with an incremented attempt counter', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const { consumer, channel, deliver } = buildSetup(handler);
    await consumer.onApplicationBootstrap();
    const message = buildMessage(buildEnvelope(), { keep: 'me' });

    await deliver(message);
    await waitForRetryDelay();

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'test.queue',
      message.content,
      expect.objectContaining({ persistent: true, headers: { keep: 'me', 'x-attempts': 1 } }),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('dead-letters an event once it has reached the maximum attempts', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('still failing'));
    const { consumer, channel, redis, deliver } = buildSetup(handler);
    await consumer.onApplicationBootstrap();
    const message = buildMessage(buildEnvelope(), { 'x-attempts': 2 });

    await deliver(message);

    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(channel.sendToQueue).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('treats a non-Error rejection as a failure and still retries', async () => {
    const handler = jest.fn().mockRejectedValue('plain string');
    const { consumer, channel, deliver } = buildSetup(handler);
    await consumer.onApplicationBootstrap();
    const message = buildMessage(buildEnvelope());

    await deliver(message);
    await waitForRetryDelay();

    expect(channel.sendToQueue).toHaveBeenCalled();
  });
});
