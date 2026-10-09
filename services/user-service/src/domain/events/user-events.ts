import type { User } from '../entities/user';

export interface DomainEvent<T = Record<string, unknown>> {
  type: string;
  data: T;
  actor?: { userId?: string | null; ip?: string | null };
}

/** `actorId` is the user who triggered the change; null for system-driven changes. */
export const userCreated = (user: User, actorId: string | null): DomainEvent => ({
  type: 'user.created',
  data: { userId: user.id, email: user.email.value, firstName: user.firstName.value, lastName: user.lastName.value },
  actor: { userId: actorId },
});

export const userUpdated = (user: User, actorId: string | null): DomainEvent => ({
  type: 'user.updated',
  data: { userId: user.id, firstName: user.firstName.value, lastName: user.lastName.value },
  actor: { userId: actorId },
});

export const userDeactivated = (user: User, actorId: string | null): DomainEvent => ({
  type: 'user.deactivated',
  data: { userId: user.id },
  actor: { userId: actorId },
});

export const userActivated = (user: User, actorId: string | null): DomainEvent => ({
  type: 'user.activated',
  data: { userId: user.id },
  actor: { userId: actorId },
});
