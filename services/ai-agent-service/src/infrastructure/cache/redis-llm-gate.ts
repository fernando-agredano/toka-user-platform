import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { GateTimeoutError, type LlmGate } from '../../application/ports/rate-limit.port';

const WINDOW_MS = 60_000;
const POLL_JITTER_MS = 50;

// Sliding window over a sorted set. Returns 0 when a slot was taken, otherwise the ms until the oldest slot expires.
const SLIDING_WINDOW = `
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
if redis.call('ZCARD', KEYS[1]) < limit then
  redis.call('ZADD', KEYS[1], now, ARGV[3])
  redis.call('PEXPIRE', KEYS[1], window)
  return 0
end
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
return math.max(1, tonumber(oldest[2]) + window - now)
`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The provider's RPM quota belongs to the API key, not to a replica, so the window lives in Redis. */
export class RedisLlmGate implements LlmGate {
  constructor(
    private readonly redis: Redis,
    private readonly rpmLimit: number,
  ) {}

  async acquire(maxWaitMs: number): Promise<void> {
    const startedAt = Date.now();
    for (;;) {
      const waitMs = Number(await this.redis.eval(SLIDING_WINDOW, 1, 'ai:llm:rpm', this.rpmLimit, WINDOW_MS, randomUUID()));
      if (waitMs === 0) return;
      if (Date.now() - startedAt + waitMs > maxWaitMs) throw new GateTimeoutError(waitMs);
      await sleep(waitMs + Math.random() * POLL_JITTER_MS);
    }
  }
}
