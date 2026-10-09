import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@toka/common';
import type Redis from 'ioredis';
import type { PermissionsCacheInvalidator } from '../../application/ports/ports';
import { PERMISSIONS_CACHE_PREFIX } from '../http/role-permissions-gateway';

const SCAN_BATCH = 200;

@Injectable()
export class RedisPermissionsCacheInvalidator implements PermissionsCacheInvalidator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async invalidateUser(userId: string): Promise<void> {
    await this.redis.del(`${PERMISSIONS_CACHE_PREFIX}${userId}`);
  }

  async invalidateAll(): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${PERMISSIONS_CACHE_PREFIX}*`, 'COUNT', SCAN_BATCH);
      if (keys.length > 0) await this.redis.del(...keys);
      cursor = next;
    } while (cursor !== '0');
  }
}
