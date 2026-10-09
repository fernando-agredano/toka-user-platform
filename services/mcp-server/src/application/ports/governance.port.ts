import type { Caller } from '../dtos/caller';

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface ToolRateLimiter {
  consume(userId: string): Promise<RateLimitDecision>;
}

export type InvocationOutcome = 'success' | 'preview' | 'error' | 'denied' | 'rate_limited';

/** Payload of the `mcp.tool.invoked` event: what was asked and what happened, never raw secrets. */
export interface ToolInvocationRecord {
  tool: string;
  arguments: Record<string, unknown>;
  outcome: InvocationOutcome;
  errorKind?: string;
  durationMs: number;
  userId: string;
  transport: Caller['transport'];
  ip: string | null;
}

export interface InvocationAuditor {
  record(invocation: ToolInvocationRecord): Promise<void>;
}

export interface Clock {
  now(): number;
}

export interface LogSink {
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
}

export interface DocsRepository {
  list(): Promise<Array<{ name: string; title: string }>>;
  read(name: string): Promise<string | null>;
}
