import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@toka/common';
import type Redis from 'ioredis';
import { InvalidRefreshTokenError } from '../../domain/errors/domain-error';
import type { IssuedRefreshToken, RefreshTokenStore } from '../../application/ports/ports';
import { AUTH_CONFIG, AuthConfig } from '../config/auth-config';

// Only the SHA-256 of a token is stored, so a Redis leak does not expose usable tokens.
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const tokenKey = (hash: string) => `refresh:${hash}`;
const usedKey = (hash: string) => `refresh:used:${hash}`;
const userSetKey = (userId: string) => `refresh:user:${userId}`;

@Injectable()
export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async issue(userId: string): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const hash = hashToken(token);
    const ttl = this.config.refreshTtlSeconds;
    await this.redis
      .multi()
      .set(tokenKey(hash), userId, 'EX', ttl)
      .sadd(userSetKey(userId), hash)
      .expire(userSetKey(userId), ttl)
      .exec();
    return { token, ttlSeconds: ttl };
  }

  async rotate(token: string): Promise<{ userId: string; next: IssuedRefreshToken }> {
    const hash = hashToken(token);
    const userId = await this.redis.getdel(tokenKey(hash));

    if (!userId) {
      // A token that was already rotated being presented again means it leaked: kill every session of that user.
      const reusedBy = await this.redis.get(usedKey(hash));
      if (reusedBy) await this.revokeAllForUser(reusedBy);
      throw new InvalidRefreshTokenError();
    }

    await this.redis.multi().set(usedKey(hash), userId, 'EX', this.config.refreshTtlSeconds).srem(userSetKey(userId), hash).exec();
    return { userId, next: await this.issue(userId) };
  }

  async revoke(token: string): Promise<void> {
    const hash = hashToken(token);
    const userId = await this.redis.getdel(tokenKey(hash));
    if (userId) await this.redis.srem(userSetKey(userId), hash);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const hashes = await this.redis.smembers(userSetKey(userId));
    await this.redis.del(userSetKey(userId), ...hashes.map(tokenKey));
  }
}
