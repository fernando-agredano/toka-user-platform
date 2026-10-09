import type { Role } from '../entities/role';
import type { DomainEvent } from '../events/role-events';
import type { RoleName } from '../value-objects/role-name';

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

export interface RoleRepository {
  findById(id: string): Promise<Role | null>;
  findByName(name: RoleName): Promise<Role | null>;
  list(): Promise<Role[]>;
  findByUser(userId: string): Promise<Role[]>;
  countHolders(roleId: string): Promise<number>;
  findHolderIds(roleId: string): Promise<string[]>;
  /**
   * Upserts the role and its permissions with the events it produced, atomically (transactional outbox).
   * Throws RoleAlreadyExistsError on a duplicate name.
   */
  save(role: Role, events?: DomainEvent[]): Promise<void>;
  /** Idempotent: assigning a role the user already holds is a no-op. */
  assign(userId: string, role: Role, events?: DomainEvent[]): Promise<void>;
  /**
   * Removes the assignment. Implementations must serialize concurrent revocations of the same role
   * and re-check `role.assertRevocable` under that lock, so two admins cannot remove each other.
   */
  revoke(userId: string, role: Role, events?: DomainEvent[]): Promise<void>;
}
