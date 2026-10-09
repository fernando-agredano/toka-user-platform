import { Inject, Injectable } from '@nestjs/common';
import { RoleNotFoundError } from '../../domain/errors/domain-error';
import { rolePermissionsUpdated } from '../../domain/events/role-events';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { RoleView, toRoleView } from '../dtos/role.dtos';
import { PERMISSIONS_CACHE, PermissionsCache } from '../ports/ports';

export interface UpdateRolePermissionsInput {
  roleId: string;
  permissions: string[];
  actorId: string | null;
}

@Injectable()
export class UpdateRolePermissionsUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(PERMISSIONS_CACHE) private readonly cache: PermissionsCache,
  ) {}

  async execute(input: UpdateRolePermissionsInput): Promise<RoleView> {
    const role = await this.roles.findById(input.roleId);
    if (!role) throw new RoleNotFoundError();

    if (role.replacePermissions(input.permissions)) {
      await this.roles.save(role, [rolePermissionsUpdated(role, input.actorId)]);
      await this.cache.invalidate(await this.roles.findHolderIds(role.id));
    }
    return toRoleView(role);
  }
}
