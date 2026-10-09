export interface SessionUser {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export const hasPermission = (user: SessionUser, permission: string): boolean => user.permissions.includes(permission);
