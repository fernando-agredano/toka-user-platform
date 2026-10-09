import { Inject, Injectable } from '@nestjs/common';
import { RoleAssignmentNotFoundError, RoleNotFoundError } from '../../domain/errors/domain-error';
import { roleRevoked } from '../../domain/events/role-events';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { PERMISSIONS_CACHE, PermissionsCache } from '../ports/ports';

export interface RevokeRoleInput {
  userId: string;
  roleId: string;
  actorId: string | null;
}

@Injectable()
export class RevokeRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(PERMISSIONS_CACHE) private readonly cache: PermissionsCache,
  ) {}

  async execute(input: RevokeRoleInput): Promise<void> {
    const role = await this.roles.findById(input.roleId);
    if (!role) throw new RoleNotFoundError();

    const held = await this.roles.findByUser(input.userId);
    if (!held.some((candidate) => candidate.id === role.id)) throw new RoleAssignmentNotFoundError();

    role.assertRevocable(await this.roles.countHolders(role.id));
    await this.roles.revoke(input.userId, role, [roleRevoked(role, input.userId, input.actorId)]);
    await this.cache.invalidate([input.userId]);
  }
}
