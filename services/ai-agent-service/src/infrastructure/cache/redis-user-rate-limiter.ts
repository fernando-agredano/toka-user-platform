import type Redis from 'ioredis';
import type { RateLimitDecision, UserRateLimiter } from '../../application/ports/rate-limit.port';

// Token bucket evaluated atomically in Redis, using the server clock so replicas never disagree on time.
const TOKEN_BUCKET = `
local capacity = tonumber(ARGV[1])
local refillPerMs = tonumber(ARGV[2])
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then tokens = capacity; ts = now end
tokens = math.min(capacity, tokens + (now - ts) * refillPerMs)
local allowed = 0
local retryMs = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  retryMs = math.ceil((1 - tokens) / refillPerMs)
end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(capacity / refillPerMs) + 1000)
return { allowed, retryMs }
`;

export class RedisUserRateLimiter implements UserRateLimiter {
  private readonly refillPerMs: number;

  constructor(
    private readonly redis: Redis,
    private readonly perMinute: number,
  ) {
    this.refillPerMs = perMinute / 60_000;
  }

  async consume(userId: string): Promise<RateLimitDecision> {
    const [allowed, retryMs] = (await this.redis.eval(
      TOKEN_BUCKET,
      1,
      `ai:rl:${userId}`,
      this.perMinute,
      this.refillPerMs,
    )) as [number, number];
    return { allowed: allowed === 1, retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)) };
  }
}
