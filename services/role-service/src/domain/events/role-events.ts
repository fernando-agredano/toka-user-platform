import type { Role } from '../entities/role';

export interface DomainEvent<T = Record<string, unknown>> {
  type: string;
  data: T;
  actor?: { userId?: string | null; ip?: string | null };
}

/** `actorId` is the user who triggered the change; null for system-driven changes. */
export const roleCreated = (role: Role, actorId: string | null): DomainEvent => ({
  type: 'role.created',
  data: { roleId: role.id, name: role.name.value, permissions: [...role.permissions] },
  actor: { userId: actorId },
});

export const rolePermissionsUpdated = (role: Role, actorId: string | null): DomainEvent => ({
  type: 'role.permissions.updated',
  data: { roleId: role.id, name: role.name.value, permissions: [...role.permissions] },
  actor: { userId: actorId },
});

export const roleAssigned = (role: Role, userId: string, actorId: string | null): DomainEvent => ({
  type: 'role.assigned',
  data: { userId, roleId: role.id, roleName: role.name.value },
  actor: { userId: actorId },
});

export const roleRevoked = (role: Role, userId: string, actorId: string | null): DomainEvent => ({
  type: 'role.revoked',
  data: { userId, roleId: role.id, roleName: role.name.value },
  actor: { userId: actorId },
});
