import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from './authenticated-user';

/** For endpoints open to a resource's owner or to anyone holding `permission`. */
export function assertSelfOrPermission(user: AuthenticatedUser, ownerId: string, permission: string): void {
  if (user.userId !== ownerId && !user.permissions.includes(permission)) {
    throw new ForbiddenException('Insufficient permissions');
  }
}
