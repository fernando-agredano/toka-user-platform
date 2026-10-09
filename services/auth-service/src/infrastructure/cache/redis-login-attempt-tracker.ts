import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@toka/common';
import type Redis from 'ioredis';
import type { LoginAttemptTracker } from '../../application/ports/ports';
import { AUTH_CONFIG, AuthConfig } from '../config/auth-config';

const failuresKey = (email: string) => `login:failures:${email}`;

/**
 * Counts failures per email in a fixed window that starts at the first failure.
 * Keyed by email (not IP) so distributed guessing against one account is also blocked;
 * the trade-off is that an attacker can lock out a known email for the window.
 */
@Injectable()
export class RedisLoginAttemptTracker implements LoginAttemptTracker {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async isLocked(email: string): Promise<boolean> {
    const attempts = Number((await this.redis.get(failuresKey(email))) ?? 0);
    return attempts >= this.config.lockout.maxAttempts;
  }

  async registerFailure(email: string): Promise<{ attempts: number; justLocked: boolean }> {
    const key = failuresKey(email);
    const results = await this.redis.multi().incr(key).expire(key, this.config.lockout.windowSeconds, 'NX').exec();
    const attempts = Number(results?.[0]?.[1] ?? 0);
    return { attempts, justLocked: attempts === this.config.lockout.maxAttempts };
  }

  async reset(email: string): Promise<void> {
    await this.redis.del(failuresKey(email));
  }
}
