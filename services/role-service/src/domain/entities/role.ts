import { LastAdminError, ProtectedRoleError } from '../errors/domain-error';
import { Permission, parsePermissions } from '../value-objects/permission';
import { ADMIN_ROLE_NAME, RoleName } from '../value-objects/role-name';

export interface RoleProps {
  id: string;
  name: RoleName;
  description: string;
  permissions: Permission[];
  createdAt: Date;
}

export class Role {
  private constructor(private props: RoleProps) {}

  static create(input: { id: string; name: RoleName; description: string; permissions: string[] }): Role {
    return new Role({
      id: input.id,
      name: input.name,
      description: input.description.trim(),
      permissions: parsePermissions(input.permissions),
      createdAt: new Date(),
    });
  }

  static restore(props: RoleProps): Role {
    return new Role({ ...props, permissions: [...props.permissions] });
  }

  get id(): string {
    return this.props.id;
  }

  get name(): RoleName {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get permissions(): readonly Permission[] {
    return this.props.permissions;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get isAdmin(): boolean {
    return this.props.name.value === ADMIN_ROLE_NAME;
  }

  /** Returns whether the permission set changed. ADMIN is immutable so nobody can lock the platform out. */
  replacePermissions(raw: string[]): boolean {
    if (this.isAdmin) throw new ProtectedRoleError();
    const next = parsePermissions(raw);
    if (next.join() === this.props.permissions.join()) return false;
    this.props = { ...this.props, permissions: next };
    return true;
  }

  /** Invariant: the last ADMIN can never be removed. `holders` counts the users that currently hold this role. */
  assertRevocable(holders: number): void {
    if (this.isAdmin && holders <= 1) throw new LastAdminError();
  }
}
