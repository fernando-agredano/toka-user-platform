import { Inject, Injectable } from '@nestjs/common';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { UserAuthorization } from '../dtos/role.dtos';
import { PERMISSIONS_CACHE, PermissionsCache } from '../ports/ports';

/** Roles and the union of their permissions. A user without assignments yields empty lists, never an error. */
@Injectable()
export class GetUserAuthorizationUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(PERMISSIONS_CACHE) private readonly cache: PermissionsCache,
  ) {}

  async execute(userId: string): Promise<UserAuthorization> {
    const cached = await this.cache.get(userId);
    if (cached) return cached;

    const roles = await this.roles.findByUser(userId);
    const authorization: UserAuthorization = {
      roles: roles.map((role) => role.name.value).sort(),
      permissions: [...new Set(roles.flatMap((role) => role.permissions))].sort(),
    };
    // Empty results are not cached: the USER role is assigned asynchronously right after registration.
    if (roles.length > 0) await this.cache.set(userId, authorization);
    return authorization;
  }
}
