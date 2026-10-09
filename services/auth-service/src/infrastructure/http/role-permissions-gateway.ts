import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_CLIENT, ResilientHttpClient } from '@toka/common';
import type Redis from 'ioredis';
import { PermissionsUnavailableError } from '../../domain/errors/domain-error';
import type { PermissionsProvider, UserAuthorization } from '../../application/ports/ports';
import type { AuthConfig } from '../config/auth-config';

export const ROLE_HTTP_CLIENT = Symbol('ROLE_HTTP_CLIENT');

const CACHE_TTL_SECONDS = 60 * 60;
export const PERMISSIONS_CACHE_PREFIX = 'auth:permissions:';
const cacheKey = (userId: string) => `${PERMISSIONS_CACHE_PREFIX}${userId}`;

export const createRoleHttpClient = (config: AuthConfig) =>
  new ResilientHttpClient({
    name: 'role-service',
    baseURL: config.roleServiceUrl,
    headers: { 'x-internal-key': config.internalApiKey },
  });

/**
 * Reads roles/permissions from role-service. The last good answer is cached so logins keep
 * working during a role-service outage (circuit open or timeouts); with no cache we answer 503.
 */
@Injectable()
export class RolePermissionsGateway implements PermissionsProvider {
  private readonly logger = new Logger(RolePermissionsGateway.name);

  constructor(
    @Inject(ROLE_HTTP_CLIENT) private readonly http: Pick<ResilientHttpClient, 'get'>,
    @Inject(REDIS_CLIENT) private readonly redis: Pick<Redis, 'get' | 'set'>,
  ) {}

  async getAuthorization(userId: string): Promise<UserAuthorization> {
    try {
      const { roles, permissions } = await this.http.get<UserAuthorization>(
        `/api/roles/internal/users/${userId}/permissions`,
      );
      const authorization = { roles, permissions };
      await this.redis.set(cacheKey(userId), JSON.stringify(authorization), 'EX', CACHE_TTL_SECONDS);
      return authorization;
    } catch (error) {
      const cached = await this.redis.get(cacheKey(userId));
      if (!cached) throw new PermissionsUnavailableError();
      this.logger.warn(
        `role-service unavailable (${error instanceof Error ? error.message : 'unknown'}); using cached permissions`,
      );
      return JSON.parse(cached) as UserAuthorization;
    }
  }
}
