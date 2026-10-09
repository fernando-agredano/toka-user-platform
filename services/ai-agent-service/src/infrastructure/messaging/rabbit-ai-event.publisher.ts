import { Injectable } from '@nestjs/common';
import { EventPublisher, createEnvelope } from '@toka/common';
import type { AiEventPublisher, QueryCompletedEvent } from '../../application/ports/event-publisher.port';

const PUBLISH_TIMEOUT_MS = 5000;

@Injectable()
export class RabbitAiEventPublisher implements AiEventPublisher {
  constructor(private readonly publisher: EventPublisher) {}

  async queryCompleted(event: QueryCompletedEvent): Promise<void> {
    const envelope = createEnvelope('ai-agent-service', {
      type: 'ai.query.completed',
      data: event.data,
      actor: { userId: event.userId, ip: event.ip },
    });
    // While the broker is down a publish can wait indefinitely; the caller only logs, so cap the wait.
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('publish timed out')), PUBLISH_TIMEOUT_MS);
    });
    try {
      await Promise.race([this.publisher.publish(envelope), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
