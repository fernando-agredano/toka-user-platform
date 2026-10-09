import { type EventPublisher, createEnvelope } from '@toka/common';
import type { InvocationAuditor, ToolInvocationRecord } from '../../application/ports/governance.port';

const PUBLISH_TIMEOUT_MS = 5000;

/** Publishes `mcp.tool.invoked` to the shared exchange; audit-service stores it like any other event. */
export class RabbitInvocationAuditor implements InvocationAuditor {
  constructor(private readonly publisher: EventPublisher) {}

  async record({ userId, ip, ...data }: ToolInvocationRecord): Promise<void> {
    const envelope = createEnvelope('mcp-server', { type: 'mcp.tool.invoked', data, actor: { userId, ip } });
    // While the broker is down a publish can wait indefinitely; cap the wait so the promise always settles.
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

/** stdio runs on a developer machine without broker access: the downstream services still audit their own events. */
export class NullInvocationAuditor implements InvocationAuditor {
  async record(): Promise<void> {}
}
