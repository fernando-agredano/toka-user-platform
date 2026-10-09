import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@toka/common';
import type Redis from 'ioredis';
import type { UserAuthorization } from '../../application/dtos/role.dtos';
import type { PermissionsCache } from '../../application/ports/ports';
import { ROLE_CONFIG, RoleConfig } from '../config/role-config';

const cacheKey = (userId: string) => `perms:${userId}`;

@Injectable()
export class RedisPermissionsCache implements PermissionsCache {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(ROLE_CONFIG) private readonly config: RoleConfig,
  ) {}

  async get(userId: string): Promise<UserAuthorization | null> {
    const raw = await this.redis.get(cacheKey(userId));
    return raw ? (JSON.parse(raw) as UserAuthorization) : null;
  }

  async set(userId: string, authorization: UserAuthorization): Promise<void> {
    await this.redis.set(cacheKey(userId), JSON.stringify(authorization), 'EX', this.config.permissionsCacheTtlSeconds);
  }

  async invalidate(userIds: string[]): Promise<void> {
    if (userIds.length > 0) await this.redis.del(...userIds.map(cacheKey));
  }
}
