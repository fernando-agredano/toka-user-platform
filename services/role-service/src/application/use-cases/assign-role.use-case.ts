import { Inject, Injectable } from '@nestjs/common';
import { RoleNotFoundError } from '../../domain/errors/domain-error';
import { roleAssigned } from '../../domain/events/role-events';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { PERMISSIONS_CACHE, PermissionsCache } from '../ports/ports';

export interface AssignRoleInput {
  userId: string;
  roleId: string;
  actorId: string | null;
}

/** Idempotent: re-assigning a held role writes nothing and emits no event. */
@Injectable()
export class AssignRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(PERMISSIONS_CACHE) private readonly cache: PermissionsCache,
  ) {}

  async execute(input: AssignRoleInput): Promise<void> {
    const role = await this.roles.findById(input.roleId);
    if (!role) throw new RoleNotFoundError();

    const held = await this.roles.findByUser(input.userId);
    if (held.some((candidate) => candidate.id === role.id)) return;

    await this.roles.assign(input.userId, role, [roleAssigned(role, input.userId, input.actorId)]);
    await this.cache.invalidate([input.userId]);
  }
}
