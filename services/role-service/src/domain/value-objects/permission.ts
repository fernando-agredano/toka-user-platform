import { InvalidPermissionError } from '../errors/domain-error';

/** Closed catalog (CONTEXTO §5): a typo in a role definition must fail loudly instead of silently granting nothing. */
export const PERMISSION_CATALOG = [
  'users:read',
  'users:write',
  'roles:read',
  'roles:write',
  'audit:read',
  'ai:use',
] as const;

export type Permission = (typeof PERMISSION_CATALOG)[number];

export function parsePermissions(raw: string[]): Permission[] {
  const unique = new Set<Permission>();
  for (const value of raw) {
    if (!(PERMISSION_CATALOG as readonly string[]).includes(value)) throw new InvalidPermissionError(value);
    unique.add(value as Permission);
  }
  return [...unique].sort();
}
