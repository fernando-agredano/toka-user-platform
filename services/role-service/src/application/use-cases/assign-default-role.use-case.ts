import { Inject, Injectable } from '@nestjs/common';
import { RoleNotFoundError } from '../../domain/errors/domain-error';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { DEFAULT_ROLE_NAME, RoleName } from '../../domain/value-objects/role-name';
import { AssignRoleUseCase } from './assign-role.use-case';

/** Reacts to auth.user.registered. Throws if the seed role is missing so the consumer retries instead of dropping the user. */
@Injectable()
export class AssignDefaultRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    private readonly assignRole: AssignRoleUseCase,
  ) {}

  async execute(userId: string): Promise<void> {
    const role = await this.roles.findByName(RoleName.create(DEFAULT_ROLE_NAME));
    if (!role) throw new RoleNotFoundError();
    await this.assignRole.execute({ userId, roleId: role.id, actorId: null });
  }
}
