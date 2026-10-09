import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@toka/common';
import type Redis from 'ioredis';
import type { UserView } from '../../application/dtos/user.dtos';
import type { UserCache } from '../../application/ports/ports';
import { USER_CONFIG, UserConfig } from '../config/user-config';

const cacheKey = (userId: string) => `user:${userId}`;

@Injectable()
export class RedisUserCache implements UserCache {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(USER_CONFIG) private readonly config: UserConfig,
  ) {}

  async get(userId: string): Promise<UserView | null> {
    const raw = await this.redis.get(cacheKey(userId));
    return raw ? (JSON.parse(raw) as UserView) : null;
  }

  async set(user: UserView): Promise<void> {
    await this.redis.set(cacheKey(user.id), JSON.stringify(user), 'EX', this.config.cacheTtlSeconds);
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.del(cacheKey(userId));
  }
}
