import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import type { EventEnvelope } from './event-envelope';
import { EventPublisher } from './event-publisher';

export const OUTBOX_DB = Symbol('OUTBOX_DB');

/** Structural subset of a Prisma client, so common does not depend on any generated client. */
export interface OutboxTransaction {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export interface OutboxDatabase {
  $transaction<T>(fn: (tx: OutboxTransaction) => Promise<T>, options?: { timeout?: number }): Promise<T>;
}

const RELAY_INTERVAL_MS = 1000;
const BATCH_SIZE = 50;
const TRANSACTION_TIMEOUT_MS = 15_000;

/**
 * Transactional-outbox relay: polls `outbox_events` and publishes pending rows.
 * `FOR UPDATE SKIP LOCKED` lets several replicas run it without double-publishing.
 */
@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(OUTBOX_DB) private readonly db: OutboxDatabase,
    private readonly publisher: EventPublisher,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), RELAY_INTERVAL_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /** Publishes one batch; returns how many events were sent. Exposed for tests. */
  async relayPending(): Promise<number> {
    return this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRawUnsafe<{ id: string; payload: EventEnvelope }[]>(
          `SELECT id, payload FROM outbox_events
           WHERE published_at IS NULL
           ORDER BY created_at
           LIMIT ${BATCH_SIZE}
           FOR UPDATE SKIP LOCKED`,
        );

        const publishedIds: string[] = [];
        try {
          for (const row of rows) {
            await this.publisher.publish(row.payload);
            publishedIds.push(row.id);
          }
        } finally {
          // Mark what was confirmed even if a later publish failed, to avoid duplicates on retry.
          if (publishedIds.length > 0) {
            await tx.$executeRawUnsafe(
              'UPDATE outbox_events SET published_at = now() WHERE id = ANY($1::uuid[])',
              publishedIds,
            );
          }
        }
        return publishedIds.length;
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.relayPending();
    } catch (error) {
      this.logger.error(`Outbox relay failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
