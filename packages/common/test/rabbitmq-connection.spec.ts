import { EventEmitter } from 'node:events';
import { connect } from 'amqplib';
import { Logger } from '@nestjs/common';
import { RabbitMqConnection } from '../src/messaging/rabbitmq-connection';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

const mockedConnect = connect as unknown as jest.Mock;

const buildBrokerConnection = () => {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    createChannel: jest.fn().mockResolvedValue({ id: 'channel' }),
    createConfirmChannel: jest.fn().mockResolvedValue({ id: 'confirm' }),
    close: jest.fn().mockResolvedValue(undefined),
  });
};

describe('RabbitMqConnection', () => {
  beforeEach(() => {
    mockedConnect.mockReset();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('connects once and reuses the connection for channels', async () => {
    const broker = buildBrokerConnection();
    mockedConnect.mockResolvedValue(broker);
    const connection = new RabbitMqConnection('amqp://broker');

    await expect(connection.createChannel()).resolves.toEqual({ id: 'channel' });
    await expect(connection.createConfirmChannel()).resolves.toEqual({ id: 'confirm' });

    expect(mockedConnect).toHaveBeenCalledTimes(1);
    expect(mockedConnect).toHaveBeenCalledWith('amqp://broker');
  });

  it('shares one in-flight connection attempt between concurrent callers', async () => {
    mockedConnect.mockResolvedValue(buildBrokerConnection());
    const connection = new RabbitMqConnection('amqp://broker');

    await Promise.all([connection.getConnection(), connection.getConnection()]);

    expect(mockedConnect).toHaveBeenCalledTimes(1);
  });

  it('gives up after the configured number of attempts', async () => {
    mockedConnect.mockRejectedValue(new Error('refused'));
    const connection = new RabbitMqConnection('amqp://broker');

    await expect(connection.getConnection(1)).rejects.toThrow('refused');
  });

  it('retries until the broker becomes reachable', async () => {
    mockedConnect.mockRejectedValueOnce(new Error('refused')).mockResolvedValueOnce(buildBrokerConnection());
    const connection = new RabbitMqConnection('amqp://broker');

    await expect(connection.getConnection(2)).resolves.toBeDefined();
    expect(mockedConnect).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('emits reconnected after the connection drops and is re-established', async () => {
    const first = buildBrokerConnection();
    const second = buildBrokerConnection();
    mockedConnect.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const connection = new RabbitMqConnection('amqp://broker');
    await connection.getConnection();
    const reconnected = jest.fn();
    connection.events.on('reconnected', reconnected);

    first.emit('close');
    await new Promise((resolve) => setImmediate(resolve));

    expect(reconnected).toHaveBeenCalledTimes(1);
    await expect(connection.createChannel()).resolves.toEqual({ id: 'channel' });
    expect(mockedConnect).toHaveBeenCalledTimes(2);
  });

  it('logs connection errors without dropping the connection', async () => {
    const broker = buildBrokerConnection();
    mockedConnect.mockResolvedValue(broker);
    const connection = new RabbitMqConnection('amqp://broker');
    await connection.getConnection();

    broker.emit('error', new Error('socket reset'));

    expect(Logger.prototype.error).toHaveBeenCalledWith('RabbitMQ connection error: socket reset');
  });

  it('closes the connection on shutdown without triggering a reconnect', async () => {
    const broker = buildBrokerConnection();
    mockedConnect.mockResolvedValue(broker);
    const connection = new RabbitMqConnection('amqp://broker');
    await connection.getConnection();

    await connection.onApplicationShutdown();
    broker.emit('close');
    await new Promise((resolve) => setImmediate(resolve));

    expect(broker.close).toHaveBeenCalled();
    expect(mockedConnect).toHaveBeenCalledTimes(1);
  });

  it('ignores close errors during shutdown', async () => {
    const broker = buildBrokerConnection();
    broker.close.mockRejectedValue(new Error('already closed'));
    mockedConnect.mockResolvedValue(broker);
    const connection = new RabbitMqConnection('amqp://broker');
    await connection.getConnection();

    await expect(connection.onApplicationShutdown()).resolves.toBeUndefined();
  });
});
