import { InvalidRoleNameError } from '../errors/domain-error';

const ROLE_NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;

export const ADMIN_ROLE_NAME = 'ADMIN';
export const DEFAULT_ROLE_NAME = 'USER';

export class RoleName {
  private constructor(readonly value: string) {}

  static create(raw: string): RoleName {
    const normalized = raw.trim().toUpperCase();
    if (!ROLE_NAME_PATTERN.test(normalized)) throw new InvalidRoleNameError();
    return new RoleName(normalized);
  }

  equals(other: RoleName): boolean {
    return this.value === other.value;
  }
}
