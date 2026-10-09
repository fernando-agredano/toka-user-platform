import { Inject, Injectable } from '@nestjs/common';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { RoleView, toRoleView } from '../dtos/role.dtos';

@Injectable()
export class ListRolesUseCase {
  constructor(@Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository) {}

  async execute(): Promise<RoleView[]> {
    return (await this.roles.list()).map(toRoleView);
  }
}
