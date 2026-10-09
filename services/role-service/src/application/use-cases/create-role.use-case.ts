import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Role } from '../../domain/entities/role';
import { RoleAlreadyExistsError } from '../../domain/errors/domain-error';
import { roleCreated } from '../../domain/events/role-events';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { RoleName } from '../../domain/value-objects/role-name';
import { RoleView, toRoleView } from '../dtos/role.dtos';

export interface CreateRoleInput {
  name: string;
  description: string;
  permissions: string[];
  actorId: string | null;
}

@Injectable()
export class CreateRoleUseCase {
  constructor(@Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository) {}

  async execute(input: CreateRoleInput): Promise<RoleView> {
    const role = Role.create({
      id: randomUUID(),
      name: RoleName.create(input.name),
      description: input.description,
      permissions: input.permissions,
    });
    if (await this.roles.findByName(role.name)) throw new RoleAlreadyExistsError();

    await this.roles.save(role, [roleCreated(role, input.actorId)]);
    return toRoleView(role);
  }
}
