import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT, blacklistKey } from '@toka/common';
import type Redis from 'ioredis';
import type { TokenBlacklist } from '../../application/ports/ports';

@Injectable()
export class RedisTokenBlacklist implements TokenBlacklist {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async blacklist(jti: string, expiresAt: number): Promise<void> {
    const ttl = expiresAt - Math.floor(Date.now() / 1000);
    if (ttl > 0) await this.redis.set(blacklistKey(jti), '1', 'EX', ttl);
  }
}
