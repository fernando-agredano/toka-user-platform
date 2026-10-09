import type Redis from 'ioredis';
import type { RateLimitDecision, ToolRateLimiter } from '../../application/ports/governance.port';

// Fixed window evaluated atomically: the first call of a window creates the counter and its expiry together,
// so a crash can never leave a counter without TTL (which would block the user forever).
const FIXED_WINDOW = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { count, redis.call('PTTL', KEYS[1]) }
`;

const WINDOW_MS = 60_000;

export class RedisToolRateLimiter implements ToolRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly perMinute: number,
  ) {}

  async consume(userId: string): Promise<RateLimitDecision> {
    const [count, ttlMs] = (await this.redis.eval(FIXED_WINDOW, 1, `mcp:rl:${userId}`, WINDOW_MS)) as [number, number];
    return { allowed: count <= this.perMinute, retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)) };
  }
}

/** Per-process limiter for stdio, where there is no Redis to share state with. */
export class InMemoryToolRateLimiter implements ToolRateLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();

  constructor(
    private readonly perMinute: number,
    private readonly now: () => number = Date.now,
  ) {}

  async consume(userId: string): Promise<RateLimitDecision> {
    const now = this.now();
    const current = this.windows.get(userId);
    const window = current && now - current.startedAt < WINDOW_MS ? current : { startedAt: now, count: 0 };
    window.count += 1;
    this.windows.set(userId, window);
    return {
      allowed: window.count <= this.perMinute,
      retryAfterSeconds: Math.max(1, Math.ceil((window.startedAt + WINDOW_MS - now) / 1000)),
    };
  }
}
