import type { UserAuthorization } from '../../../src/application/dtos/role.dtos';
import type { PermissionsCache } from '../../../src/application/ports/ports';
import { Role } from '../../../src/domain/entities/role';
import { RoleAlreadyExistsError } from '../../../src/domain/errors/domain-error';
import type { DomainEvent } from '../../../src/domain/events/role-events';
import type { RoleRepository } from '../../../src/domain/repositories/role.repository';
import { RoleName } from '../../../src/domain/value-objects/role-name';

export class InMemoryRoleRepository implements RoleRepository {
  readonly roles = new Map<string, Role>();
  /** roleId -> userIds */
  readonly holders = new Map<string, Set<string>>();
  readonly savedEvents: DomainEvent[] = [];

  async findById(id: string) {
    return this.roles.get(id) ?? null;
  }

  async findByName(name: RoleName) {
    return [...this.roles.values()].find((role) => role.name.equals(name)) ?? null;
  }

  async list() {
    return [...this.roles.values()];
  }

  async findByUser(userId: string) {
    return [...this.roles.values()].filter((role) => this.holders.get(role.id)?.has(userId));
  }

  async countHolders(roleId: string) {
    return this.holders.get(roleId)?.size ?? 0;
  }

  async findHolderIds(roleId: string) {
    return [...(this.holders.get(roleId) ?? [])];
  }

  async save(role: Role, events: DomainEvent[] = []) {
    const clash = await this.findByName(role.name);
    if (clash && clash.id !== role.id) throw new RoleAlreadyExistsError();
    this.roles.set(role.id, role);
    this.savedEvents.push(...events);
  }

  async assign(userId: string, role: Role, events: DomainEvent[] = []) {
    this.holders.set(role.id, (this.holders.get(role.id) ?? new Set()).add(userId));
    this.savedEvents.push(...events);
  }

  async revoke(userId: string, role: Role, events: DomainEvent[] = []) {
    role.assertRevocable(await this.countHolders(role.id));
    this.holders.get(role.id)?.delete(userId);
    this.savedEvents.push(...events);
  }

  eventTypes() {
    return this.savedEvents.map((event) => event.type);
  }
}

export class InMemoryPermissionsCache implements PermissionsCache {
  readonly entries = new Map<string, UserAuthorization>();

  async get(userId: string) {
    return this.entries.get(userId) ?? null;
  }

  async set(userId: string, authorization: UserAuthorization) {
    this.entries.set(userId, authorization);
  }

  async invalidate(userIds: string[]) {
    for (const userId of userIds) this.entries.delete(userId);
  }
}

let counter = 0;
export const buildRole = (name: string, permissions: string[] = [], description = '') =>
  Role.create({ id: `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`, name: RoleName.create(name), description, permissions });
