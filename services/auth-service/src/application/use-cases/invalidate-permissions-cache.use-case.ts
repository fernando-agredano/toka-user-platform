import { Inject, Injectable } from '@nestjs/common';
import { PERMISSIONS_CACHE_INVALIDATOR, PermissionsCacheInvalidator } from '../ports/ports';

/**
 * Reacts to role.assigned / role.revoked (targets one user) and role.permissions.updated (affects every holder).
 * Dropping the cache means a role-service outage can no longer be bridged with stale grants: login answers 503 instead.
 */
@Injectable()
export class InvalidatePermissionsCacheUseCase {
  constructor(@Inject(PERMISSIONS_CACHE_INVALIDATOR) private readonly cache: PermissionsCacheInvalidator) {}

  async execute(input: { userId?: string }): Promise<void> {
    if (input.userId) await this.cache.invalidateUser(input.userId);
    else await this.cache.invalidateAll();
  }
}
