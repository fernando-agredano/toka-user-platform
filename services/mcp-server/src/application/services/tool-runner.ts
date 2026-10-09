import { ToolExecutionError } from '../../domain/errors/tool-execution-error';
import { redactArguments } from '../../domain/services/untrusted-text';
import { type Caller, hasPermissions } from '../dtos/caller';
import type {
  Clock,
  InvocationAuditor,
  InvocationOutcome,
  LogSink,
  ToolRateLimiter,
} from '../ports/governance.port';
import type { ToolDefinition } from '../tools/tool-definition';

export interface ToolRunResult {
  isError: boolean;
  body: Record<string, unknown>;
}

export interface ToolRunnerDependencies {
  rateLimiter: ToolRateLimiter;
  auditor: InvocationAuditor;
  clock: Clock;
  logger: LogSink;
}

/** Governance around every tool call: rate limit, permission pre-check, uniform errors and an audit record. */
export class ToolRunner {
  constructor(private readonly deps: ToolRunnerDependencies) {}

  async run(tool: ToolDefinition, args: Record<string, unknown>, caller: Caller): Promise<ToolRunResult> {
    const startedAt = this.deps.clock.now();
    const finish = (outcome: InvocationOutcome, body: Record<string, unknown>, errorKind?: string): ToolRunResult => {
      this.audit(tool, args, caller, outcome, this.deps.clock.now() - startedAt, errorKind);
      return { isError: outcome !== 'success' && outcome !== 'preview', body };
    };

    const limit = await this.consumeQuota(caller);
    if (!limit.allowed) {
      return finish('rate_limited', errorBody('rate_limited', `Rate limit reached. Retry in ${limit.retryAfterSeconds}s.`), 'rate_limited');
    }

    if (!hasPermissions(caller, tool.permissions)) {
      const missing = tool.permissions.filter((permission) => !caller.permissions.includes(permission));
      return finish('denied', errorBody('forbidden', `Missing permission: ${missing.join(', ')}.`), 'forbidden');
    }

    try {
      const output = await tool.execute(args, caller);
      return finish(output.preview ? 'preview' : 'success', output.data);
    } catch (error) {
      if (error instanceof ToolExecutionError) return finish('error', errorBody(error.kind, error.message), error.kind);
      // Unknown failures are logged with detail but reported opaquely: no stack traces reach the assistant.
      this.deps.logger.error({ tool: tool.name, err: error instanceof Error ? error.message : String(error) }, 'Tool failed unexpectedly');
      return finish('error', errorBody('internal', 'Unexpected internal error.'), 'internal');
    }
  }

  /** A broken limiter must not turn into an outage of read-only access: fail open and say so in the log. */
  private async consumeQuota(caller: Caller) {
    try {
      return await this.deps.rateLimiter.consume(caller.userId);
    } catch (error) {
      this.deps.logger.warn({ err: error instanceof Error ? error.message : String(error) }, 'Rate limiter unavailable, allowing call');
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }

  /** Fire and forget: auditing is best effort and must never add broker latency to the tool call. */
  private audit(
    tool: ToolDefinition,
    args: Record<string, unknown>,
    caller: Caller,
    outcome: InvocationOutcome,
    durationMs: number,
    errorKind?: string,
  ): void {
    void this.deps.auditor
      .record({
        tool: tool.name,
        arguments: redactArguments(args),
        outcome,
        ...(errorKind && { errorKind }),
        durationMs,
        userId: caller.userId,
        transport: caller.transport,
        ip: caller.ip,
      })
      .catch((error: unknown) =>
        this.deps.logger.warn({ tool: tool.name, err: error instanceof Error ? error.message : String(error) }, 'Could not record tool invocation'),
      );
  }
}

const errorBody = (kind: string, message: string): Record<string, unknown> => ({ error: { kind, message } });
