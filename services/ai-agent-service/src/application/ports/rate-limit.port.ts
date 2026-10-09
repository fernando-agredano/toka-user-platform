export const USER_RATE_LIMITER = Symbol('USER_RATE_LIMITER');
export const LLM_GATE = Symbol('LLM_GATE');

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface UserRateLimiter {
  consume(userId: string): Promise<RateLimitDecision>;
}

export class GateTimeoutError extends Error {
  constructor(readonly waitMs: number) {
    super(`No LLM quota slot available within the allowed wait (next one in ${waitMs}ms)`);
    this.name = 'GateTimeoutError';
  }
}

/** A quota shared by every replica: callers wait for a free slot, up to `maxWaitMs`, and then give up. */
export interface LlmGate {
  acquire(maxWaitMs: number): Promise<void>;
}
