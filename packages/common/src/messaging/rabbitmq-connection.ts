import { EventEmitter } from 'node:events';
import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { connect } from 'amqplib';

export const RABBITMQ_URL = Symbol('RABBITMQ_URL');

type AmqpConnection = Awaited<ReturnType<typeof connect>>;

const INITIAL_CONNECT_ATTEMPTS = 15;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class RabbitMqConnection implements OnApplicationShutdown {
  /** Emits `reconnected` after a dropped connection is re-established, so consumers can re-subscribe. */
  readonly events = new EventEmitter();
  private readonly logger = new Logger(RabbitMqConnection.name);
  private connection?: AmqpConnection;
  private pending?: Promise<AmqpConnection>;
  private closing = false;

  constructor(@Inject(RABBITMQ_URL) private readonly url: string) {}

  getConnection(maxAttempts = INITIAL_CONNECT_ATTEMPTS): Promise<AmqpConnection> {
    if (this.connection) return Promise.resolve(this.connection);
    this.pending ??= this.connectWithRetry(maxAttempts).finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  async createChannel() {
    return (await this.getConnection()).createChannel();
  }

  async createConfirmChannel() {
    return (await this.getConnection()).createConfirmChannel();
  }

  async onApplicationShutdown(): Promise<void> {
    this.closing = true;
    await this.connection?.close().catch(() => undefined);
  }

  private async connectWithRetry(maxAttempts: number): Promise<AmqpConnection> {
    for (let attempt = 1; ; attempt++) {
      try {
        const connection = await connect(this.url);
        connection.on('error', (error: Error) => this.logger.error(`RabbitMQ connection error: ${error.message}`));
        connection.on('close', () => {
          this.connection = undefined;
          if (!this.closing) void this.reconnect();
        });
        this.connection = connection;
        return connection;
      } catch (error) {
        if (attempt >= maxAttempts) throw error;
        this.logger.warn(`RabbitMQ not reachable (attempt ${attempt}), retrying...`);
        await sleep(Math.min(attempt * 1000, 5000));
      }
    }
  }

  private async reconnect(): Promise<void> {
    this.logger.warn('RabbitMQ connection lost, reconnecting');
    await this.getConnection(Number.POSITIVE_INFINITY);
    this.events.emit('reconnected');
  }
}
