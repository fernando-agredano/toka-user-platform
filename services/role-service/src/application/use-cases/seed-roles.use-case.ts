import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Role } from '../../domain/entities/role';
import { RoleAlreadyExistsError } from '../../domain/errors/domain-error';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { PERMISSION_CATALOG } from '../../domain/value-objects/permission';
import { ADMIN_ROLE_NAME, DEFAULT_ROLE_NAME, RoleName } from '../../domain/value-objects/role-name';

export const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000001';

const SEED_ROLES = [
  { name: ADMIN_ROLE_NAME, description: 'Full access', permissions: [...PERMISSION_CATALOG] },
  {
    name: 'MANAGER',
    description: 'Manages users and reads roles and audit',
    permissions: ['users:read', 'users:write', 'roles:read', 'audit:read', 'ai:use'],
  },
  { name: DEFAULT_ROLE_NAME, description: 'Standard user', permissions: ['ai:use'] },
];

@Injectable()
export class SeedRolesUseCase {
  constructor(@Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository) {}

  /**
   * Creates the missing seed roles and gives the seed admin the ADMIN role. Never overwrites existing roles
   * and emits no events (same convention as the other services' admin seeds). Safe to run on every boot
   * and from several replicas at once.
   */
  async execute(): Promise<void> {
    for (const seed of SEED_ROLES) {
      const name = RoleName.create(seed.name);
      if (await this.roles.findByName(name)) continue;
      try {
        await this.roles.save(Role.create({ id: randomUUID(), ...seed, name }));
      } catch (error) {
        if (!(error instanceof RoleAlreadyExistsError)) throw error; // another replica won the race
      }
    }

    const admin = await this.roles.findByName(RoleName.create(ADMIN_ROLE_NAME));
    if (admin) await this.roles.assign(ADMIN_USER_ID, admin);
  }
}
